// The replay. Walks the window one day at a time.
//
// Each day: take in whatever the bank heard about today, then close the day by
// assessing overdraft fees. On the last day, capitalise the interest.
//
// Nothing is ever looked at out of order, because a fee booked on one day
// changes what the next day is worth.

import { Money } from './money.js';
import { Ledger, ENTRY_REASONS } from './ledger.js';
import { EVENT_TYPES } from './events.js';
import { balanceOn } from './balances.js';
import { splitEvenly } from './allocate.js';
import { applyAuthorization, applySettlement, availableBalance, heldTotal, authorizationStates } from './holds.js';
import { assessFeesAtClose } from './fees.js';
import { capitaliseInterest } from './interest.js';
import { ACCOUNTS, EVENTS, WINDOW_DAYS, accountOf } from './stream.js';

/** A credit, either as one entry or split into instalments. */
function applyCredit(ledger, event) {
  const parts = event.instalments ? splitEvenly(event.amount, event.instalments) : [event.amount];

  return parts.map((amount, index) =>
    ledger.post({
      account: event.account,
      amount,
      valueDate: event.valueDate,
      bookedOn: event.bookedOn,
      reason: ENTRY_REASONS.CREDIT,
      sourceEvent: event.id,
      note: event.instalments ? `instalment ${index + 1} of ${event.instalments}` : '',
    })
  );
}

/**
 * A reversal. The original entry stays exactly where it is. What gets added is
 * an equal and opposite entry pointing back at it.
 */
function applyReversal(ledger, event) {
  const originals = ledger.entries(event.account).filter((entry) => entry.sourceEvent === event.reverses);

  if (originals.length === 0) {
    ledger.refuse({
      account: event.account,
      day: event.bookedOn,
      sourceEvent: event.id,
      reason: `nothing to reverse, ${event.reverses} was never posted`,
    });
    return { reversed: false, entries: [] };
  }

  const already = ledger
    .entries(event.account)
    .some((entry) => entry.reason === ENTRY_REASONS.REVERSAL && entry.note === `reverses ${event.reverses}`);

  if (already) {
    ledger.refuse({
      account: event.account,
      day: event.bookedOn,
      sourceEvent: event.id,
      reason: `${event.reverses} has already been reversed`,
    });
    return { reversed: false, entries: [] };
  }

  const entries = originals.map((original) =>
    ledger.post({
      account: event.account,
      amount: original.amount.negated(),
      valueDate: event.valueDate,
      bookedOn: event.bookedOn,
      reason: ENTRY_REASONS.REVERSAL,
      sourceEvent: event.id,
      note: `reverses ${event.reverses}`,
    })
  );

  return { reversed: true, entries };
}

/** Hand one event to whichever rule deals with it. */
function applyEvent(ledger, event) {
  const account = accountOf(event.account);
  if (!account) {
    throw new Error(`Event ${event.id} names an account that does not exist: ${event.account}`);
  }

  const options = { currency: account.currency };

  switch (event.type) {
    case EVENT_TYPES.CREDIT: {
      const entries = applyCredit(ledger, event);
      return { event, outcome: 'posted', detail: entries.length > 1 ? `${entries.length} instalments` : '' };
    }
    case EVENT_TYPES.DEBIT: {
      ledger.post({
        account: event.account,
        amount: event.amount.negated(),
        valueDate: event.valueDate,
        bookedOn: event.bookedOn,
        reason: ENTRY_REASONS.DEBIT,
        sourceEvent: event.id,
      });
      return { event, outcome: 'posted', detail: '' };
    }
    case EVENT_TYPES.AUTHORIZATION: {
      const result = applyAuthorization(ledger, event, options);
      return {
        event,
        outcome: result.approved ? 'approved' : 'declined',
        detail: result.approved
          ? `available ${result.available.format()} to ${result.afterHold.format()}`
          : `available ${result.available.format()}, hold would leave ${result.afterHold.format()}`,
      };
    }
    case EVENT_TYPES.SETTLEMENT: {
      const result = applySettlement(ledger, event, options);
      return {
        event,
        outcome: result.settled ? 'settled' : 'refused',
        detail: result.settled ? `released ${result.released.format()} back` : `no authorisation ${event.authId}`,
      };
    }
    case EVENT_TYPES.REVERSAL: {
      const result = applyReversal(ledger, event);
      return { event, outcome: result.reversed ? 'reversed' : 'refused', detail: `target ${event.reverses}` };
    }
    default:
      throw new Error(`No rule for event type ${event.type}.`);
  }
}

/** Earlier days whose closing balance changed because of what arrived today. */
function daysRewrittenBy(ledger, { account, currency, day }) {
  const changed = [];

  for (let earlier = 1; earlier < day; earlier += 1) {
    const before = balanceOn(ledger, { account, currency, day: earlier, asKnownOn: day - 1 });
    const after = balanceOn(ledger, { account, currency, day: earlier, asKnownOn: day });
    if (!before.equals(after)) changed.push({ day: earlier, before, after });
  }

  return changed;
}

/**
 * Replay the whole window.
 *
 * @returns {{ ledger: Ledger, days: object[], accounts: object[] }}
 */
export function replay({ accounts = ACCOUNTS, events = EVENTS, days = WINDOW_DAYS } = {}) {
  const ledger = new Ledger();
  const report = [];

  for (let day = 1; day <= days; day += 1) {
    const arriving = events.filter((event) => event.bookedOn === day);
    const outcomes = arriving.map((event) => applyEvent(ledger, event));

    const perAccount = accounts.map((account) => {
      const where = { account: account.id, currency: account.currency };

      // Earlier days are checked before this day's fees are booked, so the
      // rewrite shown is the one caused by the events, not by our own fees.
      const rewritten = daysRewrittenBy(ledger, { ...where, day });
      const fees = assessFeesAtClose(ledger, { ...where, closingDay: day });
      const interest = day === days ? capitaliseInterest(ledger, { ...where, days, onDay: day }) : null;

      return {
        ...account,
        rewritten,
        fees,
        interest,
        closing: balanceOn(ledger, { ...where, day, asKnownOn: day }),
        available: availableBalance(ledger, { ...where, day, asKnownOn: day }),
        held: heldTotal(ledger, { ...where, upToDay: day }),
        authorizations: authorizationStates(ledger, { account: account.id, upToDay: day }),
        errors: ledger.refusals(account.id).filter((refusal) => refusal.day === day),
      };
    });

    report.push({ day, outcomes, accounts: perAccount });
  }

  return { ledger, days: report, accounts };
}

/** Closing figures for each account at the end of the window. */
export function finalPositions(result) {
  const last = result.days[result.days.length - 1];
  return last.accounts.map((account) => ({
    id: account.id,
    currency: account.currency,
    closing: account.closing,
    interest: account.interest ? account.interest.total : Money.zero(account.currency),
  }));
}

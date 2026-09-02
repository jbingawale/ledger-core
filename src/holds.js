// Holds: money that is spoken for but has not moved yet.
//
// Tap your card at a hotel and the money is not taken, it is set aside. So an
// account has two figures. The ledger balance is what has actually moved. The
// available balance is that minus everything still on hold.
//
// An authorisation is approved only if the available balance is still zero or
// better once the hold is applied. A settlement closes its hold and turns it
// into a real entry. A settlement with no authorisation behind it is refused
// and nothing moves.

import { RECORD_KINDS, ENTRY_REASONS } from './ledger.js';
import { balanceOn } from './balances.js';
import { Money } from './money.js';

const ALWAYS = Number.POSITIVE_INFINITY;

export const AUTH_STATES = Object.freeze({
  OPEN: 'OPEN',           // approved, money still set aside
  SETTLED: 'SETTLED',     // closed, money has moved
  DECLINED: 'DECLINED',   // refused, nothing set aside
});

/** Holds still open for an account, in the order they were placed. */
export function activeHolds(ledger, { account, upToDay = ALWAYS }) {
  const open = new Map();

  for (const record of ledger.all()) {
    if (record.account !== account || record.day > upToDay) continue;
    if (record.kind === RECORD_KINDS.HOLD_OPENED) open.set(record.authId, record);
    if (record.kind === RECORD_KINDS.HOLD_CLOSED) open.delete(record.authId);
  }

  return [...open.values()];
}

/** Everything still set aside on an account. */
export function heldTotal(ledger, { account, currency, upToDay = ALWAYS }) {
  const holds = activeHolds(ledger, { account, upToDay });
  return Money.sum(currency, holds.map((hold) => hold.amount));
}

/** Ledger balance minus the holds. What the customer can actually spend. */
export function availableBalance(ledger, { account, currency, day, asKnownOn = ALWAYS }) {
  const balance = balanceOn(ledger, { account, currency, day, asKnownOn });
  return balance.minus(heldTotal(ledger, { account, currency, upToDay: day }));
}

/** What happened to every authorisation on an account. */
export function authorizationStates(ledger, { account, upToDay = ALWAYS }) {
  const states = new Map();

  for (const record of ledger.all()) {
    if (record.account !== account || record.day > upToDay) continue;

    if (record.kind === RECORD_KINDS.HOLD_OPENED) {
      states.set(record.authId, { authId: record.authId, state: AUTH_STATES.OPEN, amount: record.amount, day: record.day });
    }
    if (record.kind === RECORD_KINDS.HOLD_CLOSED) {
      const existing = states.get(record.authId);
      if (existing) states.set(record.authId, { ...existing, state: AUTH_STATES.SETTLED, closedOn: record.day });
    }
    if (record.kind === RECORD_KINDS.REFUSAL && record.authId) {
      states.set(record.authId, { authId: record.authId, state: AUTH_STATES.DECLINED, amount: record.amount, day: record.day });
    }
  }

  return [...states.values()];
}

/**
 * Handle an authorisation request. Approves and opens a hold, or declines and
 * records why. Either way the ledger balance is untouched.
 */
export function applyAuthorization(ledger, event, { currency }) {
  const day = event.valueDate;
  const available = availableBalance(ledger, { account: event.account, currency, day, asKnownOn: event.bookedOn });
  const afterHold = available.minus(event.amount);

  if (afterHold.isNegative()) {
    ledger.refuse({
      account: event.account,
      day: event.bookedOn,
      sourceEvent: event.id,
      authId: event.authId,
      amount: event.amount,
      reason: `available balance ${available.toString()} cannot cover a hold of ${event.amount.format()}, it would leave ${afterHold.format()}`,
    });
    return { approved: false, available, afterHold };
  }

  ledger.openHold({
    account: event.account,
    authId: event.authId,
    amount: event.amount,
    day,
    sourceEvent: event.id,
  });

  return { approved: true, available, afterHold };
}

/**
 * Handle a settlement. Closes the matching hold and books the real entry.
 * With no matching hold nothing is booked, so the funds never leave.
 */
export function applySettlement(ledger, event, { currency }) {
  const hold = activeHolds(ledger, { account: event.account, upToDay: event.valueDate })
    .find((h) => h.authId === event.authId);

  if (!hold) {
    ledger.refuse({
      account: event.account,
      day: event.bookedOn,
      sourceEvent: event.id,
      authId: event.authId,
      amount: event.amount,
      reason: `no open authorisation ${event.authId} to settle against, funds not moved`,
    });
    return { settled: false, hold: null };
  }

  // The hold closes in full, whatever the settled amount turns out to be.
  // Auth-A holds 200.00 and settles for 185.00, so 15.00 goes straight back.
  ledger.closeHold({
    account: event.account,
    authId: event.authId,
    day: event.valueDate,
    sourceEvent: event.id,
    note: `settled ${event.amount.format()} against a hold of ${hold.amount.format()}`,
  });

  ledger.post({
    account: event.account,
    amount: event.amount.negated(),
    valueDate: event.valueDate,
    bookedOn: event.bookedOn,
    reason: ENTRY_REASONS.SETTLEMENT,
    sourceEvent: event.id,
    note: `settles ${event.authId}`,
  });

  return { settled: true, hold, released: hold.amount.minus(event.amount) };
}

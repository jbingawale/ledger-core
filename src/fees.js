// Overdraft fees.
//
// AED 25.00, once per day per account, on any day that closes below zero.
//
// Two things make this harder than it looks.
//
// First, a fee is itself a ledger entry, so it drags the next day down and can
// trigger a further fee. That is why the days are walked in order and each fee
// is booked before the next day is looked at.
//
// Second, a backdated debit can reveal that a day which already closed was
// actually negative. We charge for it when we find out, dated the day it went
// negative. If a later reversal lifts that day back above zero, the fee still
// stands. The ledger is append only, and the account really was overdrawn as
// far as anyone knew at the time.

import { Money } from './money.js';
import { ENTRY_REASONS } from './ledger.js';
import { balanceOn } from './balances.js';

/** The fee itself. See NUMBERS.md N-01. */
export const OVERDRAFT_FEE = Money.of('AED', '25.00');

/** Days this account has already been charged for. */
function alreadyCharged(ledger, account) {
  return new Set(
    ledger
      .entries(account)
      .filter((entry) => entry.reason === ENTRY_REASONS.OVERDRAFT_FEE)
      .map((entry) => entry.valueDate)
  );
}

/**
 * Assess fees at the close of one day, looking back over every day up to it.
 *
 * @returns {{ day: number, amount: Money }[]} fees charged by this run
 */
export function assessFeesAtClose(ledger, { account, currency, closingDay, fee = OVERDRAFT_FEE }) {
  // The fee is written in AED. An account in another currency cannot be charged
  // it, so we record why instead of quietly converting. See AMBIGUITIES.md A-12.
  if (currency !== fee.currency) {
    const negative = balanceOn(ledger, { account, currency, day: closingDay, asKnownOn: closingDay }).isNegative();
    if (negative) {
      ledger.refuse({
        account,
        day: closingDay,
        sourceEvent: `FEE-${account}-D${closingDay}`,
        reason: `overdraft fee is set in ${fee.currency} and this account is in ${currency}, no fee charged`,
      });
    }
    return [];
  }

  const charged = alreadyCharged(ledger, account);
  const assessed = [];

  for (let day = 1; day <= closingDay; day += 1) {
    if (charged.has(day)) continue;

    // Read the balance fresh each time, so a fee booked a moment ago for an
    // earlier day is already counted in this one.
    const balance = balanceOn(ledger, { account, currency, day, asKnownOn: closingDay });
    if (!balance.isNegative()) continue;

    ledger.post({
      account,
      amount: fee.negated(),
      valueDate: day,
      bookedOn: closingDay,
      reason: ENTRY_REASONS.OVERDRAFT_FEE,
      sourceEvent: `FEE-${account}-D${day}`,
      note: `day ${day} closed at ${balance.format()}`,
    });

    charged.add(day);
    assessed.push({ day, amount: fee, closingBalance: balance });
  }

  return assessed;
}

/** Every fee charged to an account so far. */
export function feesFor(ledger, account) {
  return ledger.entries(account).filter((entry) => entry.reason === ENTRY_REASONS.OVERDRAFT_FEE);
}

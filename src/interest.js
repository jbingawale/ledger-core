// Daily interest.
//
// 0.04% a day on the closing balance, positive days only, paid as one credit at
// the end of day 6.
//
// The rule that matters: the rounded daily figures must add up to exactly the
// one credit that gets paid. Those two numbers do not agree on their own. For
// ACC-001 the six days round to 0.93 individually, while the true total for the
// week rounds to 0.92. Something has to give.
//
// We work out the true total first, round it once, then share that total back
// across the days using the same largest remainder splitter the instalments
// use. So the daily figures always add up to the credit, and one day carries
// the adjustment where anyone can see it.

import { Money } from './money.js';
import { ENTRY_REASONS } from './ledger.js';
import { distribute } from './allocate.js';

/** 0.04% per day, held as a fraction so no decimal is ever involved. */
export const DAILY_RATE = Object.freeze({ numerator: 4, denominator: 10000 });

/** Round a fraction to the nearest whole number, halves going up. */
function roundHalfUp(numerator, denominator) {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * Closing balance for a day, ignoring interest already paid.
 * Interest is worked out on what the account did, not on its own interest.
 */
function balanceForAccrual(ledger, { account, currency, day, asKnownOn }) {
  const entries = ledger
    .entries(account)
    .filter((entry) => entry.valueDate <= day && entry.bookedOn <= asKnownOn && entry.reason !== ENTRY_REASONS.INTEREST);

  return Money.sum(currency, entries.map((entry) => entry.amount));
}

/**
 * Work out the interest for the window without booking anything.
 *
 * @returns {{ daily: { day: number, balance: Money, amount: Money }[], total: Money }}
 */
export function accrueInterest(ledger, { account, currency, days = 6, rate = DAILY_RATE }) {
  const balances = [];
  for (let day = 1; day <= days; day += 1) {
    balances.push(balanceForAccrual(ledger, { account, currency, day, asKnownOn: days }));
  }

  // Negative and zero days earn nothing, so they carry no weight in the split.
  const weights = balances.map((balance) => (balance.isPositive() ? balance.minor : 0));
  const earning = weights.reduce((a, b) => a + b, 0);

  if (earning === 0) {
    return {
      daily: balances.map((balance, index) => ({ day: index + 1, balance, amount: Money.zero(currency) })),
      total: Money.zero(currency),
    };
  }

  // The whole week's interest, rounded once.
  const total = Money.fromMinor(currency, roundHalfUp(earning * rate.numerator, rate.denominator));

  // Shared back over the days, so the parts add up to the total by construction.
  const shares = distribute(total, weights);

  return {
    daily: balances.map((balance, index) => ({ day: index + 1, balance, amount: shares[index] })),
    total,
  };
}

/**
 * Work out the interest and book it as one credit.
 * Returns the same breakdown so the report can show the daily figures.
 */
export function capitaliseInterest(ledger, { account, currency, days = 6, onDay = days, rate = DAILY_RATE }) {
  const accrual = accrueInterest(ledger, { account, currency, days, rate });

  if (accrual.total.isZero()) {
    return accrual;
  }

  ledger.post({
    account,
    amount: accrual.total,
    valueDate: onDay,
    bookedOn: onDay,
    reason: ENTRY_REASONS.INTEREST,
    sourceEvent: `INTEREST-${account}-D${onDay}`,
    note: `${accrual.daily.filter((d) => !d.amount.isZero()).length} days of accrual, capitalised in one credit`,
  });

  return accrual;
}

/** What each day would round to on its own, ignoring the total. Used to show why that fails. */
export function naiveDailyAmounts(ledger, { account, currency, days = 6, rate = DAILY_RATE }) {
  const out = [];
  for (let day = 1; day <= days; day += 1) {
    const balance = balanceForAccrual(ledger, { account, currency, day, asKnownOn: days });
    const minor = balance.isPositive() ? roundHalfUp(balance.minor * rate.numerator, rate.denominator) : 0;
    out.push(Money.fromMinor(currency, minor));
  }
  return out;
}

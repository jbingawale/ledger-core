// Balances are never stored. They are worked out by adding up entries.
//
// The closing balance for a day is every entry whose value date is on or before
// that day. Not every entry booked by that day. That difference is what lets a
// debit arriving on day 5 change what day 2 was worth.
//
// Because of that, a balance is only true "as far as we knew on day X". Ask for
// day 2 on day 4 and you get one answer. Ask again on day 5, after the backdated
// debit arrives, and you get another. Both are correct.

import { Money } from './money.js';

const ALWAYS = Number.POSITIVE_INFINITY;

/**
 * Entries that count towards one account's balance on a given day.
 *
 * @param {import('./ledger.js').Ledger} ledger
 * @param {object} opts
 * @param {string} opts.account
 * @param {number} opts.day value dates up to and including this day
 * @param {number} [opts.asKnownOn] only entries booked by this day. Leave out for everything.
 */
export function entriesFor(ledger, { account, day, asKnownOn = ALWAYS }) {
  return ledger
    .entries(account)
    .filter((entry) => entry.valueDate <= day && entry.bookedOn <= asKnownOn);
}

/** Closing ledger balance for one day. */
export function balanceOn(ledger, { account, currency, day, asKnownOn = ALWAYS }) {
  const entries = entriesFor(ledger, { account, day, asKnownOn });
  return Money.sum(currency, entries.map((entry) => entry.amount));
}

/**
 * Closing balance for every day in the window.
 * @returns {{ day: number, balance: Money }[]}
 */
export function balancesByDay(ledger, { account, currency, days, asKnownOn = ALWAYS }) {
  const result = [];
  for (let day = 1; day <= days; day += 1) {
    result.push({ day, balance: balanceOn(ledger, { account, currency, day, asKnownOn }) });
  }
  return result;
}

/**
 * What changed on one day, meaning entries whose value date is that exact day.
 * Handy for the report, where a running total alone hides the reason.
 */
export function movementsOn(ledger, { account, day, asKnownOn = ALWAYS }) {
  return ledger
    .entries(account)
    .filter((entry) => entry.valueDate === day && entry.bookedOn <= asKnownOn);
}

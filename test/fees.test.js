import test from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../src/money.js';
import { Ledger, ENTRY_REASONS } from '../src/ledger.js';
import { balanceOn } from '../src/balances.js';
import { assessFeesAtClose, feesFor, OVERDRAFT_FEE } from '../src/fees.js';

const aed = (text) => Money.of('AED', text);
const acc = { account: 'ACC-001', currency: 'AED' };

const post = (ledger, sourceEvent, amount, valueDate, bookedOn, reason) =>
  ledger.post({ account: 'ACC-001', amount: aed(amount), valueDate, bookedOn, reason, sourceEvent });

const bal = (ledger, day, asKnownOn) =>
  balanceOn(ledger, { ...acc, day, asKnownOn }).format();

/**
 * The real stream for ACC-001, with fees assessed at the close of every day the
 * way the replay does it. Entries only appear once their booking day arrives.
 */
function runToDay(lastDay) {
  const ledger = new Ledger();
  const fees = [];

  const arrivals = {
    1: () => {
      post(ledger, 'E1', '1200.00', 1, 1, ENTRY_REASONS.CREDIT);
      post(ledger, 'E2', '-950.00', 1, 1, ENTRY_REASONS.DEBIT);
    },
    3: () => post(ledger, 'E4', '400.00', 3, 3, ENTRY_REASONS.CREDIT),
    4: () => post(ledger, 'E5', '-185.00', 4, 4, ENTRY_REASONS.SETTLEMENT),
    5: () => post(ledger, 'E7', '-620.00', 2, 5, ENTRY_REASONS.DEBIT),
    6: () => post(ledger, 'E9', '620.00', 2, 6, ENTRY_REASONS.REVERSAL),
  };

  for (let day = 1; day <= lastDay; day += 1) {
    arrivals[day]?.();
    fees.push(...assessFeesAtClose(ledger, { ...acc, closingDay: day }));
  }

  return { ledger, fees };
}

test('no fee while every day closes above zero', () => {
  const { fees } = runToDay(4);
  assert.equal(fees.length, 0);
});

test('E7 causes three fees, not one', () => {
  // Criterion C-02 claims exactly one fee, on day 2. Days 4 and 5 only go
  // negative because of the fees charged before them.
  const { fees } = runToDay(5);

  assert.deepEqual(fees.map((f) => f.day), [2, 4, 5]);
  assert.equal(fees.length, 3);
});

test('the cascade, day by day', () => {
  const { ledger } = runToDay(5);

  // Day 2 goes to -370 on its own, and the fee takes it to -395.
  assert.equal(bal(ledger, 2, 5), '-395.00');
  // Day 3 is only 5.00 above water, because the day 2 fee ate into the 400 credit.
  assert.equal(bal(ledger, 3, 5), '5.00');
  // Day 4 would have been -155 without that fee. With it, -180, then -205 after its own.
  assert.equal(bal(ledger, 4, 5), '-205.00');
  assert.equal(bal(ledger, 5, 5), '-230.00');
});

test('without the day 2 fee, day 4 would have been -155.00', () => {
  // Same entries, no fees assessed. This is the number the cascade builds on.
  const ledger = new Ledger();
  post(ledger, 'E1', '1200.00', 1, 1, ENTRY_REASONS.CREDIT);
  post(ledger, 'E2', '-950.00', 1, 1, ENTRY_REASONS.DEBIT);
  post(ledger, 'E4', '400.00', 3, 3, ENTRY_REASONS.CREDIT);
  post(ledger, 'E5', '-185.00', 4, 4, ENTRY_REASONS.SETTLEMENT);
  post(ledger, 'E7', '-620.00', 2, 5, ENTRY_REASONS.DEBIT);

  assert.equal(bal(ledger, 4, 5), '-155.00');
});

test('a fee is dated the day that went negative, not the day it was discovered', () => {
  const { ledger } = runToDay(5);
  const fees = feesFor(ledger, 'ACC-001');

  assert.deepEqual(fees.map((f) => f.valueDate), [2, 4, 5]);
  // All three were found on day 5, when the backdated debit arrived.
  assert.deepEqual(fees.map((f) => f.bookedOn), [5, 5, 5]);
});

test('the reversal does not give the fees back', () => {
  // Criterion C-06 says everything returns to its pre-E7 values. Balances do.
  // Fees do not, because nothing in an append only ledger can be un-booked.
  const { ledger } = runToDay(6);

  assert.equal(feesFor(ledger, 'ACC-001').length, 3);
  assert.equal(bal(ledger, 2, 6), '225.00'); // positive again, fee still there
  assert.equal(bal(ledger, 6, 6), '390.00'); // 465.00 less 75.00 of fees
});

test('day 6 charges no new fee, because every day is back above zero', () => {
  const before = runToDay(5).fees.length;
  const { fees } = runToDay(6);

  assert.equal(before, 3);
  assert.equal(fees.length, 3);
});

test('never charges the same day twice', () => {
  const ledger = new Ledger();
  post(ledger, 'E-X', '-100.00', 1, 1, ENTRY_REASONS.DEBIT);

  assert.equal(assessFeesAtClose(ledger, { ...acc, closingDay: 1 }).length, 1);
  assert.equal(assessFeesAtClose(ledger, { ...acc, closingDay: 1 }).length, 0);
  assert.equal(assessFeesAtClose(ledger, { ...acc, closingDay: 2 }).length, 1); // day 2 is a different day
  assert.equal(feesFor(ledger, 'ACC-001').length, 2);
});

test('a day closing at exactly zero is not overdrawn', () => {
  const ledger = new Ledger();
  post(ledger, 'E-X', '100.00', 1, 1, ENTRY_REASONS.CREDIT);
  post(ledger, 'E-Y', '-100.00', 1, 1, ENTRY_REASONS.DEBIT);

  assert.equal(assessFeesAtClose(ledger, { ...acc, closingDay: 1 }).length, 0);
});

test('one fee can be enough to trigger the next one', () => {
  // 0.01 above water on day 2. The day 1 fee alone pushes day 2 under.
  const ledger = new Ledger();
  post(ledger, 'E-X', '-1.00', 1, 1, ENTRY_REASONS.DEBIT);
  post(ledger, 'E-Y', '25.99', 2, 1, ENTRY_REASONS.CREDIT);

  const fees = assessFeesAtClose(ledger, { ...acc, closingDay: 2 });
  assert.deepEqual(fees.map((f) => f.day), [1, 2]);
  assert.equal(bal(ledger, 2, 2), '-25.01');
});

test('the fee is 25.00 AED and is booked as a debit', () => {
  const { ledger } = runToDay(5);
  const fee = feesFor(ledger, 'ACC-001')[0];

  assert.equal(OVERDRAFT_FEE.format(), '25.00');
  assert.equal(fee.amount.format(), '-25.00');
  assert.equal(fee.reason, ENTRY_REASONS.OVERDRAFT_FEE);
  assert.match(fee.note, /day 2 closed at -370.00/);
});

test('a BHD account is not charged an AED fee', () => {
  // The fee is written in AED. Converting it would invent an exchange rate.
  const ledger = new Ledger();
  ledger.post({
    account: 'ACC-002',
    amount: Money.of('BHD', '-5.000'),
    valueDate: 1,
    bookedOn: 1,
    reason: ENTRY_REASONS.DEBIT,
    sourceEvent: 'E-X',
  });

  const fees = assessFeesAtClose(ledger, { account: 'ACC-002', currency: 'BHD', closingDay: 1 });

  assert.equal(fees.length, 0);
  assert.equal(feesFor(ledger, 'ACC-002').length, 0);
  assert.match(ledger.refusals('ACC-002')[0].reason, /fee is set in AED/);
});

test('ACC-002 never goes negative, so the question never comes up in the real run', () => {
  const ledger = new Ledger();
  ledger.post({
    account: 'ACC-002',
    amount: Money.of('BHD', '10.000'),
    valueDate: 5,
    bookedOn: 5,
    reason: ENTRY_REASONS.CREDIT,
    sourceEvent: 'E10',
  });

  assert.equal(assessFeesAtClose(ledger, { account: 'ACC-002', currency: 'BHD', closingDay: 6 }).length, 0);
  assert.equal(ledger.refusals('ACC-002').length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../src/money.js';
import { Ledger, ENTRY_REASONS } from '../src/ledger.js';
import { balanceOn, balancesByDay, movementsOn } from '../src/balances.js';

const aed = (text) => Money.of('AED', text);

/**
 * ACC-001 as the event stream leaves it, with no fees and no interest yet.
 * E6 is missing on purpose: it was refused, so it never became an entry.
 */
function acc001() {
  const ledger = new Ledger();
  const add = (sourceEvent, amount, valueDate, bookedOn, reason) =>
    ledger.post({ account: 'ACC-001', amount: aed(amount), valueDate, bookedOn, reason, sourceEvent });

  add('E1', '1200.00', 1, 1, ENTRY_REASONS.CREDIT);
  add('E2', '-950.00', 1, 1, ENTRY_REASONS.DEBIT);
  add('E4', '400.00', 3, 3, ENTRY_REASONS.CREDIT);
  add('E5', '-185.00', 4, 4, ENTRY_REASONS.SETTLEMENT);
  add('E7', '-620.00', 2, 5, ENTRY_REASONS.DEBIT);   // backdated: booked day 5, valued day 2
  add('E9', '620.00', 2, 6, ENTRY_REASONS.REVERSAL); // reverses E7, also valued day 2

  return ledger;
}

const on = (ledger, day, asKnownOn) =>
  balanceOn(ledger, { account: 'ACC-001', currency: 'AED', day, asKnownOn }).format();

test('day 2 closing balance seen from end of day 5 is -370.00', () => {
  // Criterion C-01. 1200 in, 950 out, then the backdated 620 debit.
  assert.equal(on(acc001(), 2, 5), '-370.00');
});

test('the same day 2 seen from end of day 4 is +250.00', () => {
  // Nothing was edited. The day 5 debit simply had not arrived yet.
  assert.equal(on(acc001(), 2, 4), '250.00');
});

test('day 2 goes back to +250.00 once the reversal lands on day 6', () => {
  assert.equal(on(acc001(), 2, 6), '250.00');
});

test('a backdated debit rewrites three days at once', () => {
  const ledger = acc001();

  // How the week looked at the end of day 4.
  assert.deepEqual([1, 2, 3, 4].map((d) => on(ledger, d, 4)), ['250.00', '250.00', '650.00', '465.00']);

  // How the same week looked one day later, after E7 arrived.
  assert.deepEqual([1, 2, 3, 4].map((d) => on(ledger, d, 5)), ['250.00', '-370.00', '30.00', '-155.00']);
});

test('day 5 closes at -155.00 before any fee', () => {
  // This is why Auth-B cannot be approved: there is nothing available to hold.
  assert.equal(on(acc001(), 5, 5), '-155.00');
});

test('the window ends at 465.00 once the reversal is in', () => {
  const ledger = acc001();
  assert.equal(on(ledger, 6, 6), '465.00');
  assert.equal(on(ledger, 6), '465.00'); // no cut off means everything counts
});

test('an entry only counts from its value date onwards', () => {
  const ledger = acc001();
  // E4 credits 400 with value date 3, so day 2 has never seen it.
  assert.equal(on(ledger, 2, 3), '250.00');
  assert.equal(on(ledger, 3, 3), '650.00');
});

test('lists a closing balance for every day in the window', () => {
  const days = balancesByDay(acc001(), { account: 'ACC-001', currency: 'AED', days: 6, asKnownOn: 5 });

  assert.deepEqual(days.map((d) => d.day), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(days.map((d) => d.balance.format()), ['250.00', '-370.00', '30.00', '-155.00', '-155.00', '-155.00']);
});

test('shows what actually moved on a day, not just the running total', () => {
  const ledger = acc001();

  // Day 2 has no movement of its own until the backdated debit arrives.
  assert.equal(movementsOn(ledger, { account: 'ACC-001', day: 2, asKnownOn: 4 }).length, 0);
  assert.equal(movementsOn(ledger, { account: 'ACC-001', day: 2, asKnownOn: 5 }).length, 1);
  assert.equal(movementsOn(ledger, { account: 'ACC-001', day: 2, asKnownOn: 6 }).length, 2);
});

test('an empty account is zero in its own currency', () => {
  const ledger = new Ledger();
  assert.equal(balanceOn(ledger, { account: 'ACC-002', currency: 'BHD', day: 6 }).format(), '0.000');
});

test('accounts are kept apart', () => {
  const ledger = acc001();
  ledger.post({
    account: 'ACC-002',
    amount: Money.of('BHD', '10.000'),
    valueDate: 5,
    bookedOn: 5,
    reason: ENTRY_REASONS.CREDIT,
    sourceEvent: 'E10',
  });

  assert.equal(balanceOn(ledger, { account: 'ACC-002', currency: 'BHD', day: 6 }).format(), '10.000');
  assert.equal(on(ledger, 6, 6), '465.00');
});

test('the balance is worked out fresh every time, never cached', () => {
  const ledger = acc001();
  const before = on(ledger, 6, 6);

  ledger.post({
    account: 'ACC-001',
    amount: aed('-25.00'),
    valueDate: 2,
    bookedOn: 6,
    reason: ENTRY_REASONS.OVERDRAFT_FEE,
    sourceEvent: 'FEE',
  });

  assert.equal(before, '465.00');
  assert.equal(on(ledger, 6, 6), '440.00');
  assert.equal(on(ledger, 1, 6), '250.00'); // day 1 is untouched, the fee is dated day 2
});

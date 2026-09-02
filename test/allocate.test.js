import test from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../src/money.js';
import { distribute, splitEvenly } from '../src/allocate.js';

const shown = (parts) => parts.map((p) => p.format());

test('E10: BHD 10.000 in three instalments adds back to exactly 10.000', () => {
  // Criterion C-07 asks for 3.334 each, which is 10.002. This is the correction.
  const parts = splitEvenly(Money.of('BHD', '10.000'), 3);

  assert.deepEqual(shown(parts), ['3.334', '3.333', '3.333']);
  assert.ok(Money.sum('BHD', parts).equals(Money.of('BHD', '10.000')));
});

test('the leftover unit goes to the earliest part', () => {
  // Same answer on every run, which matters when an auditor re-runs it.
  const parts = splitEvenly(Money.of('AED', '100.00'), 3);
  assert.deepEqual(shown(parts), ['33.34', '33.33', '33.33']);
});

test('an amount that divides cleanly gets no adjustment', () => {
  const parts = splitEvenly(Money.of('AED', '100.00'), 4);
  assert.deepEqual(shown(parts), ['25.00', '25.00', '25.00', '25.00']);
});

test('two leftover units go to the first two parts', () => {
  const parts = splitEvenly(Money.of('AED', '1.00'), 6);
  assert.deepEqual(shown(parts), ['0.17', '0.17', '0.17', '0.17', '0.16', '0.16']);
  assert.ok(Money.sum('AED', parts).equals(Money.of('AED', '1.00')));
});

test('a negative amount splits the same way', () => {
  const parts = splitEvenly(Money.of('AED', '-100.00'), 3);
  assert.deepEqual(shown(parts), ['-33.34', '-33.33', '-33.33']);
  assert.ok(Money.sum('AED', parts).equals(Money.of('AED', '-100.00')));
});

test('zero splits into zeros', () => {
  const parts = splitEvenly(Money.zero('AED'), 3);
  assert.deepEqual(shown(parts), ['0.00', '0.00', '0.00']);
});

test('shares out in proportion to weights', () => {
  const parts = distribute(Money.of('AED', '100.00'), [1, 2, 7]);
  assert.deepEqual(shown(parts), ['10.00', '20.00', '70.00']);
});

test('a part with no weight gets nothing', () => {
  const parts = distribute(Money.of('AED', '10.00'), [1, 0, 1]);
  assert.deepEqual(shown(parts), ['5.00', '0.00', '5.00']);
});

test('the biggest shortfall gets the leftover unit, even if it is not the first part', () => {
  // 0.07 split 1:5. Floors are 0.01 and 0.05, one fils left over.
  // The second part was short by more, so it takes it.
  const parts = distribute(Money.of('AED', '0.07'), [1, 5]);
  assert.deepEqual(shown(parts), ['0.01', '0.06']);
  assert.ok(Money.sum('AED', parts).equals(Money.of('AED', '0.07')));
});

test('when shortfalls tie, the earliest part takes the leftover', () => {
  // 0.10 split 1:1:4. Every part is short by the same amount, so order decides.
  const parts = distribute(Money.of('AED', '0.10'), [1, 1, 4]);
  assert.deepEqual(shown(parts), ['0.02', '0.02', '0.06']);
});

test('never loses or invents a unit, across many random splits', () => {
  for (let minor = 0; minor < 500; minor += 1) {
    for (let parts = 1; parts <= 7; parts += 1) {
      const amount = Money.fromMinor('AED', minor);
      const split = splitEvenly(amount, parts);
      assert.equal(split.length, parts);
      assert.ok(Money.sum('AED', split).equals(amount));
    }
  }
});

test('parts never differ by more than one unit', () => {
  const parts = splitEvenly(Money.of('BHD', '10.000'), 7);
  const values = parts.map((p) => p.minor);
  assert.ok(Math.max(...values) - Math.min(...values) <= 1);
});

test('refuses nonsense input', () => {
  assert.throws(() => splitEvenly(Money.of('AED', '10.00'), 0), /Cannot split into 0 parts/);
  assert.throws(() => splitEvenly(Money.of('AED', '10.00'), 2.5), /Cannot split into 2.5 parts/);
  assert.throws(() => distribute(Money.of('AED', '10.00'), []), /at least one weight/);
  assert.throws(() => distribute(Money.of('AED', '10.00'), [1, -1]), /non negative whole numbers/);
  assert.throws(() => distribute(Money.of('AED', '10.00'), [0, 0]), /cannot all be zero/);
});

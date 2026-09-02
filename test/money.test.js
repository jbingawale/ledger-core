import test from 'node:test';
import assert from 'node:assert/strict';
import { Money, CURRENCIES } from '../src/money.js';

test('reads written amounts into whole minor units', () => {
  assert.equal(Money.of('AED', '1200.00').minor, 120000);
  assert.equal(Money.of('AED', '1,200.00').minor, 120000);
  assert.equal(Money.of('AED', '950').minor, 95000);
  assert.equal(Money.of('AED', '-620.00').minor, -62000);
  assert.equal(Money.of('BHD', '10.000').minor, 10000);
  assert.equal(Money.of('BHD', '3.334').minor, 3334);
});

test('each currency keeps its own number of decimal places', () => {
  assert.equal(CURRENCIES.AED.scale, 2);
  assert.equal(CURRENCIES.BHD.scale, 3);
  assert.equal(Money.of('AED', '1').minor, 100);
  assert.equal(Money.of('BHD', '1').minor, 1000);
});

test('refuses an amount finer than the currency can hold', () => {
  // Rounding this away quietly would hide a real problem.
  assert.throws(() => Money.of('AED', '10.005'), /keeps 2 decimal places/);
  assert.throws(() => Money.of('BHD', '3.3335'), /keeps 3 decimal places/);
});

test('refuses a plain number as an amount', () => {
  // 0.1 is already rounded by the time it arrives. Nothing left to recover.
  assert.throws(() => Money.of('AED', 10.5), /expects the amount as text/);
});

test('a thousand additions of one fils land exactly on ten dirhams', () => {
  // Why money is not a decimal. In plain JS this ends at 10.000000000000165.
  let running = Money.zero('AED');
  for (let i = 0; i < 1000; i += 1) {
    running = running.plus(Money.of('AED', '0.01'));
  }
  assert.equal(running.minor, 1000);
  assert.equal(running.format(), '10.00');
  assert.ok(running.equals(Money.of('AED', '10.00')));
});

test('three BHD instalments of 3.334 really do overshoot the total', () => {
  // The arithmetic behind rejecting criterion C-07.
  const instalment = Money.of('BHD', '3.334');
  const total = instalment.times(3);
  assert.equal(total.format(), '10.002');
  assert.notEqual(total.minor, Money.of('BHD', '10.000').minor);
});

test('will not mix two currencies in one calculation', () => {
  const dirhams = Money.of('AED', '100.00');
  const dinars = Money.of('BHD', '100.000');
  assert.throws(() => dirhams.plus(dinars), /Cannot mix AED and BHD/);
  assert.throws(() => dirhams.minus(dinars), /Cannot mix AED and BHD/);
  assert.throws(() => dirhams.compare(dinars), /Cannot mix AED and BHD/);
});

test('an amount is never changed in place', () => {
  const original = Money.of('AED', '250.00');
  const result = original.plus(Money.of('AED', '400.00'));

  assert.equal(original.minor, 25000);
  assert.equal(result.minor, 65000);
  assert.notEqual(original, result);
  assert.throws(() => {
    'use strict';
    original.minor = 999;
  });
});

test('adds and subtracts the way the day two balance is worked out', () => {
  // 1200 in, 950 out, then the backdated 620 debit from E7.
  const balance = Money.of('AED', '1200.00')
    .minus(Money.of('AED', '950.00'))
    .minus(Money.of('AED', '620.00'));

  assert.equal(balance.format(), '-370.00');
  assert.ok(balance.isNegative());
  assert.ok(!balance.isPositive());
});

test('sums a list of amounts', () => {
  const parts = [Money.of('BHD', '3.334'), Money.of('BHD', '3.333'), Money.of('BHD', '3.333')];
  assert.ok(Money.sum('BHD', parts).equals(Money.of('BHD', '10.000')));
});

test('prints with the right decimals, grouping and sign', () => {
  assert.equal(Money.of('AED', '1200').format(), '1,200.00');
  assert.equal(Money.of('AED', '1234567.89').format(), '1,234,567.89');
  assert.equal(Money.of('AED', '0').format(), '0.00');
  assert.equal(Money.of('AED', '0.05').format(), '0.05');
  assert.equal(Money.of('BHD', '10').format(), '10.000');
  assert.equal(Money.of('AED', '-25.00').toString(), 'AED -25.00');
});

test('compares and reports sign', () => {
  const small = Money.of('AED', '5.00');
  const large = Money.of('AED', '180.00');

  assert.equal(small.compare(large), -1);
  assert.equal(large.compare(small), 1);
  assert.equal(small.compare(Money.of('AED', '5.00')), 0);
  assert.ok(Money.zero('AED').isZero());
  assert.ok(!Money.zero('AED').isNegative());
});

test('rejects an unknown currency and a fractional minor unit', () => {
  assert.throws(() => Money.of('USD', '1.00'), /Unknown currency/);
  assert.throws(() => Money.fromMinor('AED', 10.5), /whole number of AED minor units/);
});

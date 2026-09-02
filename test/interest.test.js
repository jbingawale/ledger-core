import test from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../src/money.js';
import { Ledger, ENTRY_REASONS } from '../src/ledger.js';
import { accrueInterest, capitaliseInterest, naiveDailyAmounts, DAILY_RATE } from '../src/interest.js';

const aed = (text) => Money.of('AED', text);
const acc = { account: 'ACC-001', currency: 'AED' };
const shown = (list) => list.map((x) => (x.amount ?? x).format());

/** ACC-001 as it stands at the end of day 6, fees included, interest not yet paid. */
function finalLedger() {
  const ledger = new Ledger();
  const post = (sourceEvent, amount, valueDate, bookedOn, reason) =>
    ledger.post({ account: 'ACC-001', amount: aed(amount), valueDate, bookedOn, reason, sourceEvent });

  post('E1', '1200.00', 1, 1, ENTRY_REASONS.CREDIT);
  post('E2', '-950.00', 1, 1, ENTRY_REASONS.DEBIT);
  post('E4', '400.00', 3, 3, ENTRY_REASONS.CREDIT);
  post('E5', '-185.00', 4, 4, ENTRY_REASONS.SETTLEMENT);
  post('E7', '-620.00', 2, 5, ENTRY_REASONS.DEBIT);
  post('FEE-D2', '-25.00', 2, 5, ENTRY_REASONS.OVERDRAFT_FEE);
  post('FEE-D4', '-25.00', 4, 5, ENTRY_REASONS.OVERDRAFT_FEE);
  post('FEE-D5', '-25.00', 5, 5, ENTRY_REASONS.OVERDRAFT_FEE);
  post('E9', '620.00', 2, 6, ENTRY_REASONS.REVERSAL);

  return ledger;
}

test('the rate is a fraction, never a decimal', () => {
  assert.equal(DAILY_RATE.numerator / DAILY_RATE.denominator, 0.0004);
  assert.ok(Number.isInteger(DAILY_RATE.numerator));
  assert.ok(Number.isInteger(DAILY_RATE.denominator));
});

test('accrues on the closing balance of every day', () => {
  const { daily } = accrueInterest(finalLedger(), acc);

  assert.deepEqual(daily.map((d) => d.balance.format()), ['250.00', '225.00', '625.00', '415.00', '390.00', '390.00']);
});

test('the daily figures add up to the capitalised credit exactly', () => {
  // The non negotiable rule, tested directly.
  const { daily, total } = accrueInterest(finalLedger(), acc);
  const added = Money.sum('AED', daily.map((d) => d.amount));

  assert.ok(added.equals(total));
  assert.equal(total.format(), '0.92');
  assert.deepEqual(shown(daily), ['0.10', '0.09', '0.25', '0.17', '0.16', '0.15']);
});

test('rounding each day on its own would not add up, which is why C-08 is wrong', () => {
  // Each day rounded independently comes to 0.93. The week's true interest is
  // 0.918, which rounds to 0.92. Discarding the difference loses a fils.
  const ledger = finalLedger();
  const naive = naiveDailyAmounts(ledger, acc);
  const { total } = accrueInterest(ledger, acc);

  assert.deepEqual(shown(naive), ['0.10', '0.09', '0.25', '0.17', '0.16', '0.16']);
  assert.equal(Money.sum('AED', naive).format(), '0.93');
  assert.equal(total.format(), '0.92');
  assert.notEqual(Money.sum('AED', naive).minor, total.minor);
});

test('the adjustment lands on one day and is visible', () => {
  // Day 6 takes 0.15 instead of its own 0.16. That fils is the reconciliation.
  const ledger = finalLedger();
  const naive = naiveDailyAmounts(ledger, acc);
  const { daily } = accrueInterest(ledger, acc);

  assert.equal(naive[5].format(), '0.16');
  assert.equal(daily[5].amount.format(), '0.15');
});

test('negative days earn nothing', () => {
  const ledger = new Ledger();
  ledger.post({ account: 'ACC-001', amount: aed('-100.00'), valueDate: 1, bookedOn: 1, reason: ENTRY_REASONS.DEBIT, sourceEvent: 'X' });
  ledger.post({ account: 'ACC-001', amount: aed('600.00'), valueDate: 3, bookedOn: 3, reason: ENTRY_REASONS.CREDIT, sourceEvent: 'Y' });

  const { daily } = accrueInterest(ledger, acc);

  assert.deepEqual(shown(daily), ['0.00', '0.00', '0.20', '0.20', '0.20', '0.20']);
});

test('an account that is never in credit earns nothing at all', () => {
  const ledger = new Ledger();
  ledger.post({ account: 'ACC-001', amount: aed('-100.00'), valueDate: 1, bookedOn: 1, reason: ENTRY_REASONS.DEBIT, sourceEvent: 'X' });

  const { total } = capitaliseInterest(ledger, acc);

  assert.equal(total.format(), '0.00');
  assert.equal(ledger.entries('ACC-001').filter((e) => e.reason === ENTRY_REASONS.INTEREST).length, 0);
});

test('capitalises as a single credit on day 6', () => {
  const ledger = finalLedger();
  capitaliseInterest(ledger, acc);

  const credits = ledger.entries('ACC-001').filter((e) => e.reason === ENTRY_REASONS.INTEREST);

  assert.equal(credits.length, 1);
  assert.equal(credits[0].amount.format(), '0.92');
  assert.equal(credits[0].valueDate, 6);
  assert.equal(credits[0].bookedOn, 6);
});

test('the interest credit does not earn interest on itself', () => {
  const ledger = finalLedger();
  const first = capitaliseInterest(ledger, acc);
  const second = accrueInterest(ledger, acc);

  assert.equal(first.total.format(), '0.92');
  assert.equal(second.total.format(), '0.92');
  assert.deepEqual(shown(second.daily), shown(first.daily));
});

test('ACC-002 earns on the two days it holds a balance', () => {
  const ledger = new Ledger();
  for (const part of ['3.334', '3.333', '3.333']) {
    ledger.post({
      account: 'ACC-002',
      amount: Money.of('BHD', part),
      valueDate: 5,
      bookedOn: 5,
      reason: ENTRY_REASONS.CREDIT,
      sourceEvent: 'E10',
    });
  }

  const { daily, total } = accrueInterest(ledger, { account: 'ACC-002', currency: 'BHD' });

  assert.deepEqual(shown(daily), ['0.000', '0.000', '0.000', '0.000', '0.004', '0.004']);
  assert.equal(total.format(), '0.008');
  assert.ok(Money.sum('BHD', daily.map((d) => d.amount)).equals(total));
});

test('the parts always add up to the total, whatever the balances', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const ledger = new Ledger();
    for (let day = 1; day <= 6; day += 1) {
      const swing = ((seed * 37 * day) % 900) - 300;
      ledger.post({
        account: 'ACC-001',
        amount: Money.fromMinor('AED', swing * 100),
        valueDate: day,
        bookedOn: day,
        reason: swing < 0 ? ENTRY_REASONS.DEBIT : ENTRY_REASONS.CREDIT,
        sourceEvent: `X${day}`,
      });
    }

    const { daily, total } = accrueInterest(ledger, acc);
    assert.ok(Money.sum('AED', daily.map((d) => d.amount)).equals(total));
  }
});

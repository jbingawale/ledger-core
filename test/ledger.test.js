import test from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../src/money.js';
import { Ledger, ENTRY_REASONS, RECORD_KINDS } from '../src/ledger.js';
import { credit, debit, authorization, settlement, reversal, defineEvent, isBackdated } from '../src/events.js';

const aed = (text) => Money.of('AED', text);

const post = (ledger, over = {}) =>
  ledger.post({
    account: 'ACC-001',
    amount: aed('100.00'),
    valueDate: 1,
    bookedOn: 1,
    reason: ENTRY_REASONS.CREDIT,
    sourceEvent: 'E1',
    ...over,
  });

test('an event cannot be changed after it is made', () => {
  const e7 = debit({ id: 'E7', account: 'ACC-001', amount: aed('620.00'), bookedOn: 5, valueDate: 2 });

  assert.throws(() => { e7.valueDate = 5; });
  assert.throws(() => { e7.amount = aed('1.00'); });
  assert.equal(e7.valueDate, 2);
});

test('knows when an event is backdated', () => {
  const e7 = debit({ id: 'E7', account: 'ACC-001', amount: aed('620.00'), bookedOn: 5, valueDate: 2 });
  const e1 = credit({ id: 'E1', account: 'ACC-001', amount: aed('1200.00'), bookedOn: 1, valueDate: 1 });

  assert.ok(isBackdated(e7));
  assert.ok(!isBackdated(e1));
});

test('direction comes from the type, so amounts are always written positive', () => {
  assert.throws(
    () => debit({ id: 'X', account: 'ACC-001', amount: aed('-620.00'), bookedOn: 5, valueDate: 2 }),
    /positive amount/
  );
});

test('a reversal points at an event id, not at an amount', () => {
  // Two identical debits on the same day would be impossible to tell apart otherwise.
  const e9 = reversal({ id: 'E9', account: 'ACC-001', reverses: 'E7', bookedOn: 6, valueDate: 2 });

  assert.equal(e9.reverses, 'E7');
  assert.equal(e9.amount, undefined);
  assert.throws(
    () => reversal({ id: 'X', account: 'ACC-001', bookedOn: 6, valueDate: 2 }),
    /missing "reverses"/
  );
});

test('authorisations and settlements must name their authorisation', () => {
  const e3 = authorization({ id: 'E3', account: 'ACC-001', authId: 'Auth-A', amount: aed('200.00'), bookedOn: 2, valueDate: 2 });
  assert.equal(e3.authId, 'Auth-A');

  assert.throws(
    () => settlement({ id: 'X', account: 'ACC-001', amount: aed('185.00'), bookedOn: 4, valueDate: 4 }),
    /missing "authId"/
  );
});

test('rejects a malformed event', () => {
  assert.throws(() => defineEvent({ id: 'X', type: 'TRANSFER', account: 'A', bookedOn: 1, valueDate: 1 }), /unknown type/);
  assert.throws(() => credit({ id: 'X', account: 'A', amount: aed('1.00'), bookedOn: 0, valueDate: 1 }), /invalid booking day/);
  assert.throws(() => credit({ id: 'X', account: 'A', amount: aed('1.00'), bookedOn: 1, valueDate: 1.5 }), /invalid value date/);
  assert.throws(() => credit({ id: 'X', account: 'A', bookedOn: 1, valueDate: 1 }), /missing "amount"/);
});

test('a stored record cannot be edited', () => {
  const ledger = new Ledger();
  const record = post(ledger);

  assert.throws(() => { record.amount = aed('999.00'); });
  assert.throws(() => { record.valueDate = 6; });
  assert.equal(ledger.entries()[0].amount.format(), '100.00');
});

test('the list can only grow, and callers cannot add to it themselves', () => {
  const ledger = new Ledger();
  post(ledger);
  post(ledger, { sourceEvent: 'E2' });

  const snapshot = ledger.all();
  assert.equal(snapshot.length, 2);
  assert.throws(() => snapshot.push({ kind: 'ENTRY' }));
  assert.equal(ledger.size, 2);
});

test('there is no way to remove or replace a record', () => {
  const ledger = new Ledger();
  assert.equal(typeof ledger.delete, 'undefined');
  assert.equal(typeof ledger.remove, 'undefined');
  assert.equal(typeof ledger.update, 'undefined');
  assert.equal(typeof ledger.clear, 'undefined');
});

test('records are numbered in the order they arrived', () => {
  const ledger = new Ledger();
  assert.equal(post(ledger).seq, 1);
  assert.equal(post(ledger).seq, 2);
  assert.equal(ledger.refuse({ account: 'ACC-001', day: 4, sourceEvent: 'E6', reason: 'no such authorisation' }).seq, 3);
});

test('reversing a debit makes the ledger longer, not shorter', () => {
  const ledger = new Ledger();
  const original = post(ledger, { amount: aed('-620.00'), reason: ENTRY_REASONS.DEBIT, valueDate: 2, bookedOn: 5, sourceEvent: 'E7' });
  post(ledger, { amount: aed('620.00'), reason: ENTRY_REASONS.REVERSAL, valueDate: 2, bookedOn: 6, sourceEvent: 'E9' });

  assert.equal(ledger.size, 2);
  assert.equal(ledger.entries()[0].seq, original.seq);
  assert.equal(ledger.entries()[0].amount.format(), '-620.00');
});

test('a refusal is recorded, so a rejected event is not the same as one that never happened', () => {
  const ledger = new Ledger();
  ledger.refuse({ account: 'ACC-001', day: 4, sourceEvent: 'E6', reason: 'Auth-Z was never authorised' });

  const refusals = ledger.refusals('ACC-001');
  assert.equal(refusals.length, 1);
  assert.equal(refusals[0].kind, RECORD_KINDS.REFUSAL);
  assert.equal(refusals[0].sourceEvent, 'E6');
  assert.equal(ledger.entries().length, 0);
  assert.throws(() => ledger.refuse({ account: 'ACC-001', day: 4, sourceEvent: 'E6' }), /must say why/);
});

test('holds are recorded separately from entries', () => {
  const ledger = new Ledger();
  ledger.openHold({ account: 'ACC-001', authId: 'Auth-A', amount: aed('200.00'), day: 2, sourceEvent: 'E3' });
  ledger.closeHold({ account: 'ACC-001', authId: 'Auth-A', day: 4, sourceEvent: 'E5' });

  assert.equal(ledger.holdsOpened('ACC-001').length, 1);
  assert.equal(ledger.holdsClosed('ACC-001').length, 1);
  assert.equal(ledger.entries('ACC-001').length, 0);
});

test('reads back by account and by booking day', () => {
  const ledger = new Ledger();
  post(ledger, { account: 'ACC-001', bookedOn: 1 });
  post(ledger, { account: 'ACC-002', amount: Money.of('BHD', '10.000'), bookedOn: 5, valueDate: 5 });

  assert.equal(ledger.entries('ACC-001').length, 1);
  assert.equal(ledger.entries('ACC-002').length, 1);
  assert.equal(ledger.bookedOn(5).length, 1);
});

test('refuses an entry with a bad reason or a bad date', () => {
  const ledger = new Ledger();
  assert.throws(() => post(ledger, { reason: 'BONUS' }), /Unknown entry reason/);
  assert.throws(() => post(ledger, { valueDate: 1.5 }), /whole number value date/);
});

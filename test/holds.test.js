import test from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../src/money.js';
import { Ledger, ENTRY_REASONS } from '../src/ledger.js';
import { balanceOn } from '../src/balances.js';
import {
  activeHolds,
  heldTotal,
  availableBalance,
  authorizationStates,
  applyAuthorization,
  applySettlement,
  AUTH_STATES,
} from '../src/holds.js';

const aed = (text) => Money.of('AED', text);
const opts = { currency: 'AED' };

const post = (ledger, sourceEvent, amount, valueDate, bookedOn, reason) =>
  ledger.post({ account: 'ACC-001', amount: aed(amount), valueDate, bookedOn, reason, sourceEvent });

const auth = (authId, amount, day) => ({
  id: `auth-${authId}`, account: 'ACC-001', authId, amount: aed(amount), bookedOn: day, valueDate: day,
});

const settle = (id, authId, amount, day) => ({
  id, account: 'ACC-001', authId, amount: aed(amount), bookedOn: day, valueDate: day,
});

/** Days 1 to 2 of the real stream: 1200 in, 950 out. */
function openingDays() {
  const ledger = new Ledger();
  post(ledger, 'E1', '1200.00', 1, 1, ENTRY_REASONS.CREDIT);
  post(ledger, 'E2', '-950.00', 1, 1, ENTRY_REASONS.DEBIT);
  return ledger;
}

test('E3: Auth-A is approved because 250.00 covers a 200.00 hold', () => {
  const ledger = openingDays();
  const result = applyAuthorization(ledger, auth('Auth-A', '200.00', 2), opts);

  assert.ok(result.approved);
  assert.equal(result.available.format(), '250.00');
  assert.equal(result.afterHold.format(), '50.00');
});

test('a hold reduces available balance but not ledger balance', () => {
  // Criterion C-05, tested on Auth-A because Auth-B never gets approved.
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-A', '200.00', 2), opts);

  assert.equal(balanceOn(ledger, { account: 'ACC-001', currency: 'AED', day: 2 }).format(), '250.00');
  assert.equal(availableBalance(ledger, { account: 'ACC-001', currency: 'AED', day: 2 }).format(), '50.00');
  assert.equal(ledger.entries('ACC-001').length, 2); // the hold added no entry
});

test('a hold that lands exactly on zero is still approved', () => {
  // The rule says at or above zero, so 250.00 held against 250.00 is fine.
  const ledger = openingDays();
  const result = applyAuthorization(ledger, auth('Auth-Edge', '250.00', 2), opts);

  assert.ok(result.approved);
  assert.equal(result.afterHold.format(), '0.00');
});

test('one fils too much is declined', () => {
  const ledger = openingDays();
  const result = applyAuthorization(ledger, auth('Auth-Edge', '250.01', 2), opts);

  assert.ok(!result.approved);
  assert.equal(result.afterHold.format(), '-0.01');
  assert.equal(activeHolds(ledger, { account: 'ACC-001' }).length, 0);
});

test('E5: Auth-A settles for 185.00 and releases the whole 200.00 hold', () => {
  // Criterion C-03. Settling under the held amount is normal.
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-A', '200.00', 2), opts);
  post(ledger, 'E4', '400.00', 3, 3, ENTRY_REASONS.CREDIT);

  const result = applySettlement(ledger, settle('E5', 'Auth-A', '185.00', 4), opts);

  assert.ok(result.settled);
  assert.equal(result.released.format(), '15.00');
  assert.equal(heldTotal(ledger, { account: 'ACC-001', currency: 'AED' }).format(), '0.00');
  assert.equal(balanceOn(ledger, { account: 'ACC-001', currency: 'AED', day: 4 }).format(), '465.00');
});

test('E6: a settlement with no authorisation behind it is refused and no money moves', () => {
  // Criterion C-04. Auth-Z was never authorised.
  const ledger = openingDays();
  const before = balanceOn(ledger, { account: 'ACC-001', currency: 'AED', day: 4 }).format();

  const result = applySettlement(ledger, settle('E6', 'Auth-Z', '180.00', 4), opts);

  assert.ok(!result.settled);
  assert.equal(balanceOn(ledger, { account: 'ACC-001', currency: 'AED', day: 4 }).format(), before);
  assert.equal(ledger.entries('ACC-001').length, 2);

  const refusals = ledger.refusals('ACC-001');
  assert.equal(refusals.length, 1);
  assert.match(refusals[0].reason, /no open authorisation Auth-Z/);
});

test('a settled authorisation cannot be settled twice', () => {
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-A', '200.00', 2), opts);
  applySettlement(ledger, settle('E5', 'Auth-A', '185.00', 4), opts);

  const second = applySettlement(ledger, settle('E5-again', 'Auth-A', '185.00', 4), opts);

  assert.ok(!second.settled);
  assert.equal(ledger.entries('ACC-001').filter((e) => e.reason === ENTRY_REASONS.SETTLEMENT).length, 1);
});

test('E8: Auth-B is declined because day 5 is already 155.00 overdrawn', () => {
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-A', '200.00', 2), opts);
  post(ledger, 'E4', '400.00', 3, 3, ENTRY_REASONS.CREDIT);
  applySettlement(ledger, settle('E5', 'Auth-A', '185.00', 4), opts);
  post(ledger, 'E7', '-620.00', 2, 5, ENTRY_REASONS.DEBIT);

  const result = applyAuthorization(ledger, auth('Auth-B', '90.00', 5), opts);

  assert.ok(!result.approved);
  assert.equal(result.available.format(), '-155.00');
  assert.equal(result.afterHold.format(), '-245.00');
  assert.equal(heldTotal(ledger, { account: 'ACC-001', currency: 'AED' }).format(), '0.00');
});

test('a decline leaves a record, so it is not the same as never asking', () => {
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-B', '90.00', 5), { currency: 'AED', ...opts });
  post(ledger, 'E7', '-620.00', 2, 5, ENTRY_REASONS.DEBIT);

  const declined = applyAuthorization(ledger, auth('Auth-C', '400.00', 5), opts);
  assert.ok(!declined.approved);
  assert.equal(ledger.refusals('ACC-001').length, 1);
});

test('reports the state of every authorisation', () => {
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-A', '200.00', 2), opts);
  applySettlement(ledger, settle('E5', 'Auth-A', '185.00', 4), opts);
  post(ledger, 'E7', '-620.00', 2, 5, ENTRY_REASONS.DEBIT);
  applyAuthorization(ledger, auth('Auth-B', '90.00', 5), opts);

  const states = authorizationStates(ledger, { account: 'ACC-001' });
  const byId = Object.fromEntries(states.map((s) => [s.authId, s.state]));

  assert.equal(byId['Auth-A'], AUTH_STATES.SETTLED);
  assert.equal(byId['Auth-B'], AUTH_STATES.DECLINED);
});

test('an approved hold that never settles stays open to the end of the window', () => {
  // No expiry rule was given, so nothing quietly releases a hold.
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-B', '90.00', 2), opts);

  assert.equal(heldTotal(ledger, { account: 'ACC-001', currency: 'AED', upToDay: 6 }).format(), '90.00');
  assert.equal(authorizationStates(ledger, { account: 'ACC-001' })[0].state, AUTH_STATES.OPEN);
});

test('a hold only counts from the day it was placed', () => {
  const ledger = openingDays();
  applyAuthorization(ledger, auth('Auth-A', '200.00', 2), opts);

  assert.equal(heldTotal(ledger, { account: 'ACC-001', currency: 'AED', upToDay: 1 }).format(), '0.00');
  assert.equal(heldTotal(ledger, { account: 'ACC-001', currency: 'AED', upToDay: 2 }).format(), '200.00');
});

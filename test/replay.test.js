import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, finalPositions } from '../src/replay.js';
import { renderRun } from '../src/report.js';
import { ENTRY_REASONS } from '../src/ledger.js';
import { AUTH_STATES } from '../src/holds.js';
import { EVENTS } from '../src/stream.js';

const run = replay();
const day = (n) => run.days[n - 1];
const acc = (n, id) => day(n).accounts.find((a) => a.id === id);
const outcome = (id) => run.days.flatMap((d) => d.outcomes).find((o) => o.event.id === id);

test('every event in the stream is dealt with exactly once', () => {
  const handled = run.days.flatMap((d) => d.outcomes).map((o) => o.event.id);
  assert.deepEqual(handled.sort(), EVENTS.map((e) => e.id).sort());
});

test('each event lands on its own outcome', () => {
  assert.equal(outcome('E1').outcome, 'posted');
  assert.equal(outcome('E3').outcome, 'approved');
  assert.equal(outcome('E5').outcome, 'settled');
  assert.equal(outcome('E6').outcome, 'refused');
  assert.equal(outcome('E8').outcome, 'declined');
  assert.equal(outcome('E9').outcome, 'reversed');
  assert.equal(outcome('E10').detail, '3 instalments');
});

test('the closing balance printed each day is what was known that day', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((d) => acc(d, 'ACC-001').closing.format()),
    ['250.00', '250.00', '650.00', '465.00', '-230.00', '390.92']
  );
});

test('day 5 shows the earlier days that E7 rewrote', () => {
  const rewritten = acc(5, 'ACC-001').rewritten;
  assert.deepEqual(rewritten.map((r) => r.day), [2, 3, 4]);
  assert.equal(rewritten[0].before.format(), '250.00');
  assert.equal(rewritten[0].after.format(), '-370.00');
});

test('day 6 shows the reversal putting those days back', () => {
  const rewritten = acc(6, 'ACC-001').rewritten;
  assert.deepEqual(rewritten.map((r) => r.day), [2, 3, 4, 5]);
  assert.equal(rewritten[0].after.format(), '225.00');
});

test('three fees, all found on day 5, dated days 2, 4 and 5', () => {
  assert.equal(acc(4, 'ACC-001').fees.length, 0);
  assert.deepEqual(acc(5, 'ACC-001').fees.map((f) => f.day), [2, 4, 5]);
  assert.equal(acc(6, 'ACC-001').fees.length, 0);
});

test('the authorisations end in the states we expect', () => {
  const states = Object.fromEntries(acc(6, 'ACC-001').authorizations.map((a) => [a.authId, a.state]));
  assert.equal(states['Auth-A'], AUTH_STATES.SETTLED);
  assert.equal(states['Auth-B'], AUTH_STATES.DECLINED);
  assert.equal(states['Auth-Z'], AUTH_STATES.DECLINED);
});

test('both errors are reported on the day they happened', () => {
  assert.equal(acc(4, 'ACC-001').errors.length, 1);
  assert.match(acc(4, 'ACC-001').errors[0].reason, /no open authorisation Auth-Z/);
  assert.equal(acc(5, 'ACC-001').errors.length, 1);
  assert.match(acc(5, 'ACC-001').errors[0].reason, /cannot cover a hold of 90.00/);
});

test('the orphan settlement moved no money', () => {
  const settlements = run.ledger.entries('ACC-001').filter((e) => e.reason === ENTRY_REASONS.SETTLEMENT);
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].sourceEvent, 'E5');
});

test('E10 posts three instalments that add back to 10.000', () => {
  const parts = run.ledger.entries('ACC-002').filter((e) => e.sourceEvent === 'E10');
  assert.deepEqual(parts.map((p) => p.amount.format()), ['3.334', '3.333', '3.333']);
  assert.equal(acc(5, 'ACC-002').closing.format(), '10.000');
});

test('interest is capitalised once, on day 6, and the daily figures add up to it', () => {
  const one = acc(6, 'ACC-001').interest;
  const two = acc(6, 'ACC-002').interest;

  assert.equal(one.total.format(), '0.92');
  assert.equal(two.total.format(), '0.008');
  assert.equal(run.ledger.entries('ACC-001').filter((e) => e.reason === ENTRY_REASONS.INTEREST).length, 1);
  assert.equal(acc(5, 'ACC-001').interest, null);
});

test('the window closes where the arithmetic says it should', () => {
  const [one, two] = finalPositions(run);

  // 465.00 of activity, less 75.00 of fees, plus 0.92 of interest.
  assert.equal(one.closing.format(), '390.92');
  assert.equal(two.closing.format(), '10.008');
});

test('nothing in the ledger was ever edited or removed', () => {
  assert.equal(run.ledger.size, 18);
  const seqs = run.ledger.all().map((r) => r.seq);
  assert.deepEqual(seqs, seqs.map((_, i) => i + 1));
});

test('the printed report covers all six days and the summary', () => {
  const text = renderRun(run);

  for (let d = 1; d <= 6; d += 1) assert.match(text, new RegExp(`DAY ${d}`));
  assert.match(text, /END OF WINDOW/);
  assert.match(text, /overdraft fees charged\s+3\s+on days 2, 4, 5/);
  assert.match(text, /accruals add up to 0.92/);
});

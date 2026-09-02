// THIS TEST IS MEANT TO FAIL.
//
// It is the one deliberately failing test the brief asks for. It is not a bug
// that slipped through, it is a limitation of my own design, written down as a
// test so it cannot be forgotten. The comments below say what it asserts, why
// it fails, what that reveals, and what I would do about it with more time.
//
// Everything else in the suite passes. If any other test is red, that is a real
// problem. If this one is red, the repository is behaving as intended.

import test from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../src/replay.js';
import { balanceOn } from '../src/balances.js';
import { feesFor } from '../src/fees.js';

test('a day that ends the window in credit carries no overdraft fee', () => {
  const { ledger } = replay();

  // For each fee, look at the day it is dated to and ask what that day is
  // finally worth, once every event including the day 6 reversal is in.
  const contradictions = feesFor(ledger, 'ACC-001')
    .map((fee) => ({
      day: fee.valueDate,
      finalBalance: balanceOn(ledger, { account: 'ACC-001', currency: 'AED', day: fee.valueDate }),
      fee: fee.amount,
    }))
    .filter((row) => !row.finalBalance.isNegative())
    .map((row) => `day ${row.day} finally closes at ${row.finalBalance.format()} but carries a fee of ${row.fee.format()}`);

  // WHAT THIS ASSERTS
  // An overdraft fee should sit on an overdrawn day. Read the finished ledger
  // and every fee should point at a day that is actually in the red.
  //
  // WHY IT FAILS
  // Day 2 fails it. E7 arrives on day 5 and drags day 2 down to -370.00, so a
  // fee is charged and dated day 2. On day 6 the reversal lifts day 2 back to
  // +225.00. The fee stays, because the ledger is append only and because a
  // reversal in this brief reverses one named event and nothing downstream of
  // it. So the finished ledger contains a fee sitting on a day that closes in
  // credit, which reads as an error to anyone who was not watching.
  //
  // WHAT IT REVEALS
  // A fee carries a value date but no record of the state of the world that
  // justified it. The note says "day 2 closed at -370.00", which is prose, not
  // data. Nothing in the model links the fee to the version of day 2 that was
  // true when it was charged, so the fee cannot defend itself once the facts
  // move underneath it. My design treats a fee as a fact about a day, when it
  // is really a fact about a day as understood at a moment in time.
  //
  // This is the cost of resolving A-01 the way I did. The alternative readings
  // do not escape it. Dating the fee to day 5 instead only moves the oddity to
  // a different day, and not charging at all lets a customer avoid every fee by
  // reporting their debits late.
  //
  // WHAT I WOULD CHANGE WITH MORE TIME
  // Give the fee a second date: the day it was assessed, alongside the day it
  // applies to. That is already stored as bookedOn, so the real change is to
  // teach the report to say "charged on day 5 for day 2, which stood at -370.00
  // at the time". The stronger version is to record the balance that triggered
  // the fee as a Money value rather than as text, so a later reader can check
  // the charge without replaying the whole stream. Then this assertion becomes
  // "a fee points at a day that was overdrawn when the fee was charged", which
  // is both true and checkable.
  //
  // WHY I DID NOT CHANGE IT NOW
  // Because doing so would hide the more interesting fact. The brief asks for
  // one failing test that shows something real, and this is the sharpest thing
  // I found in my own model. Papering over it with a better printed line would
  // make the report read nicely while leaving the underlying gap exactly where
  // it is. It is also the direct evidence that acceptance criterion C-06 is
  // wrong: balances come back, fees do not.
  assert.deepEqual(contradictions, []);
});

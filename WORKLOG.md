# WORKLOG

Append-only. Entries are written by `npm run log` at the moment the work happens;
commit hashes are attached by `npm run log:commit` immediately after each commit.
Nothing in this file is back-filled.

<!-- entry ts=2026-09-02T17:36:25+05:30 -->
## 2026-09-02 17:36 - Setup

_first entry_

- Repo initialised: zero-dependency Node ESM project, node:test as the runner.
- Scaffolded README.md, NUMBERS.md, AMBIGUITIES.md, REJECTED.md with section headings.
- Built tools/worklog.mjs so the log is timestamped at write time, not reconstructed later.

<!-- entry ts=2026-09-02T17:47:31+05:30 -->
## 2026-09-02 17:47 - Planning

_11m since previous entry_

- Wrote PLAN.md breaking the build into ten steps, one commit each.
- Ordered the steps so money and rounding are settled before any balance logic is written.

<!-- entry ts=2026-09-02T17:51:39+05:30 -->
## 2026-09-02 17:51 - Step 1 - Money

_4m since previous entry_

- Built src/money.js: amounts held as whole minor units, AED at 2 places and BHD at 3, frozen values, no decimal numbers anywhere inside.
- Money.of only accepts text. Passing a plain JS number is refused, because by then the language has already rounded it.
- Amounts finer than the currency can hold are rejected rather than silently rounded.
- 13 tests pass, including a thousand additions of 0.01 AED landing exactly on 10.00.
- Fixed the test script: node --test needs a glob on this Node version, a bare directory was read as a file name.

<!-- entry ts=2026-09-02T18:10:52+05:30 -->
## 2026-09-02 18:10 - Step 2 - Splitting amounts

_19m since previous entry_

- Built src/allocate.js with distribute and splitEvenly, using largest remainder so parts always add back to the original.
- BHD 10.000 into three gives 3.334, 3.333, 3.333. Criterion C-07 asks for 3.334 three times, which is 10.002.
- Leftover units go to the biggest shortfall first, ties broken by earliest part, so the answer is identical on every run.
- One test caught my own bad arithmetic: I expected an untied shortfall in a case where all three tied. Fixed the test, code was right.
- 26 tests pass, including 3500 random splits that all reconcile exactly.

<!-- entry ts=2026-09-02T18:17:56+05:30 -->
## 2026-09-02 18:17 - Step 3 - Events and the append only store

_7m since previous entry_

- Built src/events.js: frozen event records carrying both a booking day and a value date, amounts always written positive with direction coming from the type.
- Built src/ledger.js: one append only store holding entries, holds and refusals. No update, no delete, every record frozen, all() hands back a frozen copy.
- Decided refusals get recorded. A trail that only shows successes cannot tell a rejected settlement apart from one that never arrived.
- Reversals point at an event id rather than an amount, so two identical debits on the same day stay distinguishable.
- 41 tests pass.

<!-- entry ts=2026-09-02T18:36:08+05:30 -->
## 2026-09-02 18:36 - Step 4 - Balances

_18m since previous entry_

- Built src/balances.js. A balance is a sum over entries, never a stored field.
- Two filters do the work: value date on or before the day being asked about, and booking day on or before the day we are standing on.
- Confirmed C-01 by test: day 2 seen from end of day 5 is -370.00, the same day seen from end of day 4 is +250.00, and it returns to +250.00 after the day 6 reversal.
- Also confirmed day 5 closes at -155.00 before any fee, which is what makes Auth-B impossible to approve.
- 53 tests pass.

<!-- entry ts=2026-09-02T19:01:19+05:30 -->
## 2026-09-02 19:01 - Step 5 - Holds, approvals and settlements

_25m since previous entry_

- Built src/holds.js. Available balance is ledger balance minus open holds, and a hold never touches the ledger balance.
- Auth-A approved on day 2 with 250.00 available, settles 185.00 on day 4 and releases the full 200.00 hold, 15.00 goes straight back.
- Auth-Z settlement refused, no entry written, balance unchanged. The refusal is recorded with its reason.
- Auth-B declined on day 5: available is already -155.00 before the hold, so it can never be approved. Criterion C-05 is true as written but its premise never fires.
- Had to widen Ledger.refuse to carry authId and amount so the report can show a declined authorisation properly.
- 65 tests pass.

<!-- entry ts=2026-09-02T23:00:35+05:30 -->
## 2026-09-02 23:00 - Step 6 - Overdraft fees

_3h 59m since previous entry_

- Built src/fees.js. Fees are assessed at the close of every day, walking days 1 to today, one fee per account per day, dated the day that went negative.
- Resolved A-01 the hard way: a fee is charged when we find out a day was negative, but it is dated that day, not the day of discovery.
- Confirmed the cascade. E7 causes three fees, on days 2, 4 and 5. Days 4 and 5 are only negative because of the fees booked before them.
- Proved C-06 wrong: after the day 6 reversal day 2 is back to +225.00 but all three fees are still there, so nothing returns to its pre-E7 value. Closing balance ends at 390.00, not 465.00.
- Decided a BHD account cannot be charged an AED fee. Converting would invent an exchange rate, so the engine records a refusal instead. Never fires in the real run.
- 78 tests pass.

<!-- entry ts=2026-09-03T00:11:09+05:30 -->
## 2026-09-03 00:11 - Step 7 - Interest

_1h 11m since previous entry_

- Built src/interest.js. Rate held as the fraction 4/10000 so no decimal is involved anywhere.
- Found the real tension in the brief. Rounding each of ACC-001's six days on its own gives 0.93, but the week's true interest is 0.918 which rounds to 0.92.
- Resolved it by rounding the total once, then sharing it back over the days with the same largest remainder splitter the instalments use. Day 6 takes 0.15 instead of 0.16 and carries the adjustment where it can be seen.
- That is the direct disproof of C-08. Discarding the remainder would lose a fils and break the rule the brief calls non negotiable.
- Interest ignores interest already paid, so the day 6 credit does not earn on itself. 300 random balance runs all reconcile exactly.
- 89 tests pass.

<!-- entry ts=2026-09-03T00:35:10+05:30 -->
## 2026-09-03 00:35 - Step 8 - Replay and report

_24m since previous entry_

- Built src/stream.js with the two accounts and all ten events, src/replay.js to walk the window day by day, src/report.js to print it, src/main.js as the entry point.
- Added a report line that names the earlier days a backdated event rewrote, with the figure before and after. Day 5 shows three days collapsing, day 6 shows them coming back.
- Reversal handling posts an equal and opposite entry pointing at the original event id, and refuses a second reversal of the same event.
- Full run: ACC-001 closes at 390.92, three fees on days 2, 4 and 5, interest 0.92. ACC-002 closes at 10.008. 18 ledger records, none edited.
- Wrote the README including how to read every line of the output.
- 103 tests pass.

<!-- entry ts=2026-09-03T00:42:29+05:30 -->
## 2026-09-03 00:42 - Step 9 - The failing test

_7m since previous entry_

- Wrote test/design-limitation.test.js. It asserts that every overdraft fee sits on a day that is actually overdrawn in the finished ledger, and it fails.
- All three fees fail it. Days 2, 4 and 5 finish the window at 225.00, 415.00 and 390.00 after the reversal, yet each still carries a 25.00 fee.
- What it exposes: a fee stores the day it applies to but no data about the state that justified it. The note is prose, not something a later reader can check.
- Left it failing on purpose. Fixing the printed line would hide the gap rather than close it, and this is the sharpest thing I found in my own model.
- 104 tests, 103 pass, 1 fails by design.

<!-- entry ts=2026-09-03T00:50:44+05:30 -->
## 2026-09-03 00:50 - Step 10 - Review pass

_8m since previous entry_

- Checked the repo against the README claims. Zero dependencies confirmed, no em dashes anywhere, no web layer, no persistence, no float literals in the arithmetic.
- Fixed two places where the README sample output had drifted from what the replay actually prints.
- Suite stands at 104 tests: 103 pass, 1 fails by design.

# PLAN

The whole project in ten steps. Each step is one small piece of development, one
commit, and one worklog entry. Nothing in a later step is started before the step
before it passes its own tests.

Standing habits for every step:

- run `npm run log -- "<step name>" "<what happened>"` when the step is done
- commit with the one line message given in the step
- run `npm run log:commit` straight after, so the hash lands in the worklog
- if the step made me abandon an approach, write it down in REJECTED.md Part 2
- if the step forced a judgement call, write it down in AMBIGUITIES.md

---

## Step 1 - Money

**Goal.** Make it impossible to lose a fils to rounding drift.

**What gets built.** A money value that holds a whole number of the smallest unit
plus a currency code. AED counts in hundredths, BHD in thousandths. Add, subtract,
compare, negate, and format for printing. Adding two different currencies throws.
No decimal numbers anywhere inside.

**Files.** `src/money.js`, `test/money.test.js`

**Docs.** NUMBERS.md N-03, N-04, N-14, N-15. REJECTED.md R-01 and R-03.

**Done when.** Tests prove that a thousand additions of 0.01 AED give exactly
10.00, and that AED plus BHD is refused.

**Commit.** `feat: add currency aware money value stored in whole minor units so amounts can never drift through float rounding`

---

## Step 2 - Splitting an amount without losing anything

**Goal.** One function that both the BHD instalments and the interest
capitalisation will use, because underneath they are the same problem.

**What gets built.** A splitter that divides an amount into N parts, and a
matching helper that reconciles a list of rounded daily figures against a total,
so the parts always add back up to exactly the original. Leftover units go to the
earliest parts first.

**Files.** `src/allocate.js`, `test/allocate.test.js`

**Docs.** NUMBERS.md N-07 and N-10. REJECTED.md R-06 and criterion C-07.

**Done when.** BHD 10.000 into three parts gives 3.334, 3.333, 3.333 and the test
asserts the sum is exactly 10.000.

**Commit.** `feat: add largest remainder splitter so divided amounts always add back to the original with no unit invented or lost`

---

## Step 3 - Events and the append only store

**Goal.** A place to put events that can only ever grow.

**What gets built.** Frozen event records for credit, debit, authorisation,
settlement and reversal, each with an id, a booking day, a value date and an
amount. A store that appends and reads, with no update and no delete. Every
outcome is recorded, including refusals, so the trail is complete.

**Files.** `src/events.js`, `src/ledger.js`, `test/ledger.test.js`

**Docs.** AMBIGUITIES.md A-09, A-10, A-13, A-14, A-15, A-16. REJECTED.md R-04 and
R-05.

**Done when.** A test proves that trying to change or remove a stored event fails,
and that the store only ever gets longer.

**Commit.** `feat: add frozen event records and an append only store that refuses any change or delete so the audit trail cannot be edited`

---

## Step 4 - Balances

**Goal.** The core idea of the whole exercise. A balance is never stored, it is
always worked out by adding up entries.

**What gets built.** Closing balance for a day, meaning every entry whose value
date is on or before that day. Plus the same figure limited to what was known at
the end of an earlier day, which is what makes a backdated entry rewrite the past.

**Files.** `src/balances.js`, `test/balances.test.js`

**Docs.** AMBIGUITIES.md A-04. README section 5.

**Done when.** With E7 in the stream, Day 2 evaluated at end of Day 5 comes out at
minus 370.00 AED, and the same day evaluated at end of Day 4 comes out at plus
250.00.

**Commit.** `feat: derive closing balances from value dates so a backdated entry rewrites earlier days instead of touching stored totals`

---

## Step 5 - Holds, approvals and settlements

**Goal.** Keep pending money separate from real money.

**What gets built.** Available balance, meaning ledger balance minus the holds
still open. An authorisation is approved only if available balance stays at zero
or above once the hold is applied. A settlement closes its hold and writes a real
entry. A settlement with no matching authorisation is refused and no money moves.

**Files.** `src/holds.js`, `test/holds.test.js`

**Docs.** AMBIGUITIES.md A-08 and A-11. REJECTED.md C-03, C-04, C-05.

**Done when.** Auth A settles for 185.00 and releases its 200.00 hold, Auth Z is
refused with the balance untouched, and Auth B is declined on Day 5.

**Commit.** `feat: add hold tracking with available balance checks so authorisations are declined and orphan settlements never move funds`

---

## Step 6 - Overdraft fees

**Goal.** Charge the fee correctly, including the part where one fee causes the
next fee.

**What gets built.** Walk the six days in order. At each day work out the closing
balance, and if it is below zero book a 25.00 AED fee dated that same day. The fee
is a real entry, so it feeds into the next day and can push that day under too.
One fee per account per day, never two.

**Files.** `src/fees.js`, `test/fees.test.js`

**Docs.** AMBIGUITIES.md A-01, A-02, A-03, A-12. NUMBERS.md N-01 and N-12.
REJECTED.md C-02 and C-06, with the cascade arithmetic written out.

**Done when.** The run shows fees on Day 2, Day 4 and Day 5 rather than the single
fee the acceptance criteria claim, and the test spells out why.

**Commit.** `feat: assess overdraft fees day by day so each booked fee feeds the next day and can trigger a further charge`

---

## Step 7 - Interest

**Goal.** Pay interest that adds up exactly.

**What gets built.** For each day with a positive closing balance work out 0.04
percent of it and round to the currency. Keep the daily figures. At the end of Day
6 pay them as a single credit whose amount is the sum of those rounded figures,
not a fresh calculation. Nothing is thrown away.

**Files.** `src/interest.js`, `test/interest.test.js`

**Docs.** AMBIGUITIES.md A-05, A-06, A-07. NUMBERS.md N-02, N-08, N-09.
REJECTED.md C-08.

**Done when.** A test adds up the six daily figures and asserts they equal the
single capitalised credit to the last fils.

**Commit.** `feat: accrue daily interest on positive balances and capitalise the exact sum of the rounded daily figures on day six`

---

## Step 8 - The replay and the printed report

**Goal.** One command that tells the whole story.

**What gets built.** The ten events in the given order, both accounts, and a
printed block per day showing the closing balance, any fee, the state of every
authorisation, and any errors. Day 6 also shows the interest capitalisation.

**Files.** `src/stream.js`, `src/report.js`, `src/replay.js`

**Docs.** README sections 3 and 4, with the real output pasted in and every line
explained.

**Done when.** `npm run replay` prints six readable day blocks and needs no
explanation beyond the README.

**Commit.** `feat: add the six day replay driver and per day report showing balances, fees, authorisation states and errors`

---

## Step 9 - The failing test

**Goal.** Show the weak spot in my own design before anyone else finds it.

**What gets built.** One test that genuinely fails when the suite runs, aimed at a
real limitation rather than a typo. First choice is the backdated fee question
from A-01, where both readings are defensible and mine loses something. The
comments next to the assertion say what it asserts, why it fails, what that tells
you about the model, what I would change with more time, and why I left it alone.

**Files.** `test/design-limitation.test.js`

**Docs.** README section 3, so nobody thinks the repo is simply broken.

**Done when.** `npm test` is red on exactly one test, and the reason is written
next to it in plain words.

**Commit.** `test: add one deliberately failing test that exposes the backdated fee limitation with the reasoning written beside it`

---

## Step 10 - Documentation pass and review

**Goal.** The writing is the deliverable. The code is the evidence.

**What gets built.** Nothing new. Finish README, NUMBERS.md, AMBIGUITIES.md and
REJECTED.md from the notes made along the way. Check every acceptance criterion
has a verdict. Check the worklog matches the commit history. Read the whole thing
once as a stranger would.

**Files.** all four markdown deliverables

**Done when.** AMBIGUITIES.md has real depth rather than a token list, every
constant in NUMBERS.md survives the question of why not half it, and nothing in
the repo is left unexplained.

**Commit.** `docs: complete the reasoning documents with every ambiguity resolved, constant justified and acceptance criterion answered`

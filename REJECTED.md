# REJECTED.md

## Part 1 - Acceptance criteria evaluated

Format per entry: **Criterion (verbatim) / Verdict / Why / What is true instead / Evidence**

### C-01 - "The Day 2 closing ledger balance, evaluated at end of Day 5 and before any fee is assessed, is AED -370.00"

Verdict: accepted.

Why: 1,200.00 in and 950.00 out on day 1, then E7's backdated 620.00 debit which carries value date day 2. Every entry with a value date of 2 or earlier, added up, gives 250.00 - 620.00 = -370.00. The qualifier "before any fee is assessed" matters, because once the fee is charged the same day closes at -395.00.

Evidence: `test/balances.test.js`, "day 2 closing balance seen from end of day 5 is -370.00". The same test file also asserts that the identical question asked from the end of day 4 gives +250.00, which is the point of the exercise.

### C-02 - "E7 causes exactly one overdraft fee to be assessed, on Day 2"

Verdict: rejected. Two separate defects.

The count is wrong. A fee is a ledger entry, so it counts towards the following days. Charging day 2 pulls day 3 down from 30.00 to 5.00, which leaves day 4 at -180.00 instead of -155.00, which takes a second fee, which leaves day 5 at -205.00, which takes a third. Three fees, on days 2, 4 and 5.

The evidence, evaluated at the close of day 5:

    day 1     250.00   clear
    day 2    -370.00   fee, closes at -395.00
    day 3    -395.00 + 400.00 = 5.00   clear
    day 4       5.00 - 185.00 = -180.00   fee, closes at -205.00
    day 5    -205.00   fee, closes at -230.00

Note that day 4 is negative on customer activity alone, at -155.00, so it would have taken a fee even without the cascade. Day 5 would not have.

The date is also self contradictory. The criterion says the fee is assessed on day 2. On day 2 the account showed +250.00 and nobody had any reason to charge anything. The information that day 2 was overdrawn did not exist until E7 arrived on day 5. The fee can be dated day 2, which is what this implementation does, but it cannot have been assessed on day 2. The brief's own wording, "booked with value_date equal to the day assessed", is the source of the confusion, and A-01 sets out how it was resolved.

What is true instead: E7 causes three fees, dated days 2, 4 and 5, all of them discovered and booked on day 5.

### C-03 - "The Day 4 settlement of Auth-A must be accepted"

Verdict: accepted.

Why: Auth-A was authorised on day 2 for 200.00 and the hold was still open on day 4. Settling for 185.00, which is less than the amount held, is the ordinary case rather than an error. You authorise a round number at a restaurant and the bill comes in under it. The hold closes in full and the leftover 15.00 becomes available again immediately, see AMBIGUITIES.md A-11.

Evidence: `test/holds.test.js`, "E5: Auth-A settles for 185.00 and releases the whole 200.00 hold". Day 4 closes at 465.00 on customer activity alone.

### C-04 - "Any settlement referencing an authorization ID not present in the ledger must be rejected and the funds must not leave the account"

Verdict: accepted.

Why: E6 settles Auth-Z, which appears nowhere in the stream. With no authorisation there is nothing to settle against, so the settlement is refused, no entry is written and the balance is untouched. The refusal itself is recorded, with its reason, so an auditor can tell a rejected settlement from one that never arrived.

Evidence: `test/holds.test.js`, "E6: a settlement with no authorisation behind it is refused and no money moves". The balance before and after are asserted to be identical and the entry count is unchanged.

Worth one honest caveat for the defence. Real card networks do allow a forced post, where an acquirer settles without a matching authorisation and the issuer takes the loss. This implementation follows the brief rather than the network, because the brief states the rule plainly and a forced post would need a policy the brief does not give.

### C-05 - "If Auth-B is approved, its hold reduces available balance but not ledger balance"

Verdict: accepted as written, but misleading. The statement is true. Its premise never occurs.

The rule it describes is correct and is implemented: a hold reduces available balance and leaves the ledger balance alone, because no money has moved.

The problem is the "if". Auth-B is never approved. It asks for a 90.00 hold on day 5, by which point E7 has already put the account at -155.00. The rule is that available balance must remain at or above zero after the hold, and -155.00 is not at or above zero before the hold is even considered, let alone after. Auth-B is declined and no hold is ever placed. See AMBIGUITIES.md A-08 for why the rule is read as a test on the resulting balance rather than on the change.

So the criterion is a conditional whose antecedent is false, which makes it true and useless. Anyone using it as a check on the implementation would be testing nothing.

Evidence: `test/holds.test.js` proves both halves separately. "E8: Auth-B is declined because day 5 is already 155.00 overdrawn" shows the premise failing. "a hold reduces available balance but not ledger balance" proves the rule itself on Auth-A, which is the one authorisation in this stream that is actually approved: ledger balance stays at 250.00 while available drops to 50.00, and the ledger gains no entry.

### C-06 - "After E9, all balances and fees return to their pre-E7 values"

Verdict: rejected.

Balances do return. Day 2 goes from -370.00 back to +225.00, which is its pre-E7 value of 250.00 less the 25.00 fee that is still sitting on it. Fees do not return, and cannot.

Three things stand in the way. Fees were booked as real ledger entries, and the ledger is append only, so there is nothing that can remove them. A reversal in this brief reverses one named event, E7, and nothing says it cascades to everything downstream. And even a deliberate refund would be three new credits appended to the ledger, which leaves the ledger strictly longer than it was before E7, so the pre-E7 state is unreachable by construction.

The evidence: ACC-001 closes the window at 390.00. Its pre-E7 value was 465.00. The 75.00 difference is the three fees.

What is true instead: after E9, the balances return to their pre-E7 values less the fees that were assessed in between, and the fees stand.

### C-07 - "The three BHD instalments in E10 must each be BHD 3.334"

Verdict: rejected. The three instalments do not add up to the credit.

BHD has three decimal places. 10.000 divided by three is 3.3333 recurring, which the currency cannot hold. Rounding each part up to 3.334 gives:

    3.334 + 3.334 + 3.334  =  10.002

That is 0.002 BHD which nobody paid in and which the ledger has no entry for. On a single credit it is trivial. Applied across a payment file it is a reconciliation break that someone has to find and explain.

What is true instead: the instalments are 3.334, 3.333 and 3.333, which add to exactly 10.000. Every part gets the floor value first, then the one leftover unit is handed to the part that was short by the most, with ties going to the earliest. The parts are no longer equal, and that is the trade being made. A ledger survives unequal instalments. It does not survive a wrong total.

Evidence: `test/allocate.test.js`, "E10: BHD 10.000 in three instalments adds back to exactly 10.000", plus a property test that splits every amount from 0.00 to 4.99 into one through seven parts and asserts the parts always reconcile. `test/money.test.js` holds the counter proof, "three BHD instalments of 3.334 really do overshoot the total".

This is the same mistake as C-08. Both criteria assume a rounding difference can be waved away, and in both cases waving it away breaks the books.

Verdict:

### C-08 - "If the rounded daily interest accruals do not sum to the capitalized total, the remainder is discarded"

Verdict: rejected. It contradicts the brief's own non negotiable rule, which states that the rounded daily accruals must sum exactly to the capitalised total. A rule cannot both require an exact match and permit throwing away the difference.

The evidence, on ACC-001. The six closing balances are 250.00, 225.00, 625.00, 415.00, 390.00 and 390.00. Rounding each day's interest on its own gives:

    0.10 + 0.09 + 0.25 + 0.17 + 0.16 + 0.16  =  0.93

The week's actual interest is 0.04% of 2,295.00, which is 0.918, and that rounds to 0.92. So the independently rounded days overshoot by one fils. Discarding it leaves a credit of 0.92 sitting under daily figures that add to 0.93, and the two never reconcile.

What is true instead: the remainder is allocated, not discarded. The total is rounded once, then shared back across the days by largest remainder, giving:

    0.10 + 0.09 + 0.25 + 0.17 + 0.16 + 0.15  =  0.92

Day 6 carries the adjustment, taking 0.15 rather than its own 0.16. Nothing is invented and nothing is lost, and the daily figures reconcile to the credit by construction rather than by luck.

This is the same correction as C-07. Both criteria assume a rounding difference can be ignored, and in both cases ignoring it breaks the books.
Verdict:

## Part 2 - Approaches abandoned mid-build

### R-01 - Floating-point amounts

Tried first because it is the obvious choice. Dropped when I split BHD 10.000 three ways by hand and the parts did not add back to 10.000. The loss happens inside the number itself, so no care at the call site fixes it. Replaced with whole minor units. The proof is kept as a live test that adds 0.01 AED a thousand times and lands exactly on 10.00.

### R-02 - Stored, incrementally-updated balance field

The first shape I sketched had a `balance` on each account, updated as each event was applied. It is the obvious design and it is what most systems do.

Dropped at E7. A debit that arrives on day 5 with value date day 2 means day 2's balance changes after day 2 has closed. With a stored balance there are only two ways forward: go back and overwrite day 2's saved figure, which is exactly the mutation the brief forbids, or leave it stale and let the ledger disagree with itself. Neither is acceptable.

Replaced by deriving every balance from the entries on demand. The stored balance became a stored list of entries, and the balance became a question you ask it. E7 then needs no special handling at all: it is appended like anything else and day 2's answer changes on its own the next time anyone asks. See AMBIGUITIES.md A-04.

The wider lesson, and the one I would lead with in a defence: in a system where facts can arrive late, a cached total is not an optimisation, it is a second source of truth that will eventually disagree with the first.

### R-03 - Third-party decimal library

Looked at decimal.js and dinero.js. Both work. Dropped for two reasons: the rounding is the part being assessed, so importing it removes the point, and zero dependencies is easier to audit and defend. Cost is about 150 lines of my own. The interface would let a library slot in later without touching anything else.

### R-04 - Mutating events with a `reversed` flag

The obvious way to handle E9 is to find E7 and set `reversed: true` on it. Dropped because it breaks the one rule the brief calls non negotiable: no event record is ever mutated. It also loses information. A flag tells you the debit was reversed but not when, not by whom and not under which event id. A separate reversal entry carries all of that.

### R-05 - Deleting or skipping E7 on reversal

Second attempt at the same problem: leave E7 in the event list but skip it when adding up the balance. Dropped for the same reason. Skipping is deleting with extra steps, and it makes the balance depend on hidden logic rather than on the entries you can see. The reversal is now a real 620.00 credit sitting in the ledger where anyone can read it.

### R-06 - Separate rounding logic for instalments and for interest

I started to write the instalment split and the interest capitalisation as two separate pieces of code. Dropped once I saw they are the same question asked twice: take a total, break it into parts the currency can express, make the parts add back to the total. One function now serves both, with equal weights for the instalments and per day weights for the interest. Two copies would have been two places to get the rounding wrong.

### R-07 - Single-pass fee assessment across all six days

My first version worked out all six closing balances, then counted the negative ones and charged a fee for each. It gave one fee, on day 2, which looked like it agreed with the acceptance criteria.

Dropped once I saw why it agreed. A fee is a ledger entry with a value date, so charging day 2 changes what day 3 and day 4 are worth. A single pass reads all six balances before any fee exists, so it never sees the days that only go negative because of the fees before them. Rewritten to walk the days in order and book each fee before looking at the next day, which produces three fees rather than one.

The lesson worth keeping: with this rule, order of evaluation is not a style choice, it changes the answer.

### R-08 - Express / HTTP scaffold

Never built. Noting it because Express was my instinct as a Node developer and the brief forbids a web layer outright. There is no server, no route, no port and no framework anywhere in this repository. The entire thing runs as `npm run replay` and `npm test`.

### R-09 - Making the failing test pass by improving the fee note

Once the deliberately failing test was written, the tempting fix was to change the report so a fee prints as "charged on day 5 for day 2, which stood at -370.00 at the time". That reads well and nobody would question it.

Dropped, because it fixes the sentence rather than the model. The fee still holds no data about the state that justified it, only a longer piece of prose about it. The gap would be exactly where it was, just harder to notice. The test stays red and the limitation stays visible, which is the point of the exercise.
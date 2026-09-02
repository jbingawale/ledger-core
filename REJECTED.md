# REJECTED.md

## Part 1 - Acceptance criteria evaluated

Format per entry: **Criterion (verbatim) / Verdict / Why / What is true instead / Evidence**

### C-01 - "The Day 2 closing ledger balance, evaluated at end of Day 5 and before any fee is assessed, is AED -370.00"

Verdict:

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

Verdict:

### C-04 - "Any settlement referencing an authorization ID not present in the ledger must be rejected and the funds must not leave the account"

Verdict:

### C-05 - "If Auth-B is approved, its hold reduces available balance but not ledger balance"

Verdict:

### C-06 - "After E9, all balances and fees return to their pre-E7 values"

Verdict: rejected.

Balances do return. Day 2 goes from -370.00 back to +225.00, which is its pre-E7 value of 250.00 less the 25.00 fee that is still sitting on it. Fees do not return, and cannot.

Three things stand in the way. Fees were booked as real ledger entries, and the ledger is append only, so there is nothing that can remove them. A reversal in this brief reverses one named event, E7, and nothing says it cascades to everything downstream. And even a deliberate refund would be three new credits appended to the ledger, which leaves the ledger strictly longer than it was before E7, so the pre-E7 state is unreachable by construction.

The evidence: ACC-001 closes the window at 390.00. Its pre-E7 value was 465.00. The 75.00 difference is the three fees.

What is true instead: after E9, the balances return to their pre-E7 values less the fees that were assessed in between, and the fees stand.

### C-07 - "The three BHD instalments in E10 must each be BHD 3.334"

Verdict:

### C-08 - "If the rounded daily interest accruals do not sum to the capitalized total, the remainder is discarded"

Verdict:

## Part 2 - Approaches abandoned mid-build

### R-01 - Floating-point amounts

Tried first because it is the obvious choice. Dropped when I split BHD 10.000 three ways by hand and the parts did not add back to 10.000. The loss happens inside the number itself, so no care at the call site fixes it. Replaced with whole minor units. The proof is kept as a live test that adds 0.01 AED a thousand times and lands exactly on 10.00.

### R-02 - Stored, incrementally-updated balance field

### R-03 - Third-party decimal library

Looked at decimal.js and dinero.js. Both work. Dropped for two reasons: the rounding is the part being assessed, so importing it removes the point, and zero dependencies is easier to audit and defend. Cost is about 150 lines of my own. The interface would let a library slot in later without touching anything else.

### R-04 - Mutating events with a `reversed` flag

The obvious way to handle E9 is to find E7 and set `reversed: true` on it. Dropped because it breaks the one rule the brief calls non negotiable: no event record is ever mutated. It also loses information. A flag tells you the debit was reversed but not when, not by whom and not under which event id. A separate reversal entry carries all of that.

### R-05 - Deleting or skipping E7 on reversal

Second attempt at the same problem: leave E7 in the event list but skip it when adding up the balance. Dropped for the same reason. Skipping is deleting with extra steps, and it makes the balance depend on hidden logic rather than on the entries you can see. The reversal is now a real 620.00 credit sitting in the ledger where anyone can read it.

### R-06 - Separate rounding logic for instalments and for interest

I started to write the instalment split and the interest capitalisation as two separate pieces of code. Dropped once I saw they are the same question asked twice: take a total, break it into parts the currency can express, make the parts add back to the total. One function now serves both, with equal weights for the instalments and per day weights for the interest. Two copies would have been two places to get the rounding wrong.

### R-07 - Single-pass fee assessment across all six days

### R-08 - Express / HTTP scaffold

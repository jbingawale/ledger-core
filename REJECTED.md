# REJECTED.md

## Part 1 - Acceptance criteria evaluated

Format per entry: **Criterion (verbatim) / Verdict / Why / What is true instead / Evidence**

### C-01 - "The Day 2 closing ledger balance, evaluated at end of Day 5 and before any fee is assessed, is AED -370.00"

Verdict:

### C-02 - "E7 causes exactly one overdraft fee to be assessed, on Day 2"

Verdict:

### C-03 - "The Day 4 settlement of Auth-A must be accepted"

Verdict:

### C-04 - "Any settlement referencing an authorization ID not present in the ledger must be rejected and the funds must not leave the account"

Verdict:

### C-05 - "If Auth-B is approved, its hold reduces available balance but not ledger balance"

Verdict:

### C-06 - "After E9, all balances and fees return to their pre-E7 values"

Verdict:

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

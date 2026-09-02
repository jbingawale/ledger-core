# REJECTED.md

## Part 1 — Acceptance criteria evaluated

Format per entry: **Criterion (verbatim) / Verdict / Why / What is true instead / Evidence**

### C-01 — "The Day 2 closing ledger balance, evaluated at end of Day 5 and before any fee is assessed, is AED -370.00"

Verdict:

### C-02 — "E7 causes exactly one overdraft fee to be assessed, on Day 2"

Verdict:

### C-03 — "The Day 4 settlement of Auth-A must be accepted"

Verdict:

### C-04 — "Any settlement referencing an authorization ID not present in the ledger must be rejected and the funds must not leave the account"

Verdict:

### C-05 — "If Auth-B is approved, its hold reduces available balance but not ledger balance"

Verdict:

### C-06 — "After E9, all balances and fees return to their pre-E7 values"

Verdict:

### C-07 — "The three BHD instalments in E10 must each be BHD 3.334"

Verdict:

### C-08 — "If the rounded daily interest accruals do not sum to the capitalized total, the remainder is discarded"

Verdict:

## Part 2 — Approaches abandoned mid-build

### R-01 — Floating-point amounts

### R-02 — Stored, incrementally-updated balance field

### R-03 — Third-party decimal library

### R-04 — Mutating events with a `reversed` flag

### R-05 — Deleting or skipping E7 on reversal

### R-06 — Separate rounding logic for instalments and for interest

### R-07 — Single-pass fee assessment across all six days

### R-08 — Express / HTTP scaffold

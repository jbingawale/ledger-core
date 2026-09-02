# NUMBERS.md

Every constant in this codebase, and why it is that value and not half it.

Format per entry: **Value / Source / Why not half it / Where it lives**

## Constants given by the specification

### N-01 - Overdraft fee: AED 25.00

### N-02 - Daily interest rate: 0.04%

### N-03 - AED minor-unit scale: 2

Value 2, from ISO 4217. Not 1, because one place cannot express a 25 fils fee or a 0.05 accrual. Not 4, because no AED payment rail settles that. Lives in `CURRENCIES.AED.scale`.

### N-04 - BHD minor-unit scale: 3

Value 3, from ISO 4217. Bahrain is one of the few three place currencies. Not 2, because the third place is exactly where the E10 split problem lives. Lives in `CURRENCIES.BHD.scale`.

The scale is attached to each currency, not shared across the project. That is what makes AED plus BHD a thrown error instead of a silent wrong number.

### N-05 - Window length: 6 days

### N-06 - Opening balances: 0.00 / 0.000

## Constants chosen by me

### N-07 - Rounding mode

### N-08 - Interest basis (which balance the rate applies to)

### N-09 - Day-count convention (simple, non-compounding within window)

### N-10 - Residual allocation direction (earliest-first)

### N-11 - Instalment count: 3, and why they are not equal

### N-12 - Overdraft fee cap: none

### N-13 - Hold expiry: none within the window

### N-14 - Integer representation (number vs BigInt)

A JavaScript number is exact up to about 9 quadrillion. The largest amount here is 120,000 fils, so there is huge headroom. BigInt would be right for a real bank wide ledger and is a one file change. A `Number.isSafeInteger` guard throws the day that assumption breaks.

### N-15 - Epsilon: none, because there is no float anywhere

There is no epsilon and no tolerance in this codebase. Tolerances exist only because float comparison is unreliable. Every comparison here is between two whole numbers, so it is exact. A tolerance would let the ledger call two different balances equal, which is the one thing a ledger must never do.

## Constants deliberately NOT introduced

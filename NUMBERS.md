# NUMBERS.md

Every constant in this codebase, and why it is that value and not half it.

Format per entry: **Value / Source / Why not half it / Where it lives**

## Constants given by the specification

### N-01 — Overdraft fee: AED 25.00

### N-02 — Daily interest rate: 0.04%

### N-03 — AED minor-unit scale: 2

### N-04 — BHD minor-unit scale: 3

### N-05 — Window length: 6 days

### N-06 — Opening balances: 0.00 / 0.000

## Constants chosen by me

### N-07 — Rounding mode

### N-08 — Interest basis (which balance the rate applies to)

### N-09 — Day-count convention (simple, non-compounding within window)

### N-10 — Residual allocation direction (earliest-first)

### N-11 — Instalment count: 3, and why they are not equal

### N-12 — Overdraft fee cap: none

### N-13 — Hold expiry: none within the window

### N-14 — Integer representation (number vs BigInt)

### N-15 — Epsilon: none, because there is no float anywhere

## Constants deliberately NOT introduced

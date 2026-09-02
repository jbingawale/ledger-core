# NUMBERS.md

Every constant in this codebase, and why it is that value and not half it.

Format per entry: **Value / Source / Why not half it / Where it lives**

## Constants given by the specification

### N-01 - Overdraft fee: AED 25.00

Value 25.00 AED, given by the brief. Stored as 2500 fils in `OVERDRAFT_FEE` in `src/fees.js`.

Why not half it: the figure is fixed by the brief, but the shape of it is worth defending. It is flat rather than a percentage, which means it does not care how far overdrawn you are. That is deliberate in real products: the fee pays for the decision to let the payment through, and that decision costs the same whether the account is 1.00 or 1,000.00 short. Halving it to 12.50 would not change any behaviour in this run, only the closing balances, because every day that goes negative here is negative by far more than 25.00. Doubling it to 50.00 would change the story: day 3 would fall from 5.00 to -20.00 and take a fourth fee, so the cascade is sensitive to this number even though the rule is not.

It is also once per day rather than once per overdrawn entry. Day 2 has one fee even though two separate debits contributed to it going negative.

### N-02 - Daily interest rate: 0.04%

Value 0.04% per day, given by the brief. Held in `DAILY_RATE` in `src/interest.js` as the fraction 4 over 10000, never as the decimal 0.0004, so nothing in the calculation is ever a floating point number.

Why not half it: at 0.02% ACC-001's week would earn 0.46 rather than 0.92, and more to the point the rounding problem would still be there, because it comes from six separate roundings rather than from the size of the rate. What the number does control is how visible the problem is. At this rate the daily figures are small enough that a single fils of adjustment shows up clearly. At a much larger rate the adjustment would be lost in the noise, and at a much smaller one every day would round to zero and there would be nothing to reconcile.

Note it is 0.04% per day, not per year. Over a year that is about 15%, which is high for a deposit rate but this is a six day window and the brief is explicit.

### N-03 - AED minor-unit scale: 2

Value 2, from ISO 4217. Not 1, because one place cannot express a 25 fils fee or a 0.05 accrual. Not 4, because no AED payment rail settles that. Lives in `CURRENCIES.AED.scale`.

### N-04 - BHD minor-unit scale: 3

Value 3, from ISO 4217. Bahrain is one of the few three place currencies. Not 2, because the third place is exactly where the E10 split problem lives. Lives in `CURRENCIES.BHD.scale`.

The scale is attached to each currency, not shared across the project. That is what makes AED plus BHD a thrown error instead of a silent wrong number.

### N-05 - Window length: 6 days

### N-06 - Opening balances: 0.00 / 0.000

## Constants chosen by me

### N-07 - Rounding mode

Round down, then hand the leftover units back out. Not round half up on each part independently, because that is what produces 3.334 three times and a total of 10.002. Flooring can only ever lose, never gain, and the leftover step gives back exactly what was lost. Lives in `distribute` in `src/allocate.js`.

### N-08 - Interest basis (which balance the rate applies to)

The closing ledger balance of each day, taken as it finally stands at the end of the window, positive days only, with fees included and interest excluded. See AMBIGUITIES.md A-05, A-06 and A-07 for each of those three choices.

Positive only means strictly above zero. A day closing at exactly 0.00 earns nothing, which matters because 0.04% of zero is zero anyway, so the rule only really matters as a statement that negative days do not produce negative interest.

### N-09 - Day-count convention (simple, non-compounding within window)

Simple interest. Each day's accrual is worked out on that day's own closing balance, and no accrual is added to the balance before the next day is worked out.

Why not compound daily: the brief says accruals capitalise as a single credit at the end of day 6. Capitalise is the word for the moment interest joins the balance and starts earning, so saying it happens once at the end says plainly that it does not happen six times along the way. Compounding daily over six days at this rate would change the credit by well under a fils, so the difference is invisible here, but the rule would matter over a year.

### N-09 - Day-count convention (simple, non-compounding within window)

### N-10 - Residual allocation direction (earliest-first)

Leftover units go to whichever part was short by the most. When several are equally short, the earliest part wins.

Not last-first, and not random. Earliest-first means the same input always gives the same output, so an auditor re-running the split six months later gets the identical answer. Last-first would work equally well as arithmetic, but it hides the adjustment at the end of the list where people stop reading.

### N-11 - Instalment count: 3, and why they are not equal

Three, given by E10. They come out as 3.334, 3.333, 3.333 rather than three identical figures. BHD 10.000 simply does not divide by three, so something has to give: either the parts are unequal or the total is wrong. A ledger can survive unequal parts. It cannot survive a wrong total.

### N-12 - Overdraft fee cap: none

No cap on the number of fees an account can take in the window. The brief gives a per day limit and nothing else, so a per window limit would be invented. In this run the account takes three fees over six days, which is well short of the six that would be possible. Real products often cap this, but any number chosen here would be mine rather than the brief's, and it would change the closing balance. Refusing to add a constant is itself the decision.

### N-13 - Hold expiry: none within the window

No expiry, because the brief never mentions one. Real card holds usually expire after 7 to 30 days depending on the scheme, but picking any of those numbers would be inventing a rule that changes the answer. A 5 day expiry would silently release Auth-B before the window closes. Not halving or doubling a number here, refusing to introduce one at all.

### N-14 - Integer representation (number vs BigInt)

A JavaScript number is exact up to about 9 quadrillion. The largest amount here is 120,000 fils, so there is huge headroom. BigInt would be right for a real bank wide ledger and is a one file change. A `Number.isSafeInteger` guard throws the day that assumption breaks. In production grade we can use decimal.js for handling numbers more proerly.

### N-15 - Epsilon: none, because there is no float anywhere

There is no epsilon and no tolerance in this codebase. Tolerances exist only because float comparison is unreliable. Every comparison here is between two whole numbers, so it is exact. A tolerance would let the ledger call two different balances equal, which is the one thing a ledger must never do.

## Constants deliberately NOT introduced

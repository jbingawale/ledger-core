# Account Ledger Core

## 1. What this is

An in-memory account ledger core. It replays a six day stream of banking events
across two accounts and prints, for each day, the closing balance, any overdraft
fee, the state of every authorisation, and anything that went wrong.

There is no web layer, no database, no user interface and nothing is written to
disk. It is a library and a script that exercises it.

Three ideas do most of the work:

- an amount is a whole number of the smallest unit of its currency, never a decimal
- the ledger only ever grows, so a mistake is fixed by adding a line, not by editing one
- a balance is not stored anywhere, it is worked out from the entries every time it is asked for

## 2. Requirements

Node 20 or newer. Nothing else. There are no runtime dependencies and no
development dependencies, so there is nothing to install.

## 3. How to run

### Replay the six-day event stream

```
npm run replay
```

Prints one block per day, then a summary. This is the main thing to look at.

### Run the test suite

```
npm test
```

One test fails on purpose. See below.

### Run the deliberately failing test

```
npm run test:failing
```

`test/design-limitation.test.js` is expected to be red. It is not a bug that
slipped through, it is a limitation of my own design written down as a test, with
the reasoning in the comments next to the assertion. The repository is working
correctly when exactly this one test fails and every other test passes.

## 4. How to read the output

### Sample day block

This is day 5, the most interesting day in the window.

```
==========================================================================
DAY 5
==========================================================================

events booked today
  E7   DEBIT          ACC-001      620.00  posted    value date day 2
  E8   AUTHORIZATION  ACC-001       90.00  declined  available -155.00, hold would leave -245.00
  E10  CREDIT         ACC-002       10.000 posted    3 instalments

  ACC-001 (AED)
  earlier days rewritten by what arrived today:
    day 2: 250.00 becomes -370.00
    day 3: 650.00 becomes 30.00
    day 4: 465.00 becomes -155.00
  closing ledger balance      -230.00
  holds                          0.00
  available balance           -230.00
  overdraft fee          -25.00 for day 2, which closed at -370.00; -25.00 for day 4,
                         which closed at -180.00; -25.00 for day 5, which closed at -205.00
  authorisations       Auth-A  SETTLED   200.00
                       Auth-Z  DECLINED  180.00
                       Auth-B  DECLINED  90.00

errors
  E8    ACC-001  available balance AED -155.00 cannot cover a hold of 90.00, it would leave -245.00
```

### events booked today

What the bank heard about on this day, with what happened to each one. The
outcome word is one of `posted`, `approved`, `declined`, `settled`, `refused` or
`reversed`.

If an event counts from an earlier day, the line says `value date day N`. E7 is
the case worth watching: it arrives on day 5 but counts from day 2.

### earlier days rewritten by what arrived today

Only appears when something backdated turns up. It lists the earlier days whose
closing balance changed because of it, with the figure before and after.

Nothing was edited to make this happen. The balance for a day is a sum over the
entries, so adding one entry with an old value date changes what that sum comes
to. Day 5 shows three days collapsing. Day 6 shows the reversal putting them back.

### closing ledger balance

Every entry whose value date is on or before this day, added up, as far as anyone
knew at the end of this day.

The last part matters. The same day can honestly print different figures on
different days. Day 2 closes at 250.00 on day 2, at -395.00 on day 5, and at
225.00 on day 6. All three are correct answers to the question at the time it was
asked.

### holds and available balance

`holds` is money set aside by an approved authorisation that has not settled yet.
It has not left the account, so the ledger balance does not move.

`available balance` is the ledger balance minus those holds. It is what the
customer could actually spend, and it is the figure an authorisation is tested
against.

### overdraft fee

`none`, or the fees charged at the close of this day, each with the day it is
dated to and the balance that triggered it.

Note that a fee can be dated an earlier day than the one it appears under. All
three of ACC-001's fees are found on day 5, when the backdated debit arrives, but
they are dated days 2, 4 and 5, because those are the days the account was
actually overdrawn. AMBIGUITIES.md A-01 explains that choice.

Note also that fees feed forward. The day 2 fee is part of day 3's balance, which
is what leaves day 4 low enough to take a fee of its own.

### authorisations

Every authorisation seen so far and where it stands:

- `OPEN` approved, money still set aside, not settled yet
- `SETTLED` closed, the money has moved and the hold is released
- `DECLINED` refused, nothing was set aside and no money moved

Auth-Z shows as `DECLINED` because a settlement arrived for an authorisation that
never existed.

### errors

Anything refused on this day, with the reason. An empty line here reads `none`.

Refusals are recorded in the ledger like everything else. A refused event and an
event that never arrived have to look different to anyone auditing this later.

### Day 6 interest capitalisation

Day 6 has an extra block:

```
  interest capitalised 0.92 credited today
    day 1 on     250.00 accrued 0.10
    day 2 on     225.00 accrued 0.09
    day 3 on     625.00 accrued 0.25
    day 4 on     415.00 accrued 0.17
    day 5 on     390.00 accrued 0.16
    day 6 on     390.00 accrued 0.15
                     accruals add up to 0.92
```

Interest accrues daily at 0.04% on positive balances and is paid as a single
credit at the end of day 6. The daily figures shown add up to the credit exactly.

Day 6 is the line to look at. On its own it would round to 0.16, the same as day
5. It shows 0.15 because the week's true interest is 0.918, which rounds to 0.92,
and one fils has to come off somewhere for the days to reconcile to the credit.
That adjustment is deliberate and visible rather than silently dropped.
REJECTED.md C-08 covers why.

### The summary

At the end:

```
  ACC-001 (AED)
  closing ledger balance       390.92
  overdraft fees charged            3  on days 2, 4, 5
  interest capitalised           0.92
```

ACC-001 ends at 390.92. That is 465.00 of customer activity, less 75.00 of
overdraft fees, plus 0.92 of interest. The fees stand even though the reversal on
day 6 lifted every day back above zero, which is why the account does not return
to 465.00. REJECTED.md C-06 covers that.

The last two lines report how many records were written and confirm that none of
them was edited or removed.

## 5. The model in five bullets

- **Two dates on every event.** The booking day is when the bank found out. The value date is the day it counts. E7 arrives on day 5 and counts from day 2.
- **Append only.** Nothing is updated and nothing is deleted. A reversal is a new opposite entry, so the ledger gets longer even when money goes back.
- **Balances are derived.** No balance is stored. Every one is a sum over the entries, filtered by value date and by what was known at the time.
- **Two balances, not one.** The ledger balance is what moved. The available balance is that minus holds, and it is what an authorisation is tested against.
- **Money is whole units.** AED counts in hundredths, BHD in thousandths. No decimal number appears anywhere in the arithmetic.

## 6. Repo map

| File | What it owns |
| --- | --- |
| `src/money.js` | amounts as whole minor units, currency aware, no floats |
| `src/allocate.js` | splitting a total into parts that add back to it exactly |
| `src/events.js` | the input record types, frozen once created |
| `src/ledger.js` | the append only store of entries, holds and refusals |
| `src/balances.js` | closing balance for a day, as known on a day |
| `src/holds.js` | available balance, authorisations, settlements |
| `src/fees.js` | overdraft fee assessment, day by day |
| `src/interest.js` | daily accrual and the single capitalised credit |
| `src/stream.js` | the two accounts and the ten events from the brief |
| `src/replay.js` | walks the window and produces the report data |
| `src/report.js` | turns that into the printed output |
| `src/main.js` | entry point for `npm run replay` |
| `tools/worklog.mjs` | appends timestamped worklog entries |

## 7. Where the reasoning lives

| Document | What is in it |
| --- | --- |
| `AMBIGUITIES.md` | every gap found in the brief and how it was resolved |
| `NUMBERS.md` | every constant, and why that value and not half it |
| `REJECTED.md` | the acceptance criteria that are wrong, and approaches abandoned mid build |
| `PLAN.md` | the ten steps this was built in |
| `WORKLOG.md` | timestamped record of the work, written as it happened |

Start with REJECTED.md if you only read one. Four of the eight acceptance
criteria do not survive contact with the arithmetic, and a fifth is true but
misleading.

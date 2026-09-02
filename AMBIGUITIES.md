# AMBIGUITIES.md

Every ambiguity found in the specification, and how it was resolved.

Format per entry:

```
Ambiguity:   what the spec does not say
Readings:    (a) ... (b) ... [(c) ...]
Chosen:      (a)
Rationale:   why
Impact:      which numbers move if you flip it
Reversible:  where in the code the switch lives
```

---

## A-01 - Retroactive fee assessment on a day that already closed

## A-02 - Fee cascade: do assessed fees feed into later days' balances?

## A-03 - Does a reversal also reverse the fees it caused?

## A-04 - Recompute-from-events vs append-correcting-entries when history changes

## A-05 - Which version of a revised day's balance earns interest?

## A-06 - Does the capitalized interest credit itself earn interest?

## A-07 - Do fee entries count toward the interest-bearing balance?

## A-08 - Auth-B: declined when available balance was already negative before the hold

## A-09 - Are declined authorizations recorded in the ledger?

Ambiguity: the brief describes what happens when an authorisation is approved. It never says what happens to one that is declined.

Readings: (a) record the attempt and its refusal, (b) drop it silently and record nothing.

Chosen: (a).

Rationale: append only exists so the ledger can be audited. If a decline leaves no mark, an auditor cannot tell a declined authorisation from one that was never sent, which is exactly the difference they would want to see. Auth-B is the live case, and it is the only trace that the customer tried.

Impact: the record count changes but no balance moves. A refusal never touches money.

Reversible: `Ledger.refuse` in `src/ledger.js`. Stop calling it and the behaviour flips.

## A-10 - Are rejected events (E6) recorded in the ledger?

Ambiguity: the criteria say an orphan settlement must be rejected and the funds must not move. They do not say whether the rejection itself is written down.

Readings: (a) write a refusal record naming the event and the reason, (b) ignore the event entirely.

Chosen: (a), same reasoning as A-09.

Rationale: E6 is a settlement for 180.00 against an authorisation that does not exist. That is either a bug upstream or an attempted fraud, and either way it is the single most interesting thing in the six day window. Losing it would be the worst possible outcome.

Impact: none on any balance.

Reversible: same place as A-09.

## A-11 - Settlement below the held amount: when is the difference released?

## A-12 - Overdraft fee currency vs account currency (AED fee on a BHD account)

## A-13 - E10: three entries or one entry with three components?

Ambiguity: E10 is one credit of BHD 10.000 "posted as three equal instalments". It does not say whether that is one ledger line or three.

Readings: (a) three separate entries of 3.334, 3.333 and 3.333, (b) one entry of 10.000 that happens to have been calculated in three parts.

Chosen: (a).

Rationale: the brief says posted as three instalments, and posted is a ledger word. Three lines is also the only version where the rounding is visible to a reader, which is the point of the event. One line of 10.000 would hide the interesting part.

Impact: the day 5 closing balance for ACC-002 is BHD 10.000 either way. Only the number of lines differs.

Reversible: the instalment count is carried on the event itself, so it is data, not logic.

## A-14 - Ordering of entries sharing the same value_date

Ambiguity: several entries land on value date day 2. The brief gives no ordering rule for entries inside one day.

Readings: (a) order by the sequence they were added to the ledger, (b) order by amount or type.

Chosen: (a).

Rationale: addition order is the only ordering that is a fact rather than an opinion. It also matches the replay order given in the brief. Since the closing balance for a day is a sum, order does not change the balance, but it does change how the report reads, and it decides which line comes first when two are otherwise identical.

Impact: no balance changes. Only the printed order.

Reversible: `seq` on every record in `src/ledger.js`.

## A-15 - Reversal identity: by event ID, not by amount matching

Ambiguity: E9 reverses E7. The brief does not say how a reversal finds its target.

Readings: (a) by the event id it names, (b) by finding an entry with a matching amount and value date.

Chosen: (a).

Rationale: amount matching breaks the moment two identical debits exist on the same day, which is a normal thing to happen. Reversal by id is unambiguous even then. The validator refuses a reversal that does not name an event.

Impact: none in this stream, because there is only one 620.00 debit. It matters the first time there are two.

Reversible: `reverses` on the reversal event in `src/events.js`.

## A-16 - Day boundaries: no timestamps, only day numbers

Ambiguity: the brief works in day numbers, 1 through 6. There are no clock times, no time zone and no cut off.

Readings: (a) treat a day as one indivisible bucket, (b) invent timestamps and a cut off time.

Chosen: (a).

Rationale: inventing a cut off would add a constant nobody asked for and would change which day an event lands on. A day is the smallest unit the brief recognises, so it is the smallest unit the code recognises.

Impact: everything inside a day is simultaneous. Ordering within a day comes from arrival order only, see A-14.

Reversible: days are plain whole numbers throughout, so a timestamp could replace them without changing the shape of the model.

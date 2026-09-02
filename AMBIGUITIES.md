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

## A-10 - Are rejected events (E6) recorded in the ledger?

## A-11 - Settlement below the held amount: when is the difference released?

## A-12 - Overdraft fee currency vs account currency (AED fee on a BHD account)

## A-13 - E10: three entries or one entry with three components?

## A-14 - Ordering of entries sharing the same value_date

## A-15 - Reversal identity: by event ID, not by amount matching

## A-16 - Day boundaries: no timestamps, only day numbers

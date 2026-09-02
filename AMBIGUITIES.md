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

This is the central ambiguity of the whole brief. Everything else is downstream of it.

Ambiguity: E7 arrives on day 5 carrying value date day 2, and reveals that day 2 closed at -370.00 rather than the +250.00 everyone believed at the time. Day 2 has been shut for three days. The rule says a fee is "assessed once per day per account when that day's closing balance is negative", and "booked with value_date equal to the day assessed". Neither sentence says what to do when the negative day is discovered late, and the phrase "the day assessed" can mean either the day being assessed or the day on which the assessing happens.

Readings:

(a) Charge for day 2 when we find out on day 5, and date the fee day 2. The fee belongs to the day the account was actually overdrawn.

(b) Charge for day 2 when we find out on day 5, but date the fee day 5, because that is the day the assessment happened.

(c) Do not charge at all. Day 2 closed clean on day 2 and a closed day is closed.

Chosen: (a).

Rationale: the fee exists because the account was overdrawn on a particular day, so the fee belongs to that day. Reading (b) breaks the once per day rule in an ugly way, because three separate overdrawn days would all pile onto day 5 and the account would take three fees dated the same day. Reading (c) means a customer can avoid every fee by having their debits reported late, which turns a fee rule into an incentive to file late.

Impact: this is where the arithmetic diverges most. Under (a) the fee lands on day 2, which drags day 3 down to 5.00 and starts the cascade that produces fees on days 4 and 5 as well. Under (c) there are no fees at all in this run.

Reversible: `assessFeesAtClose` in `src/fees.js` takes the day being closed and walks back over every earlier day. Restricting that loop to the closing day alone gives reading (c).

The cost of this choice: a day can be charged a fee and then, after a later reversal, end up positive. Day 2 finishes the window at +225.00 with a 25.00 fee sitting on it. That looks wrong until you remember the account really was overdrawn as far as the bank knew, and that an append only ledger cannot take a fee back. This is the exact case the deliberately failing test in `test/design-limitation.test.js` is built on.

## A-01 - Retroactive fee assessment on a day that already closed

This is the central ambiguity of the whole brief. Everything else is downstream of it.

Ambiguity: E7 arrives on day 5 carrying value date day 2, and reveals that day 2 closed at -370.00 rather than the +250.00 everyone believed at the time. Day 2 has been shut for three days. The rule says a fee is "assessed once per day per account when that day's closing balance is negative", and "booked with value_date equal to the day assessed". Neither sentence says what to do when the negative day is discovered late, and the phrase "the day assessed" can mean either the day being assessed or the day on which the assessing happens.

Readings:

(a) Charge for day 2 when we find out on day 5, and date the fee day 2. The fee belongs to the day the account was actually overdrawn.

(b) Charge for day 2 when we find out on day 5, but date the fee day 5, because that is the day the assessment happened.

(c) Do not charge at all. Day 2 closed clean on day 2 and a closed day is closed.

Chosen: (a).

Rationale: the fee exists because the account was overdrawn on a particular day, so the fee belongs to that day. Reading (b) breaks the once per day rule in an ugly way, because three separate overdrawn days would all pile onto day 5 and the account would take three fees dated the same day. Reading (c) means a customer can avoid every fee by having their debits reported late, which turns a fee rule into an incentive to file late.

Impact: this is where the arithmetic diverges most. Under (a) the fee lands on day 2, which drags day 3 down to 5.00 and starts the cascade that produces fees on days 4 and 5 as well. Under (c) there are no fees at all in this run.

Reversible: `assessFeesAtClose` in `src/fees.js` takes the day being closed and walks back over every earlier day. Restricting that loop to the closing day alone gives reading (c).

The cost of this choice: a day can be charged a fee and then, after a later reversal, end up positive. Day 2 finishes the window at +225.00 with a 25.00 fee sitting on it. That looks wrong until you remember the account really was overdrawn as far as the bank knew, and that an append only ledger cannot take a fee back. This is the exact case the deliberately failing test in `test/design-limitation.test.js` is built on.

## A-02 - Fee cascade: do assessed fees feed into later days' balances?

Ambiguity: a fee is booked as a ledger entry with a value date. The brief does not say whether that entry counts when working out whether the following day is overdrawn.

Readings: (a) yes, a fee is an ordinary entry and counts like any other, (b) no, fees are excluded when testing for overdraft, so only customer activity can trigger a fee.

Chosen: (a).

Rationale: the rule defines the closing balance as all entries with value date on or before that day. A fee is an entry. Excluding it would need a special rule that the brief does not contain, and it would mean the printed closing balance and the balance used for the fee test are two different numbers, which is exactly the kind of hidden second truth a ledger should not have.

Impact: large. Day 4 closes at -155.00 on customer activity alone, which is already a fee. But the day 2 fee reduces day 3 from 30.00 to 5.00 and day 4 from -155.00 to -180.00. Under reading (b) the count of fees would be the same in this particular run, but the closing balances would all be higher and any account sitting just above zero would behave differently.

Reversible: `assessFeesAtClose` reads the balance fresh on each pass of the loop, so fees already booked are visible. Filtering them out of `balanceOn` would give reading (b).

Note that this is why the days are walked in order rather than assessed all at once. Order is not a style choice here, it changes the answer.


## A-03 - Does a reversal also reverse the fees it caused?

Ambiguity: E9 reverses E7 on day 6. E7 is what caused three fees. The brief says nothing about what happens to a fee whose cause has been undone.

Readings: (a) the fees stand, (b) the fees are refunded by appending three credits, (c) the fees are removed.

Chosen: (a).

Rationale: (c) is not available at all, because no record is ever deleted. Between (a) and (b), a reversal in this brief reverses one named event, E7, and nothing else. Nothing says a reversal cascades to everything downstream of its target. In real banking a fee refund is a separate decision made by a human, usually after the customer complains, and it arrives as its own credit with its own reason. Inventing an automatic refund would be inventing a policy.

Impact: the account closes at 390.00 rather than 465.00. Under (b) it would close at 465.00 and criterion C-06 would be correct.

Reversible: nothing to switch off. Adding the refund would mean appending three credits when a reversal lands, which is a change to the reversal handler rather than to the fee code.

This is the direct reason criterion C-06 is refused. Balances do come back. Fees do not.

## A-04 - Recompute-from-events vs append-correcting-entries when history changes

Ambiguity: when a backdated entry arrives and an earlier day turns out to have been wrong, the brief does not say whether the ledger corrects the past or simply records the new fact and lets the past be re-read.

Readings: (a) store no balances at all and work every balance out from the entries each time it is asked for, (b) keep a running balance per day and write correcting adjustment entries whenever a late arrival changes an earlier day.

Chosen: (a).

Rationale: option (b) needs a stored number that can disagree with the entries behind it, and once those two can disagree the stored one is the one people will trust. It also invents adjustment entries that no event asked for, which pollutes the audit trail with lines the bank never actually did. Option (a) has one source of truth, the entries, and every balance is a fact derived from it. The cost is that every read is a sum, which at this size is nothing.

Impact: none on any printed number. It changes where a bug could hide, not what the answer is.

Reversible: `balanceOn` in `src/balances.js` is the only place a balance is produced.

Consequence worth naming: because a balance is always derived, the same day can honestly report different values depending on when you ask. That is not a bug, it is the point, and the report prints the day you are standing on so the reader can tell which version they are looking at.

## A-05 - Which version of a revised day's balance earns interest?

Ambiguity: day 2 was worth +250.00 on day 2, then -370.00 once E7 arrived, then +225.00 after the reversal. The brief says interest accrues daily on the closing balance but never says which version of a rewritten day counts.

Readings: (a) the balance as it finally stands at the end of the window, (b) the balance as it was understood on the day itself, (c) accrue as you go and then post correcting adjustments when a day is revised.

Chosen: (a).

Rationale: the accrual is not paid out until the end of day 6, so at the moment of paying it we know what every day was actually worth. Using a figure we now know to be wrong, purely because we believed it at the time, would mean knowingly paying the wrong amount. Option (c) produces the same answer as (a) with more moving parts.

Impact: day 2 earns on 225.00 rather than on 250.00 or on nothing. Under reading (b) day 2 would earn on 250.00 and days 3 to 5 would earn on the pre-E7 figures, giving a larger credit.

Reversible: `accrueInterest` in `src/interest.js` reads every day with `asKnownOn` set to the last day of the window. Setting it to the day itself gives reading (b).

Worth noting the deliberate difference from fees, see A-01. A fee is charged and booked at a moment in time and cannot be taken back. An accrual is not booked until day 6, so it is still free to use the best information available at the moment it is paid. The two rules treat late information differently because one has already been acted on and the other has not.

## A-06 - Does the capitalized interest credit itself earn interest?

Ambiguity: the interest credit is booked with value date day 6, and day 6 is inside the window. Left alone, that credit would appear in day 6's closing balance and earn interest on itself.

Readings: (a) no, interest is worked out on what the account did, ignoring interest already paid, (b) yes, whatever is in the balance earns.

Chosen: (a).

Rationale: the brief says accruals capitalise as a single credit at the end of day 6, which puts the credit at the very end of the window rather than inside it. Reading (b) would also make the calculation depend on itself, so running it twice would give two different answers, which is not a property a ledger should have.

Impact: 0.00 in this run, because 0.04% of 0.92 rounds to nothing. It would matter on a longer window or a larger balance.

Reversible: the interest filter in `balanceForAccrual` in `src/interest.js`. There is a test that runs the accrual twice and asserts the same answer both times.

## A-07 - Do fee entries count toward the interest-bearing balance?

Ambiguity: fees are ledger entries with value dates. The brief does not say whether they are part of the balance that earns interest.

Readings: (a) yes, a fee is an entry like any other, (b) no, interest is worked out on customer activity only.

Chosen: (a).

Rationale: the same argument as A-02. The closing balance is defined as all entries with value date on or before that day, and a fee is one of those entries. Excluding fees here while including them in the printed closing balance would create two different balances for the same day.

Impact: day 2 earns on 225.00 instead of 250.00, day 4 on 415.00 instead of 440.00, day 5 and day 6 on 390.00 instead of 465.00. The credit is 0.92 rather than 0.95.

Reversible: the same filter as A-06. It excludes interest and nothing else, so adding fees to that filter gives reading (b).

## A-08 - Auth-B: declined when available balance was already negative before the hold

Ambiguity: the rule says an authorisation is approved only if available balance "remains at or above zero after the hold is applied". On day 5 the account is already at -155.00 before Auth-B asks for anything. The rule is written as though the hold is what could push the account under, and it does not say what to do when the account is already under.

Readings: (a) apply the rule literally, so the account fails the test whatever the hold size and Auth-B is declined, (b) read the rule as being about the effect of the hold, so a hold is only refused if it makes things worse than they already were, (c) treat a hold of zero as a special case.

Chosen: (a).

Rationale: the rule is a test on the resulting balance, not on the change. Reading (b) would approve a 90.00 hold on an account that has no money at all, which is the opposite of what a hold check is for. Reading (a) also gives the same answer on the ordinary case, so it is not a special rule for a strange day.

Impact: Auth-B is declined. Under reading (b) it would be approved, available balance would fall to -245.00, and criterion C-05 would suddenly have something to talk about.

Reversible: the single check in `applyAuthorization` in `src/holds.js`.

Side note: a hold of exactly the available balance is approved, because the rule says at or above zero. That edge is tested both ways, at zero and one fils under.

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

Ambiguity: Auth-A holds 200.00 and settles for 185.00. The brief does not say what happens to the remaining 15.00.

Readings: (a) the hold closes in full the moment it settles, so 15.00 is available again immediately, (b) the hold stays partly open for the 15.00 until something expires it, (c) the settlement is rejected because it does not match the hold.

Chosen: (a).

Rationale: this is the normal case in card processing, not an error. You authorise 200.00 at a restaurant and the bill comes to 185.00. One authorisation settles once, and settling closes it. Option (b) needs an expiry rule that the brief never gives, and option (c) would reject a completely ordinary transaction.

Impact: available balance on day 4 is 15.00 higher than under reading (b). No ledger balance changes either way.

Reversible: `applySettlement` in `src/holds.js` closes the hold in one step.

Related: a settlement for more than the held amount is not in this stream. The code would book the settled amount as given, because the settled figure is the real one and the hold was only ever an estimate.

## A-12 - Overdraft fee currency vs account currency (AED fee on a BHD account)

Ambiguity: the fee is specified as AED 25.00, with no mention of what happens if a non AED account goes overdrawn. ACC-002 is in BHD.

Readings: (a) only AED accounts can be charged this fee, and a BHD account going negative is recorded but not charged, (b) convert 25.00 AED into BHD at some rate, (c) charge 25.000 BHD, treating the number as currency neutral.

Chosen: (a).

Rationale: (b) needs an exchange rate, and no rate appears anywhere in the brief. Inventing one would put a made up number into the closing balances. (c) treats 25 as a magnitude rather than an amount of money, which would charge a BHD account roughly ten times more in real terms than an AED account, since one dinar is worth about ten dirhams. (a) is the only reading that adds no invented data.

Impact: none in this run. ACC-002 receives a single credit of BHD 10.000 on day 5 and is never negative. The path is tested with a made up overdrawn BHD account so the behaviour is proven rather than assumed.

Reversible: the currency check at the top of `assessFeesAtClose`. A per currency fee table would slot in there.

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

Related decision, not in the stream but the code has to answer it: a second reversal naming E7 is refused and recorded, rather than posting a second 620.00 credit. Without that guard a duplicated message in the feed would silently double the correction. The refusal goes into the ledger with its reason, the same as any other refused event.

## A-16 - Day boundaries: no timestamps, only day numbers

Ambiguity: the brief works in day numbers, 1 through 6. There are no clock times, no time zone and no cut off.

Readings: (a) treat a day as one indivisible bucket, (b) invent timestamps and a cut off time.

Chosen: (a).

Rationale: inventing a cut off would add a constant nobody asked for and would change which day an event lands on. A day is the smallest unit the brief recognises, so it is the smallest unit the code recognises.

Impact: everything inside a day is simultaneous. Ordering within a day comes from arrival order only, see A-14.

Reversible: days are plain whole numbers throughout, so a timestamp could replace them without changing the shape of the model.

## A-17 - Hold expiry: nothing releases a hold inside the window

Ambiguity: the brief never says how long a hold lasts. Auth-B is explicitly never settled inside the window, which raises the question of what happens to a hold that just sits there.

Readings: (a) a hold stays open until something settles it, (b) a hold expires after some number of days and releases itself.

Chosen: (a).

Rationale: real card holds do expire, usually somewhere between 7 and 30 days depending on the scheme, but the brief gives no number and any number I picked would be invented. A 5 day expiry would have released Auth-B before day 6 and changed the closing figures. Refusing to invent the constant is safer than guessing it.

Impact: none in this run, because Auth-B is declined and no hold survives to the end. It would matter the moment an approved hold went unsettled.

Reversible: `activeHolds` in `src/holds.js` would need a day comparison. There is nothing to switch off, because nothing was added.

See NUMBERS.md N-13.
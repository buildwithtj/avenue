# Proposed flow changes (booking windows, end reminder, auto-approval)

**Status: [PROPOSED]. Nothing here is built or saved in Power Automate.** The live flows cannot be edited from code. These are exact designer steps for the developer. Rules that apply to all of them:

- `FACILITY` = `flavors-hyattsville`. Style and existing expressions: [expressions.md](expressions.md).
- **Bare `@expr` for booleans, dates and arrays** (`@{...}` always yields text; see the gotcha in CLAUDE.md). Edit through the expression editor, then re-read Code view to confirm the stored form. After saving, check the run history: a failed run leaves the member with no outcome.
- Flows marked **SENDS E-MAIL** need the developer's explicit approval before they are saved (project rule).
- The wording of every member-facing sentence is in `apps/member-spfx/src/avenue/copy.ts` (`endReminderSubject`, `endReminderMessage`, `earlyEntryLine`, `cleaningLine`). Keep the e-mail text identical to it.
- Facility settings (live column names): `CheckoutAlertMinutes`, `EarlyEntryMinutes`, `CleanupMinutes` (30/30/30), `AutoApproveWhenFree` (new, default No). `EntryGraceMinutes` / `ExitGraceMinutes` (15) stay the check-in alert timings and are not touched.
- Prerequisite for (b): the column `AutoApproveWhenFree` must exist on the live `AvenueFacilities` (apply `schema/reconcile.browser.js`: plan first, read it, then apply).
- Portal link: `https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal.aspx`. The deep link `?booking=<BookingId>&action=extend` is [PROPOSED] and only works once the portal UI reads it; until then send the plain link.

---

## (a) Avenue - Booking ending soon (NEW, SENDS E-MAIL), every 5 minutes, concurrency 1

Purpose: ONE reminder per booking, `CheckoutAlertMinutes` before the booked end (client call 16 Nov: "20 or 30 minutes before checkout", with the option to extend). [PROPOSED reading to confirm: measured from the booked end; the cleaning window follows it.] Pure spec: `endReminderDue` in `src/avenue/windows.ts`.

Build it by copying "Avenue - Booking reminders 3-2-1 h" and changing:

1. Trigger: Recurrence, every 5 minutes. Concurrency control on, degree 1 (on the Apply to each, sequential).
2. `Get facility` (AvenueFacilities, top 1): `FacilityId eq 'flavors-hyattsville'`.
3. `Alert minutes` (Compose, bare): `@int(coalesce(first(outputs('Get_facility')?['body/value'])?['CheckoutAlertMinutes'], 0))`
4. `Cleanup minutes` (Compose, bare): `@int(coalesce(first(outputs('Get_facility')?['body/value'])?['CleanupMinutes'], 0))`
5. `Condition` (bare): `@greater(outputs('Alert_minutes'), 0)`. False: stop (the setting is empty or 0, so no reminders).
6. True: `Get items` (AvenueBookings), Top Count 5000:
   `Status eq 'Approved' and FacilityId eq 'flavors-hyattsville' and EndAlertSentAt eq null and EndUtc gt '@{utcNow()}' and EndUtc le '@{addMinutes(utcNow(), outputs('Alert_minutes'))}'`
   This is exactly `end - alert <= now < end`. Only Approved bookings, only inside the window, only while the marker is empty.
7. `Apply to each` (sequential) over `@outputs('Get_items')?['body/value']`.
8. `Condition 2` (bare): `@contains(coalesce(items('Apply_to_each')?['MemberId'], ''), '@')`.
9. True: **`Update item` first** (AvenueBookings, Id = `ID`): `EndAlertSentAt` = `@utcNow()` (bare). A retry or an overlapping run then finds the marker and does not send twice (at most once; a failed send is not retried).
10. Then `Send an email (V2)`: To `@{items('Apply_to_each')?['MemberId']}` (dynamic content), from the "Avenue mail (automations)" connection.
    - Subject: `Your Flavors booking ends at @{convertFromUtc(items('Apply_to_each')?['EndUtc'], 'Eastern Standard Time', 'h:mm tt')}`
    - Body: `Your booking ends at @{convertFromUtc(items('Apply_to_each')?['EndUtc'], 'Eastern Standard Time', 'h:mm tt')}. Please start cleaning now.@{if(greater(outputs('Cleanup_minutes'), 0), concat(' You can stay until ', convertFromUtc(addMinutes(items('Apply_to_each')?['EndUtc'], outputs('Cleanup_minutes')), 'Eastern Standard Time', 'h:mm tt'), ' for cleaning (not charged).'), '')} Need more time? Extend.` followed by a link "Extend" to the portal link above (with `?booking=@{items('Apply_to_each')?['BookingId']}&action=extend` once the UI supports it).
    - No other member's data.
- Side effects: the update fires the calendar, hours-ledger, decision-e-mail and overlap-note flows (trigger "created or modified"); all are no-ops for an already-approved, already-notified booking (the decision e-mail's trigger condition compares `DecisionNotified`; none of them read `EndAlertSentAt`).
- The portal shows the same moment as an in-page banner (`endReminderDue` / `endBannerText`), so a member who has the portal open sees it even if the e-mail is late (the flow polls every 5 minutes).

**Test (gaptest- ids, no real member):**
1. Create one booking row by the test kit: `BookingId` = `gaptest-endalert-1`, Status `Approved`, FacilityId `flavors-hyattsville`, MemberId = the developer's own test address, `StartUtc` = now - 90 min, `EndUtc` = now + 20 min, `EndAlertSentAt` empty. (Creating it as Approved fires the decision e-mail and ledger flows too: expect one decision e-mail to that address and a ledger row `gaptest-endalert-1-used`.)
2. Run the new flow manually (or wait up to 5 minutes). Expected: ONE e-mail "Your Flavors booking ends at ...", the booking's `EndAlertSentAt` is now set.
3. Run it again: `Get items` returns 0 rows and no second e-mail.
4. Negative cases (separate rows): `EndUtc` = now + 45 min (outside the window), Status `Pending`, Status `Cancelled`, and `EndUtc` in the past: none may be picked up. Set `CheckoutAlertMinutes` empty on the facility row: the run stops at `Condition`.
5. Run history: open the run, confirm `Alert minutes` = 30, `Get items` returned exactly the expected rows, `Update item` precedes `Send an email` and both succeeded. A booking the flow missed (no e-mail, marker empty) means the run failed or the window check was wrong: read `Get items` inputs.
6. Cleanup by explicit id only: delete `gaptest-endalert-*` booking rows, their `-used` ledger rows and calendar rows one by one (never a bulk delete).

---

## (b) Booking request to Pending booking: optional auto-approval (EDIT; the change is silent, the decision e-mail it triggers SENDS E-MAIL)

**[PROPOSED, NOT CONFIRMED BY THE CLIENT: Q-B21.]** The client sheet says every booking needs management approval. Build and save the new steps, but leave `AvenueFacilities.AutoApproveWhenFree` = No. With it No, the result is exactly today's behaviour. Pure spec: `decideAutoApproval` in `src/avenue/autoApproval.ts`.

Add after `Refusal` (existing actions are not changed except `Status`, `DecidedBy` and `DecidedAt` of `Create_item`):

1. `Get facility` (AvenueFacilities, top 1): `FacilityId eq 'flavors-hyattsville'`. (Place it before `Refusal` if you prefer; it has no dependency.)
2. `Auto on` (Compose, bare): `@equals(first(outputs('Get_facility')?['body/value'])?['AutoApproveWhenFree'], true)`
3. `Get_items_5` (AvenueBookings, top 500; APPROVED bookings overlapping the request):
   `Status eq 'Approved' and FacilityId eq 'flavors-hyattsville' and StartUtc lt '@{triggerOutputs()?['body/EndUtc']}' and EndUtc gt '@{triggerOutputs()?['body/StartUtc']}'`
   (`lt` / `gt` strict: bookings that only touch do not overlap, same as `availability.ts`.)
4. `Requested ids` (Compose, bare): `@split(replace(coalesce(triggerOutputs()?['body/EquipmentIds'], ''), ' ', ''), ';')`
5. `Clashing` (Filter array, `from` = `@outputs('Get_items_5')?['body/value']`), condition (bare):
```
@or(equals(item()?['Space/Value'], 'Whole facility'), equals(triggerOutputs()?['body/Space/Value'], 'Whole facility'), and(equals(triggerOutputs()?['body/Space/Value'], 'Dining'), equals(item()?['Space/Value'], 'Dining')), and(not(equals(string(outputs('Requested_ids')), '[""]')), greater(length(intersection(split(coalesce(item()?['EquipmentIds'], ''), ';'), outputs('Requested_ids'))), 0)))
```
   Meaning: an approved whole-facility booking blocks everything; a whole-facility (private event) request is blocked by any approved overlap; dining is blocked by approved dining (no table data, so it fails closed); kitchen requests are blocked by any shared unit.
6. `Length ok` (Compose, bare):
```
@and(or(empty(first(outputs('Get_facility')?['body/value'])?['MinBookingMinutes']), greaterOrEquals(div(sub(ticks(triggerOutputs()?['body/EndUtc']), ticks(triggerOutputs()?['body/StartUtc'])), 600000000), first(outputs('Get_facility')?['body/value'])?['MinBookingMinutes'])), or(empty(first(outputs('Get_facility')?['body/value'])?['MaxBookingMinutes']), lessOrEquals(div(sub(ticks(triggerOutputs()?['body/EndUtc']), ticks(triggerOutputs()?['body/StartUtc'])), 600000000), first(outputs('Get_facility')?['body/value'])?['MaxBookingMinutes'])))
```
7. `Auto approve` (Compose, bare). Member Active, no expired document (or override) and a valid time are already part of `Refusal` being empty; the rest is explicit here:
```
@and(outputs('Auto_on'), empty(outputs('Refusal')), empty(triggerOutputs()?['body/OnBehalfOf']), equals(length(outputs('Get_items_4')?['body/value']), 1), or(equals(length(outputs('Get_items_1')?['body/value']), 0), greater(length(outputs('Get_items_2')?['body/value']), 0)), outputs('Length_ok'), equals(length(body('Clashing')), 0), or(not(equals(triggerOutputs()?['body/Space/Value'], 'Kitchen')), not(equals(string(outputs('Requested_ids')), '[""]'))))
```
8. `Create_item` changes:
   - `Status` = `@{if(empty(outputs('Refusal')), if(or(and(not(empty(triggerOutputs()?['body/OnBehalfOf'])), outputs('IsStaff')), outputs('Auto_approve')), 'Approved', 'Pending'), 'Declined')}`
   - `DecidedBy` = `@{if(empty(outputs('Refusal')), if(not(empty(triggerOutputs()?['body/OnBehalfOf'])), triggerOutputs()?['body/Author/Email'], if(outputs('Auto_approve'), 'auto-approval', '')), '')}`
   - `DecidedAt` (**bare**, as before): `@if(and(empty(outputs('Refusal')), or(not(empty(triggerOutputs()?['body/OnBehalfOf'])), outputs('Auto_approve'))), utcNow(), null)`
   - `OverlapNote`: unchanged. Do NOT put an "approved automatically" text in it: a non-empty note on an Approved booking triggers "Overlap note to other members". `DecidedBy = auto-approval` is the marker staff see.
- Consequences when switched on: an auto-approved booking is created Approved, so the calendar-publish, hours-ledger and decision e-mail flows run for it (the member gets the decision e-mail, SENDS E-MAIL) and the "New request alert to staff" does not fire (it only alerts Pending), so staff are not told about auto-approved bookings except in the Approved list. The request flow already runs with concurrency 1, so two simultaneous requests cannot both pass the overlap check.

**Test (gaptest- ids):**
1. With `AutoApproveWhenFree` = No: send a request `gaptest-auto-1` as the test member. Expected Status `Pending`, `DecidedBy` empty (unchanged behaviour). Run history: `Auto on` = false, `Auto approve` = false.
2. Set it to Yes on the facility row (record the previous value; set back to No afterwards). Send `gaptest-auto-2`, free equipment, valid length: expected Status `Approved`, `DecidedBy` = `auto-approval`, `DecidedAt` set, a calendar row and a ledger row, and a decision e-mail. Run history: check `Clashing` is empty and `Auto approve` is `true` (a bare boolean, not the text "true").
3. Send `gaptest-auto-3` for the same equipment and an overlapping time: expected `Pending`; `Clashing` has 1 row. Send one that only touches (starts when `gaptest-auto-2` ends): expected `Approved`.
4. Expired-document member without an override: `Declined` (existing rule). A length below `MinBookingMinutes` (when set): `Pending`. An `OnBehalfOf` request: unchanged staff behaviour.
5. If `Create_item` fails with a date error, `DecidedAt` was saved as `@{...}` (text): re-enter it as a bare expression.
6. Cleanup by explicit id: bookings, ledger (`gaptest-auto-2-used`), calendar rows, requests. Set `AutoApproveWhenFree` back to No.

---

## (c) Hours ledger: late departure (`ActualEndUtc`) (EDIT, no e-mail)

Staff correct a late departure from the camera in the staff app, which writes `AvenueBookings.ActualEndUtc`. The existing "Used" row is created when the booking is approved (before anyone leaves) from `StartUtc`..`EndUtc` = booked time, so it must NOT be recalculated; instead add an adjustment row when `ActualEndUtc` appears. The booked time, early entry and cleaning window never use hours.

[PROPOSED, to confirm with the client: UNKNOWN] Which minutes are charged. The client said 30 minutes of cleaning after the booking are free and "anything beyond that is extra hours". This spec charges only the time after `EndUtc + CleanupMinutes`. Leaving earlier than the booked end creates no credit (not specified; BKG-12 credits only cancellations and no-shows).

In "Avenue - Hours ledger" (concurrency 1) add, after the existing rows:
1. `Get facility` (as in (a)) and `Cleanup minutes` (Compose, bare): `@int(coalesce(first(outputs('Get_facility')?['body/value'])?['CleanupMinutes'], 0))`
2. `Late minutes` (Compose, bare), zero when `ActualEndUtc` is empty:
```
@if(empty(triggerOutputs()?['body/ActualEndUtc']), 0, max(createArray(0, div(sub(ticks(triggerOutputs()?['body/ActualEndUtc']), ticks(addMinutes(triggerOutputs()?['body/EndUtc'], outputs('Cleanup_minutes')))), 600000000))))
```
3. `Get items` (AvenueHoursLedger): `ChargeKey eq '@{triggerOutputs()?['body/BookingId']}-late-@{formatDateTime(coalesce(triggerOutputs()?['body/ActualEndUtc'], utcNow()), 'yyyyMMddHHmm')}'`
4. `Condition` (bare): `@and(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), greater(outputs('Late_minutes'), 0), equals(length(outputs('Get_items_late')?['body/value']), 0))`
5. True: create an `AvenueHoursLedger` row: EntryId = ChargeKey = `<BookingId>-late-<yyyyMMddHHmm of ActualEndUtc>` (unique, so a re-save never doubles it; a corrected `ActualEndUtc` adds a new row, so staff correct downwards by an `Adjustment` row entered by hand: note this limitation), Reason `Adjustment`, Hours (bare) = `@div(float(outputs('Late_minutes')), 60)`, Period = `@{convertFromUtc(triggerOutputs()?['body/StartUtc'], 'Eastern Standard Time', 'yyyy-MM')}`, MemberId, BookingId, FacilityId, Note `Late departure, from the camera, after the cleaning window`.
- If the client says all time after the booked end is chargeable, drop `addMinutes(...)` from step 2.

**Test:** `gaptest-late-1` Approved booking (ledger row `gaptest-late-1-used` appears). Set `ActualEndUtc` = `EndUtc` + 20 min with CleanupMinutes 30: no new row. Set it to `EndUtc` + 50 min: one row `gaptest-late-1-late-...` with Hours 0.33. Save again unchanged: no second row. Run history: `Late minutes` = 20 on the last run; `Condition` true only then. Cleanup by explicit EntryId.

---

## (d) Booking decision e-mail: equipment, entry window, cleaning window, portal link (EDIT, SENDS E-MAIL)

Flow "Avenue - Booking decision e-mail to member" (95d91bb5-...). Keep the trigger condition, the `Update item` first and the existing subject. Add before the send:

1. `Get facility` (AvenueFacilities, top 1) and `Early minutes` (Compose, bare): `@int(coalesce(first(outputs('Get_facility')?['body/value'])?['EarlyEntryMinutes'], 0))`; `Cleanup minutes` as in (a).
2. `Get equipment` (AvenueEquipment, top 500): `FacilityId eq 'flavors-hyattsville' and Active eq 1`.
3. `Booked equipment` (Filter array, `from` = `@outputs('Get_equipment')?['body/value']`), where (bare): `@contains(split(coalesce(triggerOutputs()?['body/EquipmentIds'], ''), ';'), item()?['EquipmentId'])`
4. `Equipment titles` (Select, `from` = `@body('Booked_equipment')`), map (text mode): `@{item()?['Title']}`
5. In the e-mail body, for **Approved** only (wrap in `if(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), ..., '')`), add these lines (same text as `copy.ts`):
   - `Equipment: @{join(body('Equipment_titles'), ', ')}` (omit the line when the space is Dining or Whole facility: `if(empty(body('Equipment_titles')), '', ...)`)
   - `@{if(greater(outputs('Early_minutes'), 0), concat('You can come in from ', convertFromUtc(addMinutes(triggerOutputs()?['body/StartUtc'], mul(-1, outputs('Early_minutes'))), 'Eastern Standard Time', 'h:mm tt'), '.'), '')}`
   - `Booked time: @{convertFromUtc(triggerOutputs()?['body/StartUtc'], 'Eastern Standard Time', 'h:mm tt')} to @{convertFromUtc(triggerOutputs()?['body/EndUtc'], 'Eastern Standard Time', 'h:mm tt')}. This is what counts toward your hours.`
   - `@{if(greater(outputs('Cleanup_minutes'), 0), concat('Cleaning time until ', convertFromUtc(addMinutes(triggerOutputs()?['body/EndUtc'], outputs('Cleanup_minutes')), 'Eastern Standard Time', 'h:mm tt'), ' (not charged).'), '')}`
   - Link: "Open your booking" to the portal link above (with `?booking=@{triggerOutputs()?['body/BookingId']}` once the UI supports it).
6. Declined / Cancelled e-mails keep today's text plus the portal link.
- Equipment titles are not personal data and are already visible to members in the portal, so no new data is exposed.

**Test:** `gaptest-decision-1` booking Pending then set Approved by staff (to the developer's own address). Expect one e-mail with the equipment names, "You can come in from ...", the booked time, the cleaning time and a link that opens the portal. Check `DecisionNotified` = `Approved`. Set the facility's `EarlyEntryMinutes` empty and re-test with a new booking: the entry and cleaning lines disappear instead of showing "0". Run history: `Equipment titles` should hold the titles (an empty array means the ids did not match `EquipmentId`). The e-mail has never been seen delivered (CHECKLIST: NOT VERIFIED): confirm delivery in the mailbox.

# Power Automate expressions (source of truth)

The flows are built in the Power Automate designer (no Dataverse in this environment, so no solution export yet). These are the exact expressions typed into them, kept here so they can be reviewed and rebuilt. `FACILITY` is the single Phase 1 facility id, `flavors-hyattsville`.

## Avenue - Booking request to Pending booking (eef19366-dddc-44fe-9492-abb6cf8471c9)

Trigger: item created in `AvenueBookingRequests`.

- `Get items` (AvenueBookings): `BookingId eq '@{triggerOutputs()?['body/RequestId']}'`
- `Get items 1` (AvenueMemberDocuments, expired): `MemberId eq '@{triggerOutputs()?['body/Author/Email']}' and ExpiryDate lt '@{utcNow('yyyy-MM-dd')}T00:00:00Z'`
- `Get items 2` (AvenueComplianceOverrides, active): `MemberId eq '@{triggerOutputs()?['body/Author/Email']}' and Active eq 1`
- Condition: `@length(outputs('Get_items')?['body/value'])` = 0 and `@empty(triggerOutputs()?['body/CancelBookingId'])` = true
- Create item (AvenueBookings): MemberId = `@{triggerOutputs()?['body/Author/Email']}` (never a member-supplied field), BookingId = RequestId, RequestedAt = `@{utcNow()}`, and:

Status:
```
@{if(or(lessOrEquals(ticks(triggerOutputs()?['body/EndUtc']), ticks(triggerOutputs()?['body/StartUtc'])), less(ticks(triggerOutputs()?['body/StartUtc']), ticks(utcNow())), not(equals(triggerOutputs()?['body/FacilityId'], 'flavors-hyattsville')), and(greater(length(outputs('Get_items_1')?['body/value']), 0), equals(length(outputs('Get_items_2')?['body/value']), 0))), 'Declined', 'Pending')}
```

OverlapNote (reason shown to staff and, through Outcome, to the member):
```
@{if(or(lessOrEquals(ticks(triggerOutputs()?['body/EndUtc']), ticks(triggerOutputs()?['body/StartUtc'])), less(ticks(triggerOutputs()?['body/StartUtc']), ticks(utcNow()))), 'Refused automatically: the requested time is not valid.', if(not(equals(triggerOutputs()?['body/FacilityId'], 'flavors-hyattsville')), 'Refused automatically: unknown facility.', if(and(greater(length(outputs('Get_items_1')?['body/value']), 0), equals(length(outputs('Get_items_2')?['body/value']), 0)), 'Refused automatically: a required document has expired. The Flavors owner can override.', '')))}
```

## Avenue - Publish approved booking to calendar (e3331e76-2339-41c3-a036-bf0e441ca63c)

Trigger: item created or modified in `AvenueBookings`. Approved and no calendar row: create it (name from `AvenueMembers.BusinessName`, else "Member"). Any other status: delete the booking's calendar rows. Then echo the status to the member's own request item:

- `Get items 2` (AvenueBookingRequests): `RequestId eq '@{triggerOutputs()?['body/BookingId']}'`
- If found, Update item Outcome:
```
@{take(concat(triggerOutputs()?['body/Status/Value'], if(empty(triggerOutputs()?['body/CancelRequestedAt']), '', ' · cancellation requested, Flavors will reply'), if(empty(triggerOutputs()?['body/OverlapNote']), '', concat(' · Note: ', triggerOutputs()?['body/OverlapNote']))), 250)}
```
`Outcome` is display-only. Members can edit their own intake items, so no flow ever reads `Outcome` back.

## Avenue - Booking cancellation request (47d1abf9-2948-4abb-899b-7ecf5c19536c)

- `Get items` (AvenueBookings): `BookingId eq '@{triggerOutputs()?['body/CancelBookingId']}' and MemberId eq '@{triggerOutputs()?['body/Author/Email']}' and (Status eq 'Approved' or Status eq 'Pending')`
- Exactly one match, then: `@greaterOrEquals(sub(ticks(first(outputs('Get_items')?['body/value'])?['StartUtc']), ticks(utcNow())), 864000000000)` = true → Status Cancelled; else CancelRequestedAt = `@{utcNow()}`.

## Avenue - Hours ledger (f867cee5-1ca2-48f1-a7f0-390541eb1574), concurrency 1

- Used row if Approved and no `<BookingId>-used` row: Hours = `@div(float(sub(ticks(triggerOutputs()?['body/EndUtc']), ticks(triggerOutputs()?['body/StartUtc']))), 36000000000)`, Period = `@{formatDateTime(triggerOutputs()?['body/StartUtc'], 'yyyy-MM')}`
- Credit row if Cancelled or No-show credited, a Used row exists and no `<BookingId>-credit` row: Hours = `@mul(-1, first(outputs('Get_items')?['body/value'])?['Hours'])`

## Avenue - Daily document status check (f6033619-54a9-44d7-8b8f-5c69373c3cf5), daily

Status per document (date-only comparison; Expiring = within 30 days, the original default pending Q-11):
```
@{if(less(substring(items('Apply_to_each')?['ExpiryDate'], 0, 10), utcNow('yyyy-MM-dd')), 'Expired', if(less(substring(items('Apply_to_each')?['ExpiryDate'], 0, 10), addDays(utcNow(), 30, 'yyyy-MM-dd')), 'Expiring', 'Current'))}
```
Only rows whose computed status differs are updated, so versions don't pile up daily. Note: `lt` is not a workflow function; `less` is (first run failed on this, fixed and re-tested).

## Concurrency
Every flow that checks for an existing row before writing runs with **trigger concurrency = 1**: request→booking, calendar publish, cancellation, hours ledger, check-in, document submission. A test with three identical check-in submissions sent at the same instant recorded exactly one, after two had been recorded before the change.

## Avenue - Check-in submission (85b9e552-7f0b-4a09-8779-a92b1f342888)

Trigger: item created in `AvenueCheckInSubmissions` (own-items intake).
- `Get items` (AvenueBookings): `BookingId eq '@{triggerOutputs()?['body/BookingId']}' and MemberId eq '@{triggerOutputs()?['body/Author/Email']}' and Status eq 'Approved'`
- `Get items 1` (AvenueCheckIns): `SubmissionId eq '@{triggerOutputs()?['body/SubmissionId']}'`
- If exactly one booking and no existing record: create `AvenueCheckIns` row (FacilityId and BookingId from the booking, MemberId from the author, Kind, Answers, AllPassed, SubmittedAt = utcNow()).
- Outcome: `Recorded`, `Already recorded`, or `Not recorded: this is not one of your approved bookings`.

## Avenue - Document submission (10d022e9-c5d6-4c5e-b36b-88c476b3b8b9)

Trigger: item created or modified in `AvenueDocumentSubmissions`, trigger condition `@empty(triggerBody()?['Outcome'])`, concurrency 1.
(A condition on `Attachments` stopped the trigger from ever firing, so it was removed. The portal instead creates the submission with Outcome = `Uploading`, uploads the file, then clears Outcome; that update starts the flow with the file present.)
- `Get items` (AvenueMemberDocuments): `SourceSubmissionId eq '@{triggerOutputs()?['body/SubmissionId']}'`
- Valid when: no existing row, SubmissionId and DocType present, and expiry after issue:
```
@and(equals(length(outputs('Get_items')?['body/value']), 0), not(empty(triggerOutputs()?['body/SubmissionId'])), not(empty(triggerOutputs()?['body/DocType/Value'])), greater(substring(coalesce(triggerOutputs()?['body/ExpiryDate'], '0000-00-00'), 0, 10), substring(coalesce(triggerOutputs()?['body/IssueDate'], '9999-99-99'), 0, 10)))
```
- Valid: each attachment is copied to the private `AvenueDocumentFiles` library as `<SubmissionId>-<file name>` and tagged (FacilityId, MemberId = author, DocType, SourceSubmissionId). The document is registered in `AvenueMemberDocuments` with Verified = No and DocStatus computed as in the daily check. Outcome: `Received. Flavors will verify it.`
- Invalid: Outcome `Already received` or `Not accepted: choose a document type and an expiry date after the issue date, then send it again`.

## Dates
The Avenue site's regional time zone is **Eastern** (changed from the Pacific default on 12 Nov 2026), matching the facility. The portal writes date-only values as `YYYY-MM-DDT12:00:00Z` so no time zone can move them by a day. Before the change, a test expiry of 30 June was stored as 29 June.

## Avenue - Booking reminders 3-2-1 h (e5bb9dc5-48c5-4545-8415-459f1505e3da), every 15 min, concurrency 1

CHK-03: reminders 3, 2 and 1 hour before an approved booking, once each. Mail goes from automations@poweredbyavenue.com through the "Avenue mail (automations)" Office 365 Outlook connection.

- `Get items` (AvenueBookings), Top Count 5000: `Status eq 'Approved' and StartUtc gt '@{utcNow()}' and StartUtc le '@{addHours(utcNow(), 3)}'`
- `Apply to each` (sequential) over the results.
- `Compose` (reminder due now, 1–3): `@{min(add(div(sub(ticks(items('Apply_to_each')?['StartUtc']), ticks(utcNow())), 36000000000), 1), 3)}`
- `Condition` = true: `@and(not(contains(coalesce(items('Apply_to_each')?['RemindersSent'], ''), outputs('Compose'))), contains(coalesce(items('Apply_to_each')?['MemberId'], ''), '@'))`
- True: `Update item` **first**, then send, so a retry or overlapping run never sends twice (at most once; a failed send is not retried). RemindersSent:
```
@{if(equals(string(outputs('Compose')), '1'), '3,2,1', if(equals(string(outputs('Compose')), '2'), '3,2', '3'))}
```
  Marking the earlier levels as sent means a booking approved late gets only the reminder currently due, with no catch-up burst. [PROPOSED] until the client answers question 35 / Q-10 (catch-up).
- `Send an email (V2)` To `@{items('Apply_to_each')?['MemberId']}` (To field switched to "Use dynamic content"), Subject `Reminder: your Flavors booking starts at @{convertFromUtc(items('Apply_to_each')?['StartUtc'], 'Eastern Standard Time', 'h:mm tt')}`, body with the full date/time in Eastern time and the portal link. No other member's data.
- Side effect: the update fires the calendar and hours-ledger flows (trigger "created or modified"); both are no-ops for an already-approved booking.

## Avenue - Notice e-mail (sign in to view) (d89ad065-dc16-4bc4-8135-b9f98f680b52)

COM-01: members get a generic "sign in to view" e-mail; the notice content stays in Avenue. Built by a parallel browser agent and checked read-only by a second agent against the spec (no mismatches).

- Trigger: item created in `AvenueNotices` (polls every minute, split on). Trigger condition: `@equals(triggerOutputs()?['body/Active'], true)`. Withdrawing or editing a notice sends nothing.
- `Get items` (AvenueMembers), Top Count 5000: `Status eq 'Active' and FacilityId eq '@{triggerOutputs()?['body/FacilityId']}'`
- `Select` from `@outputs('Get_items')?['body/value']`, map (text mode) `@{item()?['MemberId']}`
- `Condition` = true: `@greater(length(body('Select')), 0)` (no members, no e-mail)
- `Send an email (V2)`: To automations@poweredbyavenue.com, **BCC** `@{join(body('Select'), ';')}` so members never see each other's addresses. Subject "New notice from Flavors Culinary Hub"; body "Flavors has posted a new notice for members. Sign in to Avenue to read it: <site link>". Never the notice title or body.
- Ceiling: one message carries at most 500 recipients (Exchange Online limit); split into batches of 500 if a facility ever has more active members.

## Avenue - Missed entry checklist (cce1b903-e986-4fe0-bd02-161ec825af35), every 5 min, concurrency 1

CHK-04: once an approved booking has started and the grace period has passed with no entry checklist, the member gets one nudge, and the booking appears in the staff Check-ins screen until staff log outreach. Built by a parallel browser agent and reviewed read-only by a second agent (no mismatches).

- `Get items` (AvenueFacilities, top 1): `FacilityId eq 'flavors-hyattsville'`
- `Compose` (grace minutes): `@{coalesce(first(outputs('Get_items')?['body/value'])?['EntryGraceMinutes'], 15)}`. 15 is [PROPOSED] (Q-10) and is set in the facility row, so it changes without editing the flow.
- `Get items 1` (AvenueBookings, top 5000):
  `Status eq 'Approved' and FacilityId eq 'flavors-hyattsville' and MissedCheckInAt eq null and EndUtc gt '@{utcNow()}' and StartUtc le '@{addMinutes(utcNow(), mul(-1, int(outputs('Compose'))))}'`
- Per booking, `Get items 2` (AvenueCheckIns, top 1): `BookingId eq '@{items('Apply_to_each')?['BookingId']}' and Kind eq 'Entry'`
- `Condition` = true: `@and(equals(length(outputs('Get_items_2')?['body/value']), 0), not(empty(items('Apply_to_each')?['MemberId'])))`
- True: `Update item` MissedCheckInAt = `@{utcNow()}` **first** (no second nudge, even on retry), then `Send an email (V2)` to the member: start time in Eastern time, the portal link, and a note that staff can see the booking.
- Staff side: Check-ins screen (see `apps/staff-powerapps/README.md`); "Log outreach and resolve" writes OutreachAt/By/Note, which closes the case for good.

## Staff alert address
`AvenueFacilities.StaffAlertEmail` (edited on the staff app's Settings screen). Every staff e-mail is skipped while it is empty: `@not(empty(first(outputs('Get_items')?['body/value'])?['StaffAlertEmail']))`.

## Avenue - New request alert to staff (d283e5e1-c16a-413d-b94e-40dddbff38f9)
Trigger: item created in `AvenueBookings`. Condition: `@equals(triggerOutputs()?['body/Status/Value'], 'Pending')`. Pending is set only by the request flow, so a staff-created (approved) booking never alerts.
- `Get items` (AvenueFacilities, top 1): `FacilityId eq '@{triggerOutputs()?['body/FacilityId']}'`
- If StaffAlertEmail is set, send "New booking request waiting for approval". The body names the member, the space and the Eastern-time window.

## Avenue - Booking decision e-mail to member (95d91bb5-b7cf-404a-aed4-9b02d4ae2c3a), concurrency 1
Trigger: item created or modified in `AvenueBookings`. Trigger condition:
```
@and(or(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), equals(triggerOutputs()?['body/Status/Value'], 'Declined'), equals(triggerOutputs()?['body/Status/Value'], 'Cancelled')), not(equals(triggerOutputs()?['body/Status/Value'], coalesce(triggerOutputs()?['body/DecisionNotified'], ''))), not(empty(triggerOutputs()?['body/MemberId'])))
```
- `Update item` first: DecisionNotified = `@{triggerOutputs()?['body/Status/Value']}`. The next modification no longer matches the condition, so there is no loop and no second e-mail. Power Automate's generic "circular loop" save warning is expected.
- E-mail: "Your Flavors booking is <status>". It gives the space and Eastern start time, plus `Note from Flavors: <OverlapNote>` when a note exists.

## Avenue - Failed checklist alert (9e35967f-75b0-4f57-ae42-384827660f34), CHK-05
Trigger: item created in `AvenueCheckIns`, condition `@equals(triggerOutputs()?['body/AllPassed'], false)`.
- Update the check-in: AlertSentAt = `@{utcNow()}`.
- Member e-mail "Checklist flagged for your Flavors booking". Staff e-mail "Failed <kind> checklist", sent only if StaffAlertEmail is set.
- No answers in either e-mail: answers are read only in Avenue.

## Avenue - Overdue exit checklist (1fca2bb8-2dc0-42c4-ab01-aee0c375d486), every 5 min, concurrency 1, CHK-06
- Grace: `@{coalesce(first(outputs('Get_items')?['body/value'])?['ExitGraceMinutes'], 15)}` (15 [PROPOSED], Q-10).
- Bookings: `Status eq 'Approved' and FacilityId eq 'flavors-hyattsville' and ExitFlaggedAt eq null and EndUtc le '@{addMinutes(utcNow(), mul(-1, int(outputs('Compose'))))}' and EndUtc gt '@{addHours(utcNow(), -12)}'`
- Per booking: an Entry check-in exists and no Exit exists. Then mark ExitFlaggedAt **first**, e-mail the member "Exit checklist not received…", and e-mail staff "Exit checklist overdue" if StaffAlertEmail is set.
- A booking with no entry at all is a missed entry (handled by the missed-entry flow), not an overdue exit.

## Changes to existing flows (12 Nov afternoon)
- **Booking request → Pending booking:**
  - `Get_items_3` finds approved private events that overlap the request: `Status eq 'Approved' and Space eq 'Whole facility' and FacilityId eq 'flavors-hyattsville' and StartUtc lt '@{triggerOutputs()?['body/EndUtc']}' and EndUtc gt '@{triggerOutputs()?['body/StartUtc']}'`. A match declines the request with "Refused automatically: the facility is booked for a private event at this time."
  - `Get_items_4` finds the author's membership if it is Inactive: `MemberId eq '@{triggerOutputs()?['body/Author/Email']}' and Status eq 'Inactive'`. A match declines with "Refused automatically: this membership is not active."
  - The Status and OverlapNote expressions now include both checks.
- **Hours ledger:** Period is `@{convertFromUtc(triggerOutputs()?['body/StartUtc'], 'Eastern Standard Time', 'yyyy-MM')}` (was the UTC month). Both the Used and the Credit back rows changed.

## Avenue - Overlap note to other members (1cd15abe-446d-4981-a574-52de35bfe0f3), concurrency 1, BKG-04
Trigger: item created or modified in `AvenueBookings`. Trigger condition: `@and(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), not(empty(triggerOutputs()?['body/OverlapNote'])), empty(triggerOutputs()?['body/OverlapNotified']))`
- `Update item` first: OverlapNotified = `yes`. Each note is sent once; the save shows the expected "circular loop" warning.
- `Get items`: `Status eq 'Approved' and FacilityId eq 'flavors-hyattsville' and BookingId ne '<this>' and StartUtc lt '<this end>' and EndUtc gt '<this start>'` (top 50).
- For each result whose member is a different member, e-mail "Another booking overlaps yours" with the note. The other member is never named.

## Booking request flow: extension guard
Trigger condition added: `@empty(triggerOutputs()?['body/ExtendBookingId'])`. An extra-time request never creates a booking; "Avenue - Extension request" handles it.

## Avenue - Extension request (7a312a41-0a9e-4fad-857d-84f52f89cc9d), concurrency 1, BKG-08
Trigger: item created in `AvenueBookingRequests`, condition `@not(empty(triggerOutputs()?['body/ExtendBookingId']))`.
- Booking: `BookingId eq '<ExtendBookingId>' and MemberId eq '<author email>' and Status eq 'Approved'`.
- Accept only if:
  - exactly one booking matches;
  - the new end is later than the booking's end and later than now;
  - no other request is waiting (ExtensionDecision empty or `Done-…`).
- If accepted:
  - count the approved bookings overlapping the extra time;
  - write ExtensionTo, ExtensionRequestedAt, ExtensionRequestId, ExtensionConflict, and ExtensionDecision `Pending`;
  - set the member's Outcome to "Extension requested · Flavors will reply";
  - e-mail staff, if the alert address is set.
- If not accepted: set Outcome to "Not accepted: …".

## Avenue - Extension decision (6d9890b4-99f6-4b17-82b6-087fb12d40ad), concurrency 1
Trigger: booking created or modified with ExtensionDecision `Approved` or `Declined` and ExtensionTo set.
- **Approved:**
  - Booking: EndUtc = ExtensionTo, ExtensionDecision `Done-Approved`.
  - Calendar row: EndUtc updated.
  - Ledger: new row "Hours used (extension)", EntryId/ChargeKey `<BookingId>-ext-<ExtensionRequestId>` (unique, so idempotent), hours = the extra time, Period in Eastern time.
  - Member: Outcome "Extension approved · now ends …"; e-mail "Extra time approved".
- **Declined:**
  - Booking: ExtensionDecision `Done-Declined`; the end time is unchanged.
  - Member: Outcome "Extension not approved"; e-mail.
- Staff "Extend now" in the app writes an already-approved extension (`staff-<GUID>` request id), and this flow applies it.

## Avenue - Membership card (concurrency 1)
Trigger: item created or modified in `AvenueMembers` (condition: MemberId not empty).
- `Get items` on `AvenueMyMembership`: `MemberId eq '<MemberId>'` (top 1).
- Status `Inactive`: delete the member's row, so access ends with it (fail closed).
- Otherwise:
  - update the row if it exists, or create it, copying BusinessName, PlanId, CollectionDay and Status;
  - then **Grant access to an item or a folder**: Recipients = MemberId, Role = Can view, Notify = No. This gives item-level read to that member only.
- The list itself has the private permission set (owners, automations, staff Contribute, owner Edit); members have no list-level access.


## 13 Nov 2026 audit-gap changes (saved and code-reviewed; live re-test pending)

**Rule for array inputs:** the `from` of Select / Filter array and the input of Apply to each must be a pure expression (`@outputs(...)`, no braces). `@{...}` yields text and fails with "value must be an array" (found by a live test on 13 Nov, fixed in the three flows below).

### Booking request to Pending booking (eef19366-dddc-44fe-9492-abb6cf8471c9)
Actions run in this order after the trigger: `Author groups`, `IsStaff`, `Member`, `Get_items`, `Get_items_1`, `Get_items_2`, `Get_items_3`, `Get_items_4`, `Get_items_5`, `Get equipment`, `Equipment ids`, `Unknown equipment`, `Refusal`, `Condition`, `Create_item`.
- `Author groups` (SharePoint HTTP request, GET): `_api/web/siteusers?$filter=Email eq '@{triggerOutputs()?['body/Author/Email']}'&$expand=Groups&$select=Id,Groups/Title`, header `Accept: application/json;odata=nometadata`. An empty list means not staff.
- `IsStaff`: `@or(contains(string(body('Author_groups')), 'Avenue Flavors Staff'), contains(string(body('Author_groups')), 'Avenue Flavors Owner'), contains(string(body('Author_groups')), 'Avenue Owners'))` (a bare expression so the output is a boolean; `@{...}` made it text and `not()` failed, 14 Nov)
- `Member`: `@{if(empty(triggerOutputs()?['body/OnBehalfOf']), triggerOutputs()?['body/Author/Email'], toLower(trim(triggerOutputs()?['body/OnBehalfOf'])))}`
- `Get_items_1` (expired documents): `MemberId eq '@{outputs('Member')}' and SupersededBy eq null and ExpiryDate lt '@{utcNow('yyyy-MM-dd')}T00:00:00Z'`
- `Get_items_2` (active overrides): `MemberId eq '@{outputs('Member')}' and Active eq 1`
- `Get_items_5` (active compliance holds, added 20 Nov): list AvenueComplianceHolds, `MemberId eq '@{outputs('Member')}' and Active eq 1`. Refusal rule order is now: ..., active membership, **compliance hold**, equipment, expired document, private event.
- `Get_items_4` (must find exactly one ACTIVE membership, top 2): `MemberId eq '@{outputs('Member')}' and Status eq 'Active' and FacilityId eq 'flavors-hyattsville'`
- `Get equipment`: AvenueEquipment, top 500, `FacilityId eq 'flavors-hyattsville' and Active eq 1`. `Equipment ids` (Select): from `@outputs('Get_equipment')?['body/value']`, map `@{item()?['EquipmentId']}`. `Unknown equipment` (Filter array): from `@split(coalesce(triggerOutputs()?['body/EquipmentIds'], ''), ';')`, where `@and(not(empty(trim(item()))), not(contains(body('Equipment_ids'), trim(item()))))`.
- `Refusal` (Compose, **rule order matters**: staff-only on-behalf, time, facility, active membership, equipment, expired document, private event):
```
@{if(and(not(empty(triggerOutputs()?['body/OnBehalfOf'])), not(outputs('IsStaff'))), 'Refused automatically: only Flavors staff can book for another member.', if(or(lessOrEquals(ticks(triggerOutputs()?['body/EndUtc']), ticks(triggerOutputs()?['body/StartUtc'])), less(ticks(triggerOutputs()?['body/StartUtc']), ticks(utcNow()))), 'Refused automatically: the requested time is not valid.', if(not(equals(triggerOutputs()?['body/FacilityId'], 'flavors-hyattsville')), 'Refused automatically: unknown facility.', if(not(equals(length(outputs('Get_items_4')?['body/value']), 1)), 'Refused automatically: this membership is not active.', if(greater(length(outputs('Get_items_5')?['body/value']), 0), 'Refused automatically: a compliance review is open on your account. Flavors will contact you.', if(or(and(equals(triggerOutputs()?['body/Space/Value'], 'Kitchen'), empty(trim(coalesce(triggerOutputs()?['body/EquipmentIds'], '')))), greater(length(body('Unknown_equipment')), 0)), 'Refused automatically: choose equipment from the Flavors equipment list.', if(and(greater(length(outputs('Get_items_1')?['body/value']), 0), equals(length(outputs('Get_items_2')?['body/value']), 0)), 'Refused automatically: a required document has expired. The Flavors owner can override.', if(greater(length(outputs('Get_items_3')?['body/value']), 0), 'Refused automatically: the facility is booked for a private event at this time.', ''))))))))}
```
- `Create_item` (AvenueBookings): `MemberId` = `@{outputs('Member')}`; `Status` = `@{if(empty(outputs('Refusal')), if(and(not(empty(triggerOutputs()?['body/OnBehalfOf'])), outputs('IsStaff')), 'Approved', 'Pending'), 'Declined')}`; `OverlapNote` = `@{if(empty(outputs('Refusal')), coalesce(triggerOutputs()?['body/StaffNote'], ''), outputs('Refusal'))}`; `BookedBy` = `@{if(empty(triggerOutputs()?['body/OnBehalfOf']), '', triggerOutputs()?['body/Author/Email'])}`; `DecidedBy` = `@{if(and(empty(outputs('Refusal')), not(empty(triggerOutputs()?['body/OnBehalfOf']))), triggerOutputs()?['body/Author/Email'], '')}`; `DecidedAt` = `@if(and(empty(outputs('Refusal')), not(empty(triggerOutputs()?['body/OnBehalfOf']))), utcNow(), null)` (a bare expression: inside `@{...}` null became an empty string and SharePoint rejected it as a date, so every MEMBER request failed at Create_item; fixed 14 Nov).

### Document submission (10d022e9-c5d6-4c5e-b36b-88c476b3b8b9)
Same `Author groups` / `IsStaff` / `Member` block. The validity condition also requires `or(empty(triggerOutputs()?['body/OnBehalfOf']), outputs('IsStaff'))`. File properties and `AvenueMemberDocuments.MemberId` use `outputs('Member')`; `UploadedBy` = author e-mail. After the new row, `Older documents` (same member, same DocType, `SupersededBy eq null`, other SourceSubmissionId, `ExpiryDate lt` the new expiry) are each updated with `SupersededBy` = the new SubmissionId.

### Check-in submission (85b9e552-7f0b-4a09-8779-a92b1f342888)
`Questions` (active questions of that Kind) and `Yes answers` (Filter array, from `@json(coalesce(triggerOutputs()?['body/Answers'], '[]'))`, where `@equals(item()?['a'], 'Yes')`). `AllPassed` = `@{and(equals(length(json(coalesce(triggerOutputs()?['body/Answers'], '[]'))), length(outputs('Questions')?['body/value'])), equals(length(body('Yes_answers')), length(outputs('Questions')?['body/value'])))}` ([PROPOSED] rule: all active questions answered Yes). The member's own `AllPassed` is ignored.

### Booking decision e-mail (95d91bb5-b7cf-404a-aed4-9b02d4ae2c3a)
Body now ends with a paragraph linking to the Avenue portal (same URL as the reminder e-mail).

### Notice e-mail (d89ad065-dc16-4bc4-8135-b9f98f680b52 per earlier section)
After the trigger: `Current notice` (Get item), `Already notified` (condition: `NotifiedAt` set or notice not active, then Terminate), `Update item` setting `NotifiedAt` = utcNow(), then the existing actions. Marks before sending.

### Not saved
"Avenue - Document renewal reminder" (daily; expiring or expired documents with `RenewalReminderAt` empty and `SupersededBy` empty; marks `RenewalReminderAt` first, then a generic e-mail) is built in an unsaved designer tab only.

## Booking request flow: overdue payment refusal (BKG-14) and cancel-item guard (23 Nov 2026, saved and tested live)
- `Refusal` gains one rule straight after "this membership is not active" (rule order: staff-only on-behalf, time, facility, active membership, **overdue payment**, compliance hold, equipment, expired document, private event):
```
if(contains(createArray('PastDue', 'Unpaid'), coalesce(first(outputs('Get_items_4')?['body/value'])?['PaymentStatus']?['Value'], '')), 'Refused automatically: a payment is overdue. Please contact Flavors.', <the rest unchanged>)
```
  `Get_items_4` is the member's single Active AvenueMembers row. Only `OwnerOverride` (set by the owner) lets an overdue member book; there is no staff bypass, including staff booking on the member's behalf (BKG-14: owner only). Empty PaymentStatus (members created before Stripe) is not overdue.
- Second trigger condition: `@empty(triggerOutputs()?['body/CancelBookingId'])`. Cancel items have no times; before this they reached `Get_items_3` and failed with "String was not recognized as a valid DateTime" (run 23 Nov 10:58 IST, item 94). The cancellation flow handles them.
- Live test 23 Nov (automations@, staff on behalf of TDDAdmin): member row 10 set PastDue → request `gaptest-bkg14-1` became booking 88 **Declined** "Refused automatically: a payment is overdue. Please contact Flavors."; PaymentStatus restored to empty; request 95 and booking 88 recycled by id. Not tested: OwnerOverride passing, a member's own (non-staff) request.

## Specified, not built (23 Nov 2026) — Support, Events, Storage
**None of these six flows exists in Power Automate. They are written down so the build is mechanical once the lists are applied (`schema/lists.v2.json`, [DATA_AND_ACCESS.md](../docs/DATA_AND_ACCESS.md)). Every expression is untested.** All six run at trigger concurrency 1, as the service account `automations@`, and follow the standing rules: member identity = item author (never a field), `Outcome`/`Reply` are display-only and never read back, a refused item gets "Not accepted: …", generic e-mails only (COM-02), and a bare `@expr` for every boolean or date value (`@{...}` makes text).

Shared steps for the three intake flows (same block as the booking flow): `Author groups` (HTTP request to SharePoint, GET `_api/web/siteusers?$filter=Email eq '@{triggerOutputs()?['body/Author/Email']}'&$expand=Groups&$select=Id,Groups/Title`, header `Accept: application/json;odata=nometadata`), `IsStaff` = `@or(contains(string(body('Author_groups')), 'Avenue Flavors Staff'), contains(string(body('Author_groups')), 'Avenue Flavors Owner'), contains(string(body('Author_groups')), 'Avenue Owners'))`, `Member` = `@{toLower(triggerOutputs()?['body/Author/Email'])}`. Staff may write to these intake lists too; a staff-authored item is treated as the staff member's own message or request (no `OnBehalfOf` in this release).

### 1. Avenue - Support message to case (concurrency 1), ADM-03
Trigger: item created in `AvenueSupportMessages`, condition `@not(empty(triggerOutputs()?['body/MessageId']))`.
- `Valid` = `@and(not(empty(trim(coalesce(triggerOutputs()?['body/Subject'], '')))), not(empty(trim(coalesce(triggerOutputs()?['body/Body'], '')))), less(length(coalesce(triggerOutputs()?['body/Body'], '')), 4001), contains(createArray('Booking', 'Billing', 'Documents', 'Equipment', 'Other'), triggerOutputs()?['body/Category/Value']))`. A bare expression so the output is a boolean.
- Not valid: update the item, `Outcome` = `Not accepted: a subject, a message (up to 4,000 characters) and a category are needed.`; stop.
- `Thread id` = `@{if(empty(triggerOutputs()?['body/ThreadId']), triggerOutputs()?['body/MessageId'], triggerOutputs()?['body/ThreadId'])}`. A new conversation is a message with an empty ThreadId; the flow writes that value back to the item's `ThreadId` (the portal sends the thread's id for a reply).
- A reply may only continue the member's own thread: `Get items` on `AvenueSupportCases`, filter `ThreadId eq '@{outputs('Thread_id')}' and MemberId eq '@{outputs('Member')}'`, top 1. If `ThreadId` was supplied but no row matches: `Outcome` = `Not accepted: that conversation was not found.`; stop.
- No row (new thread): create `AvenueSupportCases`: FacilityId `flavors-hyattsville`, CaseId `@{outputs('Thread_id')}`, ThreadId, MemberId `@{outputs('Member')}`, Category `@{triggerOutputs()?['body/Category/Value']}`, Subject, LastMessage = Body, Status `Open`, CreatedAt `@utcNow()` (bare: a date).
- Row exists (reply): update it: LastMessage = Body, Status `Open` (reopens a Closed or Answered thread), StaffReply and RepliedAt left as they are.
- Update the member's item: ThreadId = `@{outputs('Thread_id')}`, `Outcome` = `Received · Flavors replies here in the portal`.
- E-mail staff only if `StaffAlertEmail` is set: generic "A member sent a message" with the portal link; no message text.

### 2. Avenue - Support reply to echo (concurrency 1), ADM-03
Trigger: item modified in `AvenueSupportCases`, condition `@and(not(empty(trim(coalesce(triggerOutputs()?['body/StaffReply'], '')))), not(equals(triggerOutputs()?['body/Status/Value'], 'Open')))`. The staff app sets `StaffReply`, `RepliedBy`, `RepliedAt` and Status `Answered` (or `Closed`) in one Patch.
- There is no "already echoed" marker column in this release, so the echo is written to be idempotent: a repeat run writes the same Reply and Outcome again and changes nothing. The consequence is that the optional e-mail below can repeat if the case row is edited again (see doubts).
- `Thread items`: `Get items` on `AvenueSupportMessages`, filter `ThreadId eq '@{triggerOutputs()?['body/ThreadId']}'`.
- `Apply to each` item of `Thread items`: update `Reply` = `@{triggerOutputs()?['body/StaffReply']}` and `Outcome` = `@{if(equals(triggerOutputs()?['body/Status/Value'], 'Closed'), 'Closed by Flavors', 'Answered')}`. (The member's own items are readable only by their author, so the flow runs as `automations@`; it must not grant any other access.)
- Optional: e-mail the member a generic "Flavors replied: open Avenue" message (COM-02: no reply text in the e-mail). Omit this step in the first release unless the client wants it, because without an echo marker it can repeat.

### 3. Avenue - Event request to case (concurrency 1), BKG-16/17
Trigger: item created in `AvenueEventRequests`, condition `@not(empty(triggerOutputs()?['body/RequestId']))`.
- Price table (member, dining room only, cents): Simplicity 95000, Opulence 120000, Elevation 140000, Platinum 185000. `Quote` = `@{int(if(equals(triggerOutputs()?['body/Package/Value'], 'Simplicity'), 95000, if(equals(triggerOutputs()?['body/Package/Value'], 'Opulence'), 120000, if(equals(triggerOutputs()?['body/Package/Value'], 'Elevation'), 140000, if(equals(triggerOutputs()?['body/Package/Value'], 'Platinum'), 185000, 0)))))}`. A 0 quote means an unknown package.
- `Refusal` = `@{if(equals(int(outputs('Quote')), 0), 'Not accepted: choose Simplicity, Opulence, Elevation or Platinum.', if(not(greater(ticks(triggerOutputs()?['body/EventDate']), ticks(addDays(utcNow(), 14)))), 'Not accepted: the event date must be at least 14 days from today.', if(or(less(int(coalesce(triggerOutputs()?['body/Guests'], 0)), 1), greater(int(coalesce(triggerOutputs()?['body/Guests'], 0)), 60)), 'Not accepted: guests must be between 1 and 60.', if(greater(length(body('Active_member')?['value']), 0), '', 'Not accepted: your membership must be active to request an event.'))))}`. The 14-day minimum notice and the 60-guest limit are [PROPOSED] (the sheet gives 50 seats with the current set-up and about 60 as a pre-filled note, Q-22); the member price applies only to an active member (get `Active member` = `Get items` on `AvenueMembers`, `MemberId eq '@{outputs('Member')}' and Status eq 'Active'`, top 1).
- Refused: update the item, `Outcome` = `@{outputs('Refusal')}`; stop.
- Otherwise create `AvenueEventCases`: FacilityId, CaseId `@{triggerOutputs()?['body/RequestId']}`, RequestId, MemberId `@{outputs('Member')}`, Package, EventDate `@triggerOutputs()?['body/EventDate']` (bare), Guests, Notes, QuoteCents `@int(outputs('Quote'))` (bare), Status `Requested`.
- Update the item: `Outcome` = `Received · quote $` followed by `@{div(int(outputs('Quote')), 100)}` and ` for the package; Flavors confirms before anything is invoiced`.
- No Stripe object is created by this flow; money moves only when staff approve (flow 4 / the staff app).

### 4. Avenue - Event decision to echo (concurrency 1), BKG-16/17
Trigger: item modified in `AvenueEventCases`, condition `@or(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), equals(triggerOutputs()?['body/Status/Value'], 'Declined'), equals(triggerOutputs()?['body/Status/Value'], 'Invoiced'))`. The staff app Approve sets Status `Approved`, `DecidedBy` = `User().Email`, `DecidedAt` = `Now()` and also creates an `AvenueHostRequests` item (Kind `EventInvoice`, Payload `{"memberEmail": "<MemberId>", "packageName": "<Package>", "eventDate": "yyyy-mm-dd", "member": true}`), whose host answer (deposit and balance invoices) a staff member copies into `InvoiceId` and Status `Invoiced`.
- `Request item`: `Get items` on `AvenueEventRequests`, filter `RequestId eq '@{triggerOutputs()?['body/RequestId']}'`, top 1; if none, stop.
- Update that item: `Outcome` = `@{if(equals(triggerOutputs()?['body/Status/Value'], 'Declined'), 'Not approved', if(equals(triggerOutputs()?['body/Status/Value'], 'Invoiced'), 'Approved · invoices sent', 'Approved · invoices follow'))}`, `Reply` = `@{if(equals(triggerOutputs()?['body/Status/Value'], 'Invoiced'), 'See Billing for your deposit and balance invoices.', if(equals(triggerOutputs()?['body/Status/Value'], 'Declined'), 'Flavors could not take this event. Message Flavors for details.', 'Flavors approved your request.'))}`.
- Idempotent (writes the same text again on a repeat run). E-mail, if wanted, is the generic "open Avenue" message only.

### 5. Avenue - Storage request to case (concurrency 1), Q-25
Trigger: item created in `AvenueStorageRequests`, condition `@not(empty(triggerOutputs()?['body/RequestId']))`.
- `Refusal` = `@{if(or(less(int(coalesce(triggerOutputs()?['body/Quantity'], 0)), 1), greater(int(coalesce(triggerOutputs()?['body/Quantity'], 0)), 20)), 'Not accepted: quantity must be between 1 and 20.', if(greater(length(body('Active_member')?['value']), 0), '', 'Not accepted: your membership must be active to request storage.'))}` (`Active member` as in flow 3; the 20 limit is [PROPOSED]).
- Refused: update the item, `Outcome` = `@{outputs('Refusal')}`; stop.
- Otherwise create `AvenueStorageCases`: FacilityId, CaseId `@{triggerOutputs()?['body/RequestId']}`, RequestId, MemberId, Item `@{triggerOutputs()?['body/Item/Value']}`, Quantity, Notes, `MonthlyCents` left empty (staff enter the amount; no price is applied automatically because the sheet's storage prices are ambiguous), Status `Requested`.
- Update the item: `Outcome` = `Received · Flavors confirms the price and availability`.

### 6. Avenue - Storage decision to echo (concurrency 1), Q-25
Trigger: item modified in `AvenueStorageCases`, condition `@or(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), equals(triggerOutputs()?['body/Status/Value'], 'Declined'))`.
- `Request item`: `Get items` on `AvenueStorageRequests`, filter `RequestId eq '@{triggerOutputs()?['body/RequestId']}'`, top 1; if none, stop.
- Update it: `Outcome` = `@{if(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), 'Approved', 'Not approved')}`, `Reply` = `@{if(equals(triggerOutputs()?['body/Status/Value'], 'Approved'), concat('Approved at $', string(div(int(coalesce(triggerOutputs()?['body/MonthlyCents'], 0)), 100)), ' a month. Flavors will bill you directly.'), 'Flavors could not take this request. Message Flavors for details.')}`.
- Storage is billed by hand outside Avenue (no invoice, no Stripe object, no host call).

# Build doubts (23 Nov 2026)

Everything in the remaining-modules build (support, event requests, storage requests, team roster, staff Support/Events/Storage/Permissions/Reports screens, schema, flow specs, checklist loader) is **built locally and not deployed**. This file merges the three builders' own doubt lists so the client can confirm or change each one. Contract: [REMAINING_MODULES_CONTRACT.md](REMAINING_MODULES_CONTRACT.md). Defaults chosen earlier for payments: [CLIENT_REVIEW_DEFAULTS.md](CLIENT_REVIEW_DEFAULTS.md). Sensors: [ENVIRONMENT_PLAN.md](ENVIRONMENT_PLAN.md) section 12.

## Read this first

- **Verified by the lead on 23 Nov:** host 75 tests, sensors-core 10, billing-core 34, domain-core 48, schema 16 + `check.mjs` (37 lists), staff `check.py` (1445 controls, 22 files), member portal build 358 tests, 0 failures. Frozen modules (Compliance Documents, Payments Dashboard, Member Onboarding): staff files byte-identical to before; portal files unchanged (dates from 20-21 Nov).

- **Not verified anywhere:** nothing has been seen in a browser, in Power Apps Studio, at 390 px, with a screen reader, or on a real guest account; the six flows are written but not created; the eight new SharePoint lists do not exist on the site yet.

- **Before any deploy:** create the lists (`schema/lists.v2.json` via the reconcile script), build the six flows from `flows/expressions.md` (Specified, not built), add the four staff data sources in Studio, then paste screens per the paste map in the staff doubts. The portal package is `apps/member-spfx/sharepoint/solution/member-spfx.sppkg` (2.14.0.0), not copied to `release/`.


---

## A. Member portal

(source: [doubts/A-portal.md](doubts/A-portal.md))

# Doubts: member portal (builder A), 23 Nov 2026

Build 2.14.0.0, not uploaded, not deployed. 358 tests pass. Nothing here was run against a live site, a guest account or a phone. Each line: the doubt, then a suggested question or check.

## Not verified without a live site
- No screen was seen in a browser, in the SharePoint debug preview, at 390 px, with a screen reader, or with reduced motion on; only jsdom tests ran. Check: open each new screen in the debug preview as a guest before upload.
- The four intake lists (`AvenueSupportMessages`, `AvenueEventRequests`, `AvenueStorageRequests`, `AvenueTeamMembers`) do not exist on the live site yet. If a tab is opened before they exist, the view shows the SharePoint error text with no retry button (the reads reject rather than return an empty list). Check: create the lists first (builder B's schema), then test.
- "Own items only" relies on item-level permissions and the `AuthorId` filter, the same as the other intake lists. Not tested with two real members. Check: a second guest must not see the first guest's messages by direct URL.
- No Power Automate flow exists for any of these lists, so `Outcome` and `Reply` stay empty on a real site until the six specified flows are built. The screens then show "Waiting for Flavors." Check: confirm the flows before telling members these features work.
- Team removal updates the member's own item (`Active = false`). Whether a Contribute-with-own-items member can edit their own item on an item-level-secured list is the same assumption the existing compliance flag and document writers make, but "update" (not "add") is untested live. Check: test Remove and Bring back as a guest.

## Release flags
- `release/release.json` (changed by another builder after my first build) lists `support`, `events` and `storage` but **not `team`**. In a real (non-demo) build the Messages, Event request and Storage screens are therefore ON and My team plus the wellness name prefill are OFF. Demo mode shows all four. Question: should `team` be added to `release/release.json` when the others are deployed?
- A module absent from `release.json` is hidden from the drawer and unreachable, but its code ships in the bundle. Fine, but it means turning a module on needs a new build and upload.

- The "hidden in a real release" drawer test now asserts only `My team`, because `release/release.json` changed under it (it failed once at 357/358 when `support` was added). It will need updating again if `team` is listed.

## Support (Messages with Flavors)
- A thread is identified by `ThreadId` (the first message's id). Staff must echo the reply onto the member's newest item for the "Reply received" dot to work; a reply echoed onto an older item is still shown in the thread but does not raise the dot. Question for the flow design: always echo onto the newest message of the thread.
- "Reply received" has no read state. It stays on until the member writes again; there is no "mark as read". Question: is that acceptable, or add a `ReadAt` column?
- The reply box is capped at 2000 characters like a new message; attachments are not supported. Question: do members need to send photos (for example of broken equipment)?
- No reply time is promised and no contact e-mail or phone is shown (Q-13, Q-P1). Question: what should the screen say about when to expect a reply?
- Messages from members with a hold or an overdue payment are not blocked. Question: should support always stay open for them? (Built: yes, always open.)

## Event request
- Prices are the sheet's **member** package prices. Non-member events are staff-entered; the portal never shows them.
- The sheet says "$500 refundable deposit" and a separate package price. I treat the deposit as **in addition to** the package price (as the host's `EventInvoice` does), not included in it. Question: is the $500 deposit on top of the package price?
- "Balance due 30 days before the event, immediately if booked less than 30 days before" is shown as written. For an event exactly 30 days away the balance is due today. Question: is "30 days before" counted from the event start date?
- No refund or cancellation text is shown (8-14 days and under 7 days are open, Q8/Q9). Question: what should members be told about cancelling?
- Extra hours are shown at $100 each, but the form cannot ask for extra hours, so any extra time is a note. Question: should the form ask for a start time and end time?
- Package hours (4/6/8/12) are not checked against the date or against bookings; a private event blocks the whole facility (BKG-17) but the request does not check the calendar for clashes. Question: should the form show whether the date is free?
- Guests are limited to 1-60 (the 11 Nov call said about 60; the sheet says 50 seats with the current set-up). Above 50 the screen says Flavors quotes extra seating. Question: confirm 50 or 60.
- The date is stored as noon UTC so no time zone can move it a day; there is no start time at all.
- Dates use `<input type="date">`; very old browsers show a text box (validation still rejects bad dates).

## Storage
- Priced: half-door fridge or freezer $250 per door per month; full-door fridge or freezer $400 per door per month; daily dry $50 and daily cold $75 per shelf per day. **Not priced** ("price on request"): dry shelf single and dry shelf double, because the sheet gives two numbers per size ($250 / $135 and $450 / $235) without saying which is which.
- Full-door is shown at $400 per door, but the sheet also says "$700 per unit". The screen adds that note. Question: is a full unit $700, or $400 per door?
- Daily items are "per shelf per day"; quantity means shelves, not days, and the form has no start or end date. Question: should a daily request ask for dates?
- The estimate multiplies price by quantity only; no tax, no proration, no minimum term. It is labelled "About" and "before Flavors confirms".
- Availability is not checked (no unit inventory exists). Question: how many doors and shelves exist?

## Team roster
- Roles are Lead and Member only; more than one Lead is allowed and nothing enforces one Lead. Question: should exactly one Lead be required (CHK-02)?
- "Remove" only deactivates (the writer interface has no delete); removed people can be brought back. Nothing is ever deleted, so a member cannot erase a name.
- The roster only prefills the wellness names; it grants no access and is not shown to staff in this build. Question: should staff see each member's team?
- Wellness names are prefilled once when the check opens; a name removed for "today" in the wellness screen is not removed from the roster.
- Personal data: team names are personal data. Retention and deletion are unanswered (Q-14).

## Profile drawer
- Rows added: Account → Event request, Storage, My team; Help → Messages with Flavors. The drawer now also reads the member's support messages when it opens (one more request) and treats any failure as "no reply".
- The existing drawer tests mock a source without the new methods; the drawer guards with `typeof ... === 'function'`, so an old mock or a source built before this version still works. Real `AvenueReadSource` always has them.
- Opening a deep-linked screen whose module is off is not possible (the tab is refused); there are no direct URLs for the new screens.

## Existing test changed
- `ConsoleScreens.test.tsx` "schedule › shows the board…" failed after 18:00 UTC because the demo sample bookings end at 18:00 UTC and the unit then reads "Free for the rest of today". I added that text to the accepted pattern (comment in the test). It was already time-of-day dependent before this build; not caused by these changes. Question: replace it with a fixed clock in a later clean-up?

## Not touched on purpose
- Frozen: `DocumentsView.tsx`, `ComplianceWizard.tsx`, `compliance.ts`, `BillingView.tsx`, `JoinView.tsx`, `WelcomeView.tsx`. The drawer's Member Onboarding "Getting started" block is unchanged.
- `release/delivery-1-member-spfx.sppkg` is the 21 Nov file; the new package is only at `apps/member-spfx/sharepoint/solution/member-spfx.sppkg` (2.14.0.0).
- The 4 existing lint warnings (CalendarView, feedback, ProfileDrawer null, LEGACY_HEAD unused) are unchanged.


---

## B. Schema, host, flows spec

(source: [doubts/B-schema-host.md](doubts/B-schema-host.md))

# Doubts: schema, host, flows spec (builder B, 23 Nov 2026)

Everything below is `[PROPOSED]` and nothing was deployed, applied to SharePoint, or created in Power Automate. Format: doubt, then **Ask** (a suggested question for the client or developer).

## Schema (8 new lists, 37 total)
1. **Intake ids are not unique.** The contract asked for `MessageId`/`RequestId`/`TeamMemberId` unique; `schema/check.mjs` (and SharePoint) refuses unique fields on own-items-only lists, so they are indexed only. Duplicate protection must come from the flow (`CaseId` is unique on the private lists). **Ask:** none; developer to confirm the flows de-duplicate.
2. **Storage and event requests reference no price in the intake list.** The quote is computed by the flow into `AvenueEventCases.QuoteCents`; the member sees it only through `Outcome`. If the portal shows a price before sending, the two tables (portal and flow) can drift. **Ask:** who owns the price table, and does a price change apply to requests already received?
3. **`AvenueTeamMembers` has no uniqueness and no cap.** A member can add the same name twice. It is a convenience list, not an access list, but it holds personal names (staff may read it only through the list permission, which is none for staff on intake lists unless staff are also authors). **Ask:** may Flavors staff see a member's team roster (privacy, wellness records)?
4. **`AvenueStaffCapabilities` capability set is invented.** Seven flags (ApproveBookings, ManageDocuments, ViewPayments, ManageMembers, PostNotices, ManageEquipment, ViewEnvironment) are a guess at Q-15. Hiding controls in the staff app is not security. **Ask:** which actions may the owner switch on or off for the staff account (Q-15)?
5. **Choice values are fixed in the schema** (support categories, event packages, storage items). A new package or storage item needs a schema change. Event package names must equal the host table (`apps/integration-host/plans.mjs`), tested for the four names.
6. **None of the 8 lists exists on the live site.** `schema/check.mjs` and `invariants` pass offline only; the provisioning script (`schema/reconcile.browser.js`) was not run. Field internal names were checked for the 32-character rule only.

## Check-in question loader
7. **No question text exists in the repository.** The client's Entry (5), Exit (4) and Wellness (3) lists were in an e-mail attachment never received (Q-10); the sheet shows only numbered empty rows. `schema/checklist.seed.mjs` and `schema/checklist.load.browser.js` therefore load nothing until the developer supplies the text. Live today: 1 Entry, 3 Exit (+1 inactive), 0 Wellness. **Ask:** please send the three checklists with the exact wording and which answers fail (Q-10).
8. **Pass/fail rule is still "all Yes = pass"** (invariant 7, [PROPOSED]). Wellness answers may need a different rule (a health question is "No" to pass). **Ask:** for each question, which answer passes?
9. The loader is idempotent by Kind + SortOrder and never deletes; retiring a question is Active=false. If the client reorders questions, SortOrder numbers shift and existing rows are overwritten in place, which changes the wording behind old check-in answers (answers are stored with the question text? not verified). **Ask:** do old check-in records need to keep the original wording (versioning)?
10. The browser script is untested against SharePoint (parses only; the validator has 4 unit tests).

## Host (`apps/integration-host`)
11. **Events reuse the existing staff-only `EventInvoice` request; no host code changed.** Verified in tests that the staff payload (`payload` as a JSON string, `eventDate` as `yyyy-mm-dd`, `member: true`) works for all four packages and produces deposit $500 now and the member price due 30 days before. Refused: non-staff author, `Z` timestamps, `dd/mm/yyyy`, past dates, unknown package.
12. **The staff app must send `eventDate` as plain `yyyy-mm-dd`.** The host refuses anything else. A Power Apps date control needs `Text(date, "yyyy-mm-dd")`. **Ask (developer):** builder C must confirm this formatting.
13. **Event invoices are created only when staff approve, with no refund logic.** The 30-day rule (deposit lost under 30 days, balance due immediately if closer) follows the sheet's wording, but the 8-14 day and under 7 day refunds are 0 in one cell and 15+ days full refund in the call notes (Q8/Q9). Nothing here decides a refund. **Ask:** the cancellation schedule for private events (Q9).
14. **Non-member events** are possible in the host (`member: false`) but the member price table in the flows is member-only; non-members cannot use the portal request. Outside guests booking is staff-only (Q8).
15. **Storage creates nothing in Stripe: no host change.** Staff bill by hand outside Avenue; no invoice or subscription exists for storage rental. **Ask:** should storage become a subscription item on the member's plan (Q-25)?
16. **The event "invoice sent" step is manual:** the host answers an `EventInvoice` request with an outcome and a link, but nothing copies it back into `AvenueEventCases.InvoiceId` and Status `Invoiced`. Staff (or a later flow) must do that. **Ask:** is a manual copy acceptable for the pilot?

## Flows specified, not built
17. **Every expression is untested** (no flow was created or run). The `Active member` lookup, the price `Quote` nesting, the bare-boolean `Valid` expression and the `Apply to each` echo are written to the documented patterns but are unverified in the designer (Code view is read-only; expressions must go through the expression editor).
18. **Support reply echo has no "already echoed" marker,** so a repeat edit of a case row re-writes the same Reply (harmless) and would repeat the optional e-mail. The e-mail step is marked optional/omit. **Ask:** should members get an e-mail when Flavors replies (COM-02 allows only a generic "log in to view")?
19. **No SLA or contact promise:** support outcome text says "Flavors replies here in the portal" with no time. **Ask:** a response-time promise and contact details (Q-13, Q-P1).
20. **Event rules invented as [PROPOSED]:** 14 days minimum notice, 1-60 guests, member price only for an Active member. The sheet gives 50 seats (60 as a pre-filled note) and says nothing about minimum notice. **Ask:** minimum notice, maximum guests, and whether a non-active member may request.
21. **Storage rules invented:** quantity 1-20, active members only, no automatic price (the sheet's storage prices are ambiguous: "$250 per door", "$400 per door or $700 per unit", "$250 / $135 shelf", "$450 / $235", daily $50 dry / $75 cold). **Ask:** one price per item per month, per door or per unit.
22. **Reopening on a member reply:** a reply on a Closed or Answered thread sets the case back to Open. **Ask:** should a Closed thread be reopened by the member or start a new conversation?
23. **Guests as authors:** member identity is the author e-mail; guest accounts may appear as `name_domain#ext#@tenant`. Untested for these new flows (existing doubt C-06).
24. **Intake lists let a member send any number of messages or requests.** No rate limit exists; a member could flood the support queue. **Ask:** a daily limit per member?
25. **Nothing here touches the three frozen modules** (compliance documents, payments dashboard, member onboarding). The only edits are additive: new lists, a loader, a test case on the existing `EventInvoice` request, and documentation.


---

## C. Staff app

(source: [doubts/C-staff.md](doubts/C-staff.md))

# Doubts: builder C (staff app), 23 Nov 2026

Built, not pasted or published: `support`, `events` (new, Screen21), `storage` (new, Screen22), `permissions`, `reports` screens plus the More hub. `python3 check.py` is OK (1445 controls, 22 files). Compliance, Payments, Members and every other existing screen are byte-identical to before; only `more.pa.yaml` differs. Nothing below was run in Power Apps Studio.

## Cannot be verified without Studio (paste, then press App checker > Recheck all)
- Every formula was written to Studio's rules learned today (bare `AddColumns` names, no text `<`, `Patch` on `LookUp` records, no `ForAll`+`With` records) and bracket-linted offline, but none has been seen by the real checker. Expect delegation warnings only. A red mark right after paste can be a name defined later in the same screen (the collection `colRepM`); Recheck all clears it.
- Reports: `GroupBy` then `AddColumns(..., N, CountRows(Rows), H, Sum(Rows, Hrs))` follows the shape already used on the Dashboard, but `colRepB`/`colRepM` are new collections built by a 600 ms timer; if the tiles show 0 for a moment after opening, that is the timer, press Refresh.
- Choice columns are assumed exactly as the contract lists them (`Status`, `Category`, `Package`, `Item`, `Kind`); a Text column instead of Choice would turn `.Value` into an error on all five screens.
- `Title` is set when staff create rows (`AvenueHostRequests`, `AvenueStaffCapabilities`) because SharePoint's Title is required by default; if the provisioning makes Title optional the extra value is harmless.
- `Match.Email` in `IsMatch` is reused from the Payments screen (already live); not new.

## Assumptions
- Support: a reply is written to `AvenueSupportCases` only. Nothing in this build tells the member except the (unbuilt) echo flow: "The member sees it in the portal" assumes that flow exists. Suggested question: should staff replies also send a generic "sign in to view" e-mail (COM-02 allows it)?
- Support: the screen shows only the member's LAST message (`LastMessage`); earlier messages of a thread are not shown because the contract keeps one case row per thread. Question: is a full thread history needed on the staff side?
- Events: the quote field is recorded in `QuoteCents` but the invoice is created by the server from its own sheet price table; editing the quote does not change the invoice amount. The screen says so. Question: should the server accept a quote override (extra hours, non-sheet add-ons)?
- Events: Approve patches the case, then creates one `AvenueHostRequests` item (kind `EventInvoice`, `member:true`). If the request is created but the server refuses (past date, bad package), the case already says Approved; the outcome text shows the refusal but the status does not roll back. Approve is disabled for a past event date to reduce this. Question: should a refusal reopen the case automatically (needs a flow)?
- Events: "Mark invoiced" is manual; no code reads the host's result to set `Invoiced` or `InvoiceId` (the host returns a link, not an invoice id, in its outcome). `InvoiceId` is never written. Question: link the invoice by e-mail/date, or just track by hand?
- Events: the event date is shown and sent in Eastern (facility) time with the existing `f_local` helper. If the portal stores a date-only value as midnight UTC, the day could display one day earlier. Needs the portal builder's storage choice (see A) or a test row.
- Events: only member packages are used (member rate, `member:true`); non-member events are not created from this screen (the Payments screen already has a form with a member toggle). Question: should this screen allow a non-member (guest) event?
- Events: refund and cancellation (8-14 days, under 7 days, boundaries) are not built, only described in the screen text (Q8, Q9, Q-08, Q-22).
- Storage: the sheet's prices are ambiguous (single vs double unit, "per door" vs "per unit"), so the screen shows them as a reference note and the owner types the monthly amount; no price table drives anything. Billing is by hand; no Stripe object is created. Question: confirm the exact storage price list and whether storage is Phase 1 at all (Q-25).
- Permissions: the contract has no `Active` column, so "deactivate, not delete" is implemented as every capability off plus a Note ("Deactivated by ... on ..."); the row stays. A separate Active flag would be cleaner. Question: add `Active` to `AvenueStaffCapabilities`?
- Permissions: nothing reads these switches yet. The staff app does not hide buttons by capability anywhere, and SharePoint lets staff edit lists directly, so this is a record, not enforcement (Q-15). The capability set (7 items) is proposed. Question: which actions must the owner be able to withhold from the restricted staff account?
- Permissions: owner = the two owner e-mails hard-coded in `gen.py` (same rule as the payment override and sensor settings); a different owner login would not see the editor.
- Reports: "bookings per month" groups by `Text(StartUtc, "yyyy-mm")`, which uses the device clock, not the facility clock; a booking near midnight on the 1st may count in the wrong month. Hours-by-member uses the facility month (existing helper). Question: is a day boundary at midnight Eastern acceptable, or must months match billing periods exactly?
- Reports: no utilisation percentage: the denominator (open hours, equipment available, member capacity) is undefined (Q-16), so the screen shows bookings, booked hours and hours per booking only. Booked hours are not attended hours (a note says so).
- Reports: last-6-months window is 190 days from now, so the oldest month can be partial. Equipment usage counts bookings whose `EquipmentIds` contain the unit; a fridge assigned automatically to every booking will show near-total hours.
- Reports reuse the Payments screen's invoice macros (`INV`, `OVERDUE`, `MONEY`, `MS`, `NM`) as values only; the Payments screen's output is unchanged (verified byte-identical).

## Release plumbing
- `release/release.json` gains `support`, `permissions`, `reports`, `events`, `storage`. `release.py` renamed the old `reports-demo` module to `reports`; nothing else referenced it. The More hub now has 9 cards.
- `check.py`: DEMO_SCREENS is now empty (Sensors, Applicants, Support, Permissions, Reports are real); only `permissions.pa.yaml` must still mention Q-15; nav targets extended to Screen22; four data sources added.

## What could affect a frozen module
- Nothing found: Compliance, Payments and Members files are byte-identical. Adding modules to `release.json` could in principle turn a `Navigate(Screen15/17/18)` link on a frozen screen from a no-op into a real link; none exists (verified by the byte comparison).
- The More hub (`more.pa.yaml`) is the only existing screen that changes. Pasting it replaces the live hub: it keeps Setup, Payments, Sensors, Applicants and adds Support, Permissions, Reports, Events, Storage.

## Flows (D) — built and tested 23 Nov 2026
# D-flows: doubts from building the six remaining-module flows (23 Nov 2026)

Built in Power Automate as `automations@` with a lean design (trigger + "Send an HTTP request to SharePoint", bodies from `addProperty`). All six are saved and On; trigger concurrency 1 on each. `[PROPOSED]` everywhere until the client answers.

1. **Reply in the same polling batch as the first message is refused.** Test: a new thread message and a reply to it created within seconds were handled in one batch; the reply ran first and got "Not accepted: that conversation was not found." A reply sent after the case exists works (tested). The portal only offers Reply on an existing thread, so this should not happen for members. Not fixed. Question: none for the client.
2. **Staff reply echo is not idempotent-guarded.** No "already echoed" marker, so any later edit of an Answered or Closed case re-writes the same Reply/Outcome (harmless) and re-runs the loop. No e-mail is sent. Same as the spec.
3. **Quote, notice and guest limits are the spec's `[PROPOSED]` values** (14 days notice, 1 to 60 guests, 1 to 20 storage units, member prices only). Event refusal needs an Active member row; automations@ was Active when tested, so the "membership must be active" refusal was NOT tested.
4. **Case rows get `Title` set to the case id on the support case only**; other case lists leave Title empty (SharePoint allows it). Staff screens must not rely on Title.
5. **Condition editor leaves an empty second row in the designer**; the saved code view shows a single clean condition (checked for flows 3 and 4 and by behaviour for all six). If someone re-opens a flow and saves, re-check the condition in code view.
6. **Decision flows trigger on any modification of a case row** (item modified, concurrency 1). They are idempotent: a repeat writes the same Outcome/Reply. Storage Approved without `MonthlyCents` echoes "$0.".
7. **Storage and event decision flows read the request by RequestId** (top 1). A case whose request was deleted does nothing (the condition checks the row exists).
8. **Flow checker shows a warning on the two copied flows (storage request, storage decision)** before first run; it did not stop saving or running. Not investigated further.
9. **Test rows were removed again by explicit id** (EventRequests 1-2, EventCases 1, StorageRequests 1-2, StorageCases 1, SupportMessages 1-4, SupportCases 1; all had `gaptest-` ids). Nothing left from this build.
10. **Sender of the REST test items was `automations@`**; no real member was used. A member who is not in AvenueMembers is refused for events and storage (the flow reads the member row).

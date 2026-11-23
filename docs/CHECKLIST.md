# Project checklist (the only one)

Everything in the project, module by module. Updated 14 Nov 2026 against the code, the generated staff screens, `flows/expressions.md`, the unit tests and the live checks of 12-14 Nov (run as the `automations@` owner account). Requirement ids are from [REQUIREMENTS.md](REQUIREMENTS.md). See [ARCHITECTURE.svg](ARCHITECTURE.svg) for the picture.

**Rules.** `[x]` means built AND verified (a test I ran, or run live; evidence after the dash). `[ ]` means anything else and the tag says why: **NOT VERIFIED** (built, not tested live or by a second account), **NOT BUILT**, **DEMO ONLY** (screen exists, saves nothing), **BLOCKED** (needs a client answer, admin, Stripe or Swift), **NEEDS OK** (sends e-mail; needs the developer's approval). Tick an item only when it is done and checked. Do not start another checklist; add items here.

## 0. Data and schema
- [x] 20 SharePoint lists with fields, indexes, unique keys and versioning - applied live; `node schema/check.mjs` passes (20 lists, 157 fields)
- [x] Seed data (`demo-` prefix) on the real site with flow-safety markers - 6 seed tests pass; removal only by `seedCleanup()` one id at a time
- [x] Test rows (`gaptest-`) removed by id after each live test - done 14 Nov; the old 13 Nov rows recycled; the test member set Inactive, not deleted
- [ ] **NOT VERIFIED** `FacilityId`, `StartUtc`, `EndUtc` indexed on the live lists (5,000-item limit)
- [ ] **NOT BUILT** `AvenueInvoices`, `AvenueSensors`, `AvenueSensorReadings` lists (need Q-06 and Q-12 answers)
- [ ] **BLOCKED** Real data replaces seed data (needs the client's equipment, plans and members)

## 1. Platform, access and security
- [x] 20 SharePoint lists, three access classes, groups - applied live; `node schema/check.mjs` and 8 invariant tests pass
- [x] Members write only to own-items intake lists; flows write the private lists - exercised live (request, document, check-in)
- [x] Identity is the item author, not a field (PLT-13) - flows read `Author/Email`; invariants test
- [x] List permissions on all 20 lists match the schema - read live 14 Nov: members Contribute only on the 3 intake lists (item-level read/write = own items only), no member role on private lists, staff read-only on owner-write, extra Full Control only for site owners and the automation account
- [x] Developer admin account (TDDAdmin, "Tech DoubleKlick Designs") is SharePoint administrator and, since 18 Nov, a site admin of Avenue (added in the admin center; `IsSiteAdmin` read back true). Signed in as `aman.raj@polarein.com` is not in this tenant and was not checked
- [x] Only staff or owner may act on behalf (`OnBehalfOf`, PLT-09) - live: staff booking and a staff document upload registered under the member
- [ ] **NOT VERIFIED** One member cannot read another's records, including by direct link (PLT-08, PLT-13): the configuration is right (line above) but the behaviour needs a second member account
- [ ] **NOT VERIFIED** Staff and owner roles behave differently in the real apps (PLT-07): only `automations@` has been used
- [ ] **BLOCKED** Members sign in as Entra guests with their own e-mail (PLT-06): no guest accounts exist
- [ ] **BLOCKED** Phone-browser pass on a real guest sign-in (PLT-04): the portal can only be previewed from the laptop
- [x] No secret in source, docs or config (STR-02, PLT-12) - `node scripts/secret-scan.mjs`: clean across 230 files; proven to catch a fake live key
- [ ] **NOT BUILT** Secrets held server-side in a vault (PLT-12): no server is provisioned yet
- [ ] **NOT VERIFIED** Seeded `demo-` rows and flow behaviour under licences for guests (PLT-11, Q-15)

## 2. Booking (member and staff)
- [x] Member requests by equipment and time, 3-step form, Kitchen, Dining and Private event spaces (BKG-01, 16, 17) - form built; unit tests; live request created a Pending booking with equipment
- [x] Every booking starts Pending and staff approve or decline (BKG-03) - live: Pending, then approval
- [x] Overlap notes shown to staff (BKG-04, 05) - flow and staff screen; verified live 12 Nov
- [x] Staff create bookings on behalf with an audit stamp (BKG-06) - live 12 Nov
- [ ] **NOT VERIFIED** Decision e-mail to the member with a portal link (BKG-07): the flow runs (DecisionNotified = Approved after approval, live 14 Nov); the delivered e-mail and its link have not been seen
- [x] Extra time requests and decisions (BKG-08) - two flows; live 12 Nov
- [x] Cancellation 24h or more returns hours; under 24h goes to management (BKG-09) - flow and UI; live 12 Nov
- [x] Hours ledger: used, credit on cancel, extension rows (BKG-10, 13) - live: hours row created on approval
- [x] No-show credit returns the hours (BKG-12) - live 14 Nov: approved booking wrote a used row of 2 h; setting Status to No-show credited wrote a -2 credit row
- [ ] **BLOCKED** No-show abuse rule and how abuse is detected (call decision D8, open)
- [ ] **BLOCKED** Overdue balance blocks booking (BKG-14): needs Q-07 and invoices
- [x] Expired document blocks booking; owner override lets it through; a renewed document unblocks (BKG-15) - live 14 Nov: Declined "a required document has expired. The Flavors owner can override."; with an active override Pending; after renewal and no override Pending
- [ ] **NOT VERIFIED** Staff (not owner) cannot create an override: needs a real staff account
- [x] An inactive member's request is refused ("this membership is not active") - seen live 14 Nov
- [ ] **BLOCKED** Dining and private-event cost, approval and refund rules (BKG-11, BKG-17, Q-22): not defined
- [ ] **BLOCKED** Extending past midnight: the rule says same day (needs a rule decision)
- [x] A time that does not exist on spring-forward day moves forward - 3 tests (member suite)

## 3. Calendar
- [x] Shared calendar from a display-only list (BKG-02) - live: calendar row created on approval; calendar view built
- [x] Calendar shows who booked which equipment and when - built; uses member display name only
- [ ] **NOT VERIFIED** Calendar privacy for a real member (PLT-08): needs a member account

## 4. Check-in and reminders
- [x] Entry and exit checklists, answers private (CHK-01) - live: check-in Recorded with a record row; jsdom test of the journey
- [x] Reminders 3, 2 and 1 hours before, once each (CHK-03) - flow saved; verified live 12 Nov
- [x] Missed entry flagged to the member, then to staff (CHK-04) - flow; live 12 Nov
- [x] Failed checklist notifies member and Flavors (CHK-05) - flow; live 12 Nov
- [x] Overdue exit flagged (CHK-06) - flow; live 12 Nov
- [ ] **BLOCKED** Final checklist questions and whole-team vs one-lead model (CHK-01, CHK-02, Q-10)
- [ ] **BLOCKED** Per-person wellness check on each team member's phone (CHK-02): open question
- [x] Yes/No answers move with the arrow keys; send needs every answer - jsdom journey test passes
- [ ] **NOT VERIFIED** Focus moves to the new step heading in the booking form (built, not tested)

## 5. Documents and compliance
- [x] Upload with type, issue and expiry dates, by member or staff for a member (CMP-01) - live today: on-behalf upload registered under the member; unit tests
- [x] Older document replaced by a newer one (CMP-03 history) - live today: old row marked superseded
- [x] Failed upload cannot hide a real document - 2 unit tests
- [x] Portal staff-page option adds "for member" and writes `OnBehalfOf` - 2 unit tests on the item; flow side verified live
- [ ] **NOT VERIFIED** The staff-page option on the real page (web part setting not switched on and tried)
- [ ] **NOT VERIFIED** Daily status Current / Expiring / Expired (CMP-02): flow saved; not in the live test record
- [ ] **NOT VERIFIED** Staff Compliance screen: open file, mark verified, owner override: screen built, buttons not clicked in the published app
- [ ] **NOT BUILT** Renewal reminders before expiry (CMP-03): flow exists only unsaved; sends e-mail so needs your OK
- [ ] **NOT BUILT** Power Apps staff control to upload for a member (needs an Attachments form; not testable offline)
- [ ] **BLOCKED** Required document types, warning window, end-of-day rule, existing future bookings on expiry (Q-11)
- [ ] **BLOCKED** Retention of document versions (Q-14)

## 6. Members and administration
- [x] Staff add and edit members, plan, collection day, status (ADM-01) - Members screen; membership-card flow verified live
- [x] Deactivate keeps history and cancels future bookings (ADM-04) - live 12 Nov
- [x] Member sees own membership card (plan, hours, collection day) - live today on the real page
- [x] Setup screen: plans, equipment, required documents, hours adjustments - screen built and pasted
- [ ] **NOT VERIFIED** Setup screen buttons and staff Settings: not clicked through in the published app
- [ ] **DEMO ONLY** Permissions screen (ADM-02): saves nothing; selectable capabilities open (Q-15)
- [ ] **DEMO ONLY** Support screen (ADM-03): saves nothing; mechanism open (Q-13)
- [ ] **BLOCKED** Removing sign-in on deactivation: SharePoint admin step

## 7. Notices and communication
- [x] Staff post notices; members read them (COM-01) - live 12 Nov
- [x] Generic "sign in to view" e-mail on publish (COM-02) - flow; live 12 Nov
- [ ] **NOT VERIFIED** Notice drafts list for staff: built, not tested
- [ ] **BLOCKED** Publishing model (SharePoint News vs list) and audiences (Q-13)

## 8. Hours and billing view
- [x] Member Home shows hours left and what is owed - built; unit tests; Billing shows "not connected" honestly
- [ ] **NOT VERIFIED** Overage hours shown in the staff app: added 13 Nov, no button tested in preview
- [ ] **BLOCKED** Invoices, full payment history, upcoming charges (PAY-03): need Stripe and the invoice list
- [ ] **BLOCKED** Overage becomes an invoice with the next monthly payment (PAY-02, Q-06)

## 9. Payments and Stripe
- [x] Webhook signature check, account allow-list, de-duplication, out-of-order safety (STR-08) - `billing-core` 34 tests and `integration-host` 14 tests, including concurrent deliveries
- [x] Stripe client refuses live keys, uses the direct-charge header, never echoes the key (STR-06) - 1 test
- [x] Webhook, my-invoices (identity from token only), health, sensor sync and reconcile handlers - `integration-host` 14 tests
- [x] Token signature check (RS256 only), Graph writer with retry, Table Storage wrapper with ETag compare-and-set - tests with fakes
- [ ] **NOT VERIFIED** Azure Functions wiring (`azure.mjs`) never run against the Functions runtime
- [ ] **NOT VERIFIED** The real SDK clients and the tenant key fetch (wrappers take them as inputs)
- [x] Usage calculator for hours - unit-tested
- [ ] **NOT BUILT** Server host, secret store, Key Vault, Table Storage (Q-01)
- [x] Stripe access for the developer - checked 16 Nov in Chrome (DKD profile, user "Tech DoubleKlick Designs"): platform account B Street Headquarters, LLC; a sandbox "B Street Headquarters, LLC sandbox" and a Test mode exist; Connect is enabled in the sandbox
- [x] Sandbox has a test secret key (full access, never used) and a test publishable key - seen 16 Nov, key values not opened
- [x] Sandbox has 2 test connected accounts, Enabled, Accounts v2 configurations Merchant + Customer, card payments active, no bank account - seen 16 Nov
- [x] Onboarding link: the v1 `account_links` call (what our wrapper uses) returned an onboarding link for an existing Accounts v2 test account (Stripe Shell, sandbox, 18 Nov); the link was not opened. Direct charges on a connected account still to test
- [x] Sandbox payment methods for connected accounts: ACH Direct Debit and Google Pay On, Stablecoins/Crypto Off (PAY-07) - applied 18 Nov with the developer's OK, read back; sandbox only
- [ ] **NOT BUILT** No webhook destination in the sandbox (needs the server URL, Q-01); a restricted test key for the server, stored only in the secret store
- [ ] **BLOCKED** Live Connect: Stripe needs a valid identity document for Samia Bingham, and "finish confirming your integration" before any live connected account (only after STR-06 approval)
- [ ] **UNKNOWN** The developer login's Stripe role: the team page was not available to it (may not be Administrator)
- [ ] **NOT BUILT** Products and prices in the sandbox (none exist; need Q-04 prices), invoice branding, reminders, customer portal
- [ ] **NOT BUILT** Facility onboarding link and connected account for Flavors (STR-01, 03, 07)
- [ ] **NOT BUILT** Monthly invoices and recurring collection (PAY-01): needs Q-06 and Stripe
- [ ] **NOT BUILT** Refunds and disputes (PAY-05, Q-02)
- [ ] **NOT BUILT** Staff financial view (PAY-04): Payments screen is demo only
- [ ] **NOT BUILT** Stripe fee handling (STR-04, D6) and payment methods (PAY-07)
- [ ] **NOT BUILT** End-to-end Stripe test (STR-05) and client approval (STR-06)

## 10. Onboarding of new members
- [ ] **DEMO ONLY** Join screen in the member portal: validates and saves nothing (ONB-01, 02)
- [ ] **BLOCKED** Pay first, then onboarding starts (ONB-03, Q-06)
- [ ] **BLOCKED** Staff approval after payment (ONB-06, Q-05)
- [ ] **BLOCKED** Guest provisioning on acceptance (ONB-07): admin
- [ ] **NOT BUILT** Initial roster load by B Street (ONB-05): only 3 `demo-` members exist
- [ ] **DEMO ONLY** Applicants screen in the staff app

## 11. Sensors
- [x] Reading classification and de-duplication (SEN-01, 02) - `sensors-core` 10 tests; sync handler tested
- [ ] **BLOCKED** Unit mapping, thresholds, cadence, freshness, retention (Q-12)
- [ ] **NOT BUILT** Live Swift Sensors client and the sensor lists
- [ ] **DEMO ONLY** Staff Sensors screen
- [x] Swift Sensors console read-only on 18 Nov (account Flavors, no. 2942, created 2025-09-13): 2 gateways SG3-1010 (2G6E, 4N9Q) and 8 temperature sensors SS3-102 (A00L4N, A00JJL, A00JN6, A00JP7, A00JPK, A00JQ4, A00JRF, A00JY1), 8 measurements
- [ ] **BLOCKED** All hardware is offline: both gateways and all 8 sensors have been offline for 148 days (about mid-June 2026), 2 hardware-issue alerts open, no readings now. Someone at Flavors must check power and network at the gateways before any live data exists (Q-12)
- [x] Thresholds exist in Swift: "Above 0 - Freezers Only" (2 measurements) and "Above 41 Degrees longer than 30 minutes" (4 measurements); 2 measurements have none visible. These are Swift's alert rules (units assumed degrees F); the safe ranges Avenue shows must be confirmed (Q-12)
- [ ] **BLOCKED** Sensor-to-unit mapping: sensors show only model and serial, no fridge or freezer names; one gateway is "unmapped hardware"

## 12. Reporting
- [ ] **DEMO ONLY** Staff Reports screen (RPT-01, 04): shows booked hours, not attended hours (Q-16)
- [ ] **NOT BUILT** Power BI for B Street (RPT-03)
- [x] No member Power BI access (RPT-05, EXC-04) - none exists

## 13. Release control, build and operations
- [x] `release/release.json` picks modules for both apps; only the developer edits it - member build and `gen.py`; 3 unit tests; wave-1 build checked on the real page
- [x] Member portal builds; 126 tests including the jsdom check-in journey
- [x] Member portal screens (Home, Bookings, Documents, Billing, Membership, Calendar, Check-in, Notices, booking form) load on the real page - checked via the debug URL 14 Nov
- [x] Staff app published with 18 screens; generator and checker pass (522 controls)
- [x] Accessibility on 5 screens: no text under 4.5:1 contrast, no unnamed buttons, no unlabelled inputs (screen reader not tried)
- [x] An invalid facility time zone no longer blanks the portal - unit test
- [ ] **NOT VERIFIED** Error boundary shows a plain message if a screen throws (built, not tested)
- [ ] **NOT VERIFIED** A failed background refresh keeps data on screen; cancel, extend and document send cannot be double-submitted; reads retry on 429/503 (built; no tests)
- [ ] **NOT VERIFIED** Bookings poll only while something is Pending
- [x] Guest accounts with an empty e-mail use the claims login name - 3 unit tests
- [ ] **NOT BUILT** Stop re-reading full booking and document histories on a timer
- [ ] **NOT BUILT** Booking-form and documents journey tests (jsdom); real-browser tests (need a SharePoint test sign-in)
- [x] Git repository initialised; `.gitignore` and `.github/workflows/ci.yml` written - nothing committed
- [ ] **NOT VERIFIED** CI pipeline has never run
- [x] Portal deployed: tenant app catalog created (`/sites/appcatalog`), package built with release = booking, calendar, notices, uploaded, enabled for the tenant (not added to all sites), installed on the Avenue site; `Member-portal.aspx` renders at its plain address with Home and Bookings only - done 18 Nov as TDDAdmin (SharePoint administrator)
- [ ] **BLOCKED** Client sign-ins; first wave opened
- [ ] **NOT BUILT** Failure alerts and a monitored alert address (needs your OK)
- [ ] **NOT VERIFIED** CI pipeline file written but never run; nothing committed
- [ ] **NOT BUILT** Real-browser tests; booking and documents journey component tests
- [ ] **NOT BUILT** Operator training, UAT and handover (REL-01, 02)


## 14. Documentation, decisions and approvals
- [x] Architecture diagram, schema, approach, release plan, demo scripts written - ARCHITECTURE.svg, SCHEMA.md, APPROACH.md, RELEASE_PLAN.md, DEMO_SCRIPTS.md
- [x] Client information request drafted - CLIENT_INFORMATION_REQUEST.md
- [ ] **NEEDS OK** Send the client information request (the developer sends it)
- [ ] **BLOCKED** Call decisions D1-D10 confirmed in writing by the client
- [ ] **BLOCKED** Information-sheet wording fixed ("invoiced at booking" vs D5: nothing charged at booking)
- [ ] **NEEDS OK** Renewal-reminder flow saved (sends e-mail)
- [ ] **NEEDS OK** Failure alerts and a monitored alert address (sends e-mail)
- [ ] **BLOCKED** Admin: app catalog, guest sharing, client sign-ins, staff and owner test accounts, Entra app for the server
- [ ] **BLOCKED** DKD: Stripe platform access and the host (Q-01, Q-02)

## 15. Delivery 1: Kitchen Bookings + Communication (see [PLAN_BOOKING_COMMUNICATION.md](PLAN_BOOKING_COMMUNICATION.md); how to test: [HOW_TO_TEST_DELIVERY_1.md](HOW_TO_TEST_DELIVERY_1.md))
- [x] Client call of 16 Nov captured: recordings read, notes and raw captions saved, 3 stills kept - docs/meetings/2026-11-16-client-call.md
- [x] Master-data sheet read (13 tabs): still the template with 11 Nov values only - checked 18 Nov, read-only
- [x] Plan written: model, availability rules, UI, data, flows, deployment, tests, 20 client questions - PLAN_BOOKING_COMMUNICATION.md; nothing built
- [ ] **BLOCKED** Client's filled master-data sheet (equipment list, plans, roster, rules, dining prices)
- [ ] **BLOCKED** Answers to Q-B1 to Q-B20 (blocking rule, whole kitchen, min and max booking length, checkout alert, notice audiences, brand assets)
- [x] Design: research (Awwwards Food & Drink and Restaurant & Hotel, Nov 2026) and a designer pass built directly in the portal instead of separate mock-ups: ink-olive hero, citrus accent, serif display type, staged motion, reduced-motion support, immersive full-screen mode - live 18 Nov. Client approval of the look still to get
- [ ] **NOT BUILT** Foundation, remaining: guest sharing; test member (real, not the admin test row); privacy test; real-phone test. Done 18 Nov: app catalog, portal v1.2.0.0 deployed, 390 px layout looked at live (stacked, bottom nav, no sideways scroll; the Exit full screen button overlaps the hero text on phones, to fix)
- [x] Equipment catalogue: 29 new fields applied and read back (plan after apply empty); 15 units loaded from the client's old-system screens (mock where the sheet is blank); demo equipment deactivated; facility early entry and cleanup minutes 30 each (client's words), minimum prep tables 2 - live 18 Nov
- [x] Availability engine: 186 member tests; live 18 Nov: with an overlapping booking for Stove #1 and Grill #1 the Equipment step showed "Taken until 6:00 PM, Not available", prep tables 4 of 6 free and assigned automatically, "2 of 9 cooking items in use"
- [x] New booking flow (mode, when, equipment, review), redesigned Home and My bookings, schedule board, Notices - built; booking flow tested live to a sent request that became a Pending booking with the unit ids intact (booking 56). Schedule board, My bookings, Notices not yet looked at live
- [ ] **NEEDS OK** Flow changes: server-side equipment conflict check; "booking ending soon" alert with Extend; branded decision and notice e-mails
- [x] Staff app: Requests with conflict list and Approve disabled while an approved booking holds the equipment, Schedule board, Setup (equipment and facility rules), Notices composer, Book on behalf - published as version 22 on 18 Nov; Play-mode tests passed as automations@: approve wrote a calendar and hours row, a second overlapping request showed "Resolve the conflict first" with Approve disabled and Decline worked, schedule showed the booking in Eastern time, Setup saved without errors. Test rows removed by id
- [x] Communication: category, pin, expiry fields live; a Maintenance, pinned, expiring notice published in the staff app showed first with its tags in the member Notices feed, then withdrawn (18 Nov). Audience targeting, scheduled publish and per-member unread state are not built; unread dots are per device
- [ ] **NOT BUILT** Test pass T1 to T15, demo script, B Street written acceptance

## Totals

| Module | Done and verified | Not done |
|---|---|---|
| 0. Data and schema | 3 | 3 |
| 1. Platform, access and security | 7 | 6 |
| 2. Booking (member and staff) | 11 | 6 |
| 3. Calendar | 2 | 1 |
| 4. Check-in and reminders | 6 | 3 |
| 5. Documents and compliance | 4 | 7 |
| 6. Members and administration | 4 | 4 |
| 7. Notices and communication | 2 | 2 |
| 8. Hours and billing view | 1 | 3 |
| 9. Payments and Stripe | 10 | 13 |
| 10. Onboarding of new members | 0 | 6 |
| 11. Sensors | 3 | 5 |
| 12. Reporting | 1 | 2 |
| 13. Release control, build and operations | 9 | 11 |
| 14. Documentation, decisions and approvals | 2 | 7 |
| 15. Delivery 1: Kitchen Bookings + Communication (see [PLAN_BOOKING_COMMUNICATION.md](PLAN_BOOKING_COMMUNICATION.md); how to test: [HOW_TO_TEST_DELIVERY_1.md](HOW_TO_TEST_DELIVERY_1.md)) | 9 | 5 |
| **All** | **74** | **84** |

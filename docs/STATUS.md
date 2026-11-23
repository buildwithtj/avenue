# Status

## 23 Nov 2026 (latest) — member portal 2.16.0.0 LIVE: UI plan phases 2–5, F2–F4
- New notices list, motion, page polish, responsive rules, inactive-member screen, event date note, friendly load errors. 366 tests; live debug preview checked at 375 / desktop / 1920 px. Deployed and confirmed on the live page (bundle 6aff8c92). Returning browsers may need a reload or two (SharePoint service-worker cache).
- F1 LIVE: the booking flow refuses requests while PaymentStatus is PastDue/Unpaid (owner override only); cancel items no longer fail the flow. Still open: F5 (no guest accounts), F6 (needs OK to save a member e-mail flow).

## 23 Nov 2026 (latest) — member portal 2.15.0.0 LIVE: UI plan phases 0–1 (tokens, Inter font)
- Tokens, style test, Inter font replacing condensed Archivo, nothing under 12 px. 362 tests pass; live debug preview checked (desktop + phone). Deployed and confirmed on the live page. Next: phase 2 (notices list). Plan: docs/MEMBER_PORTAL_AUDIT_AND_UI_PLAN.md.

## 23 Nov 2026 (night) — staff app published with Reports, Events, Storage, Support, Permissions and the 9-card More hub; six Support/Events/Storage flows live and tested
- Re-added data sources AvenueInvoices and AvenueHostRequests to the staff app (they had dropped out). Events/Storage galleries use If(st="All", Filter, Filter) because the OR filter gave "query is not valid".
- Live render check 23 Nov (TDDAdmin): Check-in (no booking in 24 h, sent checklist shown) and Billing (hours, extra hours, next payment, invoices) load correctly. NOT done live: paid Join checkout (needs a person to enter a Stripe test card), staff Approve/Decline click on a real Events/Storage case, check-in with questions (Q-10 answers missing), sensors (Offline since 22 Jun 2026).
- Portal 2.14.1.0 LIVE (23 Nov): fixes Support — new messages were refused ("conversation not found") because the portal sent ThreadId = MessageId while the flow treats only an EMPTY ThreadId as new. The portal now leaves ThreadId out for a new conversation and reads `ThreadId || MessageId`. Verified live as TDDAdmin: Support new message -> case + Outcome; staff-style reply (case Answered) -> Reply echoed; Storage -> case; My team add/remove. Test rows removed by id. Deploy lesson: after upload run tenantappcatalog Deploy, then hard-reload (new tab if an edit form blocks navigation). The Power Automate expression editor would not apply my flow edit, so the flow is unchanged.
- Live E2E check 23 Nov (TDDAdmin, real portal): Event request Simplicity/15 Dec/10 guests -> intake -> flow -> AvenueEventCases (quote $950, Requested) -> Outcome echoed to the member. Test rows removed by id (requests 3, cases 2). Support, Storage and Team not yet clicked through live.
- Portal 2.14.0.0 is LIVE (23 Nov): the catalog upload had not been deployed (CurrentVersionDeployed=false, new bundle 404 in ClientSideAssets). Fixed by POST tenantappcatalog/AvailableApps('9d47307d-…')/Deploy; after a hard reload the portal loads avenue-portal-web-part_d7e9a2de… and the profile drawer shows Event request, Storage, My team. Lesson: after uploading an .sppkg, confirm CurrentVersionDeployed and click Deploy.
- Untested: membership-must-be-active refusal for events/storage; a reply in the same minute as a thread's first message is refused (see BUILD_DOUBTS).

## 23 Nov 2026 — sensors live and polling; all 8 units Offline (Swift last heard from them 22 Jun 2026)
- Live: Swift sign-in OK, 8 of 8 units matched, readings written to SharePoint through the sensor flows, staff Environment screen reads them. Units show Offline because Swift's newest reading is 153 days old. Open client question Q-E7 (docs/ENVIRONMENT_PLAN.md): are the gateways SG3-1010 (4N9Q) and (2G6E) powered and online, and are A00JPK/A00JQ4 really freezers and A00JP7/A00L4N really inside fridges?

## 23 Nov 2026 (00:51) — staff app published: Sensors (Screen14) and Applicants (Screen16) are live
- Live and seen working in Studio preview: Sensors screen reads the 8 loaded units (all Offline until Swift readings exist); Applicants shows the real queue (test applicant "Gaptest Kitchen", Onboarding, test-mode note). Swift sensors still need SWIFT_API_KEY/USER/PASSWORD and the four sensor flow links on the server. Frozen modules untouched.

## 23 Nov 2026 (later) — sensors built and deployed, off until the Swift credentials are set
- Live: 4 SharePoint lists + 8 sensors, 4 narrow Power Automate flows, host with the sensor job (inactive). Not live: staff Environment screen (generated, not pasted), real readings (need SWIFT_API_KEY, SWIFT_USER, SWIFT_PASSWORD and the four flow links on the server). Swift API shape UNVERIFIED until the first real call.

## 23 Nov 2026 — Stripe stays in TEST mode; payment not required; client amounts unchanged
- Server setting `PAYMENTS_REQUIRED=0` (honoured only with a `sk_test_` key) is ON: a Join request skips Stripe and moves the applicant and member to Onboarding with the note "Test mode: payment skipped. No money was charged." Tested end to end; the service-account test member row (id 5) was restored to Inactive / gaptest-biz / demo-plan-std. To require payment again: set `PAYMENTS_REQUIRED=1` (or remove it) in `/etc/avenue/host.env` and restart `avenue-host`. Going live with Stripe still needs the client's STR-06 approval and the checklist in the 22 Nov entry.
- Member portal in the tenant app catalog is 2.13.3.0 (uploaded 21 Nov by another session; it includes the Join wizard, real-invoice Billing and wellness check-in). It was not uploaded by this session today. Frozen by the developer's instruction on 23 Nov (do not alter): Compliance Documents, Payments Dashboard, Member Onboarding. Whether the staff Payments/Members screens in the published staff app already contain the regenerated versions is UNKNOWN (not checked).
- Remaining test rows from today: AvenueApplicants id 1 (Gaptest Kitchen, Onboarding), AvenueHostRequests ids 2-5 (gaptest-host-*).

## 22 Nov 2026 (evening) — host live on the AWS server (test mode); join path proven
- Done and seen working: 5 SharePoint relay flows + the Host requests flow (SharePoint -> server -> answer written back to the member's item); server deployed (49 tests) with Stripe test key, shared key, flow links; 26 Stripe sandbox prices from the sheet; two payment-method settings ("Avenue bank only", "Avenue card only"); Stripe webhook now listens to 11 events. A test Join request returned a real Stripe Checkout link and wrote the applicant row (Stage PaymentPending). Test rows `gaptest-host-*` (HostRequests ids 2-4) and applicant 1 remain; remove by id.
- Not done: a paid sandbox checkout end to end (needs someone to enter Stripe test card details), portal 2.13.0.0 upload, remaining staff screens paste, sensors (no Swift key yet).

## 21 Nov 2026 (night) — Bookings + Communication ready for client review
- **Live:** portal 2.13.3.0 (315 tests) and staff app published 22:36 IST. Under-24 h cancel: member asks with an optional message; staff choose Keep booking, Cancel (hours return) or Cancel, keep hours (new status "Cancelled (hours kept)"). Client test guide: docs/CLIENT_TEST_MESSAGE.md.
- **Next:** after the first "Cancel, keep hours", confirm the hours-ledger flow does not credit it (UNVERIFIED that it matches the whole status).

## 21 Nov 2026 (evening) — onboarding and payments build: local code done, live steps paused
- **Live (done):** 3 new SharePoint lists (AvenueApplicants, AvenueHostRequests, AvenueInvoices) and the new fields on 6 lists; dry run afterwards plans 0 steps. The 18 sheet plans are loaded into AvenuePlans with prices, groups and open-to-new flags (existing rows renamed to sheet-name ids).
- **Local only, tested:** host (47 tests), member portal 2.13.0.0 (311 tests, package built, not uploaded), staff screens regenerated (checker OK, not pasted into Studio), schema checks OK.
- **Not done:** the host-inbound relay flow (paused: a generic SharePoint REST relay open to anyone with its URL was refused as too broad; narrower design needed), the host-requests flow, host deploy with the Stripe test key, portal upload, Studio paste, sandbox end-to-end test. Defaults awaiting the client: docs/CLIENT_REVIEW_DEFAULTS.md. Next module plan: docs/ENVIRONMENT_PLAN.md.

## 21 Nov 2026 — plan for all unbuilt modules written: docs/MODULES_PLAN.md (not built; waits on Q-M1..Q-M6, Q-01 domain, Q-05/06/07/10/20/21).

## 21 Nov 2026 — profile drawer is live (member 2.12.1.0). Open questions Q-P1..Q-P4 in docs/PROFILE_DRAWER_PLAN.md.

## 21 Nov 2026 (later) — Stripe host
Host is live on the client's AWS instance (HTTPS via sslip.io, test mode). Stripe sandbox destination created. **Verified 21 Nov (sandbox): an `invoice.paid` for a test invoice on connected account `acct_1UYbYzAsg6Xog0k8` reached the host, passed the signature check, was stored (event and invoice marked paid) and returned 200.** my-invoices stays 501 until a real domain and Entra checks exist.

## 21 Nov 2026 — compliance escalation verified live (flag, hold, refusal, release, echo). Staff screens 4/8/10 republished. Payments dashboard = expected only; Stripe still needs host approval (Q-01) and a test key placed by the developer.

## 20 Nov 2026, evening (superseded where it conflicts with the 21 Nov note)
- Done and seen live: member 2.11.0.0 (compliance wizard, flag, onboarding checklist), flags -> cases flow, staff counters, Members onboarding column, expected-payments dashboard.
- Open: republish staff screens 4, 8, 10 (tab offset fix) and test Cases decisions; test echo flow and the booking hold refusal end to end; remove test rows (flags 1, cases 1) by id.
- Not built, blocked: self-serve apply-and-pay onboarding (Stripe, Q-05, Q-06); live payments; guest invitation is a SharePoint admin step.

## 20 Nov 2026 — compliance wizard and payments (live)
- Member 2.10.0.0 is deployed (tenant app catalog). Documents (account menu) opens a category-by-category compliance wizard for the client's 7 document types; Billing shows next payment, due date, $99 late fee, 3% card fee and extra-hour estimate. Wizard seen live as the TDDAdmin account (navigation and upload form only; no document was sent).
- Payments are **not connected**: no invoices or real payment until the host (Q-01) and Stripe test access exist; "Pay now (test)" is demo mode only. Members on demo-plan-std see no price until real members and plans are mapped (Q12).
- Staff app republished with Members/Compliance/Settings/Reports in the nav; only the Dashboard was looked at after publishing, plus Members. Check-ins and Checklist screens are unchanged (module off).
- Open questions 13-17 in booking_questions.md.

## Local preview work — 18 Nov

- Deployment attempt: member package version 1.2.4.0 built successfully, including 188 tests. It has not been uploaded or deployed: the automations account was denied access to the SharePoint admin center and the catalog's Upload Document control is disabled for that account. After restarting the local server, the member debug preview loaded successfully as automations. The editable staff app was inspected; existing booking formulas showed delegation warnings. No staff changes were applied or published in this attempt.
- Member Home now distributes booking and attention/today information across two desktop columns and uses a quieter olive palette. The Schedule has a seven-day overview alongside the existing equipment day view. Both were inspected in the SharePoint debug preview as the automations owner account; no booking mutations were made. These changes are local and are not published. Mobile-device and guest-account verification remain outstanding.
- Staff Schedule's seven-day view, generated navigation colors, and blank-date guards are local source changes only. The generator and static checker pass; they have not been pasted into Studio or verified in Power Apps runtime. The rest of the staff console still needs visual redesign and end-to-end testing. Large-list delegation must be checked before relying on the new staff view.

Updated 2026-11-14. Staff app published (screens 1-18); test plan in [TEST_CHECKLIST.md](TEST_CHECKLIST.md). Not a git repository, so no branch or commit. "Tested" below means exercised live as the **`automations@` owner account** (or unit tests); no guest, staff, owner or Stripe test exists. Test evidence: [evidence/](evidence/). Requirement detail: [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md).

## State by level

| Level | What |
|---|---|
| Confirmed | Requirements and the 11 Nov call decisions D1–D10 ([REQUIREMENTS.md](REQUIREMENTS.md)); call decisions are not yet confirmed in writing. |
| Designed / proposed | Stripe account model, secure host (🔴 Q-01), usage ledger beyond hours, sensor sync, SPFx staff console alternative (Q-24). |
| Implemented | 20 SharePoint lists; member portal (SPFx); staff app (11 screens); 18 flows; `apps/billing-core` webhook core. Generators and schema in `schema/`, `apps/staff-powerapps/`. |
| Tested | Booking, approval, cancellation, hours, extensions, overlap notes, check-in alerts, reminders, notices, membership card, deactivation (12 Nov, live). Unit: portal 47, billing-core 9, schema check OK (13 Nov). |
| Deployed | Flows are saved and on in the default environment. Staff app saved, **not published**. Portal **deployed** 18 Nov 2026: member-spfx 2.5.1.0 in tenant app catalog `/sites/appcatalog`, tenant-wide, uploaded as the admin account. Stripe, sensors, host: nothing. |
| Blocked | Stripe code (Q-01, Q-02, Q-06), prices (Q-04), guest/staff/owner verification (admin), sensors (Q-12). See [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md). |

## Current milestone: audit-gap fixes (from [SOP_SCOPE_AUDIT.md](SOP_SCOPE_AUDIT.md))

Done 13 Nov:
- Schema +new fields and 2 lists, applied and read back clean; owner role Edit → Contribute.
- Request flow: Active member required, equipment validated, renewed documents no longer block, staff booking via `OnBehalfOf`. Document flow supersedes old rows. Check-in `AllPassed` computed in the flow. Decision e-mail has a portal link. Notice e-mail marks sent first. All five **saved and code-reviewed**.
- A live test (13 Nov) failed at "Equipment ids" because array inputs were saved as text; the three affected flows were fixed (code view confirmed). **Not yet re-tested live.**
- Staff app regenerated and pasted (Setup screen, drafts, reasons, resolve failed checklist, overage in hours); app checker 0 errors; no button tested in preview.
- `billing-core`: out-of-order events handled and tested.
- Documentation reorganised (this set).

## Member portal redesign and seed data (14 Nov)
- Member Home rebuilt (`apps/member-spfx`): next booking first (date tile, facility-local time, equipment, status, one action: View booking / Check in / Book kitchen time), then "Needs your attention" (expired or expiring document, what it blocks, how to renew), then hours-left and amount-owed summaries, then the latest notice. Every member screen (Home, Bookings, Documents, booking form, Check-in, Billing, Membership, Calendar, Notices) is in the new style and was looked at in the real page, including a 390 px phone-width frame. Navigation is Home / Bookings / Documents / Billing (bottom bar on phones, top bar on desktop). 111 portal tests pass, lint clean. **Not yet seen on a real device or in a SharePoint page.**
- Seed data (prefix `demo-`, `schema/seed.*`) is **in the real Avenue site**: 3 sample members, equipment, plan, 3 documents (one expired), 3 bookings, 1 failed checklist, 1 notice, 1 draft. Flows created the matching calendar, membership-card and hours rows (verified). Cleanup: `seedCleanup()` in `schema/seed.browser.js` removes only `demo-` rows by id. Remove before real data.
- **The portal cannot be published yet:** the tenant has no app catalog (`CorporateCatalogUrl` empty, no site-collection catalog on `/sites/Avenue`) and `automations@` is refused at the SharePoint admin center. A SharePoint admin must create one, then upload `apps/member-spfx/sharepoint/solution/member-spfx.sppkg`.

## Staff date error — local fix, 18 Nov

- Staff preview reported `TimeZoneOffset` receiving a blank date. Blank guards were added locally to the Requests conflict labels and generated Schedule time labels. The generator/checker and four static guard checks passed locally; Power Apps runtime behavior and the reported screen remain **not verified**. The changes have not been pasted into Studio or published. See `apps/staff-powerapps/README.md` for the affected controls.

## Known failures and risks

- Test rows from the 13 Nov live test remain on the live site: item ids `AvenueMembers` 5, `AvenueEquipment` 1, `AvenueMemberDocuments` 6, `AvenueBookingRequests` 33 (`gaptest-` values), plus any `AvenueBookings` row with BookingId `gaptest-r1` (none had appeared when last checked). Remove by explicit id only.
- Document renewal reminder flow exists only in an unsaved Chrome tab (save was blocked pending the developer's approval).
- Staff upload on a member's behalf has flow support but **no staff app control**.
- No failure alerts; `StaffAlertEmail` empty; single flow owner; polling latency 15–60 s.
- Leftover Power Apps Studio tabs may hold an edit lock.
- The information sheet says extra hours are "invoiced at booking"; D5 says nothing is charged at booking (C-10).

## Next actions
00. **First delivery (Kitchen Bookings + Communication):** plan written 18 Nov ([PLAN_BOOKING_COMMUNICATION.md](PLAN_BOOKING_COMMUNICATION.md)); waiting on the developer's go-ahead, the client's filled sheet and answers Q-B1 to Q-B20. The paused audit-and-fix run is still to be resumed.
0. **Release plan:** open modules to the client in waves ([RELEASE_PLAN.md](RELEASE_PLAN.md)). `release/release.json` support is built (member build and `gen.py`); demo scripts drafted in DEMO_SCRIPTS.md; admin must create the app catalog and client sign-ins first.

1. Re-test live (request, check-in, documents; staff `OnBehalfOf`; superseded document unblocks) and clean up `gaptest-` rows. Record evidence.
2. Decide on saving the renewal reminder flow.
3. Developer sends the client information request; record answers in [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md) (Q-04, Q-06, Q-07, Q-10, Q-11 first).
4. Admin: app catalog, guest sharing, test guest/staff/owner accounts; then run P1–P9 ([DAY2_RUNBOOK.md](DAY2_RUNBOOK.md)).
5. Stripe test-mode path once DKD gives access and the host is agreed (Q-01, Q-02). No live activation before client approval.

Relevant IDs: Q-01, Q-02, Q-04, Q-06, Q-10, Q-11; STR-05/06, BKG-01/06/15, CMP-02/03, CHK-05.

# Status




## 27 Nov 2026 (late night) — staging 1.15.6.0 LIVE on the staging page (bundle 3eaa209d; 1.15.4 was 6c4255ff): arc date wheel (phone) / week bar (desktop), redesigned booking sheet, [PROPOSED] Flavors wordmark, AI photos, attachments on (flow R2 live). Client live portal unchanged (2.19.0.0). Next: Next-tag overlap on the arc, check the month popover and >5-unit sheet in a browser, decide how to beat the SharePoint service-worker cache, get the client's OK on the wordmark and AI photos.

## 27 Nov 2026 (night) — staging 1.15.1.0 LIVE on the staging page (bundle da52fff4): AI equipment and Home photos (Higgsfield Unlimited, no credits), phone gap and Review bar fixes. Client live portal unchanged (2.19.0.0). Nothing committed since 2970bd2.

## 27 Nov 2026 (evening) — staging 1.14.1.0 LIVE on the staging page (bundle c4c219ca): clock picker, desktop layout fixes, glass, check-in lock, attachments ON in staging (flow R2 live). Client live portal unchanged (2.19.0.0). Open: Check in phone gap, bubble echo contrast, test a real attachment end to end.

## 27 Nov 2026 (late) — staging member portal 1.13.2.0 LIVE on the staging page (bundle eaec0d22): new Start/End time picker on Book and the phone UI audit fixes (see CHANGELOG). Client live portal unchanged (2.19.0.0).

## 27 Nov 2026 (end of day) — staging member portal 1.12.0.0 LIVE on the staging page; client live portal unchanged (2.19.0.0)
- Staging page https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal-staging.aspx loads bundle 358f450d (1.12: browser-audit fixes, liquid glass, unslop copy pass 2, support attachments hidden until flow R2). Uses the real Join path (MOCK_PAYMENTS false in the staging build only; server skips Stripe in test mode).
- Staff staging app 'Avenue Staff Console (Staging)' (2637a8df): Data admin CRUD (Screen24) + Support/Setup re-pasted for text Category; App checker 0 errors.
- Live flows edited and tested 27 Nov: R1 (support topic lookup, Category now Text on AvenueSupportMessages), R9 (Archived echo), R8 (re-opened echo). R2 (support attachments) NOT built.
- Data aligned with the client sheet (docs/DATA_ALIGNMENT_27NOV.md); demo/test rows recycled by id; EntryGraceMinutes 10.
- Tests on staging link: TDDAdmin onboarded on Emerging-80, plan-hours count 4 -> 8 of 80, December separate (member 12, bookings 99-101: test data, remove by id when done).

### First items for the next session
1. CLIENT'S LIVE staff app (05e28a9d) Support/Setup screens now error against the text Category column: re-paste the two screens there ONLY with the developer's OK.
2. Flow R2 (support attachments), then switch SUPPORT_ATTACHMENTS_ENABLED on.
3. Full end-to-end test pass on staging (docs/END_TO_END_TEST_GUIDE.md), unslop view audit on 1.12 at phone/tablet/desktop, one Stripe test-mode checkout.
4. Decisions pending from the developer: equipment ids 21-23, calendar id 54, demo MemberDocuments/NoticeDrafts rows, the empty /sites/Avenue-Staging site.
5. Client inputs pending: real checklist questions (e-mail attachments), member list (Current Members .xlsx), 9th sensor, Q10 rollover, Q13 reminder, STR-06 live Stripe approval.

## 27 Nov 2026 — support/event/storage flow edits LIVE (R1, R8, R9); staging staff app Category errors fixed
- Live flows edited as automations@ and tested with gaptest rows (all removed): R1 support category now checked against AvenueSupportCategories (AvenueSupportMessages.Category converted Choice -> Text); R9 archived support cases echo "Archived by Flavors"; R8 re-opened event/storage cases echo "Re-opened by Flavors". Details: flows/expressions.md "Live edits 27 Nov 2026".
- R2 (support attachments) NOT built: the portal must not offer attachments on support messages until it is.
- Staging staff app (2637a8df) only: Setup (Screen11) and Support (Screen15) re-pasted from gen.py with plain-text Category; App checker 0 errors (350 delegation warnings, 2 unused data sources); saved and published 13:17. Client app 05e28a9d untouched and still has the old Category formulas (it needs the same re-paste before its Support screen works with the Text column).

## 27 Nov 2026 — member staging 1.11.0.0 built (Liquid Glass), not deployed
- Package apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg (1.11.0.0, bundle 1f0e2b0b), 450 tests pass. Includes the 1.10 browser-audit fixes. Not yet seen in a browser. Live portal unchanged (2.19.0.0 deployed; source config 2.22.0.0).

## 27 Nov 2026 — member portal staging 1.10.0.0 BUILT, not deployed: browser audit fixes (B1-B5, V1-V12, T1-T2). Not checked in a browser yet.

## 27 Nov 2026 — staging 1.9.0.0 BUILT (unslop copy fixes), NOT deployed
- Member portal copy cleaned per docs/UNSLOP_AUDIT_MEMBER_PORTAL.md (27 fixed, 3 kept). Data follow-up: demo/test titles in Notices, Plans, Members, calendar, and the Sample checklist questions. Next: deploy staging 1.9.0.0 and check it on SharePoint.

## 25 Nov 2026 — staging staff app has Data admin (Screen24) published
- Play: https://apps.powerapps.com/play/e/Default-89dd1ecc-bb2a-4038-ad76-6be84c3e0e2c/a/2637a8df-0f29-435b-b4bf-c52a98fb3baf . Plans and Equipment CRUD and the real-row delete guard tested PASS; other data sets not individually tested. 22 pre-existing checker errors on Setup/Support (Category type). Client app untouched. See CHANGELOG 25 Nov.


## 25 Nov 2026 (latest) — staging 1.8.0.0 BUILT, not deployed
- `apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg` 1.8.0.0 (bundle avenue-portal-web-part_01310b4971184a8420f3.js), 449 tests. Client batch 1-10 (no duplicate Book actions, New message pill, one-line facility eyebrow, no dashes, capsule date strip, flatter cards/buttons, prep card, hero contrast). Not visually verified yet (no signed-in browser available to the worker). Next: sign in the built-in browser or check staging after deploy at 360/390/412/768/1280/1440.

## 25 Nov 2026 — staff app Data admin (Screen24) BUILT, not pasted
- CRUD for every workflow list on one screen (data-set picker, search, form create/edit, Deactivate, single-row typed-confirm delete; money/audit rows deletable only when gaptest-/demo-). Paste into the staging copy only, then add form fields in Studio (13 forms). Not tested in Power Apps.

## 25 Nov 2026 — staging 1.7.1.0 DEPLOYED (live portal still 2.19.0.0)
- 1.7.1.0: Home shortcut count badge is now red with a white ring (the gold badge blended into the photo). Uploaded + deployed as TDDAdmin (AppCatalogVersion 1.7.1.0, CurrentVersionDeployed true); after unregistering the service worker the staging page loads bundle avenue-portal-web-part_e128198f0274dd0c67a3.js and the badge computes red. 449 tests.

## 25 Nov 2026 — staging 1.7.0.0 DEPLOYED
- Uploaded + deployed as TDDAdmin (tenant app catalog: AppCatalogVersion 1.7.0.0, CurrentVersionDeployed true); a fresh tab of Member-portal-staging.aspx loads bundle avenue-portal-web-part_61251a177db984bf67c2.js. 449 tests pass.
- Client UI feedback round (phone first): Book page (60-day square date strip + calendar picker, highlighted time picker, equipment group cards, recent bookings on top), Home (uniform "Your month" cards with status pills and pill buttons, centred cover-flow Kitchen right now slider, compact More ways to book, clear hero photo, flat sheet), facility name restyled and "Workspace" / back buttons removed, Schedule day sheet 60% high, footer on phones, notifications scroll, plan cards stand out, Lenis-style smooth HORIZONTAL scrolling (`smoothScrollX.ts`; vertical stays native).
- Seen on SharePoint: staging Home only (card pills, slider present). Checked in the debug preview at 390 px: Book, My bookings, Schedule sheet, Membership, notifications. NOT checked: a real phone, real trackpad/mouse-drag on the slider, desktop widths after this round.

## 24 Nov 2026 (latest) — staging 1.6.0.0 BUILT, not deployed
- `apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg` 1.6.0.0 (bundle avenue-portal-web-part_164194ea1f7bb99cbeb7.js), 449 tests. Phone feedback items 1-16 (capsule cart, mode cards, range slider, Schedule groups, type system, footer, press/ripple). Verified in fresh dev frames at 360/390/412 (+800 footer); not yet seen on SharePoint staging or a real phone. Next: coordinator uploads/deploys staging, user checks on Android.

## 24 Nov 2026 — staging 1.5.0.0 BUILT, not deployed
- `apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg` 1.5.0.0 (bundle avenue-portal-web-part_04f21dbb2ea159a8f6d1.js, CSS class suffix f40341a5), 449 tests. Items A-I plus pinned hero and the edge-to-edge fixes. Live portal untouched.

## 24 Nov 2026 (latest) — staging 1.4.0.0 BUILT (mobile UI v2), not deployed
- `apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg` 1.4.0.0, 449 tests. Plan and limits: docs/MOBILE_UI_V2_PLAN.md. Live portal untouched (catalog 2.19.0.0).

## 24 Nov 2026 (latest) — staging 1.3.0.0 BUILT, not deployed (hero banner, floating tab bar, modern buttons/segmented, overflow fixes); live portal still 2.19.0.0. Measurements and limits: docs/UI_RESEARCH_NOTES.md.

## 24 Nov 2026 (latest) — STAFF app STAGING copy published (client's app untouched)
- New app "Avenue Staff Console (Staging)" (id 2637a8df-0f29-435b-b4bf-c52a98fb3baf), made with Studio Save as from the client's "Avenue Staff Console" (05e28a9d-...), which was NOT changed or published. Play link: https://apps.powerapps.com/play/e/Default-89dd1ecc-bb2a-4038-ad76-6be84c3e0e2c/a/2637a8df-0f29-435b-b4bf-c52a98fb3baf . Shares the LIVE Avenue SharePoint lists (no separate staging data yet): test with gaptest-/demo- data only.
- Pasted (cleared first): Setup (Screen11), Notices (6), Checklist (7), Support (15), Events (21), Storage (22), Applicants (16), More hub (12); Member admin (Screen23) was already in the copy from the earlier stopped session (kept; its maDocForm has the Attachments field; Max attachments 5 / 10 MB NOT set). Frozen members/compliance/payments untouched. Duplicate `_1` data sources created by Add data were removed.
- Support/Setup use `Category.Value` because Category is still a Choice (gen.py note); switch back to Text with the R1 flow edit. App checker after the fix: 0 errors, 300 delegation warnings (mostly old screens); runtime 2 and data-source 2 issues not inspected.
- Tested in the played staging app: More hub, Member admin, add member `gaptest-stg1@example.invalid` (Onboarding), edit business name (saved), demo reset with e-mail confirmation: member row removed (AvenueMembers and AvenueMyMembership 0 rows after). **The Power Apps delete is PERMANENT (not in the recycle bin)**; the published toast still says "site recycle bin" (WRONG; gen.py fixed, app not re-pasted because Studio search/replace hung and a re-paste loses the hand-added form). Layout nit in the published copy: the "Demo reset" heading overlaps the help text (fixed in gen.py, not re-pasted).
- NOT tested: Support send/attachments (flow R1/R2 not built), new application, Events/Storage re-open, document upload on behalf, Checklist edit.

## 24 Nov 2026 (latest) — demo data seeded for the tester; Check in stepper + Documents compliance UI BUILT (staging 1.2.0.0, not deployed)
- LIVE data added (44 rows, all tagged `demo-md-`; script `schema/memberdemo.seed.mjs` + `schema/memberdemo.browser.js`: report / apply / cleanup, one id at a time): 17 SAMPLE checklist questions (6 Entry, 6 Exit, 5 Wellness, text starts "Sample:", [PROPOSED] until the client answers Q-10), 6 compliance documents in varied states (Food handler card left out on purpose = Missing), 6 bookings (one Approved starting in about 20 min so Check in is open), 2 hours rows, 3 invoices (paid, paid, open; sample amounts), 3 notices (one pinned, one expiring), 3 team members, 1 support thread with a sample reply, plus flow-made rows: SupportCases demo-md-msg-1, a Calendar row and an HoursLedger row for demo-md-bk-now (cleanup finds them by BookingId / CaseId).
- NOT possible with a clean result: the Event and Storage sample requests were refused by the live flows ("your membership must be active") because `AvenueMembers` is EMPTY on the live site (0 rows). A member row for the tester would make the Membership-card flow rewrite the tester's existing MyMembership rows, so it was not added. Events, Storage and the staff Members views stay empty until staff add a member (Member admin) or we decide to.
- Check in is now a guided stepper (one question, animated tick, slide to the next, review step, Y/N keys, aria-live, reduced motion = instant). Documents: completeness ring, staggered rows, animated expand/collapse, status chips with icon and label. Staging package 1.2.0.0 built (443 tests); NOT uploaded. build-staging now sets the web part component manifest version to the solution version so browsers stop caching an old bundle.
- Verified in the debug preview on the real SharePoint page as TDDAdmin: the stepper showed the seeded questions and a Yes drew the tick and moved to question 2; Documents showed the Current / Expiring / Waiting / Expired / Missing counts and an expanded row. Not verified: the deployed staging page, phone and tablet widths, reduced motion in a real browser, a real check-in submission, the wellness flow.

## 24 Nov 2026 (latest) — member portal 2.21.0.0 (live line) / staging 1.0.0.0 BUILT with the reference console UI, NOT deployed
- Full redesign to the user's reference (https://culina-rust.vercel.app/): sidebar with collapsible rail, top bar, page headers, KPI cards, card lists. The client-review copy must ship as the separate STAGING package (`npm run build:staging`), not over the live portal. Not checked on SharePoint; checked in a local harness at 1440 and 375 px. See CHANGELOG.

## 23 Nov 2026 (latest) — member portal 2.20.0.0 BUILT, NOT deployed: reference console redesign (sidebar, KPI home, tokens). 427 tests; not yet checked visually in a browser (debug preview not completed). See CHANGELOG.

## 24 Nov 2026 (later) — member console 2.22.0.0 / staging 1.1.0.0 BUILT (not deployed): fixed sidebar, official logo, all pages on the reference blocks
- Built and tested (441 tests). Checked visually only on the SharePoint debug preview at ~1456x835 and a 343 px frame (Home, Book, My bookings, Notices, Documents, Membership, Billing, Check in, Schedule, My team); NOT screenshotted at 768/1024/2000, and Messages/Events/Storage/Policies/Join/Welcome not looked at one by one. Staging 1.0.0.0 on the client's site still shows the older build until 1.1.0.0 is uploaded. Details: docs/CHANGELOG.md 2026-11-24.

## 24 Nov 2026 (earlier) — STAGING member console LIVE beside the untouched live portal
- Staging: app "Avenue member portal staging" 1.0.0.0 (product d5270044-328c-4f85-a99d-5e985562c6a9) uploaded and deployed in the tenant app catalog as TDDAdmin; page https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal-staging.aspx (new page; web part b7cbec8a-..., same facility flavors-hyattsville, so it reads/writes the SAME lists as live: test with gaptest-/demo- data only). Renders the reference UI (sidebar, header, KPI cards). SharePoint rejected "(staging)" in the app Name (parentheses); name is now "Avenue member portal staging" (scripts/build-staging.mjs fixed; the uploaded zip was patched by hand with the same name change).
- LIVE portal unchanged: catalog 2.19.0.0, page loads bundle 416264a8. The live source tree is now at 2.21.0.0 (reference UI) but is NOT uploaded; do not upload it until the client approves staging.
- Known visual nit on staging Home: the "Finish setting up" banner text and its link run together. Other pages were not each checked on SharePoint.
- Still pending: staging site + data (proposed Avenue-Staging), staging staff app, flows R1-R9, staff app redesign paste (stopped).

## 23 Nov 2026 (latest) — LIVE DEPLOY IN PROGRESS: lists + portal 2.19.0.0 LIVE (bundle 416264a8, uploaded and deployed as TDDAdmin, page loads it); flows and staff app still to do
- Portal 2.19 is live ahead of the flow edits: member attachments in Messages must not be used until R1/R2 are built.
- DONE on the live site (automations@): list reconcile (62 additive changes, nothing removed); Choice->Text conversion proven on `gaptest-ChoiceText` (values kept, new value accepted), test list recycled; 5 support topics seeded in AvenueSupportCategories (Booking, Billing, Documents, Equipment, Other).
- NOT done: Category on AvenueSupportMessages/AvenueSupportCases is still Choice (deliberate: the live Support flow reads `body/Category/Value` and builds the case with nested `addProperty`; convert both together with the R1 edit, otherwise members' messages fail). Only needed once staff add a topic beyond the five.
- NOT done: flows R1/R2/R4–R6/R8/R9 (live flow untouched, nothing saved); staff app data sources, screens and maDocForm attachments; (portal 2.19.0.0 is now LIVE, see below).
- Until the Support flow is edited, do NOT enable member attachments: the portal 2.19 upload sequence (create with Outcome "Uploading", attach, clear) needs the R2 trigger change first.

## 23 Nov 2026 (latest, overall) — redesign phases P1–P8 BUILT; member portal 2.19.0.0 packaged, NOT deployed
- Portal 2.19.0.0 (`apps/member-spfx/sharepoint/solution/member-spfx.sppkg`, bundle 416264a8, 1.03 MB): P1 nav/headers/footer/Policies/Home bento; P2 Book sticky cart + Review & send popup (GSAP 3.15.1); P3 My bookings filled date strip, Notices Recent/All + read state (AvenueNoticeReads, falls back to browser storage); P4 Membership plan cards + compare + plan-change request (Billing support message) and Billing estimate/charges/invoice detail; P5/P6 Documents required list (sheet's 7 types) + mirror merge, Check-in labels, Messages attachments + categories list (fallback to the 5). Full build: lint OK, 426 tests pass. Live debug preview checked (desktop + 375 px phone: 9 pages, no overflow, nothing under 12 px).
- Staff app, schema, flow specs, host: see the P7/P8 entry below (built locally).
- NOT live yet. Deploy order: (1) new lists + seed + Choice→Text test (STAFF_CRUD_GUIDE §3), (2) flows R1–R9 (support flow trigger change BEFORE members send attachments), (3) staff screens paste + publish, (4) portal upload + Deploy as TDDAdmin. The portal works before steps 1–3 (every new list read falls back silently) except: attachments must wait for the support flow trigger change.
- Doubts per builder: docs/doubts/P2-book.md, P3-bookings-notices.md, P4-membership-billing.md, P5P6-docs-support.md, P7-staff-schema.md.

## 23 Nov 2026 (latest) — P7/P8 staff CRUD + schema + flow specs + host plans BUILT LOCALLY, not deployed
- Staff app (generated, `gen.py` + `check.py` OK, 23 screen files): new Screen23 Member admin (profile edit, ledger counter-adjust, documents on behalf + verify/unverify, team view); Applicants (edit, staff-made application, re-open, invite checklist, documents N of M, Approve creates an Onboarding member, onboarding pipeline); Setup (plan prices/group/open-to-new + reactivate, Fridge, Dining tables tab, Support topics tab, all 11 required doc types); Notices (edit draft/published, hide after 24 h default [PROPOSED Q-R1]); Support (thread, attachments, topic/status edit, archive, reopen, topic filter); Checklist (inline edit, Wellness); Events/Storage (edit amount, re-open). members/compliance/payments.pa.yaml byte-identical. Nothing pasted into Studio.
- Schema: 43 lists (AvenueSupportCategories, AvenueSupportFiles, AvenueMyDocuments, AvenueMyHours, AvenueMyBookings; applicant Source Staff + invite booleans; support Category Text [PROPOSED], Archived). Flow specs R1–R9 in `flows/expressions.md` (not built); the Support/Events/Storage section now says LIVE. Host: optional `SP_BRIDGE_PLANS` plan source with plans.mjs fallback (83 tests).
- Next: developer review of `docs/doubts/P7-staff-schema.md`; deploy steps in `docs/STAFF_CRUD_GUIDE.md` §3 (Choice→Text test on a gaptest- list first). Blocked: R3 owner delete (Q-R5), notice expiry default (Q-R1).

## 23 Nov 2026 (latest) — member portal 2.18.0.0 BUILT, not deployed: redesign phase 1 (nav, page headers, footer, Policies and help, Home bento, hero aligned)
- Plan: docs/REDESIGN_AND_ADMIN_CRUD_PLAN.md phase P1. 368 tests pass; checked in the live debug preview (desktop 1470 px and phone 375 px): hero text now on the page grid (147 px = container), no sideways scroll, no text under 12 px. Package `apps/member-spfx/sharepoint/solution/member-spfx.sppkg` (bundle 71f76b9b). Deploy approved 23 Nov but postponed by the developer: both Chrome profiles were signed in as automations@, which has no Add permission on the tenant app catalog (checked). Deploy as TDDAdmin: upload + tenantappcatalog Deploy + hard reload.

## 23 Nov 2026 (night, latest) — member portal 2.17.0.0 LIVE: client UI feedback (date chips, schedule day drawer on phones, equipment cards). 367 tests; live page loads bundle 655fa7ea. See CHANGELOG.

## 23 Nov 2026  — member portal 2.16.0.0 LIVE: UI plan phases 2–5, F2–F4
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

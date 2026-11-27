# Changelog

## 27 Nov 2026: staging 1.12.0.0, unslop pass 2 and attachments off (built, not deployed)
- Second copy pass (17 findings, list in `UNSLOP_AUDIT_MEMBER_PORTAL.md` "Pass 2 (1.12)"): dropped the unsourced "Chat assistant coming soon", one name per page (My bookings, Events, Week, Documents), US dates and `formatPrice` everywhere, sentence-case eyebrow, repeated explanations cut on Messages, My team and Storage.
- Support attachments (R2) are not built, so `SUPPORT_ATTACHMENTS_ENABLED = false` in `src/avenue/support.ts` hides the attach button and makes `submitSupportMessage` send one plain create (no "Uploading" mark, no attach, no clear). The three-step code stays; set the constant to true when R2 ships. Tests: p5p6 mocks the flag on; one new test covers the off path.
- 451 tests pass (`npm run build:staging`, run as the Mac user); package `sharepoint/solution/member-spfx-staging.sppkg` 1.12.0.0.

## 27 Nov 2026: data alignment
- Compared live config lists with the client sheet; plans, equipment, dining, doc types, sensors already matched. Set `AvenueFacilities.EntryGraceMinutes` 15 -> 10 (client check-in grace). Recycled demo/test rows one id at a time: notices 10/11/13, calendar 53/55/56, MyMembership 2/3/4, equipment 2/3/4, plan 1 (`demo-plan-std`, unreferenced). Renamed automations@ test member to `Avenue Test Kitchen` on emerging-10. Details and leftovers: [DATA_ALIGNMENT_27NOV.md](DATA_ALIGNMENT_27NOV.md).

## 2026-11-27 — Live flow edits R1/R8/R9; staging staff app Setup/Support re-pasted
- Support message to case (R1): new `Topic` lookup in AvenueSupportCategories replaces the hard-coded category list; case Category takes the catalogue spelling. AvenueSupportMessages.Category converted Choice -> Text. Tested: valid category (Choice and Text), unknown category refused.
- Support reply to echo (R9): Archived -> "Archived by Flavors". Event and Storage decision echo (R8): Requested with DecidedBy set -> "Re-opened by Flavors" / "Flavors is reviewing your request again."; new cases not echoed. All tested; gaptest rows recycled one id at a time.
- R2 support attachments not built (needs a trigger change on the live flow).
- gen.py: support Category is plain text (no `.Value`); setup.pa.yaml and support.pa.yaml regenerated (check.py OK, 1909 controls). Pasted into the STAGING app only (Screen11, Screen15); App checker 0 errors; published. Client app not opened.

## 2026-11-27 — staging 1.11.0.0: Liquid Glass material (built, not deployed)
- One shared mixin `liquid-glass` in apps/member-spfx/src/webparts/avenuePortal/components/_glass.scss (translucent fill, blur 20px + saturate 170%, specular top highlight, inner edge, soft shadow, optional press sheen on opacity only). Applied to: phone nav buttons (inactive ones), Book cart capsule (with press sheen), scrolled phone top bar, More sheet header (now sticky), Profile header (dark glass), segmented control thumb, date panel (no outer shadow; bubbles unchanged), Home hero pill and shortcut circles (dark glass, keeps white text readable).
- Fallback: solid colour when backdrop-filter is unsupported or prefers-reduced-transparency is set; reduced motion drops the sheen transition. The top bar no longer transitions backdrop-filter.
- Build: 450 tests passed, 0 failed; package apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg (bundle 1f0e2b0b). Not checked in a browser (SharePoint sign-in needed).

## 2026-11-27 — staging 1.10.0.0 built (browser audit fixes), not deployed
- All 19 findings in docs/BROWSER_AUDIT_STAGING_1.9.md addressed (see its Resolution table): Policies chip overlap, Home documents tile, rounded date bubbles on My bookings (specificity root cause), Book capsule hidden until a choice, More lit on the phone tab bar for More pages, money formatting with thousands separators plus formatPrice for offers, Notices chips without a second All, layout fixes. 450 tests pass. Package apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg (bundle e37b9673). Live config unchanged (2.22.0.0 in source, 2.19.0.0 deployed).

## 2026-11-27 — staging 1.9.0.0 built: unslop audit fixes (not deployed)
- 27 of 30 audit findings fixed, 3 kept (flow Outcome text, brand dot, misconfiguration errors); see docs/UNSLOP_AUDIT_MEMBER_PORTAL.md Resolution. 449 tests pass. Package apps/member-spfx/sharepoint/solution/member-spfx-staging.sppkg (bundle 0ba26e03). Live config unchanged (2.22.0.0). Not deployed, not checked in a browser.

## 2026-11-25 — staging 1.8.0.0 deployed (live still 2.19.0.0)
- Fresh 412px frame on SharePoint loads bundle 01310b49: Home shortcut row is My bookings / Check in / Documents / Messages (no Book), no dashes in page text, darker hero scrim with solid CTA; Bookings, Schedule and Book show only the nav Book button; 'Tap a day' text gone; no horizontal overflow (scrollWidth 412) on those 4 pages. Not checked by eye: Messages New message pill, date bubbles, prep tables card, desktop widths.

## 2026-11-25 — Data admin (Screen24) live in the STAGING staff app only
- Staging copy 'Avenue Staff Console (Staging)' (app 2637a8df-...): new Screen24 pasted from screens/dataadmin.pa.yaml; Screen12 (More) replaced with the new hub (Data admin card). Client app 'Avenue Staff Console' not opened. Saved and published.
- gen.py: Form controls now emit 'Layout: Vertical' (Studio paste failed PA1011 without it).
- Data sources: all 25 already present (no change); an old AvenueTeamMembers_1 duplicate exists and was left alone.
- Forms configured by hand (Edit fields): StaffAccess 11, Notices 11, StorageCases 12, EventCases 14, MemberDocuments 12, Sensors 11, SupportTopics 4, ChecklistQuestions 6, RequiredDocuments 4, DiningTables 5, Equipment 12, Plans 10, Applicants 17 (Stripe/host-written fields left off on purpose).
- App checker: 22 errors, all on Screen11 (Setup support topics uTpSave/uTpDelete, 8) and Screen15 (Support supGal, 14): '.' operator / incompatible types on Category (column type vs the .Value formulas). Not from this paste; Screen24 and Screen12 have none.
- Tested in the played staging app (automations@): Plans create gaptest-plan1 -> search -> edit 12 h -> Deactivate -> typed delete -> Delete (recycle bin) PASS; Equipment create gaptest-eq1 -> edit title -> delete PASS; Bookings guard: real row req-mwtbpp9k... keeps Delete disabled after typing delete PASS (gaptest-hrs-* rows show Delete enabled; NOT clicked, they are the user's plan-hours test). Note: on a NEW form a number typed without leaving the field may not save (MonthlyHours stayed empty on create; saved on edit).
- Not tested: Dining tables, Doc types, Checklist, Support topics, Sensors, Staff access (same code path as Plans/Equipment); Notices create skipped because the live 'Notice e-mail' flow would e-mail members; Applicants edit skipped (only real/TDDAdmin rows, Stage changes may trigger flows).

## 2026-11-25 — staging 1.8.0.0 built (not deployed)
- Client batch 1-10: Book shortcut removed from the Home round row (Messages added); '+ Book' removed from My bookings and Schedule (nav Book is the one entry); Messages 'New message' is a labelled teal pill in the list header row (no floating gold +); page eyebrows show only the facility name ('Flavors Culinary Hub'), one line, 14 px slate-indigo, no '· HELP' etc.; decorative eyebrow/hero dash lines removed and en/em dashes replaced in UI strings (time ranges use ' - '); My bookings date strip is rounded capsules with no shadow; booking-type cards lose their card shadow; Check in (My bookings) and Today (Schedule) are flat tonal buttons; 'Tap a day with bookings...' removed; Prep tables row restyled as an equipment card with a matching stepper; hero scrim, gold CTA and shortcut circles strengthened for contrast.
- Bundle avenue-portal-web-part_01310b4971184a8420f3.js 1,193,140 B; package 363,581 B. 449 tests pass. Built with MOCK_PAYMENTS=false (staging script); live config restored to 2.22.0.0. NOT visually verified: the built-in browser is not signed in to SharePoint and Chrome was reserved for another agent.

## 2026-11-25 — plan-hours test on staging link (TDDAdmin, Emerging-80), PASSED
- Member 12 set Active by staff (TDDAdmin). Requests gaptest-hrs-a (Nov 26 4 h), -b (Nov 28 4 h), -c (Dec 3 3 h) -> booking flow created Pending bookings 99/100/101 (Outcome Pending). Approved 99 and 101 -> HoursLedger: 2026-11 4 h Used (a), 2026-12 3 h Used (c); pending b not counted. Portal Home: '4 of 80 h used · 76 h left'. Approved 100 -> ledger 2026-11 +4 h (b); portal '8 of 80 h used · 72 h left'. December hours kept in their own month (monthly reset, no rollover).
- Over-plan math (hoursPreview, compiled build): used 78 + 4 h -> 2 h extra ($90 at $45/h); used 80 + 3 h -> 3 h extra ($135).
- Test rows: requests 108-110, bookings 99-101, ledger rows for gaptest-hrs-*, member 12, applicant 2, HostRequests 6-7: remove by id when done (all TDDAdmin test data; shared live lists).

## 2026-11-25 — TDDAdmin onboarded on staging link (Emerging-80)
- Join from the staging page: HostRequests 6 answered 'Test mode: payment skipped, nothing was charged'; AvenueApplicants 2 (Onboarding, emerging-80) and AvenueMembers 12 (Onboarding, emerging-80, day 1, PaymentStatus Current) created; MyMembership 12 mirror Onboarding. A second submit (HostRequests 7) was refused 'an application for this e-mail is already being processed' (correct). Staging shares the live lists, so these rows are in the live lists too.
- Not done: activation to Active and the plan-hours booking test (writes to shared lists blocked pending the user's decision). A separate site /sites/Avenue-Staging was created by a stopped job and is EMPTY (no lists/pages); the user said to keep using the existing staging link.

## 2026-11-25 — TDDAdmin reset for onboarding test; staging 1.7.2.0 (real Join)
- Recycled 104 rows that belong to TDDAdmin as a member (BookingRequests 16, Bookings 6, CheckIns 15, ComplianceCases 1, Invoices 3, MyDocuments 6, SupportCases 2, MyMembership 1, MyHours 2, MyBookings 6, HoursLedger 13, CheckInSubmissions 18, SupportMessages 3, EventRequests 2, StorageRequests 1, NoticeReads 5, TeamMembers 3, Calendar 1). Kept facility config TDDAdmin authored (Plans, Equipment, RequiredDocTypes, DiningTables, ChecklistQuestions, Notices). NOTE: staging shares the live lists (no separate staging site yet), so this also affects how TDDAdmin looks on the live portal. All rows restorable from the site recycle bin.
- Staging build now uses the real Join path (scripts/build-staging.mjs flips MOCK_PAYMENTS to false only for the staging build). 1.7.2.0 deployed; TDDAdmin sees 'Become a member'. Join filled to Review (Emerging-80, 80 h, $4000/mo, day 1, business 'gaptest TDD Kitchen'); final submit NOT sent (blocked pending user confirmation).
- Staff app: Data admin screen (Screen24) generated with CRUD for 25 lists; not pasted into Studio.

## 2026-11-25 — staff app: Data admin (Screen24), CRUD for every workflow list (built, not pasted)
- New screens/dataadmin.pa.yaml and a More hub card; gen.py, release.py, check.py updated (OK: 1909 controls in 24 files). Matrix: docs/STAFF_CRUD_MATRIX.md; paste + gaptest plan: docs/STAFF_CRUD_GUIDE.md. Not pasted into Studio, not run.

## 2026-11-25 — staging 1.7.1.0 deployed (live portal still 2.19.0.0)
- Hero shortcut count badge: red fill, white number, 2 px white ring, no inherited text shadow. Bundle avenue-portal-web-part_e128198f0274dd0c67a3.js; package 362,975 B; 449 tests. Uploaded + deployed as TDDAdmin; returning browsers kept the old bundle until the SharePoint service worker was unregistered.

## 2026-11-25 — staging 1.7.0.0 deployed (live portal still 2.19.0.0)
- Client UI feedback round: Book (date strip 60 days + calendar input, month labels, square selected day, time picker highlighted until chosen, equipment groups as cards, recent bookings first, redundant lines removed), Home (uniform Your month cards: value + ok/warn/bad/info pill + detail + pill button; Kitchen right now cover-flow with centre scale via `useCenterScale`; More ways to book rows; hero without blur/scrim; flat sheet; black text), Schedule (title only, day sheet max 60vh), My bookings (edge-to-edge square strip, Next tab, booking + progress in one card, Check in/Book side by side), page heads (facility name restyled, no "Workspace", no back button), footer on phones, notifications menu scrolls, plan/module cards with firmer edges, tab bar without the active circle.
- New `components/smoothScrollX.ts`: eased wheel/trackpad and mouse-drag glide for horizontal rails only, settles on snap points; touch native. Vertical scrolling untouched (Lenis decision stands).
- Bundle avenue-portal-web-part_61251a177db984bf67c2.js; package 362,904 B. 449 tests. Uploaded + deployed as TDDAdmin; fresh tab confirmed.

## 2026-11-24 — staging 1.6.0.0 deployed (live portal still 2.19.0.0)
- Uploaded + deployed as TDDAdmin; fresh 412px frame loads bundle 164194ea, hero 0-412 px. Seen on SharePoint: Home only (Notices band and 'Your month' section with circular icons). Book, Schedule, My bookings, Check in, Messages not checked on SharePoint; no real phone.

## 2026-11-24 — staging 1.6.0.0 built (not deployed)
- Items 1-16 of the phone feedback batch: floating glass cart capsule (inset 12 px + safe area, count badge, two lines, Review pill; springs in, hidden when empty), four separate mode cards (2x2, selected = filled teal + check + lift), glass date panel with mesh (idle loop only on screen), 4-step Book visual + "How booking works" link, equipment tilt, Home plan-hours ring + ambient light, animated empty states, success celebration (check + 10 dots, skipped under reduced motion), trimmed ledes, key-fact type scale, two-thumb time-range slider (44 px thumbs, 30-min snap, drag bubble, keyboard, summary "8:30 AM – 2:30 PM · 6 h"), compact tablet/desktop footer with "More links" (hidden on phones), physical button press + ripple, section heading rows + 8-px spacing tokens, Schedule Timeline as stat row + collapsible category groups (circular icons, counts, unit rows with status pill and mini bar, tap = book), comma lists to chips, system font stack (0 KB webfont).
- Fixes found while verifying: the phone header never switched to glass on Home because the scroll listener fell back to `window` when the page was not yet taller than the scroller (now matched on overflow only); the footer "More links" menu showed while closed (absolute child of closed `<details>`); Schedule refresh used a clock icon; group icons now differ by category; Schedule Book is a small pill.
- Lenis rejected (fought programmatic scrolling); see DECISIONS. Bundle avenue-portal-web-part_164194ea1f7bb99cbeb7.js 1,166,093 B (1.5.0.0: 1,125,293; +40.8 KB); package 358,537 B (+8.8 KB). 449 tests pass. Live config restored to 2.22.0.0.

## 2026-11-24 — staging 1.5.0.0 deployed (live portal still 2.19.0.0)
- Uploaded + deployed as TDDAdmin. Fresh 390px frame (service worker unregistered) loads bundle 04f21dbb (class suffix f40341a5); hero spans 0-390 px. Seen: Home only (circular 3D icons, short notices strip, smaller Book button). Not checked on SharePoint: Messages chat, Check in stepper, date bubbles, hero pin while scrolling, other pages, real iPhone.

## 2026-11-24 — staging 1.5.0.0 built (not deployed)
- A circular 3D icon primitive everywhere (shared `.ico3d` plus the existing tile classes), B notices strip about 94 px, C Book circle 52 px / 24 px plus, D icons use `viewBox -1 -1 26 26` + `overflow: visible`, E Check in focal "Checklist" title and one easing family, F header inset >= 16 px + safe area and a full-bleed width taken from the scroller's visible width, G Messages as a chat console (list, topic, subject, chat; two panes on wider screens; `created` read for times/day separators), H circular date bubbles, I primitives on Book/Membership/Documents.
- Hero is pinned (sticky, no transform, no scroll handler); the content sheet rises over it; overlay text fades by IntersectionObserver. Root cause of the "margin around the hero": `.page { overflow-x: clip }` (v14) clipped the full-bleed hero to the gutter; fixed.
- Animation rules from the installed design-engineering skills applied (see the final report). 449 tests pass.

## 2026-11-24 — design skills installed
- Emil Kowalski's design-engineering skills added under .claude/skills/ (MIT; see DECISIONS). Not committed.

## 2026-11-24 — staging 1.4.0.0 built: mobile UI v2 (not deployed)
- Phone: edge-to-edge shell (root measures and removes SharePoint's offset, one `--gut` variable), Netflix-style hero (crisp / blurred / dark, copy fades on scroll), small gold pill CTA, transparent header with the official logo crossfading white to teal, new Notices block (icon, title, count, See all, glass cards with category tile and labelled pill), leaf-corner glass stat tiles with count-up and touch tilt, ticket-notch booking cards, clearer booking tracker, standalone round bottom-nav buttons (no container; Book a raised gold circle), separate **More** bottom sheet and **Profile**-only sheet, springy sliding toggles with direction-aware pane slides (My bookings, Schedule, Notices), Schedule view toggle fits (icons), large snapping date strips (My bookings, Book), compact Book pills, arrows inset/hidden on touch, scroll-linked reveals. No new library. `docs/MOBILE_UI_V2_PLAN.md`.
- Tests 449 pass. Overflow scan (iframe at 320/360/390/430) clean except two known false positives. Instagram reels could not be viewed (login wall). Not seen on a real iPhone.

## 2026-11-24 — staging 1.3.1.0 built (not deployed): phone overflow, tab bar, notices strip, KPI cards, one attention banner
- Root-cause CSS: every page child can shrink (min-width 0, border-box), text wraps, media capped, page overflow-x clip. My bookings card is one column on phones (time, icons that wrap, 2-line names, status chip); the duplicate "Cancelled" progress line is gone. The raised Book circle sits above its label (3 px gap, labels on one baseline). Home notices are a compact snap strip (84 px cards, dots, single notice = one row, whole strip 100 px). KPI cards ~140 px tall. Five document alerts collapse into one banner (count, worst severity, Show all, Review documents).
- New `apps/member-spfx/scripts/overflow-scan.browser.js`: real-data scan (local debug preview on the signed-in SharePoint page, container narrowed to 320-430 px). Results: 0 offenders on 13 pages at 343, 360, 390 and 430 px; 320 px 0 after the Documents slide-in settles (the scan saw the entry animation once); 1 px hero scale at 390. It was checked to catch a deliberate 500 px element. NOT checked: real phone, tablet widths, Join page.

## 2026-11-24 — staging 1.3.0.0 deployed (live portal still 2.19.0.0)
- Uploaded + deployed as TDDAdmin; staging page shows the hero banner on desktop (checked). Phone layout not checked on SharePoint. Note: SharePoint's service worker caches the page; unregister it (or hard refresh) to see a new staging version.

## 2026-11-24 — staging 1.3.0.0 built (not deployed): hero banner (phone full-width / desktop full-bleed), round shortcuts, notice rail, booking tracker, floating frosted tab bar, modern buttons and pill segmented control, live-card overflow fix, unused webfont removed. Tests 447 passed. See docs/UI_RESEARCH_NOTES.md. The Bisstro/Bistro app could not be referenced.

## 2026-11-24 — staff app STAGING copy published
- "Avenue Staff Console (Staging)" (Save as copy; client's app untouched): redesigned Setup/Notices/Checklist/Support/Events/Storage/Applicants/More + Member admin. gen.py: Category handled as Choice (`.Value`), demo-reset wording/layout fixed (not yet re-pasted). Demo reset verified on a gaptest- member: deletes permanently.

## 2026-11-24 — member demo data, Check in stepper, Documents compliance UI (staging 1.2.0.0, not deployed)
- `schema/memberdemo.*` (44 live rows tagged demo-md-, with a cleanup script), `ChecklistStepper.tsx`, DocumentsView ring and accordion rows, a motion block in `Ref.module.scss`, new CheckInView and DocumentsView tests (443 total), build-staging manifest version fix.

## 2026-11-24 — member console 2.22.0.0 (live line) / staging 1.1.0.0: fixed sidebar, official logo, every page on the reference blocks (built, NOT deployed)
- **Sidebar really fixed:** the sticky rule had `inset: auto` after `top: 0`, which reset `top`; fixed, height now follows the real scroll container (`--av-vh`, ResizeObserver), nav list scrolls inside, help card + user row pinned, compact on short windows (<=900 px high hides the help card, <=640 hides the workspace card). Verified on the live SharePoint page via the debug preview: sidebar top stayed at 47 px and bottom at 834 px while the page scrolled to the end; footer stays in the main column.
- **Official logo** (Brand Logo/SVG.svg cropped; A mark alone in the collapsed rail) in the sidebar, mobile bar and footer; text wordmark removed.
- **Mobile bar:** logo left, bell + avatar right (40 px, 8 px gaps); stray service-bell icon replaced by the reference bell. Home phone: full-width primary button, even KPI cards, chips under numbers, alert card wraps with a full-width button, content padded above the tab bar.
- **Pages rebuilt on lifted reference blocks (module card, row, stat card, setting row, tabs, empty state, modal fields):** Notices, Documents (required list + upload form + my documents), Billing (cards + invoice rows), Membership, Check in, Messages, Events, Storage, My team, Policies; shared `Section`/`Empty`/`LoadError` now render reference cards; Sheet/dialogs restyled; Book, Schedule, Join/Welcome use the reference card/segmented/chip skin (their inner layouts keep Avenue's own widgets).
- **Home photo card** (`homeImage` in assets/index.ts, one line to swap; lazy, fixed 16:10, scrim, fallback tile, hover zoom only with hover + motion allowed) + `HomeImage.test.tsx`.
- **Accessibility/motion:** muted text `#5b6370`, gold chip text `#80601e`, teal focus ring (the reference's gold ring and `#6b7280` fail 3:1 / 4.5:1); `contrast.test.ts`; shimmer skeletons, staggered row entry, dialog pop, progress grow, 44 px touch targets on coarse pointers, all off under reduced motion. Research: docs/UI_RESEARCH_NOTES.md.
- Build: 441 tests pass (live line 2.22.0.0 `member-spfx.sppkg`, bundle 112ac9e0...; staging 1.1.0.0 `member-spfx-staging.sppkg`, bundle 31ee0ce3..., app Name without parentheses). Not uploaded.

## 2026-11-24 — staging member console deployed (live portal untouched)
- Staging package 1.0.0.0 uploaded + deployed; new page Member-portal-staging.aspx created from the live page's settings with the staging web part. Live remains 2.19.0.0. Package-name fix: no parentheses in the app Name.

## 2026-11-24 — Member portal 2.21.0.0 / staging 1.0.0.0: reference console UI lifted (BUILT, not deployed)
- UI taken from https://culina-rust.vercel.app/ (look only; no calendar component): its own stylesheet ported rule for rule into `Ref.module.scss` (sidebar, rail, workspace card, nav, help card, profile, top bar, breadcrumbs, page header, KPI cards, section cards, rows, chips, buttons), markup lifted into `AvenuePortal.tsx` (sidebar + top bar on wide screens, collapsible 72 px rail) and `HomeView.tsx`; `RefUi.tsx` holds the icon set and the page-header block. Other pages take the same blocks through shared styles (page header, cards, buttons, chips, My bookings rows). Mid/phone keep the existing top bar, hamburger menu and bottom bar.
- New `npm run build:staging` produces a separate staging package (see DEPLOYMENT_AND_OPERATIONS.md). Visual check was done with a throwaway harness (outside the repo), not on SharePoint.

## 2026-11-23 (late) — member portal 2.20.0.0 BUILT (not deployed): reference console look
- Wide layout (>= 1100 px): 246 px sidebar (MEMBER and ACCOUNT groups, workspace card, help card, user row) + light top bar with breadcrumb and bell; narrower keeps the top bar and phone tab bar. Home: reference header (date eyebrow, greeting with gold period, Book kitchen time) + 4 KPI cards from real data (next booking, plan hours with bar, documents with Needs attention chip, balance due), next-booking card, Coming up list, My plan, Notices. Teal primary buttons, 9/7/20 px radii, 27 px / 650 page titles, font token Arial, Helvetica. The reference's calendar is not used. 427 tests pass. Not seen in a browser yet.

## 2026-11-23 (late) — DEMO ONLY: member reset (remove before go-live)
- `schema/memberreset.browser.js` (report, then apply) and a Member admin > Profile button "Delete this member and all their data" (needs the member's e-mail typed to confirm; owner/manage-members capability). Both recycle one member's rows (site recycle bin) so a demo member can start again from Join. Staff app regenerated (1,658 controls, check.py OK); **not yet pasted into Power Apps Studio, not tested live**. Logged in DECISIONS_AND_OPEN_QUESTIONS.md.

## 2026-11-23 (late) — member portal 2.19.0.0 LIVE
- Uploaded and deployed as TDDAdmin; CurrentVersionDeployed true; live page loads bundle avenue-portal-web-part_416264a8de93f80620ed.js. Flows R1–R9 and the staff app screens are still pending.

## 2026-11-23 (late) — live deploy step 1: lists reconciled, topics seeded
- Live site: 62 additive list/field/choice changes; Choice->Text proven on a gaptest list then recycled; 5 support topics seeded. Category columns left as Choice and live flows untouched (see STATUS).

## 2026-11-23 (late) — P7/P8: staff CRUD, schema, flow specs, host plans (local only, not deployed)
- Staff app: Screen23 Member admin; Applicants edit/new/re-open/invite checklist/pipeline; Setup plans prices, dining tables, support topics, Fridge, 11 doc types; Notices edit + hide-after hours; Support thread/attachments/archive/topics; Checklist inline edit + Wellness; Events/Storage edit + re-open; capability toggles hide buttons (not security). Frozen screens byte-identical. Guide: docs/STAFF_CRUD_GUIDE.md.
- Schema 43 lists (+ support topics seed as real config); invariants 11 tests. Flow specs R1–R9 (not built). Host: AvenuePlans read-only bridge with fallback, +8 tests (83).

## 2026-11-23 (late) — P5/P6: documents mirror + required list, check-in labels, support tickets with attachments (code only, not built or deployed)
- Documents: reads [PROPOSED] AvenueMyDocuments merged with own submissions (silent fallback); required list (sheet's 7 types when AvenueRequiredDocTypes is empty) with Current / Waiting for verification / Expiring (30-15-10) / Expired / Missing and an Upload button per type; summary row; friendly load/send errors.
- Check in: sent checklists show booking date, time and equipment instead of ids (A1).
- Bookings staff make for a member: [PROPOSED] AvenueMyBookings merged inside `listMyRequests` (A2), silent fallback.
- Messages: categories from [PROPOSED] AvenueSupportCategories (fallback to the built-in five); reader keeps unknown categories; attachments (5 × 10 MB, images/PDF) with the 3-step upload; thread view with status chip and bubbles. The live support flow and the Category column must change first: `docs/doubts/P5P6-docs-support.md`.
- Jest suite passed in a scratch run (425 tests); not `npm run build`.

## 2026-11-23 (night) — client UI feedback doc: dates, schedule day, equipment rows (2.17.0.0, LIVE)
- Source: the developer's Google Doc of four phone screenshots (23 Nov). My bookings date strip and the Book date grid share one clean chip style: weekday over a large numeral, rounded white card, no tear-off band; days without a booking stay readable (no 55 % fade); today outlined (gold on Book), the picked day solid ink.
- Schedule month: on phone and mid widths a tap on a day with bookings opens that day in the drawer, so the member no longer scrolls past the six-week grid; a hint says so. Desktop keeps the side panel.
- Book equipment: each unit is a card with a larger picture (64 × 50 on a tinted tile), full-strength name, status as a pill (Free green, Taken red), 36 px add button, stronger availability bar.
- `npm run build`: 367 tests pass (new: booked day opens in a sheet on phones). Checked at 375 px in the live debug preview (TDDAdmin) on My bookings, Book and Schedule. Version 2.17.0.0. Deployed 23 Nov on the developer's OK (TDDAdmin): upload + Deploy returned 200, Deployed true, AppCatalogVersion 2.17.0.0; bundle `avenue-portal-web-part_655fa7ead1d4ad75b660.js` served (200) and loaded by the plain live page. (A first upload attempt was refused with 403 because the browser was signed in as automations@; nothing changed.)

## 2026-11-23 (evening) — F1 live: overdue payment refuses new bookings (BKG-14)
- "Avenue - Booking request to Pending booking" (edited and saved as automations@): new refusal rule for PastDue/Unpaid; only the owner's OwnerOverride passes (no staff bypass). Second trigger condition skips cancel items, which failed this flow on every cancel request (run 23 Nov 10:58). Exact expressions in `flows/expressions.md`.
- Tested live: PastDue member, staff on-behalf request → Declined with "a payment is overdue"; status restored; test rows recycled by id. Members still see the overdue warning in Billing (portal) as before.
- TDDAdmin could not be made a flow owner (not a Power Platform admin; admin center lists 0 environments), so the edit was done signed in as automations@.

## 2026-11-23 (later) — member portal UI plan, phases 2–5 and F2–F4 (2.16.0.0, LIVE)
- Phase 2: Notices rebuilt as a notification list: filter chips (All, Unread, categories), groups Pinned / Today / This week / Earlier in the facility time zone, 72 px rows (76 phone) with unread dot, category icon, preview and short time, urgent red rail; the full notice opens in the drawer and is marked read. Lined-paper slip, pin and facts row removed. Bell rows get the category icon; the empty bell gets an icon. Helpers `noticeGroup` / `noticeWhen` with tests.
- Phase 3: motion with CSS and the phase-0 tokens instead of the `motion` library (the plan's documented fallback; 0 KB, no SPFx/Jest risk): toasts slide out, pause on hover/focus, errors announced as alerts; drawers animate closed; scroll reveal fallback (IntersectionObserver) where CSS scroll timelines are missing; home hero stagger. All off under reduced motion.
- Phase 4: plain page heads (no grid paper), shorter home hero, equipment names wrap to two lines (0 cut-off names, was 5), date chips at least 44 × 52, My bookings statuses as chips instead of rotated stamps, 640 px form column on the newer pages. Billing, Documents and Join untouched except shared tokens.
- Phase 5: one breakpoint system — the 12 viewport media queries now follow the portal's own measured width (`data-size`), plus `data-screen="xxl"` at ≥ 1600 px (19 px base, 1440 px column); every :hover rule only on hover-capable devices (52 rules, enforced by `styleRules.test.ts`); 44 px touch targets on coarse pointers; 16 px phone inputs; safe-area padding on tab bar, bottom sheets, toasts; landscape-phone rule. Not CSS container queries: `container-type` would make the portal the containing block of its fixed bars and toasts.
- F2: a former member (no membership row but own earlier requests) sees "Your membership is not active" instead of Join. [PROPOSED] signal; deactivation deletes the row, so status cannot be read directly. F3: the event form says when the chosen date already has bookings (informational). F4: Support, Events, Storage and Team show a plain message and Try again instead of raw SharePoint errors; the shared calendar hook no longer throws on a missing reader.
- Checked in the live debug preview (TDDAdmin): notices list and drawer (Escape returns focus); desktop and 375 px on Home, Book, My bookings, Schedule, Notices: smallest text 12 px, no horizontal scroll, no cut-off names; phone touch targets all ≥ 44 px; 1920 px uses the xxl size. `npm run build`: 366 tests pass, package 323 KB, version 2.16.0.0. Deployed 23 Nov on the developer's OK (TDDAdmin): upload + Deploy, Deployed and CurrentVersionDeployed true, bundle `avenue-portal-web-part_6aff8c92864b3a69a9bf.js` served (200); the plain live page loads it (Notices shows the new All / Unread / category filters). A browser that visited before may show the old version until SharePoint's own service worker refreshes its cached page; a reload or two (or a hard refresh) fixes it — the server served 2.16 at once.
- NOT done: F1 (Booking request flow refusal for PastDue/Unpaid) — TDDAdmin is not an owner of the flow; needs either adding TDDAdmin as owner or a sign-in as automations@. F5 (two-guest isolation etc.) needs guest accounts. F6 (renewal reminder flow) e-mails members, waits for the developer's explicit OK.

## 2026-11-23 — member portal UI plan, phases 0 and 1: tokens and Inter font (2.15.0.0, LIVE)
- Plan `docs/MEMBER_PORTAL_AUDIT_AND_UI_PLAN.md` started on the developer's instruction ("continue with the latest plan").
- Phase 0: design tokens on the portal root (`AvenuePortal.module.scss`): `--av-font`, type scale (caption 12 → display), 4-pt spacing, radius, enter/exit/standard easing and 120–400 ms durations. New `styleRules.test.ts` fails the build on any `font-stretch`, any font size under 12 px, or a hard-coded font face.
- Phase 1: Inter Variable (Fontsource 5.3.0, Latin, weight axis, SIL OFL; `assets/fonts/INTER-LICENSE.txt`) replaces Archivo, bundled through `gen_font.py` as `AVENUE_FONT_WOFF2` and registered as "Avenue Sans" (features cv11, ss01). All 40 `font-stretch` declarations and `$cond` removed; 19 font sizes of 10–11.5 px raised to 12 px. Archivo file and licence deleted.
- `npm run build`: lint OK, 362 tests pass, package 321 KB (was 363 KB). Version 2.15.0.0. Debug preview on the live page (TDDAdmin, 23 Nov): "Avenue Sans" loaded, width 100 %; Home, Book, My bookings, Schedule, Notices at desktop and Home, Book, My bookings, Notices at 375 px: smallest visible text 12 px, no horizontal scroll (only exception: the deliberately hidden Early entry / Clean-up labels in the phone timeline). Deployed 23 Nov on the developer's OK: uploaded to the tenant app catalog and Deploy run as TDDAdmin (Deployed and CurrentVersionDeployed true, version 2.15.0.0); bundle `avenue-portal-web-part_2e066b0f2ce3979b4ea4.js` served (200) and loaded by the plain live page, headings in "Avenue Sans" at 100 % width.

## 2026-11-23 — remaining modules built locally (NOT deployed)
- Member portal 2.14.0.0 (358 tests, package built only in `apps/member-spfx/sharepoint/solution`): Messages with Flavors, Event request, Storage request, Team roster (feeds the wellness check), drawer entries; module flags support/events/storage/team.
- Schema: 8 new lists (37 total), checklist question loader (no invented questions), six flows specified in `flows/expressions.md` ("Specified, not built").
- Staff app: real Support, Permissions and Reports screens, new Events (Screen21) and Storage (Screen22), hub with 9 cards; generated only. Frozen screens byte-identical.
- Doubts: `docs/BUILD_DOUBTS.md` (merged from `docs/doubts/`).

## 2026-11-23 — Swift Sensors connected and polling (real data, all 8 units matched)
- Swift sign-in works (after the password was re-entered). `swiftdiscover.mjs`: 8 temperature sensors in the tree, all 8 sheet codes matched by device name `SS3-102 (CODE)` and hwId. Treemap `value` is in **Celsius** although `unitId` says Fahrenheit, so `SWIFT_VALUE_UNIT=C` is set on the server (verified: A00JJL 2.8 = 37.0 F fridge; A00JN6 -22.6 = -8.7 F freezer).
- Host polls every 10 minutes; first poll wrote 8 AvenueSensorLatest rows, all State Offline, no excursions (nothing fresh to classify).
- **Finding for the client:** every unit's last reading is 22 Jun 2026 about 13:40 UTC (about 153 days ago; batteries 34-100%), so the gateways stopped reporting that day. Also unexpected by the sheet's names: A00JPK (Double Door Freezer #1) reads 38 F and A00JQ4 (Freezer #2) 35.8 F (fridge-like), A00JP7 (Half Door Refrigerator) and A00L4N (Complimentary Refrigerator 1, Sink Room) read about 73 F (room temperature). New question Q-E7 below.

## 2026-11-23 — Swift Sensors: real API read, client rewritten, waiting for a working sign-in
- All sensor settings are on the server (Swift key, e-mail, four sensor flow links). First live sign-in: Swift answered 400 error 1123 (e-mail and/or password invalid); the API key was accepted. To prevent lockouts (error 1122) the server's `SWIFT_PASSWORD` was blanked, so the sensor job is off (`sensorsConfigured:false`).
- Swift's public docs (my.swiftsensors.net/api-docs) were read: base `/api/client/v1`, `X-API-Key`, `POST /sign-in`, account id in every path, tree at `/accounts/{id}/treemap`, series at `/accounts/{id}/time-series/sensor`, unitId 1=F 2=C 3=K. `swiftClient.mjs`/`sensorJob.mjs` rewritten; sign-in failures pause sign-ins for 60 minutes; `swiftdiscover.mjs` prints what Swift sees and how the 8 sheet codes map. Host 75 tests, sensors-core 10. Deployed (job still off).
- Still unverified until a real sign-in works: whether treemap values are in the display or stored unit, and where codes like A00L4N appear in the tree.

## 2026-11-23 (00:51) — staff app published with Sensors (Environment) and Applicants screens
- Studio: added data sources AvenueSensors, AvenueSensorLatest, AvenueSensorHourly, AvenueTempExcursions, AvenueApplicants. Pasted `sensors.pa.yaml` into Screen14, `applicants.pa.yaml` into Screen16 (real applicant queue, shows the test application) and `more.pa.yaml` into Screen12 (hub now has Setup, Payments, Sensors, Applicants cards). Compliance, Payments, Members and every other screen were not touched.
- Fixes found by the Studio App checker and made in `gen.py`: `AddColumns` takes bare column names (not quoted text); text cannot be compared with `<` (stagger index is now `Mod(Len(UnitName), 6)`); `Patch` must be given the real list record (`LookUp(...)`), not a gallery row with extra columns. App checker: 0 errors on Screens 14 and 16, only delegation warnings.
- Previewed Sensors: 8 units by room, all Offline "No reading yet", counters "0 of 8" / "8 stale or offline" (no Swift readings yet). Published by automations@ (Studio notice 00:51:57). Not tested: Acknowledge button, Settings tab, Daily log with data, Applicants Approve/Reject (would change the test applicant/member).

## 2026-11-23 — sensors module built; lists, flows and host deployed; waiting for the Swift credentials
- SharePoint (live): AvenueSensors, AvenueSensorLatest, AvenueSensorHourly, AvenueTempExcursions created (staff only); 8 sensors loaded from the client sheet (the two "Complimentary Refrigerator 1" units are suffixed with their ids, Q-E1 open; the sheet says 9 sensors but only 8 rows were readable).
- Power Automate (live, on): Host sensors (read only), Host sensor latest, Host sensor hourly, Host excursions. Their links are NOT yet on the server.
- Host (deployed): Swift client, sensor job (10-minute poll, classification, hourly summaries, excursions, 80% call budget, backfill), health fields; stays off until SWIFT_API_KEY/USER/PASSWORD and the four sensor flow URLs are set (`scripts/set-host-secrets.sh` prompts for them). 71 host tests, 10 sensors-core, 12 schema. All Swift API details are UNVERIFIED (`swiftClient.mjs`).
- Staff app: Environment screen generated (`screens/sensors.pa.yaml` for Screen14, `more.pa.yaml` for Screen12); NOT pasted or published. Compliance, Payments, Members and every other screen are byte-identical to before.
- Server setting PAYMENTS_REQUIRED=0 (test key only) skips Stripe in the Join flow; tested.

## 2026-11-22 — host deployed and join request proven (test mode)
- Host: Checkout now selects payment methods through two connected-account settings (`pmconfig.mjs`) because Stripe rejects `payment_method_types`; Stripe error text (key-like strings redacted) now appears in the host log. 49 tests.
- Stripe sandbox: 26 plan prices created (`catalog.mjs --apply`); webhook destination updated to 11 events via the Workbench shell.
- Power Automate: Host applicants/members/invoices/hours ledger/grant read flows saved and on; Host requests flow saved (shared key pasted by the developer, inputs secured).

## 2026-11-21 (late) — staff Approved screen re-pasted and published
- Screen2 (Approved) was re-pasted from the regenerated `screens/approved.pa.yaml` after the edit lock was overridden (the other session's unsaved edits were lost; `gen.py` already held them). The extra-time gallery rows, Approve, Decline and Extend controls are inside `pg_approved`. Clipboard must be set with `LC_ALL=en_US.UTF-8 pbcopy` or "·" and "→" paste garbled. Published 21 Nov 23:30 by automations@. Not checked in preview at narrow, wide and short window sizes.

## 2026-11-21 (night, later) — staff Approved screen: extra-time section follows any screen size
- Client-facing issue (user screenshot): "Extra time requests", Approve/Decline, "Extend the selected booking", HH:MM and Extend now sat on the screen itself, while the rest of the panel is a 1366-wide page centred in a scrolling container, so they drifted left/right on any width other than 1366 and did not scroll with the panel.
- Live (published 22:52 IST): the 8 controls' X is now `App.Width/2 ± offset`. Checked in play mode as automations@ at 800, 1280 and 1920 px wide: aligned with "Adjust departure". Still open: on short windows (e.g. 1280×650) the panel scrolls and these controls do not; fix is to move them into `pg_approved` (Studio cut/paste, not possible from Claude's browser pane).
- `gen.py`: the extra-time controls are now generated inside `approved.pa.yaml`'s scrolling page (no separate `approved-extensions.pa.yaml`); check.py OK, 1057 controls in 16 files. README updated.

## 2026-11-21 (after midnight) — late cancellation decided by staff (portal 2.13.3.0 live; staff app published 22:36 IST)
- User decision (21 Nov): under 24 h the member asks with an optional message; staff review and either keep the booking, cancel with hours returned, or cancel without returning hours (staff's choice).
- Live schema (TDDAdmin, REST): `AvenueBookingRequests.Message` (Note) added; `AvenueBookings.Status` gains "Cancelled (hours kept)". The hours-ledger flow credits only "Cancelled"/"No-show credited" (per flows/expressions.md), so the new status keeps the hours used with no flow change. UNVERIFIED: that the live flow compares the whole status, not a substring; check the ledger after the first use.
- Portal 2.13.3.0 (315 tests): message box on "Ask to cancel"; "Cancelled (hours kept)" shows as Cancelled with "hours were not returned" and counts in the hours estimate; "Cancellation requested" follows the flow's echo, so "Keep booking" clears it.
- Staff app (edited in Studio, published 21 Nov 22:36 IST; App checker 0 errors, 206 delegation warnings; `gen.py` matched, check.py OK 1057 controls): Approved screen shows "Cancel request: <message>"; on a booking with a cancel request the No-show button becomes "Cancel, keep hours" and a "Keep booking" button appears (live name `Button1`), both refused without a reason in the note; Setup switches widened so On/Off is readable. Verified in play mode as automations@ (buttons and text shown; not pressed on the user's test booking).

## 2026-11-21 (late night) — Bookings + Communication logic fixes (portal 2.13.1.0 live; staff app published 22:01 IST)
Independent logic review of both modules (13 findings + 3 plausible); fixed what the client's test path touches.
- Portal (bundle `601004d8`, then `e728a8b1` as 2.13.1.0; 313 tests pass): booking starts 24 h a day (client sheet), review lists the auto-assigned refrigerator, "no refrigerator free" blocks a start, notices reload every 60 s / on focus, a booking with a cancel request stays visible until it is actually Cancelled, "Move to" checks the unit is free, Home "+N" counts chips, private event labelled "Private event", whole-kitchen chip ignores fridges, Schedule "stations free" counts cooking units only, mobile Notices dot only for notices, extend past midnight, "Renew your …" uses the newest document per type.
- Staff app (edited property by property in Studio, published; generator updated to match): Requests no longer treat the portal's auto-assigned prep tables/fridge as clashes — Approve assigns free ones (`EquipmentIds` rewritten) and stays disabled when too few are free, when the start has passed, or when the dining room / whole facility is booked; status chips read "Waiting"; Dashboard right column ends level with Operations and shows business names; draft notices with a past hide-after date are not published; "Hide after" placeholder "No end date"; Schedule month data covers ±42 days and Refresh reloads it. App checker: 0 errors (204 delegation warnings).
- Live data (approved by the user): notice "nothing" withdrawn; junk draft recycled (recycle bin); test member renamed "Test Kitchen Co." (AvenueMembers 10, AvenueMyMembership 9, AvenueCalendar 49/50).
- Checked live as TDDAdmin/automations@: new bundle, 12 AM–12 AM booking scale, review text with refrigerator, staff dashboard/Notices/labels. Not exercised live: the new Approve reassignment (no waiting requests left at the time).
- Not done: staff "Keep booking" for an under-24 h cancel request (staff can only cancel), staff dashboard label for private events.
- Generator note: the live staff Dashboard has fewer Operations rows than `gen.py` (unpasted rows), so live `dPanelEq`/`dEquipGal` heights are 260/200, not the generated values.

## 2026-11-21 (night) — mock payments for the preview; own-items reads filtered by author (portal 2.13.0.0, live 21 Nov, bundle `4a6fc6a4c660cb50d0ef`)
- Payments are mocked (`MOCK_PAYMENTS` in `avenue/billing.ts`, user instruction 21 Nov): the Join screens stay; "Pay and continue to Avenue" enters the portal without contacting Stripe (remembered per browser), the resume banner is hidden, and Billing's "Manage payment method" says payments are off. The flows still refuse bookings from someone with no AvenueMembers row; staff add the member on the Members screen. Set the constant to false when STR-06 is approved.
- Fix: site owners/admins bypass SharePoint's "read own items only", so an admin opening the portal saw other members' requests and booking alerts as their own (seen as automations@ with TDDAdmin's booking #90). Intake reads now also filter `AuthorId eq <signed-in user>`.
- 313 tests pass (2 new), run by the developer on this Mac.
- Checked live as TDDAdmin: new bundle loaded; booking-request and host-request reads carry `AuthorId eq 12`; no join screen for TD; My bookings shows TD's bookings incl. #90 Approved with the staff note. The mock join path was not tried live (needs a non-member account); covered by a unit test.

## 2026-11-21 (evening) — onboarding, payments, check-in: built locally; schema and plans live
- Host: Stripe catalog/checkout/portal/account-link/event-invoice/cancel, webhook effects (invoice mirror, applicant to member, overdue status, overage on invoice.upcoming), public /join page, bridge relay client, catalog and member-import scripts (dry run by default). 47 tests.
- Portal 2.13.0.0: Join wizard and Welcome, real Billing with Stripe links, overdue banner, team wellness check-in, drawer balance. 311 tests; package built, not uploaded.
- Staff: real Applicants queue, Payments invoices with Connect Stripe and event invoice, payment status and owner override on Members, dashboard counters; schema now 25 lists. Not pasted into Studio yet.
- Live SharePoint: new lists and fields applied; 18 sheet plans loaded (old plan ids renamed). Defaults for client review: CLIENT_REVIEW_DEFAULTS.md. Environment module plan: ENVIRONMENT_PLAN.md.

## 2026-11-21 — unbuilt modules planned (not built)
- New [MODULES_PLAN.md](MODULES_PLAN.md): research and build plan for member onboarding (staff-started and self-serve doors, Stripe Checkout with collection-day anchor, guest invite, applicants queue), real payments (invoice mirror, overage via pending invoice items, overdue block, customer portal), existing-member import, check-in finish (questions, door QR, wellness, overstay, no-show), events, sensors. Proposes a host ⇄ Power Automate signed HTTP bridge. New questions Q-M1..Q-M6.

## 2026-11-21 — profile drawer (member 2.12.1.0, live)
- The name pill now opens a right-edge modal sheet instead of a dropdown: header (name, e-mail, business, status, plan), Needs attention (booking hold, expired or missing documents, more-information requests; max 3), At a glance (hours, next payment, balance due), Your account (membership, documents, billing, bookings, check-in when on), Getting started progress, Preferences (sounds, vibration, desktop alerts, full screen as switches), Help (policies), Sign out. Documents and Billing no longer sit in the dropdown.
- Code: `avenue/profile.ts` (pure, 9 tests), `ProfileDrawer.tsx` (9 tests), `.pd*` styles. Slide-in 280 ms, slide-out 200 ms, rows rise in; reduced motion fades only; Escape, scrim click, Tab trap, focus returns to the pill; full-screen sheet under 640 px.
- Checked live as the test member: layout, attention and glance figures, navigation closes the sheet and opens the page, Escape and focus return, switch toggles, phone width (sheet fills the screen, figures stack), old dropdown gone. Not checked: screen reader, a member with a booking hold in the live drawer (covered by unit tests).

## 2026-11-21 — profile drawer planned (not built)
- Research and plan in docs/PROFILE_DRAWER_PLAN.md: right-side modal sheet from the name pill; needs attention, at a glance (hours, next payment, balance), account destinations, onboarding, preferences, help, sign out; later modules mapped; open questions Q-P1..Q-P4.

## 2026-11-21 — integration host deployed to the client's AWS instance (Stripe sandbox, test mode)
- `apps/integration-host`: new `server.mjs` (plain Node HTTP), `sqliteTable.mjs` (persistent webhook store), `deploy/` (systemd unit, idempotent deploy script). 20 tests pass.
- Server configured: Node 22, systemd service as a non-root user, Caddy HTTPS (Let's Encrypt) on `13-207-228-174.sslip.io`, ufw 22/80/443. Verified from outside: health 200, unsigned webhook rejected, nothing stored.
- Stripe sandbox destination `avenue-host-aws-test` created (connected-account events, invoice.paid and invoice.payment_failed). Signing secret set on the server by the developer. End-to-end test in the sandbox: test customer, invoice and out-of-band payment on connected account acct_1UYbYzAsg6Xog0k8 -> invoice.paid -> host 200 -> stored as paid (test objects remain in the sandbox only; the shell's `stripe trigger` ignored --stripe-account and created platform-level events, which the connected-accounts destination correctly did not deliver). `avenue.pem` and other private keys are now git-ignored.

## 2026-11-21 — compliance escalation verified end to end; staff screens republished
- Staff screens 4 (Compliance with Documents / Cases / Owner overrides), 8 (Members) and 10 (Settings) republished with the tab-row offset fix; sub-tabs clickable, no overlap.
- Verified live (member TDDAdmin, staff automations@): flag -> case Open -> staff dashboard count -> staff "Place booking hold" (refused without a message) -> member flag Outcome "Booking hold: ..." -> booking request Declined "a compliance review is open on your account" -> staff "Release hold" -> Outcome "Hold released" -> new booking request Pending. Test rows (flag 1, case 1, requests/bookings gaptest-hold, gaptest-released) recycled by id. Case 2 / flag 2 (member's own test) left in place.
- Payments: dashboard shows expected (not collected) amounts. Stripe NOT connected: needs approved host (Q-01), test-mode key in a secret store placed by the developer, then STR-06.

## 2026-11-20 (evening) — compliance escalation, onboarding checklist, payments dashboard (member 2.11.0.0 live; staff partly)
- Live: lists AvenueComplianceFlags (member intake) and AvenueComplianceCases (private; renamed from Holds, plus Status, StaffMessage). Flow "Avenue - Compliance flag to case" and "Avenue - Compliance case to member" created and saved. Booking-request flow gained `Get_items_5` (active case with Active = Yes) and a Refusal rule: "a compliance review is open on your account".
- Live: AvenueRequiredDocTypes loaded with the client's 7 documents. Member 2.11.0.0: flag form in the wizard, Getting started checklist, Required tags, Home reminder for documents never sent, case status on Documents/Home.
- Staff app published earlier today: Dashboard counters (cases to review, holds active), Members "documents x of N", Payments dashboard (expected, not collected; Reports demo screen hidden). Generator fixes since then NOT published: tab row on Compliance/Members/Settings was shifted by the content offset and the sub-tabs could not be clicked; new Compliance Cases tab not yet seen live. Studio session expired; reopen Studio and repaste screens 4, 8 and 10.
- Verified live: flag validation, flag -> case (Open) -> staff Dashboard counter 1. NOT verified live: staff decisions, echo flow, hold refusal in the booking flow, release. Test rows to remove by id: AvenueComplianceFlags 1, AvenueComplianceCases 1.

## 2026-11-20 — compliance wizard and payments (member 2.10.0.0 deployed tenant-wide; staff app republished)
- Release modules now include documents and billing (release/release.json).
- Compliance: the client's 7 document types (sheet "Compliance Documents") added as DocType choices in schema/lists.v2.json (4 lists; the 11 choices were added to the 4 live lists on 20 Nov). New `compliance.ts` (3 categories: Permits & licences, Insurance, Food safety) and `ComplianceWizard.tsx`: one question at a time, slide animation, category rail with progress, summary. Warning days 30/15/10 recorded; reviewer is the Flavors owner.
- Payments: `payments.ts` holds the sheet's rules (3% card fee on current plans, legacy prices include it, extra-hour rate per plan, due day 1-15 with grace to the 5th for a 1st due day, $99 late fee, $500 event deposit lost under 30 days). Billing screen shows Next payment, due date, late fee, extra-hour estimate; "Pay now (test)" works in demo mode only. Live payments remain NOT_CONNECTED (host Q-01, Stripe test access).
- Staff app: all 13 generated screens repasted and published (Members group with Compliance now in the nav; Settings and Reports on). Dashboard: shorter KPI captions, member names without e-mail domain, plain category tiles instead of emoji.

## 2026-11-19 — client master-data sheet read
- Read the client's Avenue Phase 1 master-data sheet end to end (read-only) and logged the booking data and 14 open questions in docs/CLIENT_SHEET_BOOKING_DATA.md. Nothing applied to the live site yet; waiting for answers (equipment/plans/rules replacement and demo- cleanup come next).

## 2026-11-19 — real booking data applied (live site)
- AvenueFacilities row 1: MinBookingMinutes 60, BookingStepMinutes 30 (1 h minimum, then 30-minute steps; no maximum). Max companies left empty (open Q3).
- AvenueEquipment: titles set to the client's names (stoves, warmers); added open fryer table, pizza oven 2 and 3 (inactive), baker's racks 1 and 2; pizza oven 1 set unavailable; three stray test rows (ids 21–23) deactivated, nothing deleted. Fridges and dining tables not added (Q4, Q6).
- AvenuePlans: added 8 current and 10 legacy plans with hours and extra-hour rate (monthly price has no column). demo-plan-std kept because the five existing members use it; real members need the "Current Members .xlsx" (Q12). demo- rows not cleaned up yet for the same reason.
- schema/equipment.seed.mjs updated to match (tests pass).

## 2026-11-19 — member 2.8.2.0: answers from the client sheet applied
- Dining room: 50 seats = 10 tables x 5 seats (AvenueDiningTables, 10 rows). MaxCompaniesInKitchen = 2.
- Fridges: new Category choice 'Fridge' (lists.v2.json, live field). fridge-1/2 are hidden from the equipment picker; every equipment booking gets one free fridge automatically, and a third company is refused when both are in use. Whole-kitchen and private-event bookings take both.
- 1-hour gap: the Book page keeps 60 minutes (30 entry + 30 clean-up) free around other bookings on the same equipment. UI-level only: the Power Automate flows were not changed, so management approval still catches any conflict.
- Private event: shortest booking 4 h (UI), package information shown. Own loader replaces the grey placeholder while data loads (2.8.0.0).
- Tests: new availability tests for the gap and fridges; build green.

## 2026-11-20 — member 2.9.0.0: booking module end-to-end test on the real data
- Cleared all booking data (requests, bookings, calendar, hours ledger; 117 rows) to the recycle bin one id at a time. Members, plans, equipment, notices, check-ins untouched.
- Added bell reminders 24 h and 1 h before an approved booking (tests added). Open questions and defaults: booking_questions.md.
- Tested live as the TDD test member + staff app: book 1.5 h with auto fridge, flow Pending, staff approve, shared calendar, ledger 1.5 h, bell, cancel (hours credited back), dining 50-seat limit, staff decline with note, staff Setup adds a unit that members see. Test rows removed afterwards (by id, recycle bin).

## 2026-11-20 — staff console: Insights screen (published)
- New screen Screen20 "Insights" (tab beside Dashboard): 12 KPI tiles (approved next 7 days, waiting, bookings this month, hours used, plan hours available, utilisation, active members, members who booked, average booking length, approval rate, cancel rate, late cancel requests) and four native charts (next 7 days, requests by status, members by plan, booked hours by equipment, last 30 days; fridges excluded). Dashboard gets the Dashboard/Insights tab row and 32 px operation rows. Generated by gen.py (check.py: 631 controls). Pasted into Studio and published ("available to everyone"); checked in Studio preview with live data.
- Power BI: not built (no licence on the signed-in account); setup guide and proposed DAX measures in docs/POWER_BI.md. Equipment photos: still held (none obtainable from the old booking site).

## 2026-11-20 — Power BI access
- Gave developer@poweredbyavenue.com (Power BI Pro seat) read-only access: Avenue Visitors group plus Read on 8 lists (SharePoint). Connected Power BI service to the site; the web route produced an empty semantic model (Pro workspace limitation in the region). Report to be built in Power BI Desktop; see docs/POWER_BI.md.

## 2026-11-20 — staff console: scrollable screens, Notices fix, Recent requests
- gen.py now wraps every screen's content in a vertical scroll container (auto-layout parent + manual page child, nav and tab bar stay fixed). check.py allows GroupContainer@1.3.0 and FirstN.
- Notices: Category, Pin to top and Hide after (optional) each have their own labelled column on a separate row (they were cut off). Publish/Save as draft moved down.
- Dashboard: new Recent requests table (member, when, space, status chip; latest 8) below the existing panels; operation rows 32 px.
- Pasted into Studio and published for Dashboard (Screen3), Insights (Screen20) and Notices (Screen6) only; Requests, Approved, Schedule, Book, Setup, Members, Check-ins are generated with the wrapper but NOT yet pasted. Verified in a fresh Play tab: Notices layout and Dashboard scrolling. Old cached tabs show the previous design until reloaded in a new tab.

## 2026-11-20 — staff console: glass shell, responsive layout (Dashboard, Insights, Notices)
- App layout set to Responsive in Studio (Settings > Display): the app fills the browser window instead of scaling a fixed 1366x768 canvas.
- New shell in gen.py nav(): translucent dark-teal glass bar with brand diamond, pill navigation with a gold active marker, glass tab pills; full-window gradient backdrop (SVG with blurred teal/gold orbs, as an Image); panels and KPI tiles are translucent white with a soft edge. Page content is centred (max 1366 wide) in a scroll container and slides up on entry (Timer-driven PaddingTop). check.py allows EncodeUrl.
- Pasted and published for Dashboard (Screen3), Insights (Screen20) and Notices (Screen6) only. Requests, Approved, Schedule, Book, Setup and More are generated with the same shell but NOT yet pasted (they still show the previous bar). Limits: no real backdrop blur in Power Apps (the blur is baked into the backdrop image), content columns are fixed at 1366 and do not reflow on phones/tablets, no hover animations. A left sidebar was not built (content layouts assume full width).

## 2026-11-20 — staff console: glass shell on every screen (published)
- Requests (Screen1), Approved (Screen2, plus its extra-time block), Schedule (Screen19), Book (Screen9), Setup (Screen11) and More (Screen12) pasted into Studio with the glass shell and published, so all screens now share the full-width bar, backdrop and scroll container. Fixed the white side margin seen on screens still using the old fixed-width bar. Verified in a fresh Play tab: Notices and Requests fill the window. Not re-checked after paste: Approved, Schedule, Book, Setup and More in Play.

## 2026-11-18 — member 2.7.1.0
- Home live booking: no card at all. Open layout on the page under one gold rule (no box, border, shadow or rounded container); ring on the right, equipment icons plain, View booking button underneath.

## 2026-11-18 — member 2.7.0.0
- Home: the live booking card (Now / Next) redesigned: light card with gold top edge, status pill, large headline, teal progress ring on the right, equipment chips, actions under a rule. Markup unchanged (CSS only). Live-checked at desktop width; phone width not checked.

## 2026-11-18 — member 2.6.2.0 / 2.6.3.0
- Book page: "Recent bookings" (latest 3 by start time, with status) under the booking form.
- Feedback sound replaced: soft two-note chime (bell partials, low-pass, faint echo) instead of the plain sine beep. Not yet heard on a real device by the developer.

## 2026-11-18 — member 2.6.1.0
- Fix: Book page on desktop had no Review button (it lived only in the review-step side panel). The side panel now shows on the first step too. Deployed; live check: button present, disabled until hours and people are set.

## 18 Nov 2026 - Schedule rebuilt (deployed)

- Head with facts (Free now, Bookings on the day, Busiest window), shared `factRow` with My bookings. Month as a prep sheet (square cells, a bar per booking, today ringed, chosen day inked, ruled day list beside it); Equipment as a departures-board list (nameplate, status, 24-hour bar with a now marker, Book); Timeline board with sticky nameplate labels, ink blocks with company names and a gold now line; Week heat table and phone lists restyled; day bar as one compact control (Refresh is an icon button). Unused `KitchenTiles` removed; 91 old rule blocks pruned and redefined once (`v7`).
- Build green (259 tests, schedule contract tests unchanged); deployed (bundle `01f64b0006285832545e`); other screens unchanged per computed-style diff.

## 18 Nov 2026 - My bookings rebuilt (deployed)

- New screen design: facts row (Now/Next, Waiting for Flavors, Booked this month), tear-off 31-day strip, full-width day headings, ticket stubs (time stub, perforation with notches, nameplates, rubber-stamp status), muted cancelled/declined, live booking marked; detail sheet with stamp, labelled Entry/Booked/Clean-up bar, nameplates and a message slip. Old agenda/rail/drawer/strip rules removed; one `v6` block.
- Fixes: sheets (portals) now get the brand body font from the shared root; sheet phase line contrast 2.3:1 → 9.5:1.
- Build green (259 tests, existing My bookings contract tests unchanged); deployed (bundle `551dafbac12a9f34bfff`); other screens unchanged per computed-style diff.

## 18 Nov 2026 - stylesheet merge (cascade-safe), verified identical

- 94 never-applied declarations removed; duplicate rule copies 87 → 79; deployed (bundle `01dc0d8e430022cd0a62`). A computed-style recorder/diff (all five screens, 375 and 1,440 px) shows no visual change beyond measured noise. A first, order-changing merge was caught by the diff and rolled back. Details: `docs/UX_TEST_LOG.md` pass 5.

## 18 Nov 2026 - stylesheet clean-up, Archivo type system (deployed)

- 467 dead CSS rules removed by selector analysis (Site 1,152 → 988 lines; AvenuePortal 1,235 → 756); unused `DayTimelineBar.tsx` deleted.
- Archivo (SIL OFL) bundled as an inlined data URI (`assets/fonts`, `gen_font.py`, `fontData.generated.ts`), registered once at runtime; condensed headings/figures/nameplates, normal-width reading text; `--av-heading-font` and the ticket figures now use it. Download approved by the owner; Q-26 asks Flavors to confirm or supply brand fonts.
- Immersive mode also hides `#SuiteNavPlaceholder` (48 px strip above the portal).
- Build green (259 tests); deployed as TDDAdmin (bundle `fb9eb32c775c61c0aa0a`, package 339 KB); regression passed at 375 px, visual check at 1440 px.

## 18 Nov 2026 - footer labels; test member display name

- Footer headings in sentence case (bundle `b1f6922e917b748597ce`, deployed, checked live).
- On the owner's decision, display name only: `gaptest-tdd` → "Tech DoubleKlick Designs" in AvenueMembers #10 and AvenueMyMembership #9 (`BusinessName`) and AvenueCalendar #39–41 (`MemberDisplayName`); ids (`Title`) unchanged, so removal by explicit id still works. Demo notice and equipment #21–23 left as they are.

## 18 Nov 2026 - member portal v4: structure rebuild, scroll-linked motion, end-to-end test (deployed)

- Plan: `docs/UX_PLAN.md` §7; test log: `docs/UX_TEST_LOG.md` (15 findings, all fixed or explained).
- Root cause of the side/bottom gaps: the portal root's own 16 px padding (and a 26 px corner); immersive mode now also hides the Microsoft 365 app bar (`#sp-appBar`) and the page frame margin (`AppChrome`).
- Home: ink nav bar; split hero (no text on the photo); live status panel with a progress ring; "Kitchen right now" equipment board; Coming up as a time rail; account facts beside it.
- Book: the 30-minute button grid is replaced by a day track with merged booked blocks, a short list of free windows, and a two-handle start/end range; "Midnight" label; past time marked.
- Motion: CSS scroll-driven animations (longhands only, because the minifier reordered the shorthand and silently disabled them), photo parallax and a scroll-progress line; page slide by `left` so fixed bars stay pinned.
- Restraint pass from the frontend-design skill: sentence-case labels, no middle-dot meta, monospace kept to tickets and time readouts.
- Build green (259 tests). Deployed as TDDAdmin from the built-in browser; checked live at 375 and 1440 px. Not tested: sound/vibration on a device, desktop alerts, sending a request.

## 18 Nov 2026 - member portal kitchen theme, motion and feedback (deployed)

- Plan: `docs/UX_PLAN.md`. Same palette; new component language: order tickets (My bookings), menu rows with dotted leaders (Book availability), ticket-stub time slots, tear-off dates, burner lights (Home stations), subway-tile page heads, pinned notice slip, kitchen icons (tab bar, bell).
- Audit fixes: base `h1–h3` reset no longer outranks components (`:where`), scroll-reveal removed, sections keep state and start at top, Schedule header (one row, single Book button, "Eastern Time"), Book bar fixed above the tab bar, past start times hidden, day-bar time scale, Home timeline/duplicate eyebrow/CTA band/search pill, hours "over plan", My bookings one-row day strip and tickets that fit, one-line phone footer, mid-width top bar, desktop editorial hero.
- Motion: tab sections stay mounted; nav indicator (desktop underline, phone plate) and directional page entrance share one 0.34 s clock. Send: spinner → ring + tick (gold burst on approval, shake on decline).
- Feedback (`components/feedback.ts`, 2 tests): haptics (Vibration API, iOS switch fallback), synthesized service-bell chime, toasts, opt-in desktop alerts; Sounds / Vibration / Desktop alerts toggles in the account menu. Defaults marked [PROPOSED].
- Build green, 259/259 tests. Deployed as TDDAdmin (bundle `f9b52a830996cc56f7ab`). Checked live in the built-in browser at 375, ~800 and 1440 px on Home, Book, My bookings, Schedule, Notices. Not checked: sound and vibration on a real phone, desktop alert, sending a request (no request was sent).

## 18 Nov 2026 - booking page redesign deployed

- `BookFlow.tsx`: start + length replaced by start time then end time (end list appears after a start is picked; ends run from start + min length to start + max length or midnight, on the booking step). Left column: what, 14-day date grid, start, end. Right column: equipment grouped by category, each with its availability under it (day note or "Free / Taken until" for the window), a day bar with booked time and the chosen window, and "Move to <next free start>" for a taken piece. Request body unchanged (startUtc/endUtc). Summary aside only on the review step.
- `Site.module.scss` v2.8 block. Build green (bundle `4401ab69b1f176df6b58`). Deployed as TDDAdmin from the built-in browser via `tenantappcatalog/Add(overwrite=true)` + `deploy` (package served from the local dev server). Checked live at 865px width: start 11:00 AM, end 2:00 PM, units show Free / Taken until 5:30 PM with Move to 5:30–8:30 PM. Phone width and the wide two-column layout not visually checked; no request was sent.

## 18 Nov 2026 - member portal phone redesign (editorial layout) deployed

- `Site.module.scss` v2.7 phone block replaces v2.6/v2.6b: full-bleed photo with the headline on it, next booking as an ink band, hairline-ruled agenda/attention rows, two-column ruled equipment sheet, square timeline, ink CTA. Top bar: bell 36px, avatar 34px without chip border so it sits inside the 52px bar. Desktop unchanged.
- Build green; uploaded and deployed as before (bundle `c68143806b44334705b6`). Home checked live in a 390px frame; other screens not visually checked.

## 18 Nov 2026 - member portal phone layout fixed and deployed (2.5.1.0)

- Phone-only CSS in `Site.module.scss` (v2.6/v2.6b blocks): home hero compacted (no lede, no search pill), next-booking card first and no longer over the photo, "Right now" as a scrolling chip row, tab labels no wrap, 2-up piece grid, tighter bands, full-width button rows. `HomeView.tsx`: space after "Your kitchen,".
- Build green (all jest suites 0 failed). Uploaded to tenant app catalog `/sites/appcatalog` as the admin account in Chrome; classic upload alone did not extract ClientSideAssets, so `AvailableApps/GetById(...)/deploy` (skipFeatureDeployment) was called. Live page verified serving the new bundle and checked in a 390px frame (Home only; other screens not visually checked).

## 18 Nov 2026 - staff app pasted into Studio (not published)

- As automations@ (Studio opened in edit mode on reload; no Override click was needed) pasted requests, approved (+ approved-extensions), dashboard, schedule (Calendar mode), book, notices, setup and more into Screen1/2/3/19/9/6/11/12. First paste used `pbcopy` without a UTF-8 locale and garbled non-ASCII text (middle dot, en dash, emoji); all screens were cleared and repasted with `LC_ALL=en_US.UTF-8 pbcopy`. Set `bEquip` Value to `EquipmentId` (rows show).
- App checker found one error: Book `bCheck.Text` was missing a closing parenthesis. Fixed in `gen.py` (B_CHECK now ends with four parentheses; `check.py` green) and in Studio by typing the missing `)`.
- Play-tested as automations@ (live data, nothing created or changed): Requests lists 5 waiting requests, none had an equipment conflict, so the Approve-disabled rule was NOT exercised; Schedule day view, 7-day overview and Calendar (month grid counts, selecting day 14 lists 3 bookings, day 18 lists 1) worked. The Month arrows, Dashboard (TimezoneOffset error), Setup tabs and Notices composer were NOT tested: the Chrome tool connection dropped. Not saved explicitly, not published; a Studio tab may still be open.

## 18 Nov 2026 — staff app redesign (local only)

- `apps/staff-powerapps/gen.py` now generates every staff screen from one design system: dark top bar with grouped navigation (6 destinations plus a tab row), cream canvas, white panels, status chips matching the member portal, KPI strip, master-detail layouts, equipment pictures (`PhotoUrl` or a category tile), entry and clean-up times beside bookings, Setup > Facility rules (early entry, clean-up, reminder, `AutoApproveWhenFree`), Adjust departure on Approved, and Book using the Requests conflict rule. Requests and Approved moved from hand-written files into the generator. `check.py` green; nothing pasted into Studio or run.

## 18 Nov 2026 — deployment preparation

- Built member package 1.2.4.0 (188 tests passed). The automations account can view the catalog but Upload Document is disabled; SharePoint admin access was denied. No deployment or staff publication was completed. Restarted the local server and verified the member debug preview loads. Inspected the existing staff Approved screen and noted delegation warnings.

## 18 Nov 2026 — local calendar and layout preview

- Added a member seven-day schedule and retained the equipment day view; rebalanced Home and softened its primary colors. Inspected both screens in the SharePoint debug preview as the automations owner.
- Generated a staff seven-day schedule and olive navigation styling locally. Staff runtime testing and publication are outstanding.

Changes actually made to this repository. Planned work is in docs/DEVELOPMENT_PLAN.md, not here.

## 18 Nov 2026 - Staff Console v22 published
Staff Console screens (Requests with conflict list, Schedule Screen19, Notices, Setup, Book, More, Dashboard) pasted and tested in Play mode as `automations@` with gaptest data: approve (calendar + ledger rows appeared), conflict blocks Approve, decline outcome, Schedule in Eastern time, notice with category/pin/expiry in portal, Setup equipment and rules, Book on behalf. Published as version 22 (was 18; v19-v21 are autosaves). Fix mirrored in `gen.py`: ListBox `Value` removed.

## 2026-11-18 (website redesign v1.4.0.0)

- Member portal redesigned as a website: sticky top bar, board-based booking with kits and illustrated equipment art, agenda-style My bookings with detail drawer, week schedule, editorial Notices; navy, ivory and gold palette; short copy with details in a drawer; slim confirm bar. Live as 1.4.0.0 (255 tests); Home, My bookings and the Book board looked at live on desktop.
- Logic added: windows.ts (early entry, cleanup, phases, reminder rule), copy.ts, autoApproval.ts (setting off by default; Q-B21), flows/PROPOSED_FLOW_CHANGES.md; `AutoApproveWhenFree` applied to the live list.
- Staff app regenerated with a new shell and sync items (238 to 278 controls, check OK) but NOT yet pasted into Studio or published (version 22 is still live).

## 2026-11-18 (delivery 1 tested)

- Portal v1.2.3.0 live: phone overflow fixed (checked at 390 px: no content past the edge on Home, Schedule, Notices, Book steps 2 and 3); Exit full screen is a small round button on phones.
- Staff app published as version 22; Play-mode tests passed (approve, conflict block, decline, schedule, notices, setup, book on behalf).
- `docs/HOW_TO_TEST_DELIVERY_1.md` added. Test member AvenueMembers 10 re-activated for manual testing; calendar test row 35 removed.

## 2026-11-18 (delivery 1 build)

- Member portal v1.2.0.0 live (booking, calendar, notices): equipment-first booking wizard with availability, schedule board, redesigned Home, My bookings, Notices; premium visual and motion pass; immersive mode. 186 member tests.
- Schema: 29 new fields applied; 15 equipment units loaded; facility EarlyEntryMinutes and CleanupMinutes = 30; demo equipment deactivated.
- Staff screens regenerated (Schedule, conflict-aware Approve, Setup tabs, notice category/pin/expiry); Setup moved under the booking module in release.py. Studio paste partly done, blocked by a read-only editing lock.
- v1.2.1.0: the Exit full screen button moves above the bottom nav on phones. Studio stayed read-only ("editing control elsewhere") on a second attempt, so the staff paste and Play tests are still pending.
- Test rows still on the site (to remove by id when staff testing finishes): AvenueBookingRequests 55, AvenueBookings 56, AvenueCalendar 32 (gaptest-cal-1) and derived rows, test member AvenueMembers 10 (set Inactive).

## 2026-11-18 (deploy foundation, Stripe sandbox)

- SharePoint: admin account TDDAdmin added as Avenue site admin; tenant app catalog created; `release/delivery-1-member-spfx.sppkg` (booking, calendar, notices) uploaded, enabled for the tenant, installed on the Avenue site; portal renders at its plain address.
- Stripe sandbox: ACH Direct Debit and Google Pay on, crypto off for connected accounts; v1 `account_links` verified against an Accounts v2 test account. No products created: direct charges happen on the facility's connected account, so plan products belong there, and prices wait for Q-04.
- Swift Sensors console read (read-only): all hardware offline 148 days; thresholds and sensor list recorded in CHECKLIST module 11.

## 2026-11-18 (delivery plan)

- `docs/PLAN_BOOKING_COMMUNICATION.md` (plan only, nothing built), `docs/meetings/2026-11-16-client-call.md` and raw captions, 3 stills in `docs/evidence/`. CHECKLIST module 15 added. Decision log: 16 Nov call and the plan's open questions.
- Master-data sheet read: still the template (11 Nov values only).

## 2026-11-16 (Stripe access check)

- Read-only check of Stripe in Chrome (DKD profile): sandbox with Connect, a test key, 2 test connected accounts (Accounts v2). Findings and what is still needed are in CHECKLIST module 9 and the decision log. Nothing was created or changed in Stripe.
- `.env` (holds a Swift Sensors credential) is now git-ignored.

## 2026-11-14 (one checklist)

- `docs/CHECKLIST.md` is now the only checklist (replaces BUILD_CHECKLIST and MODULE_AUDIT): 15 modules, 53 done and verified, 74 open. ARCHITECTURE.svg updated to match.
- `scripts/secret-scan.mjs` (clean across 230 files; proven to catch a fake live key), added to CI.
- Live read of all 20 lists' permissions against `schema/lists.v2.json`: all match.

## 2026-11-14 (checklist build)

### Added
- `docs/CHECKLIST.md` tracks the no-admin, no-Stripe build list; ARCHITECTURE.svg (white built, red not built), SCHEMA.md (generated from `schema/lists.v2.json`), APPROACH.md, CLIENT_INFORMATION_REQUEST.md (draft, not sent).
- Integration host: `jwt.mjs`, `tableClient.mjs`, `graphWriter.mjs`, `stripeClient.mjs` (test keys only); 14 tests.
- Member portal: staff-page option to upload a document for a member; Yes/No arrow keys; step focus; bookings poll only while something is Pending; guest e-mail from claims login name (member total 126 tests with the first jsdom component test, CheckInView).
- Live checks as automations@ (14 Nov): documents on behalf and superseded, booking request, staff approval (calendar and hours rows), check-in Recorded, filled Membership, contrast and names on 5 screens, wave-1 build on the real page. Test rows removed by id; gaptest rows from 13 Nov recycled; gaptest member set Inactive.
- `git init` (nothing committed), `.gitignore`, `.github/workflows/ci.yml` (not run).

## 2026-11-14 (integration host code)

### Added
- `apps/integration-host` (10 tests): webhook, my-invoices, health, sensor sync and reconcile handlers, Table Storage adapter with ETag compare-and-set, Entra claim checks, Azure Functions wiring. Not deployed; Q-01 open.

## 2026-11-14 (audit fixes)

### Fixed (member portal; independent read-only audit, then fixes; 117 tests)
- An invalid facility time zone no longer blanks the portal (facility treated as not configured); an error boundary shows a plain message if any screen throws.
- A failed background refresh keeps the data on screen (it used to replace "Checklist sent" or the bookings list with an error).
- A failed document upload ("Uploading" left behind) no longer hides the real document of that type.
- Cancel, extend and document send cannot be double-submitted.
- Reads retry twice on 429/503 (Retry-After honoured, max 10 s).
- A time that does not exist on spring-forward day now moves forward instead of booking an hour early (3 tests; member total 120).

### Known, not fixed (from the same audit)
- Histories are re-read in full on a timer; list-view threshold risk beyond 5000 items unless the filtered columns are indexed (schema marks 44 columns indexed; check FacilityId/StartUtc/EndUtc on the live lists); extension cannot cross midnight; Yes/No checklist has no arrow-key handling; guest accounts with empty e-mail fall back to login name.

## 2026-11-14 (release control)

### Added
- `release/release.json` selects modules per release. Member build (`scripts/release.mjs`, `src/avenue/release.ts`, 3 tests, 114 total) and staff `gen.py`/`check.py` (new `release.py`) read it. See RELEASE_PLAN section 8. Home hides sections of unlisted modules. `docs/DEMO_SCRIPTS.md` added.

## 2026-11-14 (plans)

### Added
- `docs/RELEASE_PLAN.md` (module-by-module client access, proposed), `docs/SERVER_SPEC.md` (integration server, proposed), `docs/ADMIN_DEPLOY_STEPS.md`, `docs/TEST_CHECKLIST.md`; logged in INDEX, STATUS and the decision log. Nothing built for the module switches yet.

## 2026-11-14 (member portal complete)

### Changed
- Calendar (day cards with Today / Tomorrow, equipment filter, week buttons in one row), Notices (newest first, newest emphasised, drafts never read) and Membership (plan, status, hours meter, details) redone in the same style. Phone pass on the real page in a 390 px frame: side padding, compact date tiles, bottom bar stays at the bottom on short pages. 111 portal tests.
- Every member screen is now in the new style: Home, Bookings, Documents, booking form, Check-in, Billing, Membership, Calendar, Notices.

## 2026-11-14 (check-in and billing)

### Changed
- Check-in: pre-selects the right approved booking (in progress, else soonest) and the checklist still to do (Entry, then Exit), big Yes/No buttons with "n of m answered", Send disabled until complete, no double send, answers kept on error, then shows the flow's result ("Recorded" / "Not recorded: reason") and a history of sent checklists. A "No" shows only "Flavors can see every answer" (no automatic consequence, CHK-05). Logic in `avenue/checklist.ts`, 8 tests.
- Billing: "This month" cards from the member's own hours and plan (hours left or over, an hours-only estimate of extra hours, no money since rates are open, Q-04) and a clear "Invoices are not available yet" panel until payments exist. 110 portal tests.
- Verified live on the Avenue site: an entry checklist became submission 11 `Recorded` and a private check-in row (all passed). Those are test rows.

## 2026-11-14 (booking form)

### Changed
- Booking form is now a short guided flow: when, equipment (with a Free / Booked marker per item at the chosen time), review. It keeps what the member typed if a save fails, cannot be sent twice, and after sending shows the flows' real answer ("Approved", "Sent to Flavors for a decision" with the note, or the refusal reason). Pure logic in `avenue/bookingFlow.ts`, 10 tests (102 portal tests total).

### Fixed
- Booking request flow: `Create_item` failed on every member-authored request ("DecidedAt ... String/date-time ... runtime value empty"). `DecidedAt` is now a bare expression. Verified live: member request 37 became booking 42 (`Pending`) and the member's request received Outcome `Pending`. Booking 42 and request 37 are test rows (oven, 15 Nov 9:00-13:00); remove by id.

## 2026-11-14 (member portal, part 2)

### Changed
- Bookings screen: one card per booking (date tile, relative day, facility-local time, equipment, status, extension and cancellation state, actions inside the card). Documents screen: one card per document type with date status (Current / Expiring soon / Expired) and review status taken only from the flow's own text ("Uploaded. Waiting for Flavors to verify it."); "verified" is never shown because members cannot read that private flag. Earlier uploads fold into a list. Home wording corrected (an uploaded renewal supersedes the old document; it does not wait for review). 92 portal tests.
- Added the page `SitePages/Member-portal.aspx` (published, facility `flavors-hyattsville`) for preview with the local dev server.

## 2026-11-14 (member portal)

### Changed
- Member portal Home redesigned and navigation reduced to Home / Bookings / Documents / Billing (`HomeView.tsx`, `AvenuePortal.tsx`, `home.ts`, SCSS appended). Member requests now carry their equipment. 14 new unit tests (87 total).

### Added
- `schema/seed.data.mjs`, `seed.print.mjs`, `seed.browser.js`, `seed.data.test.mjs`: repeatable `demo-` seed with cleanup; seeded into the real Avenue site (16 rows).

## 2026-11-14

### Added
- Staff app screens 12-18 (More hub, Payments, Sensors, Support, Applicants, Permissions, Reports) generated by `gen.py`, pasted into Studio, tested in preview, **published**. Demo screens use local collections only. Portal Billing, Membership and Join tabs added (demo data, not deployed). `docs/TEST_CHECKLIST.md`.

### Fixed
- Book screen equipment list was blank (list box showed the empty Title column): now shows `EquipmentId`.
- Booking request flow failed at `Refusal` because `IsStaff` was saved as text (`@{or(...)}`): now a boolean `@or(...)`; same fix in Document submission. Verified live: staff booking approved.
- More hub tiles clickable over the description text.
- Nav row on screens 3-11 now ends in More (Setup is reached from More).

## 2026-11-10

### Added
- `apps/member-spfx/` — SPFx 1.24.1 React web part scaffolded with the official generator, then reduced to a portal shell with a **read-only** facility calendar: read contracts, a facility-scoped SharePoint REST reader with fail-closed row mapping and paging, clearly labelled demo data, unit tests. Why: first read path requested before the task scope was narrowed. Affects BKG-02, PLT-03, PLT-08. See L-40.
- `docs/REQUIREMENTS_BASELINE.md`, `REQUIREMENTS_TRACEABILITY.md`, `CLIENT_CHANGE_REGISTER.md`, `OPEN_QUESTIONS.md`, `LIMITATIONS_AND_RISKS.md`, `RESEARCH_LOG.md`, `ARCHITECTURE.md`, `DEVELOPMENT_PLAN.md` — traceable documentation set with stable IDs.
- `docs/Avenue_Phase1_Complete_Module_SOPs.docx` — ten module SOPs and a red ambiguity register on the supplied SOP Recording Template. Draft 0.1, not approved.
- `docs/BACKLOG.md`, `schema/README.md`, `apps/member-spfx/README.md` — stage backlog, proposed read-model contract, starter instructions.
- `CHANGELOG.md`, `.env.example` (placeholders only).

### Changed
- `README.md` — rewritten as the project README (purpose, status, map, setup).
- `docs/DECISION_LOG.md` — appended toolchain, ID scheme and four [PROPOSED] decisions.
- `docs/OPEN_DECISIONS.md`, `IMPLEMENTATION_PLAN.md`, `CLIENT_DECISIONS.md` — one pointer note each to the new authoritative register/plan; content otherwise unchanged.
- `.gitignore` — Office lock files.

### Verified
- `npm run build` in `apps/member-spfx` on Node 22.23.2: lint, 13 unit tests and packaging pass (see below for the latest run).
- SOP document: XML well-formed, first page previewed. Not opened in Microsoft Word (L-42).

### Added — design
- Figma file "Avenue Phase 1 — Product design & prototype" (https://www.figma.com/design/2KLYuCd1n5gxxtiFcLw6c4), in the developer's Figma drafts: cover page with flow map and screen index; design-system page (colour/spacing/radius variables, text styles, Button, Status badge, Nav item, Open decision flag, Input, Stat tile, placeholder logo); 32 screens × desktop 1440 + mobile 390 (member portal, Flavors staff app, B Street HQ), 436 click-through links and 6 prototype flow starting points. Sample data only; every unresolved value is a red Q-ID flag. Design prototype — not the application. Affects all requirement groups; see the screen index on the cover.

- `design/prototype/avenue-prototype.html` — clickable web prototype (HTML, sample data, connected to nothing). Member portal shown as one SPFx web part on a SharePoint page (desktop and phone); staff app shown as a Power Apps canvas app at 1366×768 scaled to fit, with owner / staff / B Street HQ views. Booking, conflict, late-cancel, check-in, document-renewal and owner-exception paths work end to end across the two surfaces. Stripe and Microsoft sign-in pages are placeholders; no prices are shown; open decisions carry amber Q-ID markers. Checked in a browser: scripted click-through of every tab with no script errors, desktop and phone layouts viewed. Not checked: real phones, other browsers.

## 2026-11-11

### Planning (no code changed)
- Read the 11 Nov client call from Notion (summary, decisions, action items, transcript) and the Avenue Delivery Hub. Recorded it in `docs/meetings/2026-11-11-client-call.md`. The linked Google Docs decisions log could not be opened.
- `docs/EIGHT_DAY_PLAN.md` (internal only): eight-day plan, Wed 11 – Wed 18 Nov 2026, replacing `docs/TWO_WEEK_PLAN.md` (now marked superseded).
- `docs/DECISION_LOG.md`: six client-call decisions (equipment booking, management approval, overage balance, member pays Stripe fees, cancellation/no-show credit, dining room and private events) and the plan change.
- Day 2 prep (offline): `schema/lists.v2.json` (8 lists, 50 fields, three access classes), `schema/provision.mjs` (idempotent provisioning via the CLI for Microsoft 365, with `--dry-run`), `schema/check.mjs` (offline checks: indexed FacilityId, calendar allowlist, members never get private lists, inheritance broken before grants), `docs/DAY2_RUNBOOK.md` (access gate, tenant settings, deployment, nine privacy tests). Verified: `node schema/check.mjs` passes; dry run lists 90 steps; a non-SharePoint URL is refused. **Not run against a tenant.**
- Day 1 close-out: `docs/REQUIREMENTS_BASELINE.md` updated for the call (BKG-01..05, BKG-09, BKG-12, BKG-13, CHK-02, PAY-02, STR-04 changed; BKG-16, BKG-17, PAY-07 added); `docs/CLIENT_CHANGE_REGISTER.md` CHG-22..27; `docs/REQUIREMENTS_TRACEABILITY.md` and `docs/BACKLOG.md` notes; `schema/README.md` proposed v2 lists (equipment, bookings with status, hours ledger, plans, dining tables). Nothing provisioned.
- `docs/OPEN_QUESTIONS.md`: Q-02, Q-03, Q-04, Q-06, Q-09, Q-22 updated with call answers; Q-23 (in-person overages), Q-24 (staff console platform) and Q-25 (old tiers, storage) added.

### Changed
- `design/prototype/avenue-prototype.html` rebuilt (v2) after v1 was judged not good enough to show the client. Member portal: next-booking hero, usage ring, click-a-free-time booking in a side panel, phone layout with bottom tabs and free-slot lists. Staff app: "Today" dashboard with the day's kitchen timeline, conflict comparison cards, member list with detail pane, owner-exception dialog, notice publishing that appears in the member portal. Added a nine-step guided tour and labelled example figures (plan names, prices, hours) that can be switched off. Same published link.

- Prototype v3: every module is now simulated end to end. Added simulated Stripe steps (first payment with decline and retry, paying an overdue invoice, updating the card, staff retry and owner refund, facility onboarding), post-payment setup (profile, team, four document uploads), document upload form, check-out checklist, invoice detail, an "emails Avenue sent you" log including the 3/2/1-hour reminders, extra-hour requests to staff, and working staff and HQ actions (add member, change plan, book for a member, deactivate, reminders, call log, no-show hours, support tickets through to the HQ queue, go-live checklist and operator invitation). Tour extended to eleven steps. All payments and emails are simulated; no money moves and nothing is sent.

- Prototype v4: added a stand-in for Microsoft's sign-in page (account picker, no password field), dining-room event bookings with a simulated deposit and the three cancellation outcomes (15+ days refund, 7 days deposit kept, 8–14 days sent to Flavors to decide), a phone layout for the staff app, and a stand-in Power BI analytics screen for B Street. Tour extended to fifteen steps. Event fee and deposit amounts are examples; the staff phone layout is flagged as extra build effort.

- Prototype v5, on the developer's instruction to show only what the client's documents and emails require. Removed: all prices, plan allowances, rates, event fee and deposit amounts (now "Set by Flavors"); invented plan, station, equipment and member names (now Plan A–C, Station 1–3, Equipment 1–2, Sample Member A–D); invented people and notice text; the hours ring, cost estimate and session progress bar; the email log; the extra-hour request to staff; refunds and payment retry by staff; the reason field and "Book for…" details invented for the owner override; the invented outcome for 8–14 days' event notice (now no outcome, marked Q-08); sparklines and invented sensor unit names. Document types now use the scope's four categories (permit, licence, insurance, certification). Dashboard and analytics now show only the measures the client listed. Tour reduced to fourteen steps.

### Added
- `design/DESIGN_BRIEF.md` — research sources, design decisions and the rules that keep the prototype within what SharePoint/SPFx and Power Apps can deliver.

- `docs/TWO_WEEK_PLAN.md` — ten-day plan (12–25 Nov 2026) for a working booking slice on the tenant, with assumptions, decision deadlines and what is left out.

### Verified
- Scripted click-through of every tab, booking, conflict, late-cancel, check-in, exception, publish, role and scenario path and all nine tour steps with no script errors; desktop member, staff and phone member layouts viewed in a browser. Not checked: real phones, other browsers, the final small CSS change to conflict blocks.

## 2026-11-10 (continued)

### Not done / not verified
- No deployment, no tenant access, no guest test, no SharePoint lists, no Power Apps, no flows, no Stripe or Swift Sensors calls, no git repository initialised.
- The SharePoint reader has only been exercised against fakes.

## 2026-11-11 (Days 2–3)

### Added
- Real SharePoint site `https://bstreethq.sharepoint.com/sites/Avenue` with 9 lists, 57 fields and 3 permission groups, created via the signed-in browser; scripts in `schema/` (`provision.mjs`, `check.mjs`); evidence in `docs/evidence/day2-provisioning.md`.
- Member booking REQUEST form (`RequestPanel.tsx`, `booking.ts`): kitchen by equipment, dining room by people count, private event as whole facility; facility-time to UTC conversion (`zonedToUtc`); informational overlap hints; submission to the intake list as the signed-in user (no member field is sent).

### Changed
- Read path now uses `AvenueEquipment` (EquipmentId), `AvenueDiningTables`, and a `Space` column on the calendar.

### Verified
- `npm run build` (lint, 22 unit tests, package) passes on Node 22.23.2.

### Not done / not verified
- Nothing deployed: the app catalog and guest sharing need a tenant admin. Privacy tests P1–P9 not run.
- Hours bucket (no member-visible data source yet); the flow that turns an intake item into a Pending booking; staff approval screens; emails.
- The form has only run against demo data; submitting to the real list is untested.

### Added (later 11 Nov)
- Power Automate flow "Avenue - Booking request to Pending booking" (intake item -> Pending booking, member from item author, duplicate RequestId ignored). Tested live with one request and one duplicate; see `docs/evidence/day3-intake-flow.md`. Not tested as a guest member.

### Added (Day 4, 11 Nov)
- Power Apps canvas app "Avenue Staff Console" (saved, unpublished): pending queue, overlap view, note, Approve/Decline. Source in `apps/staff-powerapps/`.
- Flow "Avenue - Publish approved booking to calendar" (approved -> shared calendar row; any other status removes it).
- Evidence: `docs/evidence/day4-staff-approval.md`. Emails skipped by instruction; not tested as staff or owner; not published.

### Added (Day 5, 11-12 Nov)
- Cancellation flow with the 24-hour rule, hours ledger flow (Used / Credit back), guard on the request flow, `CancelBookingId` and `CancelRequestedAt` fields, staff "Approved bookings" screen (cancel, no-show credit), member "My requests" cancel. 25 unit tests pass. Evidence: `docs/evidence/day5-cancellations-hours.md`.
- Not done: overage, member hours display, guest-member test, publishing.

### Added (Day 6 groundwork, 12 Nov)
- `apps/billing-core/`: host-independent Stripe webhook signature check and idempotent invoice-event handler with 7 passing tests (`npm test`). No Stripe calls, no secrets, no host chosen (Q-01). Not connected to anything.
- Day 6 proper (Stripe test account connection, subscriptions, overage invoice items, verified live webhooks) is NOT started: it needs the server (Q-01), Stripe sandbox access, the fee-handling decision (Q-02) and billing rules (Q-06, Q-07).

### Added (Days 7–8 work, 12 Nov)
- Lists: `AvenueDocumentSubmissions`, `AvenueCheckInSubmissions` (own-items intake), `AvenueCheckIns`, `AvenueDocumentFiles` (private library), `AvenueChecklistQuestions`, `AvenueNotices`, `AvenueComplianceOverrides` (owner-only), `AvenueMemberDocuments`; fields `Outcome`, `RemindersSent`, `SourceSubmissionId`, `Verified`. Schema check: 17 lists, 107 fields.
- Flows: daily document status check, check-in submission, document submission (copies files to the private library). Request flow now refuses expired-document, invalid-time and unknown-facility requests with a reason. Calendar flow echoes status back to the member. Concurrency 1 on every de-duplicating flow, after a live race test recorded a duplicate.
- Site regional time zone set to Eastern; date-only values written at 12:00 UTC (fixes a one-day shift found in testing).
- Member portal rebuilt with Fluent UI: Home, Book, Calendar, My bookings (status, cancel or ask to cancel), Check-in, Documents (upload), Notices. 36 unit tests pass; `npm run build` clean.
- `docs/ARCHITECTURE.md`: production bar and current gaps; `flows/expressions.md`: every flow expression.

### Not done
- Portal not deployed (app catalog needs an admin), so the new screens are tested only in unit tests, not in a browser on the site.
- Reminder and notice e-mails (need a mail connection); staff screens for check-ins, documents, notices and the operator dashboard; Stripe; guest-member testing.

### Added (staff screens, 12 Nov)
- Staff console screens: Dashboard (start screen), Compliance (verify, owner override), Check-ins, Notices, Checklist. Generated by `apps/staff-powerapps/gen.py`. Tested in Studio preview as automations@; test rows recycled. Evidence: `docs/evidence/day7-8-staff-screens.md`.
- Not done: publishing, staff/owner account tests, e-mails, overage.

### Added (e-mails, 12 Nov)
- Office 365 Outlook connection "Avenue mail (automations)" (approved in chat). Flows "Avenue - Booking reminders 3-2-1 h" (every 15 min, at-most-once via `RemindersSent`) and "Avenue - Notice e-mail (sign in to view)" (BCC to active members, generic text). Both tested live to the automations@ mailbox; test rows recycled. Evidence: `docs/evidence/day7-8-emails.md`; expressions in `flows/expressions.md`.
- Not done: missed check-in alert (CHK-04), reminder catch-up rule (Q-10), guest-mailbox test.

### Added (missed entry checklist, 12 Nov)
- Fields `AvenueBookings.MissedCheckInAt/OutreachAt/OutreachBy/OutreachNote`, `AvenueFacilities.EntryGraceMinutes` (15, proposed). Flow "Avenue - Missed entry checklist" (every 5 min, one nudge per booking). Staff Check-ins screen: missed list with contact details and "Log outreach and resolve"; inner filter made delegable. Tested live (missed, checked in, cancelled, in-grace, resolve); test rows recycled. Evidence: `docs/evidence/day7-8-missed-checkin.md`.

### Added (remaining buildable scope, 12 Nov afternoon)
- Flows: new-request staff alert, booking decision e-mail, failed checklist alert (CHK-05), overdue exit checklist (CHK-06). Request flow now refuses requests that overlap an approved private event, and requests from inactive members. Hours ledger month uses Eastern time.
- Staff app: Members (deactivate cancels future bookings), Book for a member, Settings, overdue-exit follow-up, 12-tile dashboard, 10-item nav. Portal: hours used this month (38 tests).
- All paths tested live; 12 e-mails, exactly as expected. Evidence: `docs/evidence/day8-complete-build.md`.

## 2026-11-12 — booking history reliability

- Hardened the member booking-history reader (`calendar`, `extension`, `cancellation`) against malformed end dates, inverted intervals, and foreign-facility rows, including cancellation/extension records. Facility filtering is defence in depth, not an authorization boundary.
- Verified locally: `npx heft test --clean --production` passed lint, build and 44 tests, including a malformed/foreign-row regression. No tenant, guest, or direct-URL authorization test was performed for this change. Existing authoritative flow and staff permissions remain subject to the gaps in `docs/ARCHITECTURE.md`.

### Added (extra time and overlap note, 12 Nov evening)
- Extra time (BKG-08): portal "Ask for more time", flows "Extension request" and "Extension decision", staff approval and "Extend now" on the Approved screen. Overlap note to other members (BKG-04). Request flow ignores extension items. All tested live; evidence `docs/evidence/day8-extensions-overlap.md`.

### Added (membership card, 12 Nov evening)
- "My membership" on the portal Home (plan, allowance vs hours used, collection day, status), backed by `AvenueMyMembership` rows shared per member by the flow "Avenue - Membership card"; collection day (1–15) on the staff Members screen. Tested live; evidence `docs/evidence/day8-membership-card.md`.

### Added (SOP and scope audit, 12 Nov night)
- `docs/SOP_SCOPE_AUDIT.md`: as-built vs the 10 module SOPs (Draft 0.1) and the original DKD scope. 256 items audited (55 conform, 11 changed by client decision, 22 engineering proposals, 98 blocked, 27 SOP statements outdated); about 15 distinct defects/buildable gaps survived skeptic verification, led by: renewed documents still blocking bookings, staff bookings bypassing the owner-only document block, the request flow failing open for non-Active members, withdrawn notices still readable by members, and member reactivation on any edit. Read-only repo audit; no live changes.

## 2026-11-13 — SOP Draft 0.2

### Changed
- `docs/Avenue_Phase1_Complete_Module_SOPs.docx` — Draft 0.2. 373 paragraph-level updates across the front matter, SOP-01 to SOP-10 and the ambiguity register: 11 Nov call decisions D1–D10, DKD as a party (Stripe invite, servers), built behaviour described from the docs/evidence files, status lines and Mode updated, version 0.2 with a change-record line in each SOP. Labels and table structure unchanged; red/bold-red convention kept for open items and [PROPOSED] behaviour.

### Added
- `docs/Avenue_Phase1_Complete_Module_SOPs_v0.1.docx` — unchanged copy of Draft 0.1.

### Verified
- Every edit matched its original paragraph text before replacement (373/373); `document.xml` parses (xmllint); version lines read 0.2 in all ten SOPs; page 1 rendered via Quick Look.
- Not run: the docx skill's schema validator (needs Python 3.10+, only 3.9 installed) and a full-page render (LibreOffice not installed). Open the file in Word once before sharing.

### Audit-gap fixes (13 Nov, afternoon–evening)
- Schema: `OnBehalfOf`, `StaffNote`, `SupersededBy`, `UploadedBy`, `RenewalReminderAt`, `ResolvedAt/By/ResolutionNote`, `NotifiedAt`, `ChangeReason`, ledger `Note` and `Adjustment`; new lists `AvenueNoticeDrafts`, `AvenueRequiredDocTypes` (20 lists, 157 fields). Applied with `schema/reconcile.browser.js`, read back clean. Owner role Edit → Contribute; staff and owner may submit to intake lists.
- Flows edited and code-reviewed: request (active member, equipment check, superseded documents, staff `OnBehalfOf`), document submission (supersede, on-behalf), check-in (computed `AllPassed`), decision e-mail (portal link), notice e-mail (mark before send). A live test then failed at "Equipment ids" (array inputs saved as text); fixed in three flows, code view confirmed, **live re-test pending**. Renewal reminder flow built but not saved.
- Staff app regenerated and pasted: Setup screen (plans, equipment, required documents, hours adjustment), notice drafts, member reasons, failed-checklist resolve, Book via request flow, Eastern-month dashboard with overage in hours and equipment usage. App checker 0 errors.
- `apps/billing-core`: out-of-order events (paid is final; stale events recorded); 9 tests pass.
- Portal: overage line worded as an estimate. `npm run build` passes (47 tests).
- Helpers: `schema/testkit.browser.js` (tracked test rows, explicit-id cleanup).

### Documentation reorganisation (13 Nov)
- New: `CLAUDE.md`, `docs/INDEX.md`, `PROJECT_BRIEF.md`, `INTEGRATIONS.md`, `DEPLOYMENT_AND_OPERATIONS.md`, `STATUS.md`, `SOURCES.md`, `DECISIONS_AND_OPEN_QUESTIONS.md` (merges the open-questions register and the decision log).
- Renamed: `REQUIREMENTS_BASELINE.md` → `REQUIREMENTS.md`; `DATA_AND_PERMISSIONS.md` → `DATA_AND_ACCESS.md` (now leads with the as-built permissions); root `CHANGELOG.md` → `docs/CHANGELOG.md`.
- Rewritten: `AGENTS.md` (same rules, reorganised; the old "read five documents first" instruction now lives in `CLAUDE.md` as a lighter start-up). `README.md` shortened.
- Archived to `docs/archive/` (unchanged content): handoff prompt, context narrative, 2-week and 8-day plans, development and implementation plans, backlog, original open-decisions and client-questions lists, pre-merge open-questions and decision-log files.
- `REQUIREMENTS_TRACEABILITY.md` status column corrected where rows still said "Not built". Requirement C-10 added.
- Not changed: `references/original/`, SOP documents, evidence and meeting notes (only link paths).


## 2026-11-18 — staff date error

- Added blank-date guards to the local Requests conflict labels and the generated Schedule time labels so empty dates are displayed as unavailable instead of passed to `TimeZoneOffset`. Ran `python3 gen.py`, `python3 check.py` (238 controls, 8 files), and four static guard checks locally. Not applied in Power Apps Studio, published, or runtime-tested; screenshot was taken in a read-only preview.

## 2026-11-18 member 1.5.2.0
- Schedule opens on illustrated equipment cards (free / in use, 24 h strip, "Book this"); Timeline and Week stay as views. Home reduced to action tiles, one-line attention items, three upcoming bookings and category tiles. Booking steps (Choose, Pick a time, Review, Confirmed) and Schedule-to-Book equipment preselect.
- Colours moved to the Avenue brand system (teal #0F4C5C, gold #C9A24D, charcoal, slate, #F4F5F7); header uses the client's Brand Logo SVG (white wordmark on teal). Not yet verified on a phone.

## 2026-11-18 member 1.6.1.0
- Booking is now a four-step flow (What, When, Equipment/Guests, Review) with day pills, start-time slots and a free/taken equipment grid; the old drag board is no longer used by the Book tab (file kept). Verified live as the admin test member up to the equipment grid; sending and the phone view were not re-tested in this build.

## 2026-11-18 member 1.7.0.0
- Product polish: sans-serif type, white header with the teal Avenue logo, Home search bar, booking page with a sticky "Your booking" summary and equipment legend, Schedule as one full-width card grid with equipment-type tabs (fixes the empty right side).

## 2026-11-18 member 1.8.0.0
- Booking is one page: a What / Day / Start / Length bar, a day strip, start times by morning/afternoon/evening, then the equipment grid; sticky summary and Review. Layout pattern taken from Resy's venue page (layout only, Avenue colours).

## 2026-11-18 member 2.0.0.0
- Home reworked as a short landing page: hero (welcome, search bar, next-booking card), Coming up with hours, three booking types, a three-step "how it works", and a site footer on every page (links and policies; no contact details yet: UNKNOWN). Removed the stat strip, live kitchen tiles and rules block.

## 2026-11-18 member 2.1.0.0
- Home rebuilt as a landing page of distinct bands: hero with next booking, a live "right now" strip, Your week, Book by the piece (large equipment tiles), a one-booking timeline (early entry, booked time, clean-up), three facts, a closing call to action, and the footer. Replaces the over-trimmed 2.0.0.0 home.

## 2026-11-18 member 2.2.0.0
- Home top section is light: headline and booking bar on the page background, the dining-room photo as a rounded card with the next booking floating over it. The full-width dark hero block is gone. Timeline example times and wording corrected (billing wording removed: Q-06 is open).

## 2026-11-18 member 2.3.0.0 + staff Schedule calendar (staff not pasted)
- Member Schedule opens on a shared month calendar (names, equipment, times; approved bookings only; day panel). Verified live as the admin test member. Known nit: "Book equipment" appears twice on that page.
- Staff Schedule gains a Calendar mode (42 day buttons from a collection `colMonth`, selected-day list) in `gen.py`; `check.py` passes (535 controls). NOT pasted into Studio (editing lock), NOT run, formulas unverified.

## 2026-11-18 member 2.4.0.0
- Notifications: the top banner and Home ribbon show only UNREAD notices and can be dismissed or opened (both mark read); a bell in the header lists unread notices with Mark all as read; read state is shared across screens. Still per browser (localStorage); per-member read state across devices needs the AvenueNoticeReads list (plan 5.2), not built.

## 2026-11-18 member 2.5.0.0
- Bell now also carries booking updates: confirmed, declined, cancelled and extra-time answers on the member's own requests, plus document items that need them. The count goes up as they arrive (checked every minute and on tab focus); "My bookings" shows a dot. First visit sets a baseline so old history is not flooded. Per browser (localStorage). Not changed: e-mail on decisions (flow awaiting approval, not yet seen delivered).

## 2026-11-18 member 2.5.1.0
- Day strip (Book) and equipment-type tabs (Schedule) have no scrollbar; arrows at the ends scroll them when there is more.

## 2026-11-18 member 2.6.0.0
- Rest of the member rebuild: Notices lead card full width; My bookings day strip is one row with arrows; Check-in, Documents, Billing, Membership and Join get a page heading and a card; the bell closes when you change page.

## 2026-11-23 staff app + flows
- Staff app published: Reports, Events, Storage, Support, Permissions, More hub (9 cards). Six Support/Events/Storage flows built, on and tested with gaptest- rows (removed by id). Portal 2.14.0.0 not yet uploaded.
- Member portal 2.14.0.0 deployed to the tenant app catalog and live (Support, Events, Storage, Team in the profile drawer). Needed an explicit Deploy after upload.
- Member portal 2.14.1.0: Support new-thread fix (ThreadId left empty for a new conversation). Live-tested Support, Storage, Team, Event request; test rows removed.
- 2026-11-23: docs/MEMBER_PORTAL_AUDIT_AND_UI_PLAN.md — member portal functional audit, UI/notices/font/motion research and plan, responsive audit at 7 widths + code review. Plan only, nothing implemented.
- 2026-11-23: docs/END_TO_END_TEST_GUIDE.md — one complete test guide for portal 2.17.0.0, staff app, flows, host (Stripe test), sensors, UI, responsive matrix, accessibility, privacy, cleanup and results log. TEST_CHECKLIST.md and HOW_TO_TEST_DELIVERY_1.md marked superseded.
- 2026-11-23: release/testing/avenue-test-checklist.html — interactive, responsive checklist of the 129 end-to-end checks (Pass/Fail/Blocked/N/A, notes, progress, filters, search, CSV export, copy summary, dark mode; saves on the device).
- 2026-11-23: review meeting → docs/REDESIGN_AND_ADMIN_CRUD_PLAN.md (19 findings, 14 other issues, page-by-page redesign, staff CRUD matrix, onboarding pipeline, GSAP, phases ≈21 d, 10 client questions) and docs/API_CALLS.md. Plan only.

## 2026-11-23 — redesign phase 1 (2.18.0.0, built, not deployed)
- Hero on the page grid (was 79 px right of every other section); web part declares full-bleed.
- Nav: bar slims from 64 to 54 px after scrolling; avatar highlighted on account screens; phone bar Home · My bookings · Book (raised centre) · Schedule · More (opens the account menu); Notices stay under the bell.
- Every secondary screen (Check in, Documents and compliance, Billing and payments, My membership, Messages, Event request, Storage, My team) gets the same page header as the main pages: back link, eyebrow, 60 px title (36 px phone), one-line lede; repeated inner titles hidden.
- New Policies and help page (booking, cancelling, plans and payments with the open plans from AvenuePlans/the client sheet, documents, events and storage, terms and privacy pending from Flavors); linked from the footer and the account menu (replaces the 3-line "Facility policies" fold).
- Footer: brand + Message Flavors, Membership, Kitchen, Policies and help columns; year computed.
- Home: bento overview (Coming up, Hours, Balance due, Notices incl. read ones, Documents, Book something bigger); the early-entry band and "Three things" moved into Policies and help.
- New test PoliciesView.test.tsx. 368 tests pass.

## 2026-11-23 — redesign P2–P6 integrated (member portal 2.19.0.0, built, not deployed)
- Lead integration: wired Membership → Messages link; fixed the Book cart hours wording (extra time counted for this booking only, not the month's earlier overage); documents without a mirror record stay "Current" (no regression before AvenueMyDocuments exists). Full build 426 tests; GSAP Flip from gsap/dist/Flip builds in SPFx.

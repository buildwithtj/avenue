# Member portal redesign + staff admin CRUD — audit and plan

Written 23 Nov 2026 after the client review meeting. **Plan only. Nothing here is built.** Implementation starts on the developer's go.
Live versions audited: member portal **2.17.0.0**, Avenue Staff Console (published 23 Nov), flows, integration host (Stripe **test** mode).
Companion file: [API_CALLS.md](API_CALLS.md) (every call the portal makes, incl. "Send request" end to end).
Everything marked `[PROPOSED]` is an engineering idea, not a client decision. Items that need the client are in §9.

Contents
1. Review-meeting findings (each point → cause → plan)
2. Other issues found in the audit
3. Design direction (nav, type, layout, motion with GSAP)
4. Member portal — page-by-page redesign
5. Staff app — CRUD for every workflow
6. Onboarding end to end (make it visible and testable)
7. Data, flow and host changes
8. Phases, estimate, tests, release
9. Decisions and questions for the client
10. Sources

---

## 1. Review-meeting findings

| # | What the client said | What I found (evidence) | Plan |
|---|---|---|---|
| R1 | Onboarding can't be verified start to end | Portal Join is **mocked** (`MOCK_PAYMENTS = true`, `avenue/billing.ts:32`): "Pay and continue" writes browser storage only — no applicant, no member, invisible to staff. Public `/join` on the host works in test mode. Guest invite is a manual admin step the app doesn't track. | §6: an onboarding pipeline screen for staff, a working test-mode Join from the portal, visible stages, checklist per applicant |
| R2 | No CRUD for members, equipment, bookings, onboarding | Staff app can create/approve but mostly can't **edit or archive**: members (frozen screen, can't edit business name), applicants (no edit, no manual create), plans (price fields not editable), dining tables (no screen), notices (no edit), support (no edit/archive/history), checklist questions (no edit, no Wellness), documents (no upload on behalf, no unverify) | §5: full CRUD matrix, new "Member admin" screen, edits on existing screens |
| R3 | Landing page content shifted right ~60 px | Live: hero text starts at **226 px**, all other sections at **147 px** (79 px off at 1470 px width). Cause: `.hxText{justify-content:flex-end}` + `.hxInner{width:600px}` pins the hero text to the right of its column (`Site.module.scss:923-925`) instead of the page grid. Web part also isn't full-bleed (`supportsFullBleed` missing). | §4.1: hero on the same 12-column grid as the page; full-bleed web part |
| R4 | Book page: unclear what a member can see/do | Mode buttons, 14-day date grid, hours slider and equipment list have no explanation; no "how it works" | §4.2: intro strip, step labels, inline help, plan-hours meter |
| R5 | Book: "Your booking / Review request" card hidden far down | Live: with 2 items picked the **Review request** button sits **1,509 px** down (below the first screen) and is greyed until hours are set; on desktop it is the only Review button (`BookFlow.tsx:407-440`, the summary is rendered after the whole equipment grid; `.bfBar` hidden on wide) | §4.2: sticky cart column on desktop, sticky bottom bar on phone, always visible |
| R6 | Review should be a popup with an animated transition (GSAP) | Review replaces the page (`setStep('review')`, `BookFlow.tsx:221`) | §4.2: Review & send in a modal (desktop) / bottom sheet (phone), GSAP open/close |
| R7 | List the API calls behind "Send request" | Done | [API_CALLS.md](API_CALLS.md) §1 |
| R8 | My bookings: days/time and first booked day not clearly highlighted | Date strip marks only the start day with a 6 px dot; pending and approved look the same; no time; same outline as "today" (`ui-view.ts:176-181`, `Site.module.scss:1655`) | §4.3: filled booked days with start time + status colour, first/last booked day emphasised, strip scrolls to the first booked day |
| R9 | Notices: read notices must still be visible; Recent and All tabs | Read notices stay under All, but the **bell, Home ribbon and top banner show unread only**, so they seem to vanish; read state is per device (browser storage) | §4.4: Recent / All tabs, read items stay (dimmed) in the bell too, read state saved server-side |
| R10 | Notices deleted 24 h after issue | Today notices live until `ExpiresAt` (staff set) | §9 Q-R1: **conflicts with "don't invent retention"**. Proposal: default `ExpiresAt` = publish + 24 h (staff can change per notice); expired notices are hidden, not deleted, so history stays |
| R11 | My membership: little information; Netflix-style plan UI with upgrade | Shows raw plan id "demo-plan-std", allowance, collection day, e-mail; no price, rate, comparison or change path. AvenuePlans holds only the sample plan; the sheet has 8 current + 10 legacy plans | §4.5: plan hero card, usage meter, comparison cards, "Change plan" request; real plans loaded from the sheet |
| R12 | Documents and compliance: no data although the sheet has some | Portal reads only the member's own **submissions** (author = me), never AvenueMemberDocuments; required types list is empty (Q-11); sheet has dated documents for Keith's Plates only | §4.6 + §7: member-visible document mirror, required types from the sheet's 7 types, seed test data with `gaptest-` ids |
| R13 | Billing: can't see charges, invoices, extra-hour charges; use the sheet's logic | Invoices come only from Stripe (none for the test member, payments mocked); plan prices hard-coded (`payments.ts:16-27`); hours from requests, not the ledger; no line items | §4.7: billing page with next-invoice estimate (plan + extra hours × rate + 3 % card fee per sheet), ledger-based usage, invoice list with status chips, invoice detail popup |
| R14 | Page headers bigger on desktop and mobile | Secondary pages (Membership, Billing, Documents, Support…) have **no page title** at all (`LEGACY_HEAD` defined, never rendered, `AvenuePortal.tsx:70-76`) | §3.2: one page-header component with display-size titles on every page |
| R15 | Messages: attach a document/screenshot; ticket to admin | No attachment UI; categories hard-coded in 3 places (`contracts.ts:247`, list Choice, flow) | §4.8 + §5: attachments (images/PDF), ticket thread with status; admin view/edit/reply/archive/delete; admin-managed categories |
| R16 | Admin can CRUD the "About" categories | Not possible today | §5 + §7: new list **AvenueSupportCategories**, portal and flow read it |
| R17 | Complete redesign, mobile and desktop | — | §3 + §4 |
| R18 | Footer lacks policies, plan details, documentation | Footer has 3 hard-coded policy lines, quick links, "© 2026" hard-coded; no Terms, Privacy, plans, help, contact | §4.9: 4-column footer + one "Policies and help" page/URL |
| R19 | Rework the nav bar (award-site references) | Desktop: 5 links + bell + user chip; phone: bottom bar; secondary pages only in the drawer; nothing highlighted on Membership/Billing/Documents (`PARENT` map) | §3.1 |

---

## 2. Other issues found in the audit (not raised in the meeting)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| A1 | Check-in "Sent checklists" show raw ids (`staff-8154b356…`, `req-mwdpjlcd…`) instead of the booking date/time | live screenshot | Show booking date, time, equipment |
| A2 | Bookings staff make **for** a member are authored by staff → invisible in the member's My bookings, hours and alerts | `readSource.ts:648` own-items filter | Member-visible booking mirror (same pattern as membership card) or flow grants read on the member's own copy |
| A3 | Raw SharePoint error text still shown on Membership, Home, My bookings, Documents, Billing | `MembershipView.tsx:37`, `HomeView.tsx:144`, `MyBookings.tsx:227`, `DocumentsView.tsx:146` | Shared friendly error + Try again (as F4) |
| A4 | Home refetches ~8 lists every 60 s (notice poll changes its inputs); requests read 3× on load | `HomeView.tsx:141` | One shared data store per session; refresh on focus + targeted polling |
| A5 | Hours shown everywhere come from requests, not AvenueHoursLedger (credits, actual end times differ) | `booking.ts:123-129` | Read a member-visible ledger mirror |
| A6 | Notices ignore `PublishAt` and `Audience` | `readSource.ts:624` | Filter `PublishAt <= now`; audience rules → Q-R6 |
| A7 | Home example timeline hard-codes 8:30 AM while text says 9:00 AM | `HomeView.tsx:172, 283` | Compute from facility rules |
| A8 | `BookBoard.tsx` (424 lines) is dead code | only imported by a test | Delete |
| A9 | Book day picker limited to 14 days (no client rule found) | `BookFlow.tsx:223` | Q-R7 |
| A10 | Plans on the public join page and Stripe prices are hard-coded in the host (`integration-host/plans.mjs`), so a plan added in the staff app never reaches /join | staff audit | Host reads AvenuePlans (through the bridge) or a sync job |
| A11 | Docs drift: `flows/expressions.md` still says the Support/Events/Storage flows are "Specified, not built" though they are live | `expressions.md:244`, STATUS | Update the doc from the live flows' code view |
| A12 | Staff capability toggles hide nothing (nothing reads them) | staff audit | Wire into button visibility (usability only, not security) |
| A13 | Equipment categories in the staff app lack "Fridge" | `gen.py` CATS | Add |
| A14 | Footer link test during the audit opened the wrong pages, but the code maps them correctly (Documents→documents, Billing→billing, `AvenuePortal.tsx:67,389-390`) | likely my automation clicked by stale reference | **Verify by hand** in the next review |

---

## 3. Design direction

Research summary (sources §10): visible navigation beats hidden menus (NN/g); bottom bar for ≤ 5 equal destinations on phones (Material 3); Airbnb-style sticky booking card + mobile reserve bar; Stripe/Linear billing layout; Intercom/Zendesk ticket threads; GSAP for orchestrated motion.

### 3.1 Navigation `[PROPOSED]`
- **Desktop (≥ 1024 px)**: sticky top bar, compacts 64 → 52 px after 24 px scroll (stays visible). Left: Avenue · Flavors logo. Centre: **Home · Book · My bookings · Schedule · Notices** (filled pill on the active item, `aria-current`). Right: **"Book" primary button**, bell (badge), avatar → account drawer (Membership, Billing, Documents, Messages, Events, Storage, Team, Check in, Preferences, Sign out). Every secondary page highlights its parent (fix `PARENT`).
- **Tablet (600–1023)**: same bar, icons + labels, drawer as right sheet.
- **Phone (< 600)**: top bar = logo, bell, avatar. Bottom tab bar: **Home · Book (raised centre button) · My bookings · Notices · More** (More opens the account drawer as a bottom sheet). 56 px + safe area; 12 px+ labels.
- Check on the real SharePoint page (suite bar, SharePoint mobile app) before committing.

### 3.2 Type and page header
- Keep **Inter** (bundled). Scale 1.25: 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 · 61. Page titles: **49 px desktop / 31 px phone**, weight 700, −0.02 em; one `PageHeader` component (eyebrow, title, one-line lede, actions) on **every** page incl. Membership, Billing, Documents, Messages (fixes R14).
- Large numerals (40–56 px, tabular) for hours, balance, days to booking.

### 3.3 Layout
- One 12-column grid, max 1240 px (1440 px on ≥ 1600 px screens), side gutter 32 px desktop / 16 px phone; hero and all sections on the same grid (fixes R3). Web part set to full-bleed.
- **Bento Home**: next booking (large), hours meter, balance, latest notices, documents expiring, quick actions.
- Cards: one radius (16), one elevation, used only for objects (booking, invoice, plan), not for every block.

### 3.4 Motion with GSAP `[PROPOSED, needs licence OK §9]`
- **gsap 3.15.1 + @gsap/react 2.1.2** (`useGSAP`), core + **Flip**; ScrollTrigger only if needed. Standard "No Charge" licence covers commercial use; ES5 UMD builds work with the SPFx build and Jest. Size ≈ 28.5 KB + 9.7 KB gzipped.
- Patterns and timings:
  - Review modal / bottom sheet: scale .96→1 + fade, sheet slides up; 220 ms open (`power2.out`), 160 ms close (timeline reversed, unmount on complete).
  - Page change: fade + 8 px rise, 200 ms.
  - Lists: stagger 0.03 s, max 12 items, first load only.
  - Cart add/remove and filter reflow: **Flip**.
  - Counters (hours, balance): count-up 600 ms.
  - Toasts: slide + fade; bell dropdown: scale from the bell.
  - Scroll reveal: IntersectionObserver + CSS (cheap); ScrollTrigger only for the Home hero.
- All animations inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`; reduced motion = instant or ≤ 100 ms fades. Content visible without JS animation (no opacity-0 waiting).
- Replace the current CSS motion where GSAP is used; keep CSS for hover/focus.

---

## 4. Member portal — page by page

### 4.1 Home
Hero aligned to the grid (R3), shorter (≤ 60 % of the first screen on desktop, 220 px image on phone). Bento below: Next booking card (countdown, View/Check in), Hours meter (used/plan, extra-hour cost so far), Balance due, Latest notices (2 rows, Recent), Documents status, Quick actions (Book, Message Flavors). Remove the duplicated "Three things" section (move to footer/policies).

### 4.2 Book (R4, R5, R6)
- **Intro strip**: "Pick a day, your hours and the equipment. Flavors confirms every request; nothing is charged now." + link "How booking works".
- **Desktop 3 columns**: left (date, hours) · centre (equipment by category with availability bars) · right **sticky "Your booking" cart**: each item (remove ×), date + time, hours, **"Uses 4.5 of your 10 plan hours"**, extra hours × rate estimate, primary **Review request** (enabled as soon as hours + 1 item are set; if not, says what is missing).
- **Phone**: sticky bottom bar "2 items · 3 h · Review" above the tab bar; tap opens the cart sheet.
- **Review & send modal / sheet** (GSAP): items grouped with Edit/Remove, date/time, plan-hours usage, estimate wording ("billed with your next payment" — only what the sheet says), cancellation policy link, **Send request** + Back. After send: "Request sent — Flavors will confirm" with a live status that updates from the Outcome (pending → approved/declined). The page stays; "Confirmed" step chip removed.
- Calls stay the same (see API_CALLS §1); no new endpoint.

### 4.3 My bookings (R8)
Date strip: booked days **filled**, start time under the date, colour by status (Waiting amber, Approved teal, Cancelled grey), today outlined, **first booked day** labelled "Next" and the strip opens scrolled to it; past view covers past days. List grouped by day with time block (large start time, end, duration), equipment chips, status chip, actions (Details, Check in, Extend, Cancel).

### 4.4 Notices (R9, R10)
Tabs **Recent** (last 7 days) and **All**; read items stay visible (dimmed) everywhere, incl. bell ("Earlier" section). "Expires in 5 h" label when an expiry is near. Read state saved server-side `[PROPOSED]` new own-items list **AvenueNoticeReads** (NoticeId) so it follows the member across devices. Filter `PublishAt <= now`. Default expiry rule per Q-R1.

### 4.5 My membership (R11)
- Header: business name, status chip, member since.
- **Current plan card**: plan name (from AvenuePlans Title, not the id), $/month (+3 % card fee note per sheet), hours/month, extra-hour rate, next collection date.
- **Usage meter**: "6 of 10 h used · resets 1 Dec", amber ≥ 80 %, red over plan with "$X extra so far" (hours × rate).
- **Compare plans**: cards for current-group plans (Emerging 10/20/40/80 or Mobile Kitchen 10/20/40/80) from AvenuePlans; current marked; "Recommended" by usage `[PROPOSED]`.
- **Change plan**: confirm sheet showing old vs new; **sends a plan-change request to staff** (new host-request kind or support ticket category "Plan change"), no automatic charge — timing/proration is Q-R2. Legacy plans: shown as current only, not offered.

### 4.6 Documents and compliance (R12) — frozen screen, token changes allowed
- Read the member's documents from a member-visible mirror of **AvenueMemberDocuments** (incl. staff-uploaded ones).
- Required list = the sheet's 7 types with status (Current / Expiring 30-15-10 days / Expired / Missing) and upload button per type.
- **Needs the developer to unfreeze `DocumentsView.tsx` / `ComplianceWizard.tsx`** beyond tokens (§9 Q-R8).

### 4.7 Billing and payments (R13) — frozen screen, needs unfreeze
- Past-due banner (PaymentStatus).
- **Next payment card**: plan price + extra hours (ledger hours over plan × the plan's extra rate) + 3 % electronic-payment fee (sheet) = estimate; collection date; "estimate until the invoice is issued".
- **Charges this month**: line items (plan, each extra-hour block with date, event/storage charges once invoiced).
- **Invoices**: list with number, period, amount, status chip (Paid / Open / Past due / Void); click → **invoice detail popup** (line items, paid date, receipt/hosted invoice link).
- Payment method card → Stripe portal (works once payments are on; shows "switched off in test" today).
- Data: AvenueInvoices (Stripe mirror), member-visible ledger mirror, AvenuePlans rates from the sheet.

### 4.8 Messages with Flavors (R15)
- New ticket: Category (from AvenueSupportCategories), Subject, Message, **attachments** (images, PDF; `[PROPOSED]` up to 5 files × 10 MB, checked in the portal **and** the flow), optional related booking.
- Thread view: status chip (Open / Answered / Closed), member and staff messages, attachments as thumbnails.
- Upload uses the same 3-step pattern as documents (item → attachment → clear Outcome); flow copies files to a private library linked to the case.

### 4.9 Footer (R18)
Four columns: **Flavors Culinary Hub** (address, hours, phone, e-mail — values from the client) · **Membership** (Plans, Billing, Booking rules, Cancellation policy) · **Help** (Messages with Flavors, FAQ, Documents guide) · **Legal** (Terms, Privacy, Accessibility, "Operated by B Street HQ"). All policy links point to **one "Policies and help" page** (a SharePoint page or a portal tab) — content must come from the client (Q-R4). Copyright year computed.

### 4.10 Other pages
Schedule: keep (client said OK), apply tokens/header. Check in: booking date/time instead of ids (A1). Events, Storage, Team: page header, card list, animated success.

---

## 5. Staff app — CRUD for every workflow

Rules: never hard-delete members, bookings, ledger, documents, check-ins, invoices → **archive/deactivate**; hard delete only for drafts and never-used config, owner only. Every write `IfError` + who/when. Frozen screens (members, compliance, payments) untouched → new screen **Screen23 "Member admin"** (tabs) unless the developer unfreezes them.

| Entity | Today | Add | Where |
|---|---|---|---|
| Members | add (Active!), edit status/plan/day, deactivate | edit business name, plan from dropdown of Active plans, search, view Stripe/payment status; new members start **Onboarding**; status change needs a reason | Screen23 · Members |
| Applicants (onboarding) | approve, mark invited, reject | edit contact/plan/day, **new application** (Source "Staff"), re-open, documents N of M, invite checklist (invite sent / accepted / group added) | Applicants screen |
| Plans | add, edit hours/rate, deactivate | price, card price, group, open-to-new, show inactive + reactivate; load the sheet's 18 plans | Setup · Plans |
| Equipment | full | "Fridge" category; inactive units hidden from Book | Setup · Equipment |
| Dining tables | none | add/edit/deactivate | Setup · new tab |
| Bookings | create on behalf, approve/decline, cancel, no-show, extend | **Change booking** = cancel + rebook prefilled (keeps calendar/ledger correct); filter by member/date; view history | Bookings / Approved |
| Hours ledger | adjustment | per-member ledger view | Screen23 · Ledger |
| Documents | verify | **upload on a member's behalf** (form with attachment → document flow), unverify, correct dates, mark superseded | Screen23 · Documents |
| Required doc types | add 4 of 11 types, deactivate | all 11 types; load the sheet's 7 | Setup |
| Checklist questions | add, remove (Entry/Exit) | edit text/order, **Wellness** kind | Checklist |
| Notices | publish, draft, withdraw | **edit** draft, edit published (withdraw → edit → republish), set expiry | Notices |
| Support | reply, close (last message only) | **full thread view with attachments**, edit category/status, reopen, **archive**, owner delete (flow removes case + member thread), category filter | Support |
| Support categories (new) | — | **CRUD** (title, order, active; delete only if unused) | Setup · Support topics |
| Events / Storage | approve/decline | edit quote/amount, reopen before invoiced | Events / Storage |
| Team members | — | read-only view per member (optional) | Screen23 |
| Invoices | read | read (Stripe owns them) | Payments (frozen) |
| Staff capabilities | edit | wire into button visibility (not security) | Permissions |

Power Apps limits to respect: bare `AddColumns` names; no text `<`; `Patch` with `LookUp` record; no OR inside `Filter` (use `If`); attachments only through an EditForm; delegation (filter by FacilityId/MemberId first); new lists added as data sources; frozen yaml byte-identical; paste by hand, `check.py` must pass.

---

## 6. Onboarding end to end (R1)

| Stage | Today | Plan |
|---|---|---|
| Apply | Public `/join` (host) works in test mode; portal Join mocked | Portal Join posts the real `Join` host request in test mode (payment skipped while `PAYMENTS_REQUIRED=0`); applicant appears for staff immediately |
| Pay | Skipped in test mode | Unchanged until STR-06 |
| Invite (guest) | Manual admin step, untracked | Staff checklist on the applicant: invite sent / accepted / added to Members group (manual, recorded) — automatic invite needs Q-M3 |
| Documents | Member uploads; staff can't upload for them; onboarding members missing from "missing documents" | Staff upload on behalf; missing-docs view includes Onboarding |
| Approve | `appApprove`, no document check | Shows documents N of M; block-on-documents = Q-05/Q-11 |
| Active | Member card flow grants access | Unchanged; staff see each stage in one **Onboarding pipeline** view (columns: Applied → Paid/Skipped → Invited → Documents → Approved → Active) |
A test script for the whole pipeline goes into the checklist (new section).

---

## 7. Data, flow and host changes

| Change | Type | Notes |
|---|---|---|
| **AvenueSupportCategories** (FacilityId, Title, SortOrder, Active) | new list | members read, owner/staff edit; seed the current 5 |
| Support `Category` Choice → Text (messages + cases) | schema | test on a `gaptest-` list first (conversion behaviour UNKNOWN) |
| Support flow: validate category against the new list; copy attachments to a private library | flow edit | re-read live code view first (A11) |
| **AvenueNoticeReads** (NoticeId) own-items | new list | cross-device read state |
| Member-visible mirrors: documents, ledger hours, staff-made bookings | new item-granted lists + flows | same pattern as AvenueMyMembership |
| AvenuePlans: load the sheet's 8 current + 10 legacy plans with price, rate, group, open-to-new | data | `demo-plan-std` stays for the test member |
| AvenueRequiredDocTypes: the sheet's 7 types, warnings 30/15/10 | data | Q-11 still open on enforcement |
| Plan-change request (host kind `ChangePlan` or support category) | flow/host | no Stripe change until Q-R2 + STR-06 |
| Host reads plans from SharePoint instead of `plans.mjs` | host | A10 |
| Notices default expiry | flow/staff app | per Q-R1 |
| Test data with `gaptest-` ids for the test member (document, invoice, ledger rows) | seed | removed by id after testing |

---

## 8. Phases, estimate, tests, release

| Phase | Content | Estimate |
|---|---|---|
| P0 | Decisions §9; GSAP licence OK; unfreeze decision; design tokens update (type scale, page header, grid, full-bleed) | ½ d + client time |
| P1 | Nav bar + page header + footer + Home (R3, R14, R18, R19) — **built 23 Nov (2.18.0.0), not deployed** | 2 d |
| P2 | Book redesign: sticky cart, review modal/sheet, GSAP (R4-R6) | 2½ d |
| P3 | My bookings strip, Notices tabs + read state (R8-R10) | 1½ d |
| P4 | Membership plans page + plan-change request; Billing redesign (R11, R13) | 3 d |
| P5 | Documents data + mirror flows; Check-in labels (R12, A1, A2, A5) | 2 d |
| P6 | Messages with attachments + categories list (R15, R16) | 2 d |
| P7 | Staff app CRUD: Screen23, applicants, plans, dining tables, documents on behalf, notices edit, support thread/archive/categories, checklist Wellness (R2, R16) | 4 d |
| P8 | Onboarding pipeline + real test-mode Join from the portal (R1) | 2 d |
| P9 | Responsive + accessibility pass (probe at 320-2560 px, keyboard, reduced motion), checklist update, release | 1½ d |
| Status 23 Nov | P1–P8 built (portal 2.19.0.0 + staff/schema/specs locally); P9 responsive pass done in debug preview; nothing deployed |  |
| **Total** | | **≈ 21 working days** (one developer), plus client answers |

Each phase: `npm run build` (lint + tests), staff `gen.py` + `check.py`, frozen files byte-identical, live debug preview at phone/desktop, version bump, upload **and Deploy** in the app catalog, hard reload, update the test checklist, STATUS and CHANGELOG. Test rows use `gaptest-` ids and are removed by id.

---

## 9. Decisions and questions (needed before or during build)

| ID | Question | Why |
|---|---|---|
| Q-R1 | Notices "deleted 24 h after issue": hide after 24 h by default (staff can set longer per notice) and **keep** the record, or truly delete? Do maintenance/urgent notices also expire in 24 h? | Retention can't be invented |
| Q-R2 | Plan change: does an upgrade start now (prorated) or at the next collection date? Downgrade at next date? Who approves? | Billing rules (Q-06) |
| Q-R3 | Attachment limits for tickets: types and size (proposal images + PDF, 5 × 10 MB); how long are they kept? | Storage, retention |
| Q-R4 | Policy and help content: Terms, Privacy, booking rules, cancellation, plan details, facility address/phone/e-mail — will the client provide text, or one URL? | Footer/policies page |
| Q-R5 | Can admins **delete** support messages permanently, or archive only? | History, retention |
| Q-R6 | Notice audience (all members vs targeted): is targeting needed now? | A6 |
| Q-R7 | How far ahead may members book (today 14 days)? | A9 |
| Q-R8 | Unfreeze Documents/Compliance, Billing and Join/Onboarding screens for layout changes (not only tokens)? | R12, R13, R1 |
| Q-R9 | Approve GSAP (Standard "No Charge" licence) as a dependency | Licence |
| Q-R10 | Load the sheet's 18 plans and Keith's Plates documents into the live lists now? (real data) | Real data on the real site |
Existing open questions that block parts of this: STR-06/Q-02 (real payments), Q-05, Q-06, Q-10, Q-11, Q-13, Q-14, Q-M3.

---

## 10. Sources
- NN/g hidden navigation: https://www.nngroup.com/articles/hamburger-menus/ · https://www.nngroup.com/articles/find-navigation-desktop-not-hamburger/ · https://www.nngroup.com/articles/find-navigation-mobile-even-hamburger/
- Material bottom navigation: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- Netflix plan change timing: https://help.netflix.com/en/node/22
- Stripe prorations and invoice preview: https://docs.stripe.com/billing/subscriptions/prorations · https://docs.stripe.com/invoicing/preview · https://docs.stripe.com/customer-management
- Zendesk attachment limits: https://support.zendesk.com/hc/en-us/articles/4408832757146
- GSAP licence and React: https://gsap.com/standard-license/ · https://webflow.com/blog/gsap-becomes-free · https://gsap.com/resources/React/ · https://gsap.com/docs/v3/GSAP/gsap.matchMedia()
- Motion bundle size: https://motion.dev/docs/react-reduce-bundle-size
- Shared-kitchen software: https://thefoodcorridor.com/ · https://www.spacebring.com/solutions/shared-kitchen-management-software
- References for the client: https://linear.app · https://stripe.com · https://vercel.com · https://www.airbnb.com · https://resy.com · https://godly.website · https://www.awwwards.com/websites/ · https://www.saasframe.io/industries/scheduling
- Client data: [CLIENT_SHEET_BOOKING_DATA.md](CLIENT_SHEET_BOOKING_DATA.md) (plans, rates, 3 % fee, documents, events, storage)

## Member console visual reference (developer, 23 Nov 2026)
Reference given: https://culina-6aq5t41f5-amans-projects-c83914af.vercel.app/ (sidebar nav with workspace switcher, greeting header with primary action, KPI cards, bento grid, occupancy card, top-tenants list). **Take the look and layout only. Do NOT use its calendar / "Today's schedule" component** (developer instruction): Avenue keeps its own Schedule and My bookings views. Not started; needs scoping against the frozen screens and the 2.19 nav before any build.

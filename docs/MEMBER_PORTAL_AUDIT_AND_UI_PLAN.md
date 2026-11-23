# Member portal: audit and implementation plan (UI, motion, type, notices, responsive)

Written 23 Nov 2026. **Progress (23 Nov):** phases 0–1 LIVE (2.15.0.0). Phases 2–5 and F2–F4 LIVE as 2.16.0.0 (checked in the live debug preview, then deployed and confirmed). Phase 3 uses CSS + tokens (the documented fallback), not the `motion` library; phase 5 uses the portal's measured width, not CSS container queries (fixed bars). F1 LIVE (booking flow refuses PastDue/Unpaid, tested). Open: F5 (needs guest accounts), F6 (needs approval to save a flow that e-mails members).
Live portal audited: member-spfx **2.14.1.0** (tenant app catalog), signed in as TDDAdmin (an owner account, not a real member guest).
Everything marked `[PROPOSED]` is an engineering idea, not a client decision.

Contents
1. Summary
2. Functional audit: what is left in Phase 1 for members
3. UI audit: what is wrong today (with evidence)
4. Research: notices, fonts, motion, toasts (with sources)
5. Implementation plan (phased, file by file, with acceptance checks)
6. Responsive: live audit at 7 widths, code review, and plan
7. Frozen modules, risks, unknowns
8. Test and release plan

---

## 1. Summary

| Area | Finding | Plan |
|---|---|---|
| Functional | Screens for every member module are live. But **payments are switched off in the portal on purpose** (`MOCK_PAYMENTS = true`, `src/avenue/billing.ts:32`, waiting for STR-06). Join's "Pay and continue" only sets a browser flag (no applicant record, no Stripe page). Four member items can be built without the client: overdue-balance booking refusal (BKG-14), deactivated-member screen, event date-clash check, Support error/retry. | §2, phase F |
| Notices | One notice is drawn as a full-width "lined paper" letter (`ntSlip`), ~280 px tall for 3 lines of text. | Dense notification list (72 px rows), grouped, filtered, detail in the existing drawer. Phase 2 |
| Font | Not the font itself: our CSS squeezes Archivo to **72–92 % width** (`font-stretch`, `$cond: 78%`) on headings, numbers, buttons and tabs → tall, narrow, low "volume". Archivo file is 90 KB. | Inter Variable (48 KB, OFL), bundled the same way; delete every `font-stretch`. Phase 1 |
| Motion | Only a CSS fade-and-rise on a few lists. Scroll reveals use `animation-timeline: view()` (newest browsers only). No page transitions. Toasts have an entrance but **no exit** (removed from state after 3.2 s). Bell pop-up and drawer open instantly. | Motion library (`motion`, LazyMotion + `m`, ~29 KB) with one motion token set; page, list, scroll, toast, sheet, popover animations; reduced-motion respected. Phase 3 |
| Responsive | No horizontal overflow at 320–2560 px. But: JS layout breakpoints (720/1100 container) and CSS breakpoints (480/600/640/899/960/1200 viewport) disagree; **17 rules below 12 px**; 46 `:hover` rules not guarded for touch; tablet 768–1099 keeps the desktop top bar with 11 px labels; TV (1920/2560) is a 1240 px island; touch targets under 44 px on Book/My bookings date strips (36–52 per page). | One breakpoint system on the container, fluid type scale, touch rules, TV scale. §6 |

---

## 2. Functional audit (Phase 1, member-facing)

Method: every member-facing requirement in `docs/REQUIREMENTS.md` checked against the code (`apps/member-spfx/src`), `flows/expressions.md`, `docs/STATUS.md` and the 12 Nov / 23 Nov live tests. "Live" = tested on the real site by an owner account; **nothing has been tested as a real member guest**.

### 2.1 Status table

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PLT-03 | Members use SPFx pages | Live | 2.14.1.0 deployed |
| PLT-04 | Works in a phone browser | Built, not verified on a phone | §6 below (simulated widths only) |
| PLT-06 | Members sign in as B2B guests | Built, not verified | no guest account test |
| PLT-08 / PLT-13 | Own items only; checks at the data | Built, not verified | two-member isolation test never run |
| ONB-01/02 | Business details, plan, collection day | **Partial**: wizard live, submit mocked | `JoinView.tsx:71`, `AvenuePortal.tsx:211-216` |
| ONB-03 | Pay before onboarding | **Partial**: host works in Stripe test mode; portal mocked | blocked STR-06, Q-06, Q-M1, Q-M5 |
| ONB-05 | Existing members for January | Partial: import is dry-run only | Q-21, Q-25 |
| ONB-06 | Staff approve new member | Built, not clicked on a real case | Q-05 default |
| ONB-07 | Guest access on acceptance | Not built (manual admin invite) | Q-M3 (tenant admin) |
| BKG-01..04, 07, 08, 13, 15 | Book, calendar, pending, overlap, e-mail, extend, hours, document hold | Live | 12 Nov / 21 Nov tests |
| BKG-09 | Cancel rules | Live (12 Nov); "Cancel, keep hours" ledger effect (21 Nov) unverified | `booking.ts:105` |
| BKG-11 | Dining/event refunds | Not built | Q-08 |
| BKG-12 | No-shows credited | Partial (status only) | Q-09 |
| **BKG-14** | **Overdue balance blocks booking** | **Partial: banner only; booking flow has no PaymentStatus refusal** | buildable now with the documented default |
| BKG-16/17 | Dining room, private event | Event request live (23 Nov); no date-clash check; invoicing by staff | Q-22 |
| CHK-01/02 | Entry/exit, lead + team wellness | Screen live; real check-in not run; live lists hold 1 Entry, 3 Exit, **0 Wellness** questions | Q-10, Q-M6 |
| CHK-03/04 | Reminders, missed flag | Live (12 Nov) | |
| CHK-05/06 | Fail alert, exit/extension | Built, not verified; `StaffAlertEmail` empty | Q-10 |
| CMP-01/02 | Upload with dates, status | Built, not verified end to end | Q-11 |
| CMP-03 | Renewal reminders | **Partial: reminder flow never saved** (e-mails members → needs developer OK) | `flows/expressions.md:232` |
| PAY-01/02/03/07 | Stripe invoices, overage, history, methods | Partial: list renders live; paying and payment-method change mocked | STR-06, Q-02, Q-06, Q-M1 |
| COM-01/02 | Notices + generic e-mail | Live | UI rebuild in phase 2 |
| ADM-03 | Support | Live (23 Nov, after the 2.14.1.0 fix) | Q-13 reply-time wording |
| ADM-04 | Deactivation | Partial: bookings cancelled; a deactivated member is shown **Join** again | see F2 |
| Q-25 / CHK-02 | Storage, My team | Live (23 Nov) | prices Q-25 |

### 2.2 Left to build that needs no client answer (phase F)
- **F1 BKG-14 refusal** `[PROPOSED default already in CLIENT_REVIEW_DEFAULTS]`: booking-request flow refuses when the member's `PaymentStatus` is PastDue/Unpaid ("Payment overdue — contact Flavors"), owner `OnBehalfOf` bypass. Files: `flows/expressions.md` (spec), Power Automate "Booking request" flow. Check: test member set PastDue → request refused with that Outcome; set Current → accepted. Rows `gaptest-` removed by id.
- **F2 Deactivated member screen**: today `AvenuePortal.tsx:208` shows Join when the membership card is gone. Show "Your membership is inactive — contact Flavors" instead (read `AvenueMembers.Status` for the author; no Join). Files: `AvenuePortal.tsx`, `readSource.ts`, a new small `InactiveView.tsx`, tests.
- **F3 Event date check**: on the Event request form, read approved bookings for the chosen date and show "That date already has bookings; Flavors will confirm" (informational, not a block). Files: `EventsView.tsx`, `readSource.ts` (reuse calendar read).
- **F4 Read errors**: replace raw SharePoint error text in Support/Events/Storage/Team with a friendly line + "Try again" button. Files: those four views + `ui.tsx` (one shared `LoadError`).
- **F5 Live verification** (no code): two-guest isolation; one real check-in with the existing questions; one document upload; staff Approve/Decline on one applicant, event and storage case; "Cancel, keep hours" ledger; inactive-member refusal for events/storage.
- **F6 CMP-03 reminder flow**: save + test once the developer approves a flow that e-mails members (CLAUDE.md rule).

### 2.3 Needs the client (not planned for build)
STR-06/Q-02 (turn payments on), Q-M1 (card fee/methods), Q-06/Q-M5 (first payment, proration), Q-20/Q-M2 (public join), Q-05, Q-M3, Q-21/Q-25, Q-04, Q-07, Q-08/Q-22, Q-09, Q-10/Q-M6, Q-11, Q-13, Q-14, Q-17, Q-19, Q-23, Q-B21. Full wording in `docs/DECISIONS_AND_OPEN_QUESTIONS.md` and `docs/BUILD_DOUBTS.md`.

---

## 3. UI audit (live, 23 Nov 2026)

| # | Page | Problem | Evidence |
|---|---|---|---|
| U1 | Notices | One "Welcome to Avenue" notice fills a 1,176 × 280 px lined-paper card with a pin and 34 px ruled lines; with 10 notices the page is ~3,000 px. Facts row (Unread/Pinned/Latest) repeats what the tabs already count. | `NoticesView.tsx`, `.ntSlip/.ntBoard` in `Site.module.scss` |
| U2 | All | Headings, figures, tabs and buttons use Archivo at 72–92 % width → tall narrow glyphs; body text at 100 % → two widths on one screen. | `Site.module.scss:1108-1206, 1333, 1337` (`font-stretch`, `$cond: 78%`) |
| U3 | All | Font is inlined as a 90 KB base64 data URI in the 915 KB bundle. | `assets/fontData.generated.ts`, `AvenuePortal.tsx:115-121` |
| U4 | All pages | Page/tab change is an instant swap; nothing enters; scroll reveal only works on newest browsers. | `motion.ts` (`rise`, `anim`), `animation-timeline: view()` |
| U5 | Toasts | Fade in only; vanish without exit after 3.2 s; error toasts use `role="status"` (should be `alert`). | `AvenuePortal.tsx:93-108` |
| U6 | Bell pop-up, drawer, sheet | Open/close instantly (no scale/fade, no spring). Empty bell says "You are all caught up" with no icon. | Bell in `AvenuePortal.tsx`, `Sheet.tsx` |
| U7 | Book | Equipment names truncated ("Gas Stove w/Under O…", "Convection Oven (Up…") at every width; 25–30 texts under 12 px (day letters 10 px). | probe: 5 truncated, 25–30 under 12 px |
| U8 | My bookings | 30-day strip = 36–42 targets under 44 px; status stamps ("CANCELLED", "CREDITED") look like rubber stamps, inconsistent with chips elsewhere. | probe + screenshot |
| U9 | Home | Long static stack: hero, "Kitchen right now", "Coming up", a dark band, "Three things worth knowing", footer — no hierarchy change while scrolling; hero image is 50 % of the screen on desktop and 33 % on phone. | screenshots |
| U10 | Billing, Documents | Single 780 px column left inside a 1240 px container; empty right side on desktop/TV. | screenshot at 1920 |
| U11 | Global | Mixed decorative motifs (grid paper background, gold rules, ruled paper, stamps) compete; no single elevation/radius scale. | screenshots |

---

## 4. Research (sources)

### 4.1 Notification list pattern
Common anatomy across GitHub inbox, Linear inbox, Microsoft Teams activity feed, Material 3 lists and Apple HIG:
- Dense rows, unread dot, leading type icon, one-line title + one/two-line preview, relative time on the right, grouping by time, an All/Unread filter, the detail in a side pane, "mark all read".
- Sources: GitHub notifications inbox — docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox ; Linear inbox — linear.app/docs/inbox ; Teams activity feed — learn.microsoft.com/en-us/microsoftteams/platform/concepts/design/activity-feed-notifications ; Material 3 list tokens (56/72/88 px rows, 40 px avatar, 16 px padding) — github.com/material-components/material-web tokens `_md-comp-list.scss` ; Apple HIG notifications — developer.apple.com/design/human-interface-guidelines/notifications.

### 4.2 Fonts (measured from Fontsource 5.3.0 Latin variable files)
| Font | x-height/em | avg lowercase width | tabular figures | woff2 Latin | licence |
|---|---|---|---|---|---|
| **Inter** | **0.546** | 0.536 | yes | 48 KB (wght) | OFL 1.1 |
| Geist | 0.530 | 0.534 | yes | 29 KB | OFL 1.1 |
| Plus Jakarta Sans | 0.536 | 0.540 | yes | 27 KB | OFL 1.1 |
| Manrope | 0.540 | 0.503 | yes | 25 KB | OFL 1.1 |
| Figtree | 0.500 | 0.499 | yes | 20 KB | OFL 1.1 |
| Archivo (now) | 0.526 | 0.520 at 100 %, ~0.41 at our 78 % | yes | 90 KB | OFL 1.1 |
- Microsoft fonts (Aptos, Segoe UI Variable) may not be self-hosted or converted to WOFF2 (learn.microsoft.com/typography/fonts/font-faq) → system fallback only.
- SharePoint CSP is documented for scripts (learn.microsoft.com/sharepoint/dev/spfx/content-securty-policy-trusted-script-sources); fonts/styles from Google are **UNKNOWN** → keep bundling (existing `gen_font.py` pipeline).
- **Choice: Inter Variable** (largest x-height = the direct fix for "tall", tabular figures for times/money, 42 KB smaller than today). Alternative if size matters most: Geist.

### 4.3 Motion
| Option | Size | Verdict |
|---|---|---|
| **`motion` 14.x (formerly Framer Motion)**, `LazyMotion` + `m` + `domAnimation` | ~5 KB + 24 KB (motion.dev/docs/react-reduce-bundle-size) | **Choose.** MIT, React 18, CommonJS build (works with SPFx webpack + Jest — must be proven by `npm run build`), `AnimatePresence` exit animations, `layout`, `whileInView`, `MotionConfig reducedMotion="user"` (motion.dev/docs/react-accessibility) |
| react-spring 10 | larger | exits awkward |
| AutoAnimate | small | ESM-only → Jest risk; skip |
| View Transitions API | 0 KB | Baseline Oct 2025 (web.dev) but captures the whole SharePoint page; only for tab swaps as an enhancement |
| Fluent motion | — | Fluent v9 only; app is v8; skip |
- Tokens: Fluent 2 durations/curves (github.com/microsoft/fluentui `packages/tokens/src/global/durations.ts`, `curves.ts`); Material 3 motion (`_md-sys-motion.scss`).
  Enter `cubic-bezier(.05,.7,.1,1)`, exit `(.3,0,.8,.15)`, standard `(.2,0,0,1)`; durations 100–150 ms micro, 200 ms small, 250–300 ms medium, 400 ms panels, never > 500 ms.

### 4.4 Toasts
Sonner (~14 KB gzip), react-hot-toast 2.6 (4.7 KB gzip; blog.logrocket.com/react-toast-libraries-compared-2026). **Choice: keep the hand-rolled Toaster and animate it with Motion** (0 KB extra); react-hot-toast only if it grows features.

---

## 5. Implementation plan

Order matters: tokens first, then the font (touches every page), then notices, then motion, then responsive polish, then page-by-page passes. Each phase ends with `npm run build` (lint + all tests + package), a debug preview on the real site (`npm start` + debug URL in CLAUDE.md), and a version bump. Never build while `npm start` runs.

### Phase 0 — Foundations (½ day)
- **0.1 Design tokens** in `Site.module.scss` top: `--av-font`, type scale (fluid `clamp()`: 12/14/16/18/20/24/32/44/60), spacing 4-pt scale, radius (6/10/16/24), elevation (3 levels), motion tokens (`--av-ease-enter`, `--av-ease-exit`, `--av-ease-std`, `--av-d-1..4` = 120/200/300/400 ms). One place, used everywhere.
- **0.2 Lint rule** (Stylelint or a grep test in `assets.test.ts`): no `font-stretch`, no `font-size` below 12 px, every `:hover` inside `@media (hover: hover)`.
- Acceptance: build green; no visual change yet.

### Phase 1 — Typography (1 day)
- **1.1** Add `assets/fonts/inter-latin-wght.woff2` (Fontsource `@fontsource-variable/inter` 5.x, Latin subset, OFL file copied next to it). Regenerate `fontData.generated.ts` with `gen_font.py`. Register as `'Avenue Sans'` in `useBrandFont` (`AvenuePortal.tsx:115-121`) with `font-weight:100 900; font-display:swap`.
- **1.2** Replace every `'Avenue Archivo'` family with `var(--av-font)`; stack: `'Avenue Sans','Segoe UI Variable Text','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif`.
- **1.3** Delete all `font-stretch` rules and `$cond`; `$mono` becomes the same family with `font-variant-numeric: tabular-nums` (times, money, hours).
- **1.4** Type roles: Display 44–60/700/-0.025em (hero only), H1 32/700, H2 24/650, H3 18/600, Body 16/400/1.55, Small 14, Caption 12/500 (minimum). `font-feature-settings: 'cv11','ss01'` (single-storey a, open digits).
- **1.5** Remove the Archivo woff2 + licence once nothing references it (bundle −42 KB net).
- Acceptance: probe shows 0 texts under 12 px (except legal footer if any); headings measured width/height ratio up ≥ 20 %; tests updated (`assets.test.ts`), screenshots before/after in `docs/ui-evidence/`.

### Phase 2 — Notices as a notification centre (1½ days)
- **2.1 `NoticesView.tsx` rewrite** (keep data contract `readNotices`, unread logic, Mark all read):
  - Header: title "Notices", right side "Mark all read" (text button).
  - Filter bar: segmented `All · Unread (n)` + category chips `General · Maintenance · Schedule · Urgent` (horizontal scroll on phone).
  - Groups: `Pinned`, `Today`, `This week`, `Earlier` (sticky 32 px group headers, 12 px/700 caps-free label).
  - Row (`<button>` full width, min-height 72 desktop / 76 phone, padding 12×16, divider 1 px, no card, no shadow): 8 px unread dot gutter · 36 px category icon circle (tinted per category) · title 15/600 (700 unread), 1 line desktop / 2 lines phone · preview 14/400 muted, 1 line / 2-line clamp · relative time right ("2h", "Mon", "12 Nov") tabular.
  - Urgent: 3 px red left rail + red icon + "Urgent" chip; never a separate big card.
  - Click: opens `Sheet.tsx` (right drawer 480 px desktop, bottom sheet phone) with the full notice, date, category; marks read.
  - Empty: 160 px block with the existing EquipmentArt + "No notices yet".
  - Remove `.ntSlip`, `.ntBoard`, lined-paper backgrounds, pin graphic, facts row.
- **2.2 Bell pop-up** (`AvenuePortal.tsx` bell): same row component (compact 60 px), last 5, "See all notices"; unread badge with count; animated open (phase 3).
- **2.3 Home "Latest notice"** (if shown) uses the same row.
- Tests: update `Modules.test.tsx`/`ConsoleScreens.test.tsx` notice assertions; new tests for grouping (Today/This week/Earlier by facility time zone), filters, mark-read on open, urgent rail.
- Acceptance: 10 notices fit in ~800 px on desktop; keyboard: Tab to row, Enter opens sheet, Esc closes and returns focus.

### Phase 3 — Motion system (2 days)
- **3.1** Add `motion@14` (pin exact version). Wrap the portal once: `<LazyMotion features={domAnimation} strict><MotionConfig reducedMotion="user" transition={{ ease:[.2,0,0,1], duration:.2 }}>`. Prove `npm run build` + Jest work before anything else (if not: transpile via `webpack` rule `fullySpecified:false` or fall back to CSS + Web Animations API using the same tokens).
- **3.2 Page/tab transitions**: `AnimatePresence mode="wait"` keyed by tab in `AvenuePortal.tsx`: enter opacity 0→1, y 8→0, 200 ms enter-ease; exit opacity→0, 150 ms exit-ease. Scroll to top on change.
- **3.3 Lists**: staggered entrance (`staggerChildren .03`, max 10 items) for notices, bookings, equipment, invoices, threads; `layout` on rows so filter/mark-read reflow smoothly.
- **3.4 Scroll reveal**: replace `animation-timeline: view()` with `whileInView` (`viewport={{ once:true, margin:'-10% 0px' }}`), opacity + y 16, 300 ms, on Home sections and long pages.
- **3.5 Toasts**: `AnimatePresence` + `m.div layout` (enter y 16 → 0, scale .96 → 1; exit 150 ms), pause timer on hover/focus, swipe-to-dismiss on phone (`drag="x"`), `role="alert"` for errors.
- **3.6 Popovers/sheets**: bell + profile menu scale .96 → 1 + fade 150 ms from the trigger origin; `Sheet.tsx` spring `{stiffness:400, damping:40}` (x on desktop, y on phone), backdrop fade 200 ms, drag-to-close on phone bottom sheet.
- **3.7 Micro-interactions**: buttons `whileTap={{ scale:.97 }}`; cards hover lift y −2 px (hover devices only); count-up stays (`useCountUp`); skeleton shimmer 1.2 s (off under reduced motion); booking "Confirmed" step: check-mark draw (SVG pathLength 0 → 1, 400 ms).
- **3.8 Home**: hero text stagger (eyebrow → title → lede → CTA, 60 ms apart), image subtle scale 1.04 → 1 on load (600 ms), "Kitchen right now" counters count up, sections reveal on scroll; dark band parallax only on hover-capable wide screens.
- Rules: max 500 ms; only `transform`/`opacity`; no motion on first paint of data tables; everything off under `prefers-reduced-motion` (fades only).
- Tests: `motion.test.tsx` extended (reduced-motion → no transforms); jsdom has no matchMedia → final state immediately (existing helper behaviour).
- Bundle budget: +30 KB gzip max; measure `ClientSideAssets/*.js` before/after.

### Phase 4 — Page-by-page polish (2 days)
- **Home**: shorter hero (image 40 % desktop, 200 px phone), "Next booking" as a card with count-down, Kitchen-right-now as compact stat tiles, merge "Three things" into a slim info row; one dark band max.
- **Book**: equipment names wrap to 2 lines instead of truncating (or tooltip + full name on focus); day chips ≥ 44 px; sticky "Review request" bar keeps safe-area inset.
- **My bookings**: date strip chips 44 × 52 min, scroll-snap; status as chips (same component as notices categories), not stamps.
- **Schedule**: month grid cells keep 44 px min; day panel becomes a bottom sheet on phone.
- **Billing / Documents / Membership** (**frozen — see §7**): token-level changes only (allowed 23 Nov); no component or layout edits; two-column layout on ≥ 1100 px is `[PROPOSED]`.
- **Support / Events / Storage / Team**: list rows reuse the notice row component; forms in a 640 px column; success states animate.
- Global: one card style (radius 16, elevation 1, 1 px border), remove grid-paper background and rubber stamps (U11).

### Phase F — Functional items (parallel, see §2.2) (1½ days)
F1 flow change, F2 inactive screen, F3 date check, F4 error/retry, F5 live verification, F6 when approved.

### Estimate
Phase 0 ½ d · 1: 1 d · 2: 1½ d · 3: 2 d · 4: 2 d · 6 (responsive, below): 2 d · F: 1½ d · QA/release: 1 d → **about 11–12 working days** for one developer.

---

## 6. Responsive

### 6.1 How it was tested
The live portal (2.14.1.0) was loaded inside a same-origin frame at each width in the real SharePoint page (TDDAdmin), and a script measured: horizontal overflow (excluding intentional scroll rows), interactive targets smaller than 44 × 44 px, text smaller than 12 px, and truncated text. Pages: Home, Book, My bookings, Schedule, Notices, Check-in, Documents, Billing (the last three only reachable from the drawer on phones, so measured from 768 up). Not tested: real devices, iOS Safari, Android Chrome, landscape phones, TV browsers, 200 % zoom, screen readers.

### 6.2 Live results

| Width (device) | Overflow | Targets < 44 px (per page) | Text < 12 px | Truncated | Observed layout |
|---|---|---|---|---|---|
| 320 (small phone) | none | Home 7 · Book 28 · My bookings 36 · Schedule 52 · Notices 4 | Home 9 · Book 30 · My bookings 37 · Schedule 6 | Book 5 | bottom tab bar (labels 10.5 px), hero photo on top |
| 390 (phone) | none | Home 7 · Book 14 · My bookings 36 | Home 9 · Book 30 · My bookings 37 | Book 5 | same as 320 |
| 768 (tablet portrait) | none | Home 14 · Book 19 · My bookings 42 · Schedule 16 · Notices 10 | Book 25 · My bookings 32 · others 1 | 0 | **desktop top bar squeezed (11 px nav labels), no bottom bar**; Book stacks; schedule month grid fits |
| 1024 (tablet landscape / small laptop) | none | same as 768 | same | 0 | top bar, stacked layouts (wide layout starts at 1100 px container) |
| 1366 (laptop) | not run separately (between 1024 and 1920 results) | | | | |
| 1920 (desktop / 1080p TV) | none | Home 12 · Book 25 · My bookings 41 | Book 25 · My bookings 32 | Book 5 | 1240 px centred column; Billing/Documents single 780 px column, empty right |
| 2560 (QHD / TV) | none | same as 1920 | same | Book 5 | 1240 px island on 2560; body 14–16 px reads small at TV distance; hero photo stretches to the right edge while text is centred |

### 6.3 Code review (`Site.module.scss` 1,575 lines, `AvenuePortal.module.scss` 789 lines, `AvenuePortal.tsx`, `motion.ts`, `Sheet.tsx`, `CalendarView.tsx`)
| # | Finding | Where | Impact |
|---|---|---|---|
| R1 | **Two breakpoint systems.** JS sets `data-size` = phone < 720 px, mid 720–1099, wide ≥ 1100 from the **container** width (`useContainerLayout`, `WIDE_FROM = 1100`, `motion.ts:71`, `AvenuePortal.tsx:130-132`); CSS also uses **viewport** media queries at 480, 600, 640, 899, 960, 1200 px. Inside SharePoint the web part is narrower than the viewport (side nav, page margins), so the two disagree. | both SCSS files | layouts switch at different points; tablet gets desktop chrome |
| R2 | **No container queries** (0 `@container`); everything hangs on `data-size` attributes (56 rules) + viewport media. | SCSS | brittle; can't size components by their own width |
| R3 | **Tablet gap**: bottom tab bar only for `phone` (< 720); 720–1099 keeps the full top bar with 11 px labels. | `[data-size='phone']` rules | cramped nav at 768–1024 |
| R4 | **17 font-size declarations below 12 px** (9, 10, 10.5, 11 px): tab labels, day letters, captions. | SCSS | fails readability; iOS zooms inputs < 16 px |
| R5 | **46 `:hover` rules not inside `@media (hover:hover)`** | `Site.module.scss` 46, `AvenuePortal.module.scss` 7 | sticky hover states on touch screens |
| R6 | **Touch targets**: date chips, tab chips, segmented buttons, "Open schedule" links under 44 px. | Book, My bookings, Schedule | WCAG 2.5.8 / Apple 44 pt / Material 48 dp |
| R7 | **Fixed widths**: `.container`/`.bar` max 1240 px, `.legacy` 1040 px, sheet 480 px; only 10 `clamp()` uses. | `Site.module.scss:29,85,1359` | no scaling for TV; type doesn't scale fluidly |
| R8 | Good: `min-height: 100dvh`, `env(safe-area-inset-bottom)` on the footer above the tab bar, `ScrollRow` with ResizeObserver, reduced-motion media queries, no horizontal overflow anywhere. | | keep |
| R9 | Missing: `env(safe-area-inset-*)` on the bottom tab bar itself and on bottom sheets; `inputmode`/`font-size ≥ 16px` on phone inputs (iOS zoom); landscape-phone rules (short height); `@media (pointer: coarse)` sizing; print styles. | | |
| R10 | Truncation of equipment names at every width (fixed card width + `ellipsis`). | Book cards | names unreadable |

### 6.4 Responsive plan (Phase 5, ~2 days, after phases 0–1)
- **5.1 One breakpoint system, container-based.** Make the portal root a container (`container-type: inline-size; container-name: portal`). Define 6 container sizes and use only these:

  | Name | Container width | Targets |
  |---|---|---|
  | xs | < 360 | small phones |
  | sm | 360–599 | phones |
  | md | 600–899 | large phones landscape, small tablets |
  | lg | 900–1199 | tablets landscape, small laptops |
  | xl | 1200–1599 | laptops, desktops |
  | xxl | ≥ 1600 | large desktops, TVs |
  Replace viewport `@media (max-width …)` with `@container portal (…)`; keep `data-size` only for JS behaviour (calendar view choice, sheet side) and derive it from the same thresholds (`motion.ts` constants exported once).
- **5.2 Navigation per size**: xs–sm bottom tab bar (5 items, 12 px labels minimum, 56 px + safe-area); md bottom bar or compact top bar with icons + labels; lg+ top bar; profile drawer = bottom sheet on xs–md, right drawer on lg+.
- **5.3 Fluid type**: `font-size: clamp(min, preferred vw-or-cqi, max)` for every role (e.g. body `clamp(15px, 0.9rem + 0.2cqi, 17px)`, H1 `clamp(28px, 1.2rem + 2cqi, 44px)`); xxl multiplies the root scale by 1.125 (TV legibility at distance).
- **5.4 Layout per size**: content max 1240 px on xl, 1440 px on xxl with two/three columns (Home: main + side rail; Billing/Documents two columns, if unfrozen); grids with `repeat(auto-fill, minmax(…))` instead of fixed column counts.
- **5.5 Touch**: `@media (pointer: coarse)` → min 44 × 44 targets (chips 44 px tall, 8 px gaps); every `:hover` moved inside `@media (hover: hover)`; inputs 16 px on phones; `inputmode` on number/time fields.
- **5.6 Safe areas and viewport**: `env(safe-area-inset-*)` on tab bar, bottom sheets, toasts; `100dvh` for sheets; landscape phone rule (`@container portal (max-height…)` not possible → `@media (max-height: 500px) and (orientation: landscape)`): hide hero image, collapse header.
- **5.7 Truncation**: equipment and long names wrap to 2 lines (`-webkit-line-clamp: 2`) with full name in `title` + accessible name.
- **5.8 Images**: hero `aspect-ratio` per size (16:9 sm, 4:3 md, split layout lg+), `object-fit: cover`, `loading="lazy"` below the fold.
- **5.9 Checks (definition of done)**: the probe script (kept in `scripts/responsive-probe.js` `[PROPOSED]`) at 320, 360, 390, 430, 600, 768, 820, 1024, 1180, 1280, 1366, 1440, 1920, 2560 on every page: 0 overflow, 0 text < 12 px, 0 targets < 44 px on coarse pointers, 0 truncated names; plus real-device passes: iPhone (Safari), Android (Chrome), iPad (Safari, both orientations), Windows laptop (Edge), a 1080p and a 4K screen (Edge/Chrome at 100 % and 150 %), browser zoom 200 %.

---

## 7. Frozen modules, risks and unknowns
- **Frozen** (developer instruction): Compliance Documents (`DocumentsView.tsx`, `ComplianceWizard.tsx`), Payments/Billing (`BillingView.tsx`), Member Onboarding (Join/Welcome). A **global font and token change will change how these look** even if their code is untouched. **Decided by the developer, 23 Nov 2026: token-level changes (font, type scale, spacing, colours, radius, motion tokens) ARE allowed on the frozen screens.** Their component code, logic, wording and layout structure stay untouched; only shared tokens/stylesheet values reach them.
- Motion inside SPFx 1.24 build/Jest: **UNKNOWN until built**; fallback is CSS + Web Animations API with the same tokens.
- SharePoint CSP for fonts/styles: UNKNOWN → fonts stay bundled (no Google Fonts call).
- Bundle size: today 915 KB uncompressed; budget after changes ≤ 930 KB (Inter −42 KB, Motion +~70 KB uncompressed).
- Accessibility regressions: every animated element must keep focus order and `aria-live` semantics; reduced motion must give a usable static UI.
- Real-member testing still missing (guest accounts): visual and responsive checks were done as an owner.

## 8. Test and release plan
1. Each phase: unit tests (Jest via `npm run build`), lint, package.
2. Debug preview on the real site (`npm start`, debug URL in CLAUDE.md) at the §6.4 widths with the probe script; screenshots into `docs/ui-evidence/<phase>/`.
3. Accessibility: keyboard-only run of every page; NVDA/VoiceOver smoke test; reduced-motion on; 200 % zoom.
4. Release: bump `config/package-solution.json` version → upload to `/sites/appcatalog/AppCatalog` as the admin → **run the tenantappcatalog `Deploy` call** (upload alone leaves `CurrentVersionDeployed=false`) → hard reload in a fresh tab → confirm the page loads the new `avenue-portal-web-part_<hash>.js`.
5. Record in `docs/STATUS.md` and `docs/CHANGELOG.md`; open questions to `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.

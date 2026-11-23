# Member profile drawer: plan

Status: **built and deployed, member 2.12.1.0** (21 Nov 2026). Differences from the plan: no version row (not needed yet); "Contact Flavors" and the policy panel are a collapsible policies list only; the sheet uses a manual focus trap and `role=dialog` rather than native `<dialog>` (testable, same behaviour); the drawer always renders so full screen can be switched off even before the facility loads, and only the account summary waits for the facility time zone. Owner of the change: member portal (`apps/member-spfx`). Build starts when the developer says so.

## 1. Why
Today the name pill opens a small dropdown that mixes destinations (Documents, Billing, Check in) with switches (Full screen, Sounds, Vibration, Desktop alerts). There is no summary of the member's account. The developer asked for an Amazon-style account area: one tap on the name opens a panel that shows plan, hours and money at a glance, then every account destination, most important first.

## 2. What professional platforms do (research, 21 Nov 2026)
| Platform | Pattern worth copying |
|---|---|
| Amazon "Your Account" | Identity and security first (name, e-mail, password), then orders, payments (methods and transactions), memberships (Prime: plan and its payment), addresses, communication preferences. Destinations are labelled by the member's job, not the system's. |
| Nexudus member portal (coworking, closest to Avenue) | Profile drop-down splits **My activity** (invoices, bookings, plans) from **Profile and settings** (personal info, billing details, security). Unpaid invoices show first. Operators hide sections a site does not use. |
| Optix, Cobot (coworking) | Payment methods, view and pay invoices, past invoices, plan, bookings; security (passkeys, two-factor) under account. |
| Material Design, Chrome, GOV design systems | A modal **side sheet** opens from the edge opposite the main navigation, sits on a scrim, closes on scrim tap, swipe or Escape; behaves as a modal dialog (focus moves in, is trapped, returns to the trigger). Full-screen on phones. |

Principles taken from this: urgent state first; time and money next; destinations ordered by how often a member needs them; settings after destinations; help and sign-out last; sections hidden, not shown empty, when a module is off.

## 3. Interaction design
- **Trigger:** the existing name pill (avatar + name). `aria-haspopup="dialog"`, `aria-expanded`.
- **Surface:** a modal side sheet from the **right** edge (the main navigation is the top bar, so the right edge does not compete with it). Desktop and tablet width `min(420px, 100vw)`, full height, flush to the edge: **no floating rounded card**. Phones (< 640 px): full-screen sheet with a sticky header.
- **Scrim:** page dims to about 32% ink; clicking it closes the sheet.
- **Motion:** enter = slide from `translateX(100%)` to `0` in 280 ms (ease-out) with the scrim fading in; rows rise in with a 25 ms stagger (max 8 rows). Exit = slide out in 200 ms (ease-in). Under `prefers-reduced-motion` or `[data-motion="reduce"]`: fade only, no slide or stagger. Transform and opacity only (no layout animation).
- **Keyboard and screen reader:** native `<dialog>` with `showModal()` (falls back to `role="dialog" aria-modal="true"` plus a manual trap); focus goes to the sheet heading; Tab stays inside; Escape closes; focus returns to the name pill; page behind is inert and does not scroll. Every row is a real button or link, at least 44 px tall. Switches use `role="switch"` with `aria-checked`.
- **Closing on navigation:** choosing a destination closes the sheet, then opens that screen (the existing `setTab`), so the back button and deep links keep working.
- **Visual language:** grouped lists separated by hairline dividers and small uppercase group labels (like the rest of the portal); each row = icon, label, one-line detail, trailing value or status pill, chevron. Status colours reuse the portal tokens (ok, waiting, bad). No new fonts.

## 4. Contents, most important first (what exists today)
Order is fixed top to bottom. A row appears only if its module is in the release (`tabOn`) and its data exists; nothing is invented.

| # | Group | Row | Source today | Shows |
|---|---|---|---|---|
| 1 | Header | Avatar, name, e-mail, business, membership status pill, plan name | SharePoint user, `getMyMembership` | "Active · Emerging-10" |
| 2 | **Needs attention** (only when something does) | Booking hold | `listMyFlags` + `hasHold` | Red row: "Bookings paused", opens Documents |
| | | Expired / expiring document, documents never sent | `actionItems` (same rules as Home) | Count and the first item |
| | | Asked for more information | flag outcome `More information…` | Opens Documents |
| 3 | **At a glance** (three compact figures in one row, not cards) | Hours this month | `hoursThisMonth` + `hoursSummary` | "6 of 10 h · 4 left" or "0.5 h over" |
| | | Next payment | `monthlyCharge` + `dueInfo` (sheet prices, 3% fee) | "$824.00 · due 1 Dec" or "Price not set yet" |
| | | Balance due | billing reader | Live: "Not connected yet" (Stripe not live); demo: the amount |
| 4 | **Your account** | My membership | `MembershipView` | Plan, hours, payment day |
| | | Documents and compliance | `DocumentsView` (wizard, cases) | "5 of 7 on file", or "1 needs attention" |
| | | Billing and payments | `BillingView` | Next payment date, extra-hour estimate |
| | | My bookings (shortcut; also in the top bar) | `MyBookings` | Next booking date |
| | | Check in (only if the module is on) | `CheckInView` | — |
| 5 | **Getting started** (only until complete) | Onboarding checklist | `onboarding()` | "2 of 3 steps done" with a thin progress line |
| 6 | **Preferences** (inline switches, no page change) | Sounds, Vibration, Desktop alerts, Full screen | `readPrefs` / `setPref`, `requestAlerts`, `setFull` | On/off switches |
| 7 | **Help** | Facility and policies | footer text already in the portal (cancellation 24 h, early entry and clean-up) | Opens a short policy panel |
| | | Contact Flavors | **UNKNOWN**: no contact field exists | Hidden until Q-P1 is answered |
| 8 | Footer | Sign out | SharePoint `/_layouts/15/SignOut.aspx` | Last row, plain text button |
| | | Version | package version | Small muted text |

## 5. Later modules: where each one lands (do not build now)
| Module (requirement) | Drawer placement | Row |
|---|---|---|
| Payments live (PAY-01..03, STR-*) | At a glance + Your account | Balance due becomes real; "Invoices and receipts"; "Payment methods" (Stripe-hosted customer portal link minted by the host; needs HTTPS domain and member sign-in checks, Q-01) |
| Auto-pay / payment day change (ONB-02, Q-06) | Billing and payments | "Payment day" with a request-to-change, staff approves |
| Storage rental, private events, deposits (sheet "Plans & Rates") | Your account | "Storage" and "Events and deposits" (refund rule open, Q9) |
| Team members (Q-10) | Your account | "Team and check-in people" |
| Support (Support module, Q-13) | Help | "Messages with Flavors" with unread count |
| Login and security (Entra B2B guests) | Header | "Account security" opens Microsoft's own account page; Avenue stores no passwords |
| Data and privacy (Q-14 retention) | Help | "Your data" |
| Notifications history | Needs attention / Help | "Notifications" (today the bell in the top bar) |

## 6. Build plan (when approved)
1. `avenue/profile.ts` (pure): `profileModel(input)` returns the ordered groups and rows from membership, requests, documents, flags, required types, prefs and release modules. Unit tests for: ordering, hold first, rows hidden when a module is off, price unknown, empty membership, onboarding row disappears when complete.
2. `components/ProfileDrawer.tsx`: native dialog, motion helpers from `motion.ts` (`useReducedMotion`), lazy data load on first open (reuses `source` calls already made by Home; shows skeleton rows; each group fails on its own with an inline note, never the whole sheet).
3. `Site.module.scss`: `.pd*` block (sheet, scrim, header, glance strip, rows, switches, motion keyframes, phone breakpoint, reduced-motion overrides).
4. `AvenuePortal.tsx`: replace the dropdown (`menu` state and `MORE` buttons) with the drawer; keep footer quick links; the mobile "More" list points to the drawer.
5. Tests: component test (opens from the pill, Escape closes, focus returns, a destination closes the sheet and switches tab, a switch calls `setPref`); update `ConsoleScreens.test.tsx` mocks.
6. Check by hand in the SharePoint debug preview and then the deployed page: 1440 px, 768 px, 390 px; keyboard only; VoiceOver quick pass; reduced motion; member with a hold, with no plan price, with onboarding incomplete.
7. Version bump, deploy (tenant app catalog), CHANGELOG, STATUS.

Estimate: about half a day of build and one hour of live checks. Staff app is unaffected (members only); the figures come from the same lists staff see, so both sides stay in step.

## 7. Open questions
- **Q-P1** Facility contact for "Contact Flavors": which e-mail and phone (new `AvenueFacilities` fields `ContactEmail`, `ContactPhone` [PROPOSED])?
- **Q-P2** May a member ask to change plan or payment day from the drawer, or only through staff?
- **Q-P3** Show the plan price to members for legacy plans (fee already included) as well as current plans?
- **Q-P4** Sign-out for guest members: SharePoint sign-out ends the Microsoft session for the whole browser; acceptable?

## Sources (research)
- Amazon help: [Manage your personal information](https://digprjsurvey.amazon.com/csad/help/node/GW8M2CA96DDRRD7F), [Support options](https://digprjsurvey.amazon.co.uk/csad/help/node/GSD587LKW72HKU2V)
- Nexudus: [Members portal overview](https://learn.nexudus.com/member-portal/overview.md), [Managing invoices](https://help.nexudus.com/docs/managing-invoices-on-members-portal-5), [Account menu visibility](https://help.nexudus.com/docs/account-menu-visibility-settings), [Billing information](https://learn.nexudus.com/member-portal/profile/billing-information)
- Optix: [Billing and payments](https://www.optixapp.com/features/billing-payments/); Cobot: [Automated invoicing and payments](https://cobot.me/en/features/automated-invoicing-and-payments)
- Patterns: [Material side sheets](https://material.io/components/sheets-side), [Material navigation drawer](https://m2.material.io/components/navigation-drawer), [Chrome navigation drawer guide](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-components/navigation-drawer.md.txt), [CMS design system drawer](https://design.cms.gov/v/9.0.0/components/drawer), [GitLab drawer accessibility audit](https://gitlab.com/gitlab-org/gitlab-ui/-/issues/1191)

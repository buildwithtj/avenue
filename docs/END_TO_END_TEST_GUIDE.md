# Avenue Phase 1 — end-to-end test guide

> **Tick-box version:** open `release/testing/avenue-test-checklist.html` on a phone or laptop (Pass / Fail / Blocked / N/A, notes, progress, Export CSV). Online (private, opens on a phone): https://claude.ai/artifact/FirpyZrxzw9XkNuA8frqQ5 (uses Copy CSV instead of a download). Regenerate both from this file if the tests change.

Written 23 Nov 2026 for the live build: **member portal 2.17.0.0**, **Avenue Staff Console** (published 23 Nov, 9-card More hub), Power Automate flows (booking, notices, documents, check-in, support, events, storage, host bridge, sensors), **integration host** on AWS in **Stripe TEST mode** (`PAYMENTS_REQUIRED=0`), Swift Sensors polling.
This replaces `TEST_CHECKLIST.md` (14 Nov, staff only) and `HOW_TO_TEST_DELIVERY_1.md` (18 Nov, booking only) as the one guide to test everything. Those two stay for history.

**Rules for every tester (real site, there is no test environment)**
- Put `gaptest` in every name, note, subject or message you type, so test rows are easy to find.
- Remove test rows **one by one by their id** afterwards (section M). Never bulk delete. Never delete a member: set it Inactive.
- No real money moves. Stripe is in test mode; the portal's pay buttons are switched off on purpose (`MOCK_PAYMENTS`, waiting for client approval STR-06).
- Publishing a notice e-mails every active member. Check who is active before you publish (C5).
- Flows run every ~1 minute. Wait up to 2 minutes before calling something a failure; then check the flow's run history.
- Write each result in the log (section N): pass / fail / blocked, account used, date, screenshot for every fail.

---

## A. Before you start

### A1. Links
| What | Where |
|---|---|
| Member portal | `https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal.aspx` |
| Staff app | make.powerapps.com → Apps → **Avenue Staff Console** → Play |
| SharePoint lists (to verify) | `https://bstreethq.sharepoint.com/sites/Avenue/_layouts/15/viewlsts.aspx` |
| Flows (run history) | make.powerautomate.com → My flows (signed in as `automations@`) |
| Host health | `https://13-207-228-174.sslip.io/api/health` |
| Public join page (host, test mode) | `https://13-207-228-174.sslip.io/join` |
| Stripe sandbox dashboard | dashboard.stripe.com (test mode, B Street HQ sandbox) |

### A2. Accounts
| Role | Account | Notes |
|---|---|---|
| Member | `TDDAdmin@poweredbyavenue.com` (Tech DoubleKlick Designs) | Has a test member row (Active, plan `demo-plan-std`). It is a site admin, so some totals (hours) include everyone's rows; a real member sees only their own. |
| Staff / owner | `automations@poweredbyavenue.com` | Owns the staff app and every flow. Do **not** change its password (the flows would stop). |
| Second member | **none yet** | Needed for privacy tests (section K). A tenant admin must invite two guest accounts first. |

### A3. Browser setup
- Desktop: latest Edge or Chrome, signed in as the account above. After a new version is deployed, **hard reload once** (Ctrl/Cmd + Shift + R) — SharePoint caches the old page.
- Phone: open the portal URL in Safari (iPhone) or Chrome (Android), signed in as the member account. If you only have a desktop: developer tools → device toolbar → 390 × 844.
- To check which version you have: the page loads `avenue-portal-web-part_655fa7ea….js` for 2.17.0.0 (developer tools → Network → filter `avenue-portal`).

### A4. Before / after on the test member
Before section E (overdue) and F (inactive) note the member row's `PaymentStatus` and `Status` in `AvenueMembers`, and put them back exactly afterwards.

---

## B. Member portal — every screen

Sign in as the **member** account. Each row: do this → expect that.

### B1. Shell, navigation, notifications
| # | Do | Expect |
|---|---|---|
| B1.1 | Open the portal | SharePoint chrome hidden (full screen); top bar: Avenue · Flavors, Home, Book, My bookings, Schedule, Notices, bell, your name. Text in **Inter** ("Avenue Sans"), normal width (not tall and narrow). |
| B1.2 | Click each top tab | The page changes with a short fade/rise (not an instant jump); the tab underline moves; page scrolls to top. |
| B1.3 | Click the **bell** | A pop-up opens with a short animation; shows the latest notices with category icons and unread dots, or "You're all caught up"; "See all notices" opens Notices. Esc or click outside closes it. |
| B1.4 | Click your **name** | Profile drawer slides in: Needs attention, At a glance (hours, next payment, balance), Your account (My membership, Documents and compliance, Billing and payments, My bookings, Check in, Event request, Storage, My team), Getting started, Preferences, Help (Messages with Flavors, Facility policies), Sign out. Esc closes and focus returns to your name. |
| B1.5 | Any action that shows a toast (e.g. send a request) | Toast slides in, pauses while the mouse is over it, slides out after ~3 s. An error toast is read out by a screen reader immediately. |
| B1.6 | Preferences: Full screen off | SharePoint header comes back; switching on hides it again. |
| B1.7 | Phone (390 px) | Bottom tab bar (Home, Book, My bookings, Schedule, Notices), labels readable (≥ 12 px), no sideways scroll on any page. |

### B2. Home
| # | Do | Expect |
|---|---|---|
| B2.1 | Open Home | Greeting, headline, next booking (or "Nothing booked yet"), **Book kitchen time**; text enters in a short stagger. |
| B2.2 | Scroll down | Sections (Kitchen right now, Coming up, hours, Early entry band, Three things) fade in as they reach the screen. |
| B2.3 | Kitchen right now | Counts per equipment type; "Open schedule" opens Schedule. |
| B2.4 | Hours this month | Used / plan hours and over-plan amount match `AvenueHoursLedger` for this member. |
| B2.5 | Book something bigger → Whole kitchen / Dining room | Opens Book with that mode selected. |

### B3. Book (BKG-01..04, 13, 15, 16)
| # | Do | Expect |
|---|---|---|
| B3.1 | Equipment mode: pick a day (date chips: weekday over a large number, today outlined) | Day selected (solid); availability bars update. |
| B3.2 | Pick your hours | Your time shows on the bar; equipment cards show **Free** (green pill) or **Taken** (red pill). |
| B3.3 | Add a stove and a grill (+ buttons, 36 px) | Added; prep tables added automatically (at least 2). Long names wrap to two lines (none cut off). |
| B3.4 | Review → Send request | Notes: Flavors confirms, nothing paid now, 30 min before/after free, cancel 24 h ahead. Toast "sent"; step 3 Confirmed. |
| B3.5 | Within 2 min, My bookings | Request shows **Waiting for Flavors**; a row in `AvenueBookingRequests` then a `Pending` row in `AvenueBookings`. |
| B3.6 | Whole kitchen | All equipment chosen for the time; same flow. |
| B3.7 | Dining room, people = 12 | Request accepted; staff approve later (C2). |
| B3.8 | Private event | Opens **Event request** (B11). |
| B3.9 | Time in the past | Not offered / refused with a clear message. |
| B3.10 | Phone | Sticky bottom bar "Pick your hours / Review request" above the tab bar; date chips ≥ 44 × 52 px. |

### B4. My bookings (BKG-08, 09, 12)
| # | Do | Expect |
|---|---|---|
| B4.1 | Open | Next booking, waiting count, hours this month; date strip (scrolls sideways, today outlined); Upcoming / Past. |
| B4.2 | Tap a day with a booking | Strip jumps to that day's group. |
| B4.3 | Booking row | Time, equipment icons and names, status **chip** (Waiting, Approved, Cancelled, Credited, No-show credited) — no rotated stamps. |
| B4.4 | Details | Drawer with equipment, times, status, Outcome text. |
| B4.5 | Cancel a booking ≥ 24 h ahead | Status Cancelled; hours returned in `AvenueHoursLedger`. |
| B4.6 | Booking < 24 h ahead | Cancel not offered to the member; message to ask Flavors. |
| B4.7 | Extend an approved booking | Extension request created; staff approve; end time moves. |
| B4.8 | Check in button | Opens Check-in (B7). |

### B5. Schedule (BKG-02, PLT-08)
| # | Do | Expect |
|---|---|---|
| B5.1 | Calendar | Month grid, Eastern time; today highlighted; days with approved bookings have a bar. |
| B5.2 | Desktop: click a day | Side panel lists that day's approved bookings (names and equipment only). |
| B5.3 | Phone/tablet: tap a booked day | That day opens in the drawer (no scrolling past the grid); a hint explains it. |
| B5.4 | Equipment / Timeline / Week view | Each view loads; only Approved bookings appear; no private fields (no notes, no outcome). |
| B5.5 | Book button | Opens Book. |

### B6. Notices (COM-01)
| # | Do | Expect |
|---|---|---|
| B6.1 | Open | A compact list (≈72 px rows): unread dot, category icon, title, one-line preview, short time ("2h", "Mon", "21 Nov"). Groups: Pinned, Today, This week, Earlier. No lined paper or pin. |
| B6.2 | Filters | All · Unread (count) · General · Maintenance · Schedule · Urgent; switching reflows smoothly. |
| B6.3 | Click a row | Full notice opens in the drawer; row turns read; Esc returns focus to the row. |
| B6.4 | Mark all read | All dots go; bell badge clears. |
| B6.5 | Urgent notice (staff publishes one in C5) | Red left rail + Urgent label, still one row high. |
| B6.6 | Expired notice ("Hide after" in the past) | Not shown. |

### B7. Check-in (CHK-01..06)
| # | Do | Expect |
|---|---|---|
| B7.1 | No approved booking within 24 h | "You have no approved booking today or in the next 24 hours…" plus sent checklists. |
| B7.2 | With an approved booking starting soon (create one with staff, C1) | Entry checklist with the live questions (1 Entry, 3 Exit today — the client has not supplied the full set, **Q-10**). |
| B7.3 | Answer and send Entry | Row in `AvenueCheckInSubmissions` → `AvenueCheckIns`; "Recorded". |
| B7.4 | Wellness | Names prefilled from **My team**; 0 wellness questions exist (Q-10/Q-M6) → record as **Blocked**, not fail. |
| B7.5 | Exit checklist at the end | Recorded; missing exit is flagged by the flow (CHK-04/06). |

### B8. Documents and compliance (CMP-01..03, BKG-15) — screen is frozen; only shared fonts/spacing changed
| # | Do | Expect |
|---|---|---|
| B8.1 | Open | 7 required document types with Current / Expiring / Expired / Missing. |
| B8.2 | Upload one (a test PDF named `gaptest-permit.pdf`) with issue and expiry dates | Submission row; staff review screen shows it; status updates after review. |
| B8.3 | An expired required document | Booking requests are refused ("a required document has expired") until replaced or the owner grants an override (C4). |

### B9. Billing and payments (PAY-01..03, BKG-14) — frozen screen
| # | Do | Expect |
|---|---|---|
| B9.1 | Open | This month (hours, extra hours estimate), Next payment ("test mode until Flavors approves live payments"), payment methods text, Invoices ("All paid" or list). |
| B9.2 | Manage payment method | Shows a note (payments switched off) — **expected**, not a bug. |
| B9.3 | Overdue banner | When the member's `PaymentStatus` is PastDue (E1) the banner shows. |

### B10. My membership / Join (ONB-01..03)
| # | Do | Expect |
|---|---|---|
| B10.1 | My membership | Plan, collection day, status. |
| B10.2 | Join (only for an account without a membership row) | Wizard: plan → business details → collection day → review → "Pay and continue". In the portal this **does not** open Stripe and stores nothing (mocked) — test the real path on the host (D1). |

### B11. Event request (BKG-16/17)
| # | Do | Expect |
|---|---|---|
| B11.1 | Pick Simplicity, a date > 30 days away, 10 guests, note `gaptest` | Price: $950 for 4 h, extra hours $100, $500 refundable deposit, balance due 30 days before. |
| B11.2 | Pick a date < 30 days away | "Package balance due at once…" |
| B11.3 | Pick a date that already has bookings | Informational note that the date has bookings; Flavors confirms. |
| B11.4 | Send | "Waiting for Flavors"; within ~1 min Outcome "Received · quote $950…"; a row in `AvenueEventCases` (Requested). |
| B11.5 | Guests 99 | Refused: "guests must be between 1 and 60". |

### B12. Storage
| # | Do | Expect |
|---|---|---|
| B12.1 | Half-door fridge × 1, note `gaptest` | "About $250.00 per month for 1, before Flavors confirms." |
| B12.2 | Dry shelf single | "Price on request" (sheet ambiguous, Q-25). |
| B12.3 | Send | Outcome "Received · Flavors confirms the price…"; row in `AvenueStorageCases` (Requested). |
| B12.4 | Quantity 50 | Refused: "quantity must be between 1 and 20". |

### B13. Messages with Flavors (ADM-03)
| # | Do | Expect |
|---|---|---|
| B13.1 | New message: About = Other, subject `gaptest support`, body | Thread "Sent"; within ~1 min Outcome "Received · Flavors replies here in the portal"; a case in `AvenueSupportCases` (Open). |
| B13.2 | Staff reply (C7) | Thread shows Flavors' reply; drawer shows a reply dot. |
| B13.3 | Reply in the thread | Case reopens (Open) with the new LastMessage. |

### B14. My team
| # | Do | Expect |
|---|---|---|
| B14.1 | Add `gaptest Person`, role Team member | Listed. |
| B14.2 | Remove | Hidden (row `Active = false`, kept for history). |
| B14.3 | Check-in wellness | Active names are prefilled. |

### B15. Inactive member (F2)
Needs an account that had requests but no membership row (deactivated). If none exists: **Blocked**. Expect "Your membership is not active" instead of Join.

---

## C. Staff app — every screen (signed in as `automations@`)

| # | Screen | Do | Expect |
|---|---|---|---|
| C1 | Requests / Book | Approve the member's pending request from B3.4 | Booking `Approved`, `DecidedBy` set; member sees Approved; e-mail "sign in to view" to the member (once). Conflict: Approve greyed with the reason. |
| C2 | Requests | Decline a request with a reason | Member sees Declined + reason. |
| C3 | Schedule / Approved | Pick the date | Approved bookings per equipment, Eastern time. |
| C4 | Compliance | Expired document: Grant override, then Revoke (owner only) | Override appears/disappears; with override, booking passes (B8.3). |
| C5 | Notices | Write `gaptest` notice, category Urgent, Hide after tomorrow; Publish; then Withdraw | Shows in the portal (B6.5); withdraw removes it. **Publishing e-mails all active members.** |
| C6 | Members | Open a member | Plan, status, PaymentStatus, onboarding column. |
| C7 | More → Support (Screen15) | Open the B13 case, type a reply, Send/Answered | Status Answered; within ~1 min the member's message shows the reply. Close → Closed. |
| C8 | More → Events (Screen21) | Open the B11 case; quote 950; **Approve** | Status Approved; an `AvenueHostRequests` row `EventInvoice`; host creates a Stripe **test** invoice; member Outcome "Approved · invoices follow". Decline (with reason) on a second case → Declined. |
| C9 | More → Storage (Screen22) | Open the B12 case; Monthly 250; Approve | Approved; member Reply "Flavors approved this. Monthly amount: $250." Nothing is created in Stripe. |
| C10 | More → Applicants (Screen16) | Open the test applicant; Approve (when rule allows) | State Active; Q-05 note shown while undecided. |
| C11 | More → Payments (Screen13) | Open | Real invoices from `AvenueInvoices` (test mode), paid / open / overdue. |
| C12 | More → Sensors (Screen14) | Open | 8 units; all **Offline** (Swift's last reading 22 Jun 2026, Q-E7) — expected. |
| C13 | More → Permissions (Screen17) | Add a capability for a test e-mail, toggle, remove | Saved in `AvenueStaffCapabilities`; UI hiding only (not enforced). |
| C14 | More → Reports (Screen18) | Open | Bookings per month, hours by member, document counts, invoices paid/open/overdue, equipment hours; no error banner. |
| C15 | More → Setup (Screen11) | Open equipment and facility rules | Loads. Do not save changes you cannot undo. |
| C16 | Check-ins, Checklist, Dashboard | Open | Load without errors; dashboard tiles have numbers. |

---

## D. Payments path (host, Stripe TEST mode)

| # | Do | Expect |
|---|---|---|
| D1 | Open `https://13-207-228-174.sslip.io/join`, choose a plan, fill business `gaptest Kitchen`, an e-mail you control, collection day 5, submit | Because `PAYMENTS_REQUIRED=0`: "Test mode: payment skipped. No money was charged."; applicant row in `AvenueApplicants` (Onboarding). |
| D2 | (Only if the developer switches `PAYMENTS_REQUIRED=1` for the test) repeat D1 | Stripe Checkout (test) opens; pay with card **4242 4242 4242 4242**, any future date, any CVC; return page "done"; webhook marks the applicant paid; subscription in the Stripe sandbox. **Switch back to 0 afterwards.** |
| D3 | Host health | `/api/health` returns ok, test mode, payments required false. |
| D4 | Stripe webhook | In the Stripe sandbox, Webhooks → the endpoint shows recent deliveries 2xx. |
| D5 | Event invoice (after C8) | A draft/open test invoice for the event in the sandbox; mirrored row in `AvenueInvoices`; member Billing lists it. |

Never enter a real card. Never switch to a live key.

---

## E. Business rules (flows)

| # | Rule | How | Expect |
|---|---|---|---|
| E1 | Overdue blocks booking (BKG-14) | Set the test member `PaymentStatus = PastDue`; member sends a booking request | Declined: "a payment is overdue"; owner's override passes. **Restore PaymentStatus.** |
| E2 | Expired document blocks booking (BKG-15) | B8.3 | Declined with the document reason. |
| E3 | Equipment conflict (BKG-04) | Two requests for the same stove/time | Second shows Taken in the portal; staff Approve disabled with the conflict. |
| E4 | Private event blocks the facility (BKG-17) | Approved private event; another booking the same time | Declined with the private-event reason. |
| E5 | Cancel ≥ 24 h returns hours (BKG-09) | B4.5 | Ledger credit. |
| E6 | Check-in reminders 3/2/1 h (CHK-03) | Approved booking starting in ~3 h | Reminder e-mails at 3, 2, 1 h. |
| E7 | Missed checklist flagged (CHK-04) | Skip the entry checklist | Flag on the staff Check-ins screen. |
| E8 | Support / Events / Storage refusals | B11.5, B12.4 | Refusal Outcome text. |
| E9 | Inactive member refused for events/storage | Set test member Inactive, send an event request | Refused. **Restore Status.** (Not yet tested by anyone.) |

---

## F. UI quality (new in 2.15–2.17)

| # | Check | Expect |
|---|---|---|
| F1 | Font | Headings and numbers in Inter at normal width; times and money in tabular figures (columns line up). |
| F2 | Smallest text | Nothing under 12 px anywhere (inspect captions, chips, tab labels). |
| F3 | Motion | Page change fade/rise; lists stagger in (max ~10 rows); sections reveal on scroll; drawer and pop-ups animate open and closed; toasts slide out. Nothing longer than ~0.5 s. |
| F4 | Reduced motion | OS setting "reduce motion" on → no movement, only instant or fade; everything still works. |
| F5 | Notices density | 10 notices fit in about one desktop screen. |
| F6 | No cut-off names | Equipment names wrap to two lines on Book. |
| F7 | Errors | Disconnect the network, open Support → plain message + **Try again** (no raw SharePoint error). |

---

## G. Responsive matrix

Open every page in the list at every size. Desktop testers: developer tools → device toolbar (or resize the window); also test real devices where you have them.

**Pages:** Home, Book, My bookings, Schedule, Notices, Check-in, Documents, Billing, My membership, Event request, Storage, Messages, My team, profile drawer, bell pop-up.

| Size | Example devices | Expect |
|---|---|---|
| 320 × 568 | iPhone SE (1st gen), small Android | bottom tab bar; no sideways scroll; tap targets ≥ 44 px; text ≥ 12 px |
| 375–430 × 800–930 | iPhone 13–16, Pixel | same; sticky Book bar above the tab bar and the home indicator (safe area) |
| 667–932 × 375–430 (landscape phone) | phones rotated | usable; header not covering content |
| 600–899 | large phones, small tablets, iPad mini | mid layout; drawer as bottom sheet |
| 768 × 1024, 820 × 1180 | iPad portrait | no cramped nav; schedule day opens in the drawer |
| 1024–1366 | iPad landscape, small laptops | wide layout from ~1100 px portal width |
| 1440–1920 | laptops, desktops, 1080p TV | 1240 px column; side panels |
| 2560 and 3840 | QHD monitors, 4K TV | xxl size: larger base text (19 px), 1440 px column; nothing tiny |
| Zoom 200 % on desktop | any | no lost content, no sideways scroll |

Also: touch only (no mouse) on a tablet — no hover-only actions; keyboard only on desktop (Tab, Enter, Esc) — every control reachable, visible focus ring.

---

## H. Accessibility
| # | Check | Expect |
|---|---|---|
| H1 | Keyboard only through Book → Send | Possible, focus always visible, logical order. |
| H2 | Screen reader (VoiceOver / NVDA) on Notices, Book, toasts | Rows announce title, category, unread; errors announced immediately. |
| H3 | Colour contrast | Body text and chips readable (WCAG AA). |
| H4 | Form errors | Each field error is next to the field and announced. |

## I. E-mails
| # | Trigger | Expect |
|---|---|---|
| I1 | Booking approved/declined (C1/C2) | One generic e-mail per status with the portal link, no booking details in the e-mail. |
| I2 | Notice published (C5) | "Sign in to view" e-mail to every active member. |
| I3 | Check-in reminders (E6) | 3/2/1 h. |
| I4 | Staff alerts (failed/missed checklist) | **Not sent**: `StaffAlertEmail` is empty — expected until the client gives an address. |

## J. Sensors
| # | Check | Expect |
|---|---|---|
| J1 | Host health → sensors | configured true, last poll within 10 min. |
| J2 | Staff Sensors screen | 8 units, Offline (last reading 22 Jun 2026). When Flavors powers the gateways (Q-E7), readings should appear within 10 min and fridges/freezers turn Normal or Alert. |

## K. Privacy and access (needs two guest member accounts — **blocked until a tenant admin creates them**)
| # | Check | Expect |
|---|---|---|
| K1 | Member A sends a booking, support message, event and storage request | Member B cannot see any of them (portal or direct list URL). |
| K2 | Member B's Schedule | Shows A's approved booking only as public fields (time, equipment, name label per Q-19). |
| K3 | Member opens a staff list URL directly | Access denied. |
| K4 | Guest sign-in from outside the tenant | Portal loads after accepting the invitation. |

## L. Known limitations (do not log as bugs)
- Payments switched off in the portal (STR-06, Q-02, Q-M1); real money never.
- Check-in question set incomplete (Q-10); 0 wellness questions.
- Sensors Offline since 22 Jun 2026 (Q-E7).
- No guest accounts yet (K blocked).
- Staff alert e-mails off (no `StaffAlertEmail`).
- Document renewal reminder flow not saved (needs the developer's OK; it e-mails members).
- Event deposit/cancellation rules (Q-08), storage shelf prices (Q-25), support reply-time wording (Q-13), one team Lead (CHK-02) are client questions.
- Permissions screen hides UI only; it does not enforce access.
- A reply sent in the same minute as a support thread's first message may be refused (the portal only offers Reply on an existing thread).

## M. Cleanup (by id, one at a time)
Find your `gaptest` rows and recycle them individually in: `AvenueBookingRequests`, `AvenueBookings`, `AvenueCalendar`, `AvenueHoursLedger`, `AvenueEventRequests`, `AvenueEventCases`, `AvenueStorageRequests`, `AvenueStorageCases`, `AvenueSupportMessages`, `AvenueSupportCases`, `AvenueTeamMembers`, `AvenueDocumentSubmissions`, `AvenueMemberDocuments`, `AvenueCheckInSubmissions`, `AvenueCheckIns`, `AvenueNotices` (test notices), `AvenueHostRequests`, `AvenueApplicants` (set test applicants to a closed state; do not delete members). In the Stripe sandbox, void test invoices you created. Put the test member's `PaymentStatus` and `Status` back (A4). Revoke any test override.

## N. Results log
Copy this table into a sheet; one row per test.

| Test # | Result (Pass / Fail / Blocked) | Account | Device / browser / size | Date | Notes / screenshot |
|---|---|---|---|---|---|
| B1.1 | | | | | |

Report every **Fail** with: test number, what you did, what you expected, what you saw, screenshot, time (Eastern), and the row id if one was created.

# Plan: deliver Kitchen Bookings and Communication

**Status: PLAN ONLY. Nothing in this plan has been built or changed.** Written 18 Nov 2026 from the Phase 1 scope document, the client requirements, the 11 Nov and 16 Nov client calls, the master-data sheet, and the repository as it stands. Everything marked **[PROPOSED]** is an engineering suggestion, not a client decision. Anything the client has not stated is **UNKNOWN** or is listed as a question in section 13. Implementation starts on the developer's instruction.

Related: [meetings/2026-11-16-client-call.md](meetings/2026-11-16-client-call.md) (what the client said and showed), [REQUIREMENTS.md](REQUIREMENTS.md), [CHECKLIST.md](CHECKLIST.md), [RELEASE_PLAN.md](RELEASE_PLAN.md).

---

## 1. What is being delivered

The Phase 1 scope document (30 Oct 2026) names these two as the first deliverable (weeks 2 and 3: "Kitchen Bookings (calendar, request, approval, on-behalf) and Communication. Core testable from here").

| Module | Scope text | In plain words |
|---|---|---|
| **1. Kitchen Bookings** | Members request a station, table or equipment for a date and time. A shared calendar shows who has booked which station and equipment and when. Staff approve requests, manage conflicts, and book on a member's behalf. Pick resource, equipment add-ons, date and time; the app checks overlaps before submitting. | Members book **equipment-by-equipment**, or the **whole kitchen**, the **dining room** or a **private event**; everyone sees a shared calendar; Flavors approves. |
| **6. Communication** | Announcements, notices and newsletters posted centrally by staff, to all members or by audience; content lives in the app. On publish, a flow e-mails members a content-free "log in to view" nudge. | Staff post notices; members read them in the portal and get a generic e-mail telling them to sign in. |

Not part of these two: check-in/out and reminders, documents, payments/Stripe, sensors/Swift, onboarding, reporting. They stay off for B Street in this release (`release/release.json`). **Stripe and Swift Sensors access is not needed for these two modules**: nothing is charged at booking (call decision D5); overage billing is a later module.

**Release mechanics (already built):** the developer decides what B Street sees. For this delivery `release/release.json` would list `booking`, `calendar` and `notices` (the Communication module). One change is needed so that "hours left" can show inside booking without the billing module (section 9.1).

---

## 2. What was reviewed

| Source | Used for |
|---|---|
| `references/original/01-avenue-phase1-scope.docx`, `02-...client-requirements.docx` | Module definitions, delivery weeks, access model, non-goals |
| `docs/REQUIREMENTS.md` (BKG-01..17, COM-01..02, PLT, CHK-03) and the 11 Nov call (`meetings/2026-11-11-client-call.md`, decisions D1 to D10) | Confirmed rules |
| **Recordings of 16 Nov** (two Google Meet screen recordings, no audio): kitchen tour, the old system (Nexudus), the master-data sheet walk-through | Equipment-first booking, 24-hour access, grace periods, late-departure policy, checkout alert, tiers and hours. Captions read by OCR; 3 stills in `docs/evidence/` |
| **Master-data sheet** "Avenue Phase 1: Information Needed from B Street & Flavors" (13 tabs), read 18 Nov | What data we hold (section 3) |
| The repository: schema, flows, member portal, staff app, tests | What already exists (section 3.3) |
| Gmail (to look for the client's answers) | Not read: the Gmail connector is disconnected. **Check the inbox for the client's filled sheet.** |

---

## 3. The data we have

### 3.1 Master-data sheet, state on 18 Nov (read-only)
The shared sheet is **still the template**. Only the values agreed on 11 Nov are in it. The client said on 16 Nov they would fill it that day; either it has not been saved to this copy or it lives in another copy. **Re-read it, or ask for the filled file, before design is locked.**

| Tab | In the sheet now | Still blank |
|---|---|---|
| Start here | Instructions only | n/a |
| **Booking Rules** (16 rows) | Min prep tables per company **2**; every booking needs management approval **Yes**; member may cancel up to **24 h before** (under 24 h by message); hours returned on cancellation or no-show **Yes** (management can withhold if abused); plan hours reset **monthly, no rollover**; extra hours billed "invoice at booking, due with next monthly payment" (**conflicts with D5, see C-10**); payment day **1st to 15th**; Stripe fees paid by **member** | Kitchen opening hours, booking time step, **minimum** booking length, cleaning gap, **maximum companies in the kitchen at once**, hours reset day (1st or payment day?), document expiry warning days, check-in grace minutes |
| **Plans & Rates** | Example row only (Base, 10 h) | **Every plan, price, hours, extra-hour rate**; other charges (storage, private event, deposit, joining fee, equipment surcharge) |
| **Spaces** | Kitchen 1 (booked with plan hours: yes; several members at once: "yes, if equipment doesn't clash"); Prep table (included; "about 6, confirm exact count"); Dining room 1 (about 60 seats; confirm) | Prep table count, dining tables, chairs, seats per table, storage units |
| **Dining & Event Pricing** | Row labels only | **Everything**: who can book, uses plan hours, hours deducted, fee, deposit, when balance due, refund tiers |
| **Equipment** | Two example rows only | **The whole list** with quantities, location, bookable-by-members |
| Member Roster, Team Members | Example rows only | **All members and teams** |
| Staff & Logins | Samia Bingham (B Street super-admin, already set up); placeholders for the new Flavors owner, Flavors staff, B Street staff | Names and e-mails, who approves bookings |
| Compliance Documents, Member Documents, Checklists, Temperature Sensors | Row labels only | Everything (not needed for these two modules) |

### 3.2 What the client told us on 16 Nov (summary; details in the meeting notes)
- **Booking is about equipment only.** Cook stations are an artefact of the old system. If one person books both burners, nobody else can have them at that time. Every company gets **at least 2 prep tables**. A company that needs no cooking equipment should still be able to book, and Avenue should make it obvious that all the cooking equipment is free so **one or two more companies** can be let in.
- **Kitchen is open 24 hours**; members have their own door codes.
- **Entry 30 minutes before** the booking and **30 minutes grace after** it for cleaning, **not charged**. Anything beyond that is extra hours. Late departures are checked **manually** by staff from the camera; the client does not want technology for that.
- A **notification 20 or 30 minutes before checkout** (with the option to **extend**) was welcomed ("that would be awesome"). Members will use **phones**; today they book from the mobile version of the old system.
- **10 hours per month** is the minimum tier (5-hour legacy tier for "only a couple" of old members). Excess hours are counted in the **coming month's bill**. Hours are not a booking length limit.
- The old system's **UI** is what the client wants to leave behind: "everything is listed as a meeting room", equipment does not block, cook stations. Our job is a clear, modern equivalent. **The client did not describe visuals in words on the call** (no audio); the design direction in section 6 comes from what the old screens did badly and from the user's brief.

### 3.3 What already exists (from the checklist)
Built and verified (live, as `automations@`, or by test):
- Member **request form** (Kitchen, Dining room, Private event; equipment picker; people count), **My bookings** with cancel (24 h rule) and **extra time**, **shared facility calendar**, **Home** with next booking, hours, notices, **Notices** page.
- Flows: request to Pending booking, publish to calendar, cancellation, hours ledger (used, credit, no-show credit, extension rows), extension request/decision, decision e-mail (flow runs; delivered e-mail not yet seen), notice e-mail ("sign in to view"), expired-document block with owner override.
- Staff app (18 screens, published): Requests, Approved, Book (on behalf), Notices, Setup (plans, equipment), Dashboard.
- Schema: `AvenueFacilities` has `EntryGraceMinutes` and `ExitGraceMinutes`; `AvenueEquipment` has only `FacilityId`, `EquipmentId`, `Kind`, `Active` (plus the built-in Title); `AvenueCalendar` carries `EquipmentIds`.
- Seed data (`demo-` equipment: oven, mixer, prep1) is on the real site; real equipment is not loaded.

What does **not** exist yet for these two modules: availability that **blocks** equipment already approved for someone else, quantities/units, a whole-kitchen mode, the 30-minute entry/grace rules in the booking logic, the checkout alert with Extend, audiences/categories/pinning for notices, and the redesigned UI.

---

## 4. Booking module: what to build

### 4.1 Booking model [PROPOSED, to confirm: Q-B1 to Q-B8]
A booking = **a time window + the things reserved + who + how many people**. Four modes (the member picks one first):

| Mode | Reserves | Blocks others from |
|---|---|---|
| **Equipment** (default) | The listed equipment units, plus **at least 2 prep tables** | Only those same units for overlapping time |
| **Whole kitchen** ("complete workspace") | All kitchen equipment and all prep tables | Any other kitchen booking in that window (Q-B4: confirm it exists and any rules) |
| **Dining room** | Some dining tables (member states people count) **or** the whole room | Same tables, or the whole room |
| **Private event** (BKG-17, D9) | Whole facility | Everything (kitchen and dining) |

Hours are deducted for **booked time only**, not per piece of equipment (BKG-13). One booking can include several pieces of equipment; that does not multiply hours.

### 4.2 Equipment catalogue [PROPOSED]
- **One row per physical unit** for named equipment, exactly as the old system lists them: Stove #1, Stove #2 ("stove with an under oven"), Flat Top Gas Grill #1 and #2, Convection Oven Upper and Lower (a double oven whose racks "must be reserved individually"), Warming Holding Cabinet #1 and #2, Pizza Oven 1 Upper (and the lower/other ovens), plus mixers and anything else on the floor. The list seen on screen was partial; the client's **Equipment tab** is the source of truth (Q-B7).
- **Prep tables**: about 6, one row each (Prep table 1 to 6). The picker asks "how many prep tables" (2 to the maximum); Avenue assigns the free ones. Dining tables the same way (the `AvenueDiningTables` list already has `Seats`).
- New fields on `AvenueEquipment` (section 7): category, description, location, photo, sort order, bookable-by-members, optional group (for "Convection Oven" upper/lower).
- Photos: the old system shows grey placeholders. Ask Flavors for one photo per piece (Q-B16).

### 4.3 Availability rules [PROPOSED, needs Q-B1 and Q-B2 confirmed in writing]
The client wants Avenue to show equipment as unavailable ("that is what Avenue is going to offer us"). Decision D3 / BKG-05 says staff approve everything and Avenue need not stop every overlap. The proposal satisfies both:

1. **Approved bookings block.** Equipment already **approved** for someone else in an overlapping window is **unavailable** to other members. The member picker greys it out and says when it is free ("Taken until 3:00 PM"). The request flow **re-checks on the server side** and, if the member got around the screen, declines with a plain reason. Staff cannot approve a request that clashes with an approved one without first resolving it.
2. **Pending requests do not block each other** (members cannot see each other's pending requests, which is the privacy rule). When two pending requests want the same equipment, staff see them side by side with a clear **conflict panel** and approve one; the other receives a decline with the reason and the next free slots.
3. **"Free-up" signal.** For any chosen time the screen shows how many of the cooking units are free and a banner "All cooking equipment is free in this window" so Flavors can accept an extra company (client request 1.3.4).
4. **Entry and exit windows**: a member may enter **30 minutes before** the start and has **30 minutes after** the end ("grace, not charged"). They are **not** booked time and do **not** block the next booking from starting on time. Both values come from `EntryGraceMinutes` / `ExitGraceMinutes` on `AvenueFacilities`.
5. **Maximum companies in the kitchen at once**: UNKNOWN (sheet blank; BKG-04 says "two caterers are never in together" but the 16 Nov call allows 2 or 3 companies with different equipment). Q-B3.

Server-side check cannot be fully atomic (flows poll every 15 to 60 seconds). Two requests inside the same minute can both pass; the approval-time guard (rule 1, last sentence) is the safety net. No database-level lock is claimed (scope non-goal 1).

### 4.4 Booking rules to implement
| Rule | Source | Status |
|---|---|---|
| Every booking starts **Pending**; management approves (message on screen: "A member of our team will contact you to confirm this booking. No payment is required right now.") | D3, BKG-03 | **Built**; copy to be reused on the new review step |
| Kitchen open **24 hours**; bookings may run through the night | call 16 Nov | Needs the rule that a booking can cross midnight (Q-B10); extensions today are same-day only |
| **Minimum** booking length, **maximum** booking length, time step | sheet, call | UNKNOWN (Q-B5). The old UI used 30-minute steps and 1, 2, 3 hour shortcuts; the sheet template examples say "30" and "1". **Not agreed**, so do not hard-code |
| Minimum **2 prep tables** per company | sheet, call | New: enforced in picker and flow |
| Plan hours per month (10, legacy 5), **no rollover**, overage on the next month's bill | D5, call | **Built** (ledger); hours reset day is open (Q-B11) |
| Cancel by the member ≥ 24 h before; under 24 h by message | BKG-09 | **Built** |
| No-show credits hours unless abused | BKG-12 | Credit built; abuse rule open (Q-09) |
| Staff book on behalf with audit stamp; staff adjust times; late departures corrected **manually** from the camera | BKG-06, call | Booking on behalf **built**; "adjust departure time" action in the staff app is **new** [PROPOSED] (so the ledger reflects the corrected end) |
| **Checkout alert** 20 or 30 minutes before the end, with **Extend** | call | **New** (4.5) |
| Extra time request, Flavors decides | BKG-08 | **Built** |

### 4.5 New: checkout alert with Extend [PROPOSED]
A flow checks every 5 minutes for approved bookings ending in 20 or 30 minutes (Q-B9) and e-mails the member once: "Your booking ends at 6:00 PM. You have 30 minutes after that to clean. Need more time? Extend." The link opens the portal on that booking with the **Extend** dialog (built). A marker field on the booking (`EndAlertSentAt`) stops duplicates. **This flow sends e-mail, so it needs the developer's approval before saving** (project rule). Channel is e-mail only; no SMS or push (a native app is out of scope; Q-B15).

### 4.6 Staff side [PROPOSED]
Requests queue with: the member, plan and hours left, requested equipment, **conflict panel** (who holds what), approve / decline with a reason; a **schedule board** (equipment down the side, time across, one day at a time, who is in); **equipment catalogue** screen (units, category, photo link, active); **booking-rules** screen (grace minutes, minimum/maximum length, step, kitchen mode toggles) so changes do not need a developer; "adjust departure" action. Staff app stays **desktop**.

---

## 5. Communication module: what to build

### 5.1 What exists
Staff post notices from the Notices screen (drafts, publish, withdraw); members see them on the Notices page and on Home (latest notice); publishing triggers a generic e-mail ("sign in to view", members in BCC, never the notice text).

### 5.2 Gaps against the scope ("announcements, notices and newsletters ... to all members or by audience")
| Gap | Proposal [PROPOSED] | Client input needed |
|---|---|---|
| **Category** (notices have a title and a body today, nothing else) | Add `Category` (General, Maintenance, Schedule, Urgent) | Categories (Q-B14) |
| **Audience** ("all members or by audience") | `Audience` = All members, a plan tier, or selected businesses. The notices list is readable by all members, so an audience on it is **not a privacy boundary**: use it only for non-sensitive notices. Truly targeted notices need a separate item-permission list like the membership card; build that only if the client needs private notices | Which audiences exist; whether any notice is private (Q-B14) |
| **Pin and expiry** | `Pinned`, `ExpiresAt`; pinned first, expired hidden | None |
| **Schedule** a post for later | `PublishAt`; the publish flow honours it | Needed? |
| **Newsletter** | Treat a newsletter as a long notice with a heading and image; a monthly digest e-mail is **not** proposed because e-mail bodies must stay content-free (COM-02) | Newsletter format (Q-B14) |
| **SharePoint News vs list** (scope says SharePoint News; Q-13 open) | Keep the list: it gives audience, unread state and the same design as the portal. A News post could later mirror it | Approve the list approach (Q-13) |
| **Unread badge** | Per-member read state needs an own-items list (`AvenueNoticeReads`) **or** local browser memory (weak, per-device). Recommend the own-items list | Do they want read tracking? |
| **E-mail nudge** | Branded HTML (logo, button), correct sender name, still no notice text; at 500+ members split batches (already noted) | Sender address, wording, logo (Q-B20) |
| **Staff composer UX** | Preview, character count, "who will be e-mailed" count before publishing, confirm step; owner, staff and B Street can post | Who may post |

The e-mail flow already exists and runs; changes to it **send e-mail**, so every flow edit needs approval and a run-history check.

---

## 6. UI and UX transformation

### 6.1 What the client rejected (from the old system, as shown)
- Everything is a "meeting room"; the member must know "Cook Station #1".
- Equipment is a long grey list far down the page with placeholder images and **+$0.00** on every row.
- Date and time are a small calendar plus two drop-downs; availability is a thin bar.
- Nothing stops or even warns when equipment clashes; the only error is a red "cannot be placed".
- A dashboard of "Pending actions", "Quick actions" and "My Benefits" that is generic coworking software, not a kitchen.

### 6.2 Design principles [PROPOSED]
1. **Lead with equipment, not rooms.** The first screen says what the member needs: "Equipment", "Whole kitchen", "Dining room", "Private event".
2. **Show availability before the member commits.** Per chosen time, each piece is Free or "Taken until 3 PM"; one glance shows "all cooking equipment is free".
3. **Phone first** (360 to 430 px wide): large touch targets, one question per step, a sticky summary bar at the bottom, no horizontal scroll. Desktop gets the same journey in two columns.
4. **Say what happens next**: pending approval, hours used and left, 30-minute grace, how to cancel, in short sentences.
5. **Warm, food-forward look** rather than office blue: the brand olive green seen in the old system's buttons is the only brand cue we have; colours, fonts and logo come from Flavors (Q-B16). Real photos of the equipment replace grey icons.
6. **Accessible by default**: contrast at least 4.5:1 (already checked on current screens), labels, focus order, no colour-only status.

### 6.3 Screens [PROPOSED]
**Member portal (SPFx), mobile first**
| # | Screen | Key content |
|---|---|---|
| M1 | Home | Next booking card with one action; "Book kitchen time" button; strip "Who is in the kitchen today"; hours ring (used / left); latest or pinned notice |
| M2 | Book, step 1 "What do you need?" | Four mode cards: Equipment, Whole kitchen, Dining room, Private event |
| M3 | Book, step 2 "When" | Day strip, start time and duration (or end time), quick lengths; **timeline of the day** (hours across) showing how busy the kitchen is; "Find a time when my equipment is free" |
| M4 | Book, step 3 "Equipment" | Grouped cards (Stoves and grills, Ovens, Warmers, Mixers, Prep tables); photo, name, note, **Free / Taken until ...** chip, Add; prep-table stepper (2 to max); live banner "All cooking equipment is free" |
| M5 | Book, step 4 "Review" | Summary, hours used and left, 30-minute entry and grace explained, approval and cancellation notes, Send |
| M6 | My bookings | Upcoming and past, status chips (Waiting, Approved, Declined, Cancelled), cancel, extend, view details |
| M7 | Facility schedule | **Equipment by time board** for one day (who is where), plus a week list; names shown as the privacy rule allows |
| M8 | Notices | Feed with category chips, pinned first, unread dot, search by title |
| M9 | Booking details | Equipment list, times, outcome message, entry and grace times, actions |

**Staff app (Power Apps, desktop)**: S1 Dashboard (requests waiting, conflicts, bookings ending soon); S2 Requests queue with conflict panel; S3 Schedule board; S4 Book on behalf; S5 Equipment catalogue; S6 Booking rules; S7 Notice composer.

### 6.4 How design is delivered [PROPOSED]
1. **Mock the key screens first** (Figma, or a clickable HTML prototype): M1 to M5 at phone width and desktop, S2, S3, S7. Show them to the client for approval (the client already disliked the old look). One review round before building.
2. Build the approved design in the portal's existing component library (Fluent UI plus the portal's own styles). The SharePoint page must be full width with the site chrome minimised.
3. Check on a real phone, once guest sign-in exists (section 10).

---

## 7. Data model changes [PROPOSED; all additive, nothing deleted]
| List | Change |
|---|---|
| `AvenueEquipment` | Add `Category` (choice), `Description` (note), `Location` (text), `PhotoUrl` (text), `SortOrder` (number), `BookableByMembers` (yes/no), `GroupId` (text, for upper/lower pairs). One row per physical unit. Index `Category`, `Active` |
| `AvenueFacilities` | Use existing `EntryGraceMinutes`, `ExitGraceMinutes`. Add `MinBookingMinutes`, `MaxBookingMinutes`, `BookingStepMinutes`, `MaxCompaniesInKitchen`, `CheckoutAlertMinutes`, `MinPrepTables`. No defaults invented: empty until the client answers |
| `AvenueBookings` | Add `EndAlertSentAt` (date), `ActualEndUtc` (date, set by staff when they correct a departure) |
| `AvenueCalendar` | No change needed (carries `EquipmentIds`); confirm `EquipmentIds` is indexed for lookup |
| `AvenueNotices` / `AvenueNoticeDrafts` | Add `Category`, `Pinned`, `ExpiresAt`, `Audience`, `AudienceValue`, `PublishAt` |
| `AvenueNoticeReads` (new, own-items) | One row per member and notice read (only if read tracking is wanted) |
| Seed data | Replace `demo-oven`, `demo-mixer`, `demo-prep1` with the real equipment from the client's sheet. Seed rows are removed only by `seedCleanup()`, one id at a time |

Every change goes through `schema/lists.v2.json` and `node schema/check.mjs`, then is applied to the real site with the existing reconcile script (a plan first, then apply), then read back. Docs: `docs/SCHEMA.md` is regenerated.

---

## 8. Flow changes [PROPOSED]
Live flows can only be edited in the Power Automate designer through the expression editor, then checked in run history. Each change below is a **live-flow-change**; those marked ✉ send e-mail and need the developer's approval before saving.

| Flow | Change |
|---|---|
| Booking request to Pending booking | Resolve the requested equipment against **approved** bookings (via `AvenueCalendar`) and **decline** with a reason if a unit is taken; enforce 2 prep tables, whole-kitchen exclusivity and private-event exclusivity; use facility min/max length and step once the client provides them |
| Publish approved booking to calendar | No change (confirm it writes every unit in `EquipmentIds`) |
| Hours ledger | Use `ActualEndUtc` when set (hours returned or added after a manual departure correction) |
| Booking ending soon ✉ (new) | Section 4.5 |
| Booking decision e-mail ✉ | Add the equipment list, grace times and a link to the booking; re-test delivery (never seen delivered) |
| Notice e-mail ✉ | Branded template; honour `Audience`, `PublishAt`; keep the body content-free |
| New "expire notices" | Hide when `ExpiresAt` has passed (or filter in the UI; no flow needed) |

The audit that was running before this task flagged flow issues; they are in the workflow journal and will be merged into this list when the audit resumes.

---

## 9. Code changes by area [PROPOSED]
### 9.1 Member portal (`apps/member-spfx`)
- **Availability engine** (pure, unit-tested): from the approved calendar rows, compute per-unit busy intervals, free/taken at a window, prep-table assignment, "all cooking free", next free slots, cross-midnight and DST handling (the facility time zone is `America/New_York`).
- **New booking flow** (M2 to M5) replacing the 3-step form; mode cards; time-first with availability; equipment cards with photos and chips; sticky summary; review.
- **Facility schedule board** (M7) and **booking details** (M9); redesigned **Home**, **My bookings**, **Notices**.
- **Release gating**: `tabOn` currently hides Home's "This month" hours block unless the `billing` module is in the release. Hours left is part of booking, so move it under `booking` (and keep the invoice amount under `billing`).
- Tests: availability engine, mode rules, prep-table assignment, jsdom journey tests for book, cancel, extend; phone-width layout check.

### 9.2 Staff app (`apps/staff-powerapps`)
Generator changes (`gen.py`) for S1 to S7 with the new fields; `check.py` stays green; screens pasted into Studio by hand and published.

### 9.3 Server
None for these two modules. (The integration host, Stripe and Swift work is separate.)

---

## 10. Admin and deployment plan (now that SharePoint admin access exists)
Steps from [ADMIN_DEPLOY_STEPS.md](ADMIN_DEPLOY_STEPS.md), each a tenant change that the developer approves before it is done:

1. **App catalog** (site-collection catalog on the Avenue site is recommended; affects only that site). Upload and **deploy** `member-spfx.sppkg` built with `release/release.json` = `booking`, `calendar`, `notices`.
2. **Add the app to the Avenue site**; the `Member-portal.aspx` page then works at its plain address (no laptop server, no debug prompt).
3. **Turn on guest sharing** for the organisation and the Avenue site; invite **test members** (a personal Microsoft account) into the Avenue Members group.
4. **Staff and owner accounts**: only a Microsoft 365 user administrator can create them. Ask Samia to create the Flavors **owner** and **staff** accounts (PLT-07) and assign licences; add them to the Avenue Flavors Owner and Staff site groups; share the staff app.
5. **Verify**: second-account privacy test (a member cannot read another member's bookings or documents, including by direct link); phone test on a real phone; staff versus owner roles in the real apps.
6. **Real data**: load the equipment, plans and member roster from the client's sheet; invite the real members as guests; remove the `demo-` seed with `seedCleanup()`.
7. **Show B Street** the two modules (demo script for wave 1 plus a communication script), then take written acceptance.

Rollback: deploy the previous package; data and flows are untouched.

---

## 11. Data load plan
| Data | From | How | Blocked on |
|---|---|---|---|
| Equipment units, categories, photos | Sheet "Equipment" tab; photos from Flavors | Script that writes to `AvenueEquipment` (reviewed, then applied, then read back) | Client's list (Q-B7) |
| Prep tables, dining tables | Sheet "Spaces" tab | Rows in `AvenueEquipment` / `AvenueDiningTables` | Exact counts |
| Plans and hours | Sheet "Plans & Rates" | `AvenuePlans` rows | Client's tiers and prices |
| Members and plans | Sheet "Member Roster" | `AvenueMembers` rows; guest invitations | Roster |
| Rules (grace, lengths, step) | Sheet "Booking Rules" | `AvenueFacilities` fields | Client's values |

No real member data is entered until the client supplies it. Seed rows are removed only by `seedCleanup()`.

---

## 12. Test plan and acceptance
Tests use `gaptest-` ids and are removed by explicit id; the real site has no test environment.

| # | Scenario | Pass when |
|---|---|---|
| T1 | Member A has Stove #1 approved 2 to 5 PM; member B tries Stove #1 at 3 PM | Picker greys it with "Taken until 5 PM"; a forced request is declined with the reason |
| T2 | Same two members, B picks only prep tables | Allowed; "all cooking equipment is free" does not show while A holds the stove |
| T3 | B requests the whole kitchen overlapping A | Declined or flagged per the confirmed rule (Q-B4) |
| T4 | Private event approved | All kitchen and dining requests that overlap are blocked |
| T5 | Booking with no equipment | Gets the 2 prep tables automatically; fewer than 2 is rejected |
| T6 | Two pending requests want the same oven | Staff see a conflict panel; approving one makes the other declinable with the reason; approving both is refused |
| T7 | Booking ends in 30 minutes (alert minutes as confirmed) | One e-mail with an Extend link; a second run sends none |
| T8 | Entry 30 minutes before and grace 30 after | Not counted as booked hours; next booking can start on time |
| T9 | Cross-midnight booking; spring-forward and fall-back dates | Correct times and hours |
| T10 | Cancel at 24 h and at 23 h | First cancels and returns hours; second asks management |
| T11 | Notice with audience, pin and expiry | Shows to the right members; pinned first; expired hidden; the e-mail contains no notice text |
| T12 | Privacy: second guest account | Cannot read another member's items by list or link |
| T13 | Phone (390 px, a real phone) | Whole booking journey with one hand, no horizontal scroll |
| T14 | Accessibility | No contrast failures, labelled controls, keyboard path for booking |
| T15 | All suites | Member build, billing, sensors, domain, host, schema, staff check, secret scan green |

**Done for these two modules** when T1 to T15 pass, the client has approved the mock-ups and a demo, and B Street has accepted the wave in writing.

---

## 13. Questions for the client (with a proposed answer)
| # | Question | Proposed default if no answer |
|---|---|---|
| **Q-B1** | Should Avenue **block** equipment already approved for someone else (the client's description on 16 Nov), rather than only flag overlaps (D3/BKG-05)? | Yes for approved bookings; pending requests only flagged |
| Q-B2 | Should members see that equipment is taken, or just "unavailable"? | Show the time it frees up, not who holds it |
| Q-B3 | Maximum number of companies in the kitchen at once? | No limit beyond equipment |
| Q-B4 | Is there a **whole-kitchen (exclusive)** booking, and does it cost extra hours or a fee? | Exists, plain hours, exclusive |
| Q-B5 | **Minimum** and **maximum** booking length and the time step? | Ask; do not assume 1 hour or 30 minutes |
| Q-B6 | Prep tables: exact count; may a company book more than 2, up to how many? | 6, any number from 2 |
| Q-B7 | The **complete equipment list** with quantities, categories, location and notes (stoves, grills, ovens upper and lower, warming cabinets, pizza ovens, mixers, anything else). Are upper and lower convection racks separate units? | Separate units |
| Q-B8 | Is equipment ever charged ("+$0.00" in the old system) or is only time charged? | Time only (BKG-13) |
| Q-B9 | Checkout alert: **20 or 30 minutes** before the end? E-mail only, or SMS too? | 30 minutes, e-mail |
| Q-B10 | Can a booking **run past midnight** (24-hour access)? Does extending past midnight need approval? | Allowed; extension needs approval |
| Q-B11 | Hours reset on the **1st** or on each member's payment day? Which month does a booking across the month end belong to? | 1st; month the booking starts |
| Q-B12 | **Dining room**: tables or whole room, hours deducted, fee, deposit, refund tiers (the sheet is blank) | Plan hours only until the client prices it |
| Q-B13 | **Outside guests** (non-members) for private events: in Phase 1? | No; members only |
| Q-B14 | **Notices**: categories, audiences (all, plan tier, selected businesses), anything private, newsletter format, who may post | Categories General, Maintenance, Schedule, Urgent; audience all |
| Q-B15 | **Mobile**: "downloaded on their phones". Is a pinned web shortcut enough? (native app is out of scope) | Web shortcut |
| Q-B16 | **Brand**: logo, colours, fonts, **photos** of each piece of equipment and the room | Olive-green accent from the old portal; neutral type |
| Q-B17 | The **member roster** (business, owner, e-mail, plan, hours) and team members | Required before invitations |
| Q-B18 | Who are the Flavors **owner** and **staff** accounts (Samia to create)? | n/a |
| Q-B19 | **Written confirmation** of the 11 Nov decisions and of the 16 Nov points above | n/a |
| Q-B20 | E-mail **sender name/address** and wording for the notice and booking e-mails | "Flavors Culinary Hub" display name |

New items go into `DECISIONS_AND_OPEN_QUESTIONS.md` with source and date when they are accepted. Q-B1 supersedes the "no longer a release blocker" status of Q-03.

---

## 14. Risks
| Risk | Mitigation |
|---|---|
| Client data still blank | Build the engine and the catalogue loader against the example list; load real data the day it arrives; do not hard-code numbers |
| Availability is eventually consistent (flows poll every 15 to 60 s) | Approval-time guard; say "request" not "booked"; staff conflict panel |
| Rule drift between the client's words and written decisions | Get written confirmation (Q-B19) before the flow change goes live |
| Editing live flows can silently break every booking (see the `@{}` text-versus-boolean gotcha) | Edit through the expression editor, re-read Code view, check run history, test with `gaptest-` ids |
| SharePoint list limits (5,000-item view threshold) | Query only a date window; index `StartUtc`, `EndUtc`, `FacilityId` (confirm on the live lists) |
| Guest licences for Power Apps users | Staff only use Power Apps; members use SharePoint pages |
| Redesign scope creep | Mock-ups approved first; build only approved screens |
| Real site, no test environment | `gaptest-` ids, removal by explicit id, never bulk |

---

## 15. Work breakdown and order [ESTIMATE, one developer; dependencies shown]
Estimates are working days and are **not** commitments; the scope document planned weeks 2 and 3.

| Phase | Work | Needs | Estimate |
|---|---|---|---|
| A | Get the filled sheet; send the open questions (section 13); record answers | Client | 0.5 d + waiting |
| B | Design: mock-ups M1 to M5, S2, S3, S7; client review | A (brand, photos helpful) | 2 d |
| C | **Deploy foundation**: app catalog, deploy the current portal, guest sharing, invite a test member, privacy and phone tests | Admin access (have), no design needed | 1 d (can start now, in parallel) |
| D | Schema additions, equipment loader, real equipment loaded | A | 1 d |
| E | Availability engine, tests, new booking flow UI | B, D, Q-B1 | 4 d |
| F | Flow changes: conflict check, ending-soon alert, notices; each tested live | D, E, developer approval for e-mail flows | 2 d |
| G | Staff app S1 to S7 | B, D | 3 d |
| H | Communication: composer, categories, audience, pin, expiry, redesigned Notices and Home strip | B, D | 2 d |
| I | Full test pass (T1 to T15), fixes, the paused audit's fixes, demo script, acceptance | all | 2 d |
| **Total** | | | **about 15 working days** if the client answers promptly; **about 8** for a first release limited to phases C, D, E, F (equipment-wise booking with blocking, new booking UI) with staff app and notices upgraded after |

**Suggested order:** C now (no dependencies), A in parallel, then B, D, E, F, then G and H, then I. Show B Street after E and F, then again after H.

## 16. What is needed from the developer
1. Approve this plan, or change section 4.3 (blocking) and the order in section 15.
2. Say whether to start phase C (deploy) now, and with which release (`booking`, `calendar`, `notices`).
3. Approve any e-mail-sending flow before it is saved (ending-soon alert, branded notice and decision e-mails).
4. Send the question list (section 13) to the client; check the inbox for the filled sheet and reconnect the Gmail connector if wanted.
5. Resume the paused audit-and-fix run (or fold it into phase I).

# Test checklist: staff app and flows (seed data)

Prepared 14 Nov 2026. Real site, **no test environment**: every row you create is seed data. Use `gaptest-` ids and remove rows by explicit id only (see Cleanup). Stripe is not connected; nothing here charges anyone.

## Before the tester starts (owner/admin does this)
1. Share **Avenue Staff Console** with the tester (Power Apps → Share). They need a Power Apps licence that covers the app.
2. Give the tester access to `https://bstreethq.sharepoint.com/sites/Avenue` (staff group). Without it, real-data screens show errors. **UNKNOWN:** whether staff and owner test accounts exist; none has been verified.
3. Tester opens the app from make.powerapps.com → Apps. Test on a desktop browser.

## Seed data already on the site
- Facility `flavors-hyattsville`, member `gaptest-biz` (email `automations@poweredbyavenue.com`), equipment `gaptest-oven`.
- One **expired** permit for that member (expiry 1 Nov 2026), plus an **owner override** granted 14 Nov so bookings can pass.
- Bookings made 14 Nov: staff booking 19:00-20:00 (device time) Approved.

## A. Staff app screens (Play the published app)
| # | Test | Expected |
|---|---|---|
| A1 | Open app; click every nav button (Dashboard ... Settings, More) | Each opens; last button is **More** (Setup is inside More) |
| A2 | Dashboard | Tiles load, no error banner; hours this month shows the real total |
| A3 | Book screen: equipment list | `gaptest-oven` is listed (was blank before 14 Nov) |
| A4 | Book: start in the past | Red text "The start is in the past."; Book disabled |
| A5 | Book: Kitchen, no equipment | "Choose the equipment."; Book disabled |
| A6 | Book: valid slot, press Book, wait about a minute, Refresh result | Result shows Approved; a row appears in AvenueBookings |
| A7 | Compliance: expired permit listed; Grant override then Revoke (owner only) | Override appears/disappears; staff account is refused by SharePoint |
| A8 | Members, Check-ins, Notices, Checklist, Settings, Setup | Open without errors. Do not save Settings or Setup changes you cannot undo |
| A9 | More hub | Click a tile anywhere (title or description): opens that screen |

## B. Demo screens (More hub). Each says "DEMO DATA, NOT SAVED"; click Load demo data first
| # | Screen | Test | Expected |
|---|---|---|---|
| B1 | Payments | Load; open balance | $705, 4 open, 3 paid; search "Green" finds 2; select shows line items |
| B2 | Sensors | Load; type 30 in Stale after | Dry Storage Room turns grey "STALE"; selecting a sensor shows history |
| B3 | Support | Fill subject and message, Send | New ticket appears; message "Demo only: nothing was sent" |
| B4 | Applicants | Rule "Not decided" | Approve disabled, shows Q-05. Choose Yes, select an Onboarding applicant, Approve: state becomes Active |
| B5 | Permissions | Add, toggle, remove a capability | Starts empty; works; nothing is enforced |
| B6 | Reports | Open | Real hours and document counts (live lists) |

## C. Flows (run from the staff Book screen)
| # | Test | Expected |
|---|---|---|
| C1 | Staff booking as in A6 | Request row, then booking `Approved`, `DecidedBy` set |
| C2 | Revoke the override (A7), book again | Booking `Declined`: "a required document has expired" |
| C3 | Book an overlapping slot on a private-event day | Declined with the private-event reason |
| C4 | Cancel an approved booking (Requests/Approved screens) | Status Cancelled; hours ledger credits back |
| C5 | Dining booking for 12 people | Request accepted; staff approves on Requests screen |

## Not testable yet (do not report as bugs)
Member portal (not deployed, needs app catalog admin); Stripe payments and invoices; Swift Sensors live readings; sign-up and onboarding; Power BI; guest-account member testing; staff upload of a member's document (no control yet). Prices (Q-04), overdue rule (Q-07) and several client questions are open; screens show them as unknown.

## Known issues
- Book times use the device time zone, not the facility's. Use a device set to Eastern.
- Equipment hours (Dashboard, Reports) take the month start from the device date, not the Eastern facility month.
- Booking flow polls: allow 15-60 seconds.
- Request `staff-cba62be7...` (AvenueBookingRequests id 34) failed before the 14 Nov fix and stays unprocessed.

## Cleanup (by explicit id, never bulk)
AvenueMembers id 5; AvenueEquipment id 1; AvenueMemberDocuments id 6; AvenueBookingRequests ids 33, 34, 35; AvenueBookings the row with BookingId `staff-8154b356...` (id 38) and any `gaptest-r1`; revoke the compliance override for `automations@`. Deactivate members, never delete them.

## Seed data on the real site (prefix `demo-`; replace with real data later)
| Persona (sample, cannot sign in) | What it shows |
|---|---|
| Sweet Maple Bakery (sample) | Active, current permit, 7 of 10 hours used, approved bookings, one extension waiting, one failed exit checklist |
| Harvest Table Catering (sample) | Current permit, one Pending booking with a conflict note on the same equipment |
| Green Leaf Foods (sample) | Expired permit (blocks booking; owner override only) |
Also: a published notice and a draft notice (draft must stay private), equipment `demo-oven/mixer/prep1`, plan `demo-plan-std` (10 h is an invented sample; no price). Bookings were written directly with the flows' "already handled" markers, so no e-mail was sent. The member portal reads the signed-in user's **own** requests, so to see a booking on a phone, make it in the portal as that user.
Cleanup: paste `schema/testkit.browser.js`, then `window.__seed` and `schema/seed.browser.js`, run `await seedCleanup()` on a tab of the site.

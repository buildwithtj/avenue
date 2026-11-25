# How to test delivery 1: Kitchen Bookings + Communication

> **Superseded 23 Nov 2026 by [END_TO_END_TEST_GUIDE.md](END_TO_END_TEST_GUIDE.md)** (member portal 2.17.0.0, staff app, flows, host, sensors, responsive). Kept for history.

Written 18 Nov 2026. Test data only (ids start with `gaptest-`, remove them by id afterwards). The site is the real Avenue site, so keep tests small.

## What is live
| Part | Where | Version |
|---|---|---|
| Member portal (booking, calendar/schedule, notices) | `https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal.aspx` | 1.2.3.0 |
| Staff app "Avenue Staff Console" | make.powerapps.com > Apps (or its play link) | published version 22 |
| Data | the 20 Avenue lists, plus the new equipment, rules and notice fields | live |

## Who you can test as
- **Member side:** sign in as `TDDAdmin@poweredbyavenue.com` (Tech DoubleKlick Designs). It has a test member row (AvenueMembers 10, Active), so its requests are accepted. Its hours ring counts everyone's requests because it is a site admin; real members see only their own.
- **Staff side:** the `automations@` account (owner of the staff app). Open the app from make.powerapps.com, or play it.
- Real members cannot sign in yet (no guest sharing). After testing set AvenueMembers 10 back to Inactive.

## A. Member portal (phone and desktop)
Open the portal URL. SharePoint's header and menu are hidden (immersive mode); the small round ✕ (phone) or "Exit full screen" (desktop) brings them back.
1. **Home:** olive hero, next booking, the hours ring, the latest notice, a big orange "Book kitchen time".
2. **Book, step 1 "What do you need?"** Pick Equipment, Whole kitchen, Dining room or Private event.
3. **Step 2 "When":** pick a day (strip or date box), start time, length. "How busy is the kitchen?" shows the day. Try "Find me a time when my equipment is free".
4. **Step 3 "Equipment":** cards by category with Free / "Taken until ..." chips. Prep tables: at least 2, assigned for you. A green banner says when all cooking equipment is free.
5. **Step 4 "Review":** check the notes: the team confirms, nothing to pay now, 30 minutes before and after are not charged, cancel up to 24 hours ahead.
6. **Send** the request. Within about a minute it appears in **My bookings** as "Waiting for approval".
7. **To see equipment blocking:** have staff approve a booking (section B), then try the same equipment at an overlapping time: it shows "Taken until ..." and cannot be added.
8. **Schedule:** equipment down the side, time across; today is selected; the orange line is now. On a phone it becomes cards per piece of equipment.
9. **My bookings:** Details opens the equipment and times; cancel (24 hours or more ahead returns hours) and Extend.
10. **Notices:** category chips, pinned first, unread dots, "Mark as read".
Phone test: open the same URL on a phone browser signed in as the test account, or use the browser's phone view (390 px wide).

## B. Staff app (automations@)
1. **Requests:** pick the waiting request. "Conflicts" lists any approved booking sharing equipment. **Approve** is greyed out with "Resolve the conflict first: ..." while a conflict exists; **Decline** (with a reason) always works. Approve a clean request: within about 2 minutes the booking appears in the member's calendar and the hours ledger.
2. **Schedule:** choose a date; each piece of equipment lists its approved bookings in Eastern time.
3. **Book (on behalf):** staff create a booking for a member.
4. **Setup:** Equipment tab edits category, description, location, photo link, bookable, active, order and adds units; Facility rules tab holds minimum and maximum booking minutes, step, maximum companies, checkout alert, minimum prep tables, check-in alert minutes (leave empty until the client confirms).
5. **Notices:** write a notice with Category, Pin and "Hide after" date; publish; withdraw. **Publishing sends the "sign in to view" e-mail to every active member**, so check who is active first.

## C. Checks that prove the rules (do these in order)
| # | Do | Expect |
|---|---|---|
| 1 | Member A books Stove #1 + Grill #1, 3 to 5 PM; staff approve | Booking Approved, calendar row, 2 h in the hours ledger |
| 2 | Member B opens the same window | Stove #1 and Grill #1 show "Taken until 5:00 PM"; prep tables 1 and 2 are not offered if A holds them |
| 3 | B books only prep tables | Allowed; banner "All cooking equipment is free" is hidden while A holds the stove |
| 4 | A second request for Stove #1 reaches staff anyway | Approve disabled with the conflict message |
| 5 | Cancel a booking 24 hours or more ahead | Cancelled, hours returned |
| 6 | Pinned Maintenance notice | Shown first with its tags; withdrawing removes it |
| 7 | Phone at 390 px | No sideways scroll; one hand reaches Next and Back |

## D. After testing
- Remove your test rows by explicit id (requests, bookings, calendar, hours ledger, notice drafts); never bulk.
- Set AvenueMembers 10 to Inactive.
- Known gaps: the client has not approved the design; the sheet's Equipment tab is still examples, so the 15 units are mock; minimum/maximum booking length and maximum companies are not enforced (the client has not stated them); the booking-ending alert, branded e-mails and server-side double-booking check need flow changes that are waiting for approval.

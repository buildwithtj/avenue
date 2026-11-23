# Day 5 evidence: cancellations and hours (2026-11-11/12)

Client rules used (call 11 Nov): BKG-09 cancel 24 h or more ahead returns hours; under 24 h the member messages management and management cancels; BKG-12 no-shows are credited back. Plan allowances and the overage rate were not supplied (Q-04), so **overage is not computed**.

## Built
- **Schema:** intake list gained `CancelBookingId`; bookings gained `CancelRequestedAt` (applied live; `schema/lists.v2.json`, `check.mjs` OK, 59 fields).
- **Flow "Avenue - Booking cancellation request"** (47d1abf9-2948-4abb-899b-7ecf5c19536c): on an intake item with `CancelBookingId`, finds the booking only if `MemberId` equals the item's author and status is Approved/Pending; 24 h or more before start sets Cancelled, otherwise stamps `CancelRequestedAt` (the message to management).
- **Flow "Avenue - Booking request to Pending booking"** guarded so cancel items never create bookings.
- **Flow "Avenue - Hours ledger"** (f867cee5-1ca2-48f1-a7f0-390541eb1574, concurrency 1): Approved writes a `Used` row (+hours, key `<BookingId>-used`); Cancelled or No-show credited writes a `Credit back` row (-hours, key `<BookingId>-credit`) only if a Used row exists and no credit exists yet. Net hours = sum of Hours.
- **Staff app:** second screen "Approved bookings" with Cancel (hours return) and No-show credit buttons, note, and a red flag on bookings the member asked to cancel under 24 h.
- **Member web part:** "My requests" list with Cancel (24 h or more) or "Message management to cancel (under 24 hours)"; `listMyRequests`, `submitCancel`, `canSelfCancel`, `toCancelItem`. `npm run build` passes, 25 unit tests.

## Verified live
- Booking 3+ weeks ahead: cancel request cancelled it, ledger Used 2.5 then Credit back -2.5, calendar row removed.
- Booking about 5 h ahead: cancel request left it Approved with `CancelRequestedAt` set; No-show credited then wrote Credit back -2.
- Staff app: Cancel and No-show buttons worked and ledger netted to zero, no duplicate rows, calendar empty afterwards.
- Cancel items created no bookings. All test rows recycled.

## Not done / not verified
- Overage (needs plan allowance and rate); hours-used display for members (no member-readable summary source); monthly period is the UTC month of the start time, not facility time.
- Member screen not run in a browser against the live site or as a guest; only unit-tested. Members cannot see a request's status (bookings list is private); a cancelled request still shows in "My requests".
- Not run as a guest member, so the author-email match for cancellation is untested for guests (`name_domain#ext#@...` style addresses may not equal `MemberId`).
- No-show abuse rule (Q-09) not implemented; staff decide.
- The Power Apps editor went blank once after a session restart; reopened afterwards and confirmed the saved app has both screens (Screen1 with the "Approved bookings" button, Screen2 with the approved list). The app is still unpublished.
- Jest took about 15 minutes in the last build (machine contention); tests themselves ran in under a second.

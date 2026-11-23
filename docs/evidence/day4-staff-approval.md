# Day 4 evidence: staff approval slice (2026-11-11)

Decisions used: Power Apps canvas for staff (user choice, matches agreed architecture; Q-24 still open with the client). Emails skipped on the user's instruction.

## Built
1. **Power Apps canvas "Avenue Staff Console"** (saved, unpublished). Queue of Pending bookings, request details, overlapping approved calendar entries with a same-equipment / whole-facility marker, optional note, Approve and Decline, Refresh. Source in `apps/staff-powerapps/`.
2. **Flow "Avenue - Publish approved booking to calendar"** (id e3331e76-2339-41c3-a036-bf0e441ca63c): on any change to an `AvenueBookings` row, if Status = Approved and no calendar row exists, create the `AvenueCalendar` row (business name from `AvenueMembers` by MemberId, else "Member"); if the status is anything else, delete that booking's calendar rows.

## Verified live
- Two overlapping requests became two Pending bookings (flow 1). The app listed them, showed the overlap against an approved booking and marked it as same equipment.
- Approve in the app wrote Status, DecidedBy, DecidedAt and the note; the calendar row appeared within about a minute.
- Decline in the app wrote Declined and the note; no calendar row was created.
- Setting an approved booking to Cancelled (by API, as there is no cancel screen yet) removed its calendar row.
- DecidedAt was first stored five hours off (UTC conversion applied twice); fixed by writing `Now()`; confirmed correct afterwards.
- All test rows were moved to the site recycle bin.

## Not done / not verified
- Not run as a Flavors staff or owner member, only as automations@. Whether the Staff group can read the lists and edit bookings through the app, and cannot touch private lists they should not, is untested (needs test accounts and an admin).
- Not published or shared; Power Apps licences for Flavors staff are unconfirmed (L-20).
- No emails (management alert, member decision, overlap note to both members).
- Private-event approval does not yet block other requests; "book on a member's behalf" is not built; owner override and cancellation screens are Day 5.
- Calendar display name falls back to "Member" until the real `AvenueMembers.MemberId` convention is known (the lookup assumes MemberId equals the author's email).
- A member requesting equipment that does not exist is only checked in the member form, not at the list.
- Two flows share one owner connection; a connection failure stops publishing silently.

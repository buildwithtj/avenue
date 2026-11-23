# Day 8 evidence: remaining buildable scope (2026-11-12, afternoon)

Built in parallel: five flows by browser agents in separate tabs, each re-read by an independent reviewer (5/5 with no mismatches). Then two follow-up flow edits and the staff app/portal work. Expressions: `flows/expressions.md`. Staff screens: `apps/staff-powerapps/README.md`.

## Built
| Piece | What |
|---|---|
| Fields | `AvenueFacilities.ExitGraceMinutes` (15, proposed), `StaffAlertEmail`. `AvenueBookings.DecisionNotified`, `ExitFlaggedAt`, `ExitOutreachAt/By/Note`, `BookedBy`. `AvenueCheckIns.AlertSentAt`. Schema: 17 lists, 121 fields. |
| Flow: New request alert to staff | Pending booking → e-mail to the staff alert address (skipped when it is empty) |
| Flow: Booking decision e-mail | Approved, declined or cancelled → one e-mail to the member, guarded by DecisionNotified |
| Flow: Failed checklist alert (CHK-05) | Member and staff e-mails, never containing the answers; AlertSentAt recorded |
| Flow: Overdue exit checklist (CHK-06) | Entry recorded, no exit once the grace has passed → one member nudge, staff e-mail, and the booking listed on the staff Check-ins screen |
| Request flow | Auto-declines requests that overlap an approved private event, or come from an inactive membership (ADM-04) |
| Hours ledger | Period now uses the facility's month (Eastern); it was the UTC month |
| Staff app | Members (add, edit, deactivate with cancellation), Book for a member, Settings, overdue-exit follow-up, 12-tile dashboard, 10-item navigation. App checker: 0 errors, 32 delegation warnings (all on local filters over small delegated sets, or counts; see limits). |
| Member portal | "Hours this month" on Home (approved bookings, facility month); 2 new unit tests, 38 total; build clean |

## Verified live (all mail only to automations@; data created 08:13–08:22 UTC)
| Case | Result |
|---|---|
| Approved private event created | Decision e-mail "approved" (Eastern 3:00 AM = 08:00 UTC) |
| Request overlapping the private event | Declined: "the facility is booked for a private event at this time". Echoed to the member's request; "declined" e-mail. |
| Request at a free time | Pending; staff alert e-mail. After approval: "approved" e-mail, calendar row, hours row. |
| Staff booking (Book screen, Dining, 4 people) | Validation refused a past time; booking stored 14:30–15:30 UTC (device on IST) with BookedBy. "Approved" e-mail, calendar row and hours row. |
| Deactivate member (Members screen) | Member Inactive. 3 future bookings cancelled (the declined one untouched); 3 "cancelled" e-mails; hours credited (−2, −1, −1); calendar rows removed. |
| Request from the inactive member | Declined: "this membership is not active" |
| Failed checklist | Member and staff e-mails, AlertSentAt set. A passed checklist produced nothing. |
| Overdue exit | Booking with entry and no exit was flagged at 08:17:56 (first run after setup), with member and staff e-mails. Booking with entry and exit was not flagged. |
| Settings | Invalid e-mail refused; valid one saved |
| E-mail count | Exactly the 12 expected e-mails, no duplicates |
| Wording fix | "submitted an entry checklist" (was "a"), saved and read back from code |

Cleanup: every test row (7 bookings, 3 requests, 5 check-ins, 8 ledger rows, 2 calendar rows, 1 member) is in the site recycle bin. `StaffAlertEmail` is cleared, so the dashboard shows "Not set" until Flavors supplies the address.

## Known limits
- Staff can write to the bookings, members and facilities lists, so Book's expired-document refusal and Settings are enforced in the app, not at the list. Owner-only settings need an admin permission change.
- Staff app times use the device's time zone; staff must use a device set to Eastern.
- Delegation warnings: dashboard counts are exact up to the 500-row app limit per tile. Follow-up lists filter a small delegated set locally.
- No staff e-mail for missed entry checklists: the confirmed rule names a staff view. The overdue-exit flow does e-mail staff when the address is set.
- Extension requests at session end (BKG-08 / CHK-06 "or requests an extension") are not built; staff record agreed extensions in the outreach note.
- Not tested with a real staff, owner or guest account (needs admin access). Nothing is published.

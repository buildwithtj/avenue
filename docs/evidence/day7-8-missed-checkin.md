# Days 7–8 evidence: missed entry checklist (CHK-04), 2026-11-12

## Built
- Fields: `AvenueBookings.MissedCheckInAt`, `OutreachAt`, `OutreachBy`, `OutreachNote`; `AvenueFacilities.EntryGraceMinutes` = 15 [PROPOSED, Q-10]. Schema file now has 112 fields.
- **Flow "Avenue - Missed entry checklist"** (cce1b903-e986-4fe0-bd02-161ec825af35). Runs every 5 minutes with concurrency 1. Once grace has passed with no entry checklist, it marks the booking first, then sends one e-mail to the member. Expressions: `flows/expressions.md`. A parallel browser agent built it; a second agent reviewed the saved code with no mismatches.
- **Staff app, Check-ins screen:** the list "Missed entry checklist: member reminded, staff to follow up" shows business name (falls back to "Member"), e-mail, booking time and when the member was reminded. A note box and the "Log outreach and resolve" button close the case. The inner filter is delegable: approved, started, and ending within the last 12 h.

## Verified live (all mail only to automations@)
Four bookings, all starting relative to 07:02 UTC:

| Case | Expected | Result |
|---|---|---|
| Missed: started 20 min ago, no entry | nudge once | MissedCheckInAt 07:08 (first run after save); one e-mail |
| Checked in: started 20 min ago, entry recorded | nothing | nothing |
| Cancelled: started 20 min ago | nothing | nothing |
| In grace: started 5 min ago | nothing until grace ends (07:11:59), then nudge once | skipped at 07:08, nudged at 07:13; one e-mail |

- **No repeats:** the 07:13 and 07:18 runs did not nudge either booking again (MissedCheckInAt unchanged). The inbox held exactly 2 nudge e-mails.
- **Staff screen:**
  - It listed exactly the 2 nudged bookings.
  - "Log outreach and resolve" wrote OutreachAt 07:18:47, OutreachBy and OutreachNote, and the booking left the list.
- **Cleanup:** all test rows went to the recycle bin: 4 bookings, 1 check-in, plus 3 calendar and 3 hours-ledger rows the other flows created.

## Known limits / open
- Grace period (15 min) and escalation contacts are not client-confirmed (Q-10). No staff e-mail is sent: the confirmed rule names a staff view, and escalation contacts are not supplied.
- The member e-mail goes out even if a staff member already called. Outreach logged before the nudge does not suppress it (rare inside a 15-minute grace).
- Overdue exit (CHK-06) is not built.
- Dashboard has no "missed check-ins" tile yet; the list is on the Check-ins screen.
- Tested only as automations@ (site owner); not as a staff account.

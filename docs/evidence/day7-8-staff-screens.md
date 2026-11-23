# Days 7–8 evidence: staff screens and operator dashboard (2026-11-12)

App: "Avenue Staff Console" (Power Apps canvas, environment "B Street HQ (default)"), saved, **not published or shared**. Source: `apps/staff-powerapps/` (`gen.py` generates `screens/*.pa.yaml`; `screen-approvals.pa.yaml` and `screen-approved.pa.yaml` are the Day 4–5 screens).

## Screen map

| Screen | Purpose | Writes to |
|---|---|---|
| Screen3 Dashboard (start screen) | Tiles: pending requests, approved next 7 days, asked to cancel (under 24 h), hours used this month, documents expired / expiring 30 days / to verify, failed checklists last 7 days. Hours by member this month. Each tile opens its screen. | nothing |
| Screen1 Requests | Pending queue, overlap view, note, Approve / Decline (Day 4) | AvenueBookings |
| Screen2 Approved | Approved bookings, cancel, no-show credit (Day 5) | AvenueBookings |
| Screen4 Compliance | Member documents with status; mark verified; grant or revoke owner override | AvenueMemberDocuments, AvenueComplianceOverrides |
| Screen5 Check-ins | Recorded checklists; failed ones in red with each question and answer | nothing |
| Screen6 Notices | Publish and withdraw notices | AvenueNotices |
| Screen7 Checklist | Add and remove entry/exit questions | AvenueChecklistQuestions |

## Verified in Studio preview (as automations@, site owner)
- Dashboard counts matched seeded rows after "Refresh data"; the hours tile showed `0` with an empty ledger (it was blank before `Coalesce`, and `0.` with the `"0.#"` format; now `Text(Round(…, 1))`).
- Compliance: verify, grant override, revoke override (Active = false) all wrote the expected fields.
- Check-ins: a failed checklist showed in red with the parsed answers.
- Notices: publish, then withdraw.
- Checklist: add a question, then remove it (Active = false).
- All seeded rows (AvenueBookings 15, AvenueCheckIns 4, AvenueChecklistQuestions 1, AvenueComplianceOverrides 2, AvenueMemberDocuments 5, AvenueNotices 1) moved to the site recycle bin on 12 Nov.

## Known limits
- **Delegation:** SharePoint does not delegate `CountRows` or `Sum`. The filters are delegated, so each tile is exact until one tile matches more than the app's data row limit (default 500). Far above pilot volume for one facility; if it is ever reached, move the counts to a scheduled flow that writes a summary row.
- Not run as Flavors staff or owner. That the override list is owner-write-only is set by list permissions, but no test with a staff account has been done (needs test accounts from an admin).
- Not published; staff Power Apps licences unconfirmed (L-20).
- Overage tile waits for plan hours and rate (Q-04). No e-mails (reminders, notices): they need a mail connection, not yet approved.

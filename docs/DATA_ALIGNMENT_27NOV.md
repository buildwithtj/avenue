# Data alignment, 27 Nov 2026

Live lists compared with the client sheet ([CLIENT_SHEET_BOOKING_DATA.md](CLIENT_SHEET_BOOKING_DATA.md)). Run on the site as TDDAdmin. Rows were recycled one id at a time (recoverable from the site Recycle Bin); nothing bulk-deleted. Flows, apps, pages and the app catalog were not touched; no e-mails.

## Step 1: comparison (before)
| List | Result vs client data |
|---|---|
| AvenuePlans (19) | 8 current + 10 legacy match the sheet (names, price, card price = price x 1.03 for current plans, hours, extra rate, OpenToNew). Extra row id 1 `demo-plan-std`. |
| AvenueEquipment (28) | All 16 pieces + 6 prep tables present; pizza ovens 1-3 (ids 13, 25, 26) inactive. Extra rows: ids 2-4 `demo-eq-*` (inactive); ids 21 `Oven 2`, 22 `Prep table #20`, 23 `Oven #21` (inactive, not in client data, origin unknown). |
| AvenueDiningTables (10) | 10 tables x 5 seats = 50. Matches. |
| AvenueFacilities (1) | MinBooking 60, step 30, MaxCompanies 2, MinPrepTables 2, EarlyEntry 30, Cleanup 30 match. `EntryGraceMinutes` was 15 (my proposal), client says 10-minute check-in grace. ExitGraceMinutes 15 (proposal, no client value). 24 h opening has no field. |
| AvenueRequiredDocTypes (7) | Matches the 7 types. |
| AvenueSensors (8) | 8 present with names, rooms, ranges as in `ENVIRONMENT_PLAN.md` (both "Complimentary Refrigerator 1" suffixed with their codes). Sheet says 9; the 9th is not readable. |
| AvenueNotices (4) | id 9 `Welcome to Avenue` (real, kept); ids 10, 11, 13 `demo-md-notice-1/2/3`. |
| AvenueChecklistQuestions (18) | id 6 `Kitchen Clean?` (staff test, kept); ids 7-23 `demo-md-q-*` "Sample:" questions (kept by instruction). |
| AvenueMembers (1) | id 12 TDDAdmin (kept). |
| AvenueMyMembership (5) | ids 2, 3, 4 demo.*@example.invalid on demo-plan-std; id 11 automations@ `gaptest-biz` on demo-plan-std; id 12 TDDAdmin. |
| AvenueCalendar (7) | ids 53, 55, 56 `Test Kitchen Co.`; id 54 `gaptest-biz` (28 Nov, no backing booking); ids 59-61 gaptest-hrs-a/c/b. |
| AvenueBookings (4) | 92 (automations@, Declined), 99-101 gaptest-hrs-a/b/c (kept). |
| AvenueApplicants (2) | Not in scope; plan ids emerging-10 / emerging-80. |

## Applied
| List | Id | Change | Reason |
|---|---|---|---|
| AvenueFacilities | 1 | EntryGraceMinutes 15 -> 10 | Client: 10 min check-in grace |
| AvenueNotices | 10, 11, 13 | recycled | demo notices |
| AvenueCalendar | 53, 55, 56 | recycled | `Test Kitchen Co.` test rows |
| AvenueMyMembership | 2, 3, 4 | recycled | demo members |
| AvenueEquipment | 2, 3, 4 | recycled | `demo-eq-*` rows |
| AvenueMyMembership | 11 | Title and BusinessName `gaptest-biz` -> `Avenue Test Kitchen`; PlanId demo-plan-std -> emerging-10 | test account. The list has no ChangeReason field, so none was recorded (reason: Data alignment 27 Nov: demo plan removed) |
| AvenuePlans | 1 | recycled | no member, applicant or other list referenced `demo-plan-std` (checked Members, MyMembership, Applicants just before) |

Config rows needed no additions: plans, equipment, doc types, dining and sensors already match.

## After (read-back)
Plans 18 (first id 2), Equipment 25, Notices 1 (id 9), Calendar 4 (ids 54, 59, 60, 61), MyMembership 2 (ids 11, 12), Members 1 (id 12), Facilities EntryGraceMinutes 10. Bookings gaptest-hrs-a/b/c, TDDAdmin member row 12 and ledger rows untouched.

## Not applied / open
- Equipment ids 21-23 (`Oven 2`, `Prep table #20`, `Oven #21`): inactive extras not in the client data, not demo-/gaptest-; left. Delete?
- Calendar id 54 (`gaptest-biz`, 28 Nov, stove-1 etc.): orphan test row, outside the stated list; left. Delete?
- AvenueMemberDocuments: 3 rows for the demo.* members (and AvenueNoticeDrafts: 2 rows containing `demo-`) still exist; outside the stated scope; left.
- Checklist id 6 `Kitchen Clean?` left.
- 9th sensor: sheet lists 9, only 8 readable. Need its code, name, room, range.
- ExitGraceMinutes 15 stays a proposal (no client value). 24 h opening is not stored anywhere.
- Real member list and real checklist questions still not available (Q12, Q-checklists).

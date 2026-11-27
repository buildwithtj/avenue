# Staff app CRUD matrix (generated screens, 25 Nov 2026)

Source: `apps/staff-powerapps/gen.py` (scan of Patch/Defaults, Patch on a record, Remove, galleries). C = create, R = read, U = update, D = delete.
**Before** = screens that existed before Screen24. **After** = with the new **Data admin (Screen24)** (`screens/dataadmin.pa.yaml`).
Delete rules: config rows = real delete (one selected row, typed "delete") or Deactivate; money/audit/history rows = delete ONLY `gaptest-`/`demo-` rows, real rows are cancelled/archived/counter-adjusted on their own screen; members are never deleted (Deactivate; demo reset is the only exception, Member admin).

| List | Before (screen: ops) | Gaps before | After (Screen24) |
|---|---|---|---|
| AvenueApplicants (onboarding) | Applicants: R C U (approve, reject, invite checklist) | D | R C U (form), D test rows only |
| AvenueMembers | Members (frozen): R C U; Member admin: R C U, deactivate, demo reset | (D by rule: never) | R + link to Member admin |
| AvenuePlans | Setup: R U (+ Active) | C, D | R C U, Deactivate, D |
| AvenueEquipment | Setup: R C U | D | R C U, Deactivate, D |
| AvenueDiningTables | Setup: R U | C, D | R C U, Deactivate, D |
| AvenueRequiredDocTypes | Setup: R C U | D | R C U, Deactivate, D |
| AvenueChecklistQuestions | Checklist: R C U | D | R C U, Deactivate, D |
| AvenueSupportCategories | Setup: R C U D | none | R C U, Deactivate, D |
| AvenueSensors | Sensors: R U | C, D | R C U, Deactivate, D |
| AvenueStaffCapabilities | Permissions: R C U | D | R C U, D (owner only) |
| AvenueNotices / NoticeDrafts | Notices: R C U D | none | Notices: R C U D (unchanged) |
| AvenueFacilities | Settings: R U | (single facility: C/D not wanted) | unchanged |
| AvenueBookings | Requests/Approved: R U (approve, decline, cancel, extend) | D | R, D test rows only |
| AvenueBookingRequests | Book: R C U | D | R, D test rows only |
| AvenueHoursLedger | Setup/Member admin: R C (counter-adjust) | D (by rule: never for real rows) | R, D test rows only |
| AvenueCheckIns | Check-ins: R U (resolve) | D | R, D test rows only |
| AvenueInvoices | Payments (frozen): R | C/U/D (Stripe owns invoices) | R, D test rows only |
| AvenueMemberDocuments | Compliance (frozen): R U; Member admin: R U | C (via submissions), D | R U (form), D test rows only |
| AvenueDocumentSubmissions | Member admin: R C U | D | R, D test rows only |
| AvenueComplianceCases / Overrides | Compliance (frozen): R C U | D | R, D test rows only |
| AvenueSupportCases | Support: R U (reply, close, archive) | D | R, D test rows only |
| AvenueEventCases / AvenueStorageCases | Events / Storage: R U (approve, decline, re-open) | C, D | R U (form), D test rows only |
| AvenueCalendar | Requests/Dashboard: R | (flow-made mirror: read only) | R |
| AvenueHostRequests | Members/Payments/Events: R C | (host-made: read only) | R |
| AvenueTeamMembers, AvenueEventRequests, AvenueStorageRequests, AvenueComplianceFlags | Member admin: R (team) | member own-items intake lists: staff read access UNKNOWN | not on Screen24 (cases mirror them) |

Not possible in Power Apps alone: voiding or refunding an invoice (Stripe owns it, test mode; done in Stripe or through the host), deleting a member's own-items intake rows, and hard delete of a support case with its thread and files (spec R3, owner flow, not built, Q-R5).

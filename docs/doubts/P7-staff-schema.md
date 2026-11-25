# Doubts: P7/P8 staff CRUD, schema, flow specs, host plans (23 Nov 2026)

Local build only. Ran: `python3 gen.py && python3 check.py` (OK, 1655 controls in 23 files), `node schema/check.mjs` (43 lists, 405 fields), `node --test invariants.test.mjs` + `seed.data.test.mjs` (18 pass), `cd apps/integration-host && node --test` (83 pass, was 75). Nothing pasted into Studio, no list, flow, host or tenant change, no e-mail.

## Staff app (unverified in Power Apps)
- **Form control**: `maDocForm` is emitted as `Control: Form@2.4.4` with no cards; the version string is a guess (not in any existing file). check.py now allows that type plus `SubmitForm`, `EditForm`, `ResetForm`. The Attachments card is added by hand in Studio (STAFF_CRUD_GUIDE §3 step 6), because the YAML of a typed data card variant is UNKNOWN. If paste fails, insert the form by hand.
- **Other check.py edits**: Screen23 allowed (`range(1, 24)`), six new data sources allowed. release.py maps Screen23 / `memberadmin` to the `documents` module.
- **Staff reading members' own-items lists** (AvenueSupportMessages thread, AvenueTeamMembers roster): UNKNOWN. Item-level read security normally hides other people's items from Contribute users; both views fall back (LastMessage / an explanatory note). If staff must see threads, options are a flow-written staff copy of each message or granting the staff group "override list behaviours" — a decision, not made here.
- **Capability toggles** are wired only into buttons I added or touched (Member admin, Applicants, Setup equipment/plans/tables, Notices). Requests/Approved/Book/Compliance still ignore them. No row for an e-mail = allowed, so the app works before the owner fills the list; say if the default should be deny.
- `mDeactivate` was refactored into `DEACT()` in gen.py; members.pa.yaml output is byte-identical (cmp). Its Filter keeps the existing `Status = "Approved" || "Pending"` OR, which the house rules otherwise avoid.
- Pre-existing overlap fixed: on Applicants, *Invite sent* (280 px) covered *Reject* for Invite-needed rows; now 210 px.
- **Notices edit**: republishing creates a new AvenueNotices item, so the live "Notice e-mail" flow sends its generic e-mail again and P3's AvenueNoticeReads treats it as unread. Expiry is "Hide after N hours" (DatePicker removed); a draft's hours are kept as `ExpiresAt - Modified`, which drifts if someone edits the draft row in SharePoint directly.
- **Events re-open after approval** leaves the invoices the host already created; the owner must void them in Stripe test mode. Re-open needs flow change R8 or the member keeps the old Outcome.
- **Member admin status save** allows Invited/Paid/Onboarding/Active by hand (as the frozen Members screen does). Setting Active this way skips Applicants/documents; say if it should be limited.
- **Pipeline** computes a nested LookUp per application (not delegable); fine for tens of rows, slow for hundreds.
- Verify/Unverify has no VerifiedBy/VerifiedAt column, so who/when is not recorded for that action (Compliance has the same gap). Add columns?
- Staff-made applications start at *Invite needed* with no payment link [PROPOSED]; who pays and how is open (STR-06).

## Schema
- Support Category Choice → Text: conversion of a live column with data is UNTESTED; spec says test on a `gaptest-` copy first. Until both the column and flow R1 change, a new topic added in Setup is refused by SharePoint / the flow.
- Added `AvenueSupportFiles` (private library) and `ArchivedBy`/`ArchivedAt` on cases, not in the brief's list but needed by the attachment spec and the "who/when" rule.
- Mirror keys I chose: `DocKey` = `doc-<AvenueMemberDocuments ID>`, `HoursKey` = `<member>|<period>`, `BookingId`. Field names match what P5/P6 reads (docs/doubts/P5P6-docs-support.md).
- Support topics are seeded through `seed.data.mjs` (`buildSupportTopics`) as **real config** (Title = topic, no prefix) so `seedCleanup()` never removes them. If you wanted them `demo-`-prefixed test rows instead, they would show "demo-Booking" to members.
- DATA_AND_ACCESS.md said 37 lists; the file had 38 after P3; now 43.

## Flows (spec only)
- Thread delete (R3) waits for Q-R5; deletes go to the recycle bin one id at a time.
- R4 FileUrl: granting the mirror row does not grant the private file; the member link would 403. P5/P6 already does not show it.
- R5 sums ledger rows with an xpath trick; check it against a real month before trusting ExtraHours (display only; billing rules are Q-06/Q-R2).
- P5/P6 notes the **cancel / extend flows** must accept staff-authored bookings for a member (check `AvenueBookings.MemberId = author`), otherwise members see staff-made bookings (AvenueMyBookings) but cannot cancel them. Not specified here.
- Q-R3 retention of support attachments is open; nothing is deleted automatically.

## Host
- `SP_BRIDGE_PLANS` is optional and not added to `deploy/deploy.sh` (deploy artefact; add when the flow exists). With it, a plan created in SharePoint needs Stripe test prices with lookup key `avenue-<plan id>-bank|card`, or a paid join throws "no price" (test-mode skip still works).
- If SharePoint has plans but none open to new members, the host falls back to plans.mjs rather than closing /join; say if closing is wanted.

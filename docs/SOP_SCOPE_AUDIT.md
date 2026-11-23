# Avenue Phase 1: SOP and scope conformance audit (12 Nov 2026)

## 1. Summary

**Does the build follow the SOPs and scope?** Mostly yes, for the parts that exist. Where the build differs from the SOP (Draft 0.1, 10 Nov), it usually follows a later decision from the 11 Nov client call (D1, D3, D5, D8, D9, D10) or an engineering proposal recorded in `docs/DECISIONS_AND_OPEN_QUESTIONS.md`. The rest of the gap is Stripe work that is blocked. Across all modules and the original scope, verification confirmed **about 15 distinct defects and gaps that can be fixed now** (listed once each in §2 and §9); the rest is client-decided change, recorded proposals, or blocked work.

The most serious defect is that **a member who renews an expired document is still blocked from booking**. Three medium defects are trust-boundary checks that run only in the browser or only in the app:
- the request flow refuses only `Inactive` members, so it fails open for everyone else;
- the staff Book screen applies the document block in the app only;
- the check-in flow trusts `AllPassed` as sent by the browser.

About 40% of the audited items cannot be built yet. The causes are Stripe (Q-01, Q-02, Q-06), the plan rates (Q-04), admin and guest access, and other open client questions. Many SOP sections are now out of date: their "None — not built" status lines and several rules were replaced by the 11 Nov call.

**Who sets up the Stripe account that receives payments:** the Flavors operator. They own the connected account and set it up themselves through Stripe-hosted onboarding launched from Avenue (STR-01/02/03). B Street HQ owns the Connect platform settings. The platform invite is currently with TJ at DKD (11 Nov call), and nothing on the Stripe side is built yet (Q-01, Q-02).

| Module | Items | conforms | client decision | proposal | unjustified | buildable gap | blocked | SOP outdated | out of scope |
|---|---|---|---|---|---|---|---|---|---|
| SOP-01 Stripe Connect | 21 | 3 | 0 | 0 | 0 | 0 | 13 | 5 | 0 |
| SOP-02 Onboarding | 19 | 3 | 0 | 0 | 1 | 1 | 12 | 2 | 0 |
| SOP-03 Booking | 22 | 4 | 2 | 1 | 3 | 3 | 3 | 6 | 0 |
| SOP-04 Check-in | 22 | 9 | 0 | 4 | 1 | 1 | 5 | 2 | 0 |
| SOP-05 Compliance docs | 18 | 7 | 0 | 1 | 1 | 5 | 3 | 1 | 0 |
| SOP-06 Billing | 24 | 5 | 0 | 1 | 1 | 2 | 12 | 3 | 0 |
| SOP-07 Sensors | 11 | 1 | 0 | 0 | 0 | 0 | 9 | 1 | 0 |
| SOP-08 Communication | 16 | 4 | 1 | 1 | 2 | 4 | 2 | 2 | 0 |
| SOP-09 Reporting | 18 | 5 | 0 | 1 | 1 | 2 | 7 | 2 | 0 |
| SOP-10 Administration | 45 | 4 | 0 | 7 | 4 | 3 | 22 | 3 | 2 |
| Original DKD scope | 40 | 10 | 8 | 6 | 1 | 5 | 10 | 0 | 0 |
| **Total** | **256** | **55** | **11** | **22** | **15** | **26** | **98** | **27** | **2** |

Counts are per module and include the same issue seen from several modules; §2 and §9 list each confirmed issue once. SOP-07 to SOP-10 and the scope rows were added from the verified unit results after the first synthesis was cut short (see §8).

Two verdicts were corrected by the verification pass and are counted with the corrected value:
- SOP-01 Step 04 (readiness handler): changed from buildable to **blocked**. SOP-01 ties the readiness fields to Q-02, and Q-01 blocks "All Stripe code".
- SOP-05 owner-override scope: changed from unjustified to **proposal**. `TWO_WEEK_PLAN.md` line 47 records it as "open-ended exception, marked provisional".

## 2. Confirmed gaps to fix now

Every row below survived verification. Rows describing the same problem in two modules are merged.

| Ref | SOP/scope requires | As built | Sev. | Recommended fix |
|---|---|---|---|---|
| SOP-05 T4 / Step 05; BKG-15, CMP-03 | A replacement document makes the member Current again, and the booking block lasts only "until renewal or override". The new version is linked to the one it replaces. | The request flow blocks on *any* expired row (`ExpiryDate lt today`, `expressions.md` l.10), and so does the Book screen (`gen.py` l.236). No field marks a row as superseded. A renewed member stays refused unless the owner overrides or history is deleted, which Q-14 forbids. | **High** | Add a `Supersedes`/`IsCurrent` field to `AvenueMemberDocuments`. Have the submission flow retire older rows with the same DocType for that member. Filter on current rows in both checks. |
| SOP-02 T1–3; PLT-13, AGENTS.md "fail closed" | Only eligible (Active) members reach Pending. | `Get_items_4` matches only `Status eq 'Inactive'` (`expressions.md` l.151). Invited, Paid and Onboarding members, and authors with no member row, all get Pending. The staff Book screen, by contrast, allows Active only. | Med | Decline unless exactly one `AvenueMembers` row exists with Status `Active`. |
| SOP-03 Step 12; BKG-15, D9 | Staff booking on a member's behalf goes through "the same checks", and only the owner can override. | Book (`book.pa.yaml`) checks documents in the app only. Staff hold Contribute on `AvenueBookings`, so they can write an Approved booking directly and skip the check. Nothing blocks a staff booking that overlaps an approved private event. | Med | Send staff bookings through a trusted flow that runs the same document and private-event checks, and/or tighten list permissions. The SOP-05 unit rated this same item "blocked (admin)". The verified SOP-03 verdict, which says the flow route can be built now, is the one kept. |
| SOP-04 Step 03; CHK-05 | The pass/fail result is decided at the data boundary. | The flow copies `AllPassed` from the intake item the member can edit (`expressions.md` l.62). The alert, the dashboard tile and the red flag all rely on that value. | Low–Med | Compute `AllPassed` from `Answers` inside the flow. Add a DECISION_LOG row for the [PROPOSED] "all Yes = pass" rule. |
| SOP-03 Step 05; BKG-07 | The confirmation e-mail has a portal button to change, cancel or view the booking. | The decision e-mail (`expressions.md` l.128–134) has no portal link. The reminder e-mail has one. | Med | Add the portal link and record it in `expressions.md`. A deep link to a single booking would need an authorised route; until then, link to My bookings. |
| SOP-03 Input 1; BKG-01 | The trusted path rejects equipment that does not exist. | Equipment is checked in the member form only (`booking.ts` l.31–33). The flow copies `EquipmentIds` unchecked (`day4-staff-approval.md` l.23). | Med | In the request flow, check `EquipmentIds` against active rows in `AvenueEquipment`. |
| SOP-02 Step 06 / SOP-05 Step 01; CMP-01, PLT-09 | Staff can upload a document on a member's behalf, with the acting staff identity and time recorded. | No upload control in the staff app. The submission flow sets `MemberId = author`. No field records who uploaded. | Med | Add an upload with a member picker to the staff Compliance screen, plus an `UploadedBy`/`At` field (same pattern as `BookedBy`). |
| SOP-05 Output 1 / T1; CMP-01/02 | Missing required documents are listed separately (state Missing, then Current). | `DocStatus` has only Current, Expiring and Expired. There is no setting for required types. | Med | Add a staff-editable list of required types, left empty until Q-11 is answered, and a Missing view. Do not fill in the types before Q-11. |
| SOP-05 Step 04; CMP-03 | A one-off renewal reminder with a portal link when a document becomes Expiring. | No reminder flow. The mail connection now exists (`day7-8-emails.md`). | Med | Reuse the mark-before-send reminder pattern (DECISION_LOG row 29) with the 30-day default window. |
| SOP-04 Step 03 / T2; CHK-05 | A failed entry gets a follow-up and a recorded resolution (resolved by and at). | Failed checklists show red but cannot be resolved. `AvenueCheckIns` has only `AlertSentAt`. | Med | Add Resolved/Outreach fields and a "Log outreach and resolve" action, as already done for missed entry. |
| SOP-06 Exc 1; STR-08 | Duplicate or out-of-order Stripe events never change a balance twice. | Duplicates are handled. Out-of-order events are not: a `payment_failed` arriving after `paid` is still recorded as processed (`webhook.mjs` l.36–49), and no test covers it. | Med | Keep per-invoice state in billing-core, treat paid as final or compare `event.created`, and add a unit test. |
| SOP-06 Step 06; D5 "admin dashboard must show it" | Operator and staff see overage. | The dashboard shows hours used only. Its `dNote` defers overage to Q-04. | Med | Show overage in hours (ledger total minus plan `MonthlyHours`), as the portal already does. Money amounts wait on Q-04. |
| SOP-06 Output 2; PAY-03 | Estimates are shown separately from final amounts. | The portal states "h over your allowance" as fact (`HomeView.tsx` l.44). | Low | Reword, e.g. "about N h over, based on approved bookings; final amount on your invoice". |
| SOP-03 Step 09; BKG-10 | Only the owner or staff may adjust booked hours, and adjustments are audited. | Staff can only cancel or give a No-show credit for a whole booking. The ledger Reason has no Adjustment option and no actor field. | Low | Add a staff ledger entry for adjustments with reason, actor and hours. |
| SOP-03 Exc 2 / SOP-05 Exc 1 | Record uncertain or failed sends and failed uploads, and escalate them. | Mark-before-send prevents resends (conforms), but failures are never recorded. Monitoring is "Not configured" (`ARCHITECTURE.md` l.78). | Low | Add a run-after-failed branch that stamps a field or alerts `StaffAlertEmail`, plus a staff view of submissions stuck in "Uploading". |
| SOP-03 Closeout; AGENTS.md traceability | Traceability from stage to feature to evidence is kept current. | `REQUIREMENTS_TRACEABILITY.md` still marks as not built or blocked: BKG-03/05 (l.32), BKG-07 (l.35), BKG-09/10 (l.37), CMP-01/02/03 (l.47–48) and CHK-06 extension (l.45). Staff app `README.md` l.9 is also stale. | Low | One documentation pass to match the evidence files. |

## 3. Deviations by client decision

| Ref | SOP says | Built (follows decision) | Decision |
|---|---|---|---|
| SOP-03 Step 03 / T1 / B2 | A free slot is confirmed automatically, first come first served, with no staff approval. | Every valid request becomes Pending, staff approve it in the Requests screen, and staff get an alert e-mail. | Call 11 Nov **D3**. DECISION_LOG 2026-11-11 row 16 replaces Email 3. |
| SOP-03 Step 04 / T2 | A conflict is held, and a booking never overrides another. | Staff may approve an overlap (same equipment or whole facility) with a note. Every affected member is told, without naming the other member. | **D3**. Rules for caterers and light use are still [OPEN]. |

Several builds that follow D1, D5, D8, D9 and D10 are listed in §6, because there the SOP text is what needs to change.

## 4. Engineering proposals awaiting client confirmation

| Ref | Built behaviour | DECISION_LOG |
|---|---|---|
| SOP-03 Step 06 (extend) | Extra time is a request that staff approve, on the same day, with an overlap flag and its own ledger row. | 2026-11-12 row 38 |
| SOP-04 Step 01 / Exc 2 | Reminders are marked sent before sending, so each goes at most once; a failed send can be lost. | 2026-11-12 row 29 |
| SOP-04 Step 01 (catch-up) | A booking approved late gets only the reminder level currently due. | Row 29 (Q-10) |
| SOP-04 Steps 04/06 | Entry and exit grace periods are 15 min, editable in Settings. | Rows 31, 36 (Q-10) |
| SOP-04 Step 05 | No prompt at the end time; the first prompt is the overdue-exit nudge. | Row 36 |
| SOP-05 T4 (override scope) | The override is per member, covers all documents and has no end date. | **No DECISION_LOG row.** Recorded only in `TWO_WEEK_PLAN.md` l.47. Add a [PROPOSED] row. |
| SOP-06 Step 02 | The ledger counts booked time, not attended time. | 2026-11-12 "Hours ledger…" row (Q-09, Q-23; D2) |

Other proposals that exist only in code comments and need a DECISION_LOG row: upload limits (PDF/JPEG/PNG, 10 MB), the "all Yes = pass" check-in rule, and the intake-plus-private-library permission design (SOP-02 §5/§6).

## 5. Blocked items

| Blocker | Items |
|---|---|
| **Q-01 host/secret store, Q-02 account/fee model, Stripe access** (+ Q-06 billing rules) | SOP-01 Steps 01–08, Output 1, B1/B3, Exc 1/3, closeout. SOP-02 Steps 02/03, Exc 1/2, separate payment state. SOP-06 Step 01 subscriptions, Step 03 invoice items, Step 04 balance/history, Step 05 member invoices/history, Step 09 refunds/disputes, Exc 4 (tax/proration), closeout. |
| **Q-07** definition of overdue (+ Stripe) | SOP-03 Step 13 overdue block; SOP-06 Steps 07/08. |
| **Q-04** plan tiers, rates and charges | SOP-02 Step 01 plan selection (also Q-20, Q-17); SOP-03 Step 02 cost display; SOP-06 rate snapshot, equipment and storage charges (also Q-25). |
| **Q-08 + Q-02** | SOP-03 Step 11 dining/event deposit refunds (also call open question 2). |
| **SharePoint/M365 admin access** (app catalog, guests, test accounts) | SOP-02 Step 05 guest invite and own-area access, closeout. SOP-05 direct-link privacy tests P1–P9, closeout. SOP-04 wellness permission boundary test. Staff and owner role tests across SOP-03/05. |
| **Q-05** | SOP-02 Step 04 member approval and refund of a rejected applicant. |
| **Q-10** | SOP-02 Step 05 profile and team; SOP-04 per-member wellness, continue after a failed entry, exit per person, wellness access and retention, closeout. |
| **Q-11** (+ Stripe) | SOP-02 Step 07 eligibility (required types, paid state). |
| **Q-21** | SOP-02 Step 08 payment methods for existing members and mapping of old tiers. |
| **Q-12, sensor key reissue, Q-01** | SOP-07 Step 01 unit mapping, Step 02 polling, B2 retry/outage. |
| **Power BI HQ not started** | SOP-06 B Street HQ analytics. |

## 6. SOP text that must be updated

| SOP ref | Current text (summary) | Should now say |
|---|---|---|
| SOP-01 §1 Prereq / roles | The Stripe invite is with the development team; the host is not selected. | The invite is with TJ at DKD and developer access is pending. DKD provides the servers (Q-01 partly answered). Add DKD as a party. Who owns the servers after handover is still open. |
| SOP-01 Step 01 | Silent on fees and payment methods. | D6: Stripe fees are paid by the member (pass-through method and legality to be checked under Q-02). D7: offer every Stripe method (ACH, cards, Apple Pay, Google Pay). Reconcile with the 10 Nov fees.payer proposal. |
| SOP-01 §5 B2 | "None — not built". | Verify, account check and de-duplication are built in `apps/billing-core` and unit-tested, but not deployed. |
| SOP-02 Steps 02/03, Exc 1 | Silent on fees and ACH. | D6 member pays the fee. D7 ACH confirms asynchronously, so add a "payment processing" state that is neither Paid nor Failed. |
| SOP-02 Prereq (Q-04) | Plans and prices unknown. | D4: the base plan is 10 h/month with no rollover. Mapping members on old tiers is still open. |
| SOP-02 §5/§6, SOP-05 Input 1 / B2 | A permission is granted on each file; if the grant fails, the document stays Pending. | Intake list with item-level security, plus a private library that members cannot read. This fails closed by design. |
| SOP-03 Input 1 / Steps 01–02 | Booking by station or table. | Booking by equipment (D1), with a people count for dining and whole-facility bookings. |
| SOP-03 Step 02 | Show the extra-hour cost at booking. | D5: no charge at booking. Overage is invoiced and due with the next payment. |
| SOP-03 Step 03 / T1 / B2 | Auto-confirm, first come first served. | D3: management approves every booking. |
| SOP-03 Step 07 | Hours returned is "implied [Q-00]". | D8 confirms that hours are returned. |
| SOP-03 Step 08 / T4 | Under 24 h, staff decide whether the hours are lost. | D8: the member cannot cancel; management cancels and the hours are returned. |
| SOP-03 Step 10 / T5 | A no-show loses the booked hours. | D8: no-shows are credited back unless abused. The abuse rule and detection are still Q-09. |
| SOP-03 Exc 1, Prereq Q-03 | At most one of two simultaneous requests is confirmed; the concurrency mechanism is a prerequisite. | BKG-05 / D3: overlap prevention is not required, Q-03 is downgraded, and both requests go to the approval queue. |
| SOP-03 §1 scope | Kitchen and storage only. | Add dining-room and private-event bookings (D9). Whether storage rental is in Phase 1 is open. |
| SOP-03/04/05/06 §5 status lines | "Proposed / None — not built, configured or tested". | Built (test), with links to `docs/evidence/day3`–`day8` files and to `expressions.md`. |
| SOP-04 Step 02 | Every team member completes the full checklist. | D10: one lead completes the kitchen checklist. Per-member wellness on a phone is a preference, not final (Q-10). |
| SOP-06 Step 03 / Exc 3 | Overage goes on that month's invoice; "do not assume next month". | D5: the invoice is generated that month and is due with the next monthly payment. |
| SOP-06 Prereq | Q-06 is a blocker. | Q-06 is partly answered by D5. Add D2 (only time in the facility counts) and D4 as inputs to Step 02. |
| SOP-07 Prereq | (per unit summary) | Add the sensor key reissue and DKD-provided hosting. |

## 7. Out of scope / future

No audited item received an `out_of_scope` verdict. These scope questions remain open and should not be built until answered:
- whether storage rental is in Phase 1 (call open question 6, Q-25);
- whether member wellness check-in for every team member is in Phase 1 (Q-10).

Phase 2 SaaS features did not appear in any build item.

## 8. Method and limits

- **What was done.** A read-only audit of the repository, with no tenant, Stripe or browser access. Each unit compared the SOP Draft 0.1 against the governing sources in this order: 11 Nov call and DECISION_LOG, then CLIENT_DECISIONS, then REQUIREMENTS_BASELINE, then the DKD scope. Every gap or defect verdict then went through a skeptic verification pass, and two were corrected (see §1).
- **Where live behaviour comes from.** Only from the dated evidence files `docs/evidence/day2`–`day8*.md` (11–12 Nov). All live tests ran as the automations@ owner account or in Power Apps Studio preview.
- **Not verified:**
  - guest, staff and owner role boundaries, including direct-link denial for documents and staff refusal of overrides;
  - the portal deployed in SharePoint (unit tests only);
  - the staff app published;
  - anything in Stripe (billing-core is unit-tested and not deployed);
  - whether a guest Author e-mail matches MemberId;
  - the content of the flow-failure path.
- **How SOP-07 to SOP-10 and the scope were added.** The first synthesis received truncated input (an input cap in the workflow script) and covered only SOP-01 to SOP-06. All unit audits and their skeptic checks had completed; §1's table rows and §9 for SOP-07 to SOP-10 and the original scope were written afterwards from those verified unit results. Verdicts refuted by a skeptic use the corrected value (SOP-07: two "buildable" items → blocked by Q-12/Q-01; SOP-08: re-prompting on update → conforms, record as a proposal).
- **Blocker classification.** Unit auditors also counted open client questions (Q-05, Q-10, Q-11, Q-21, Q-08) as blockers, beyond the listed set. Verdicts are reported as returned.

## 9. SOP-07 to SOP-10 and the original scope: confirmed findings

Each row survived the skeptic check. Items already in §2 (staff Book bypass of the document block, staff on-behalf upload, renewal nudge, portal link in the decision e-mail) are not repeated.

| Ref | Requires | As built | Sev. | Fix |
|---|---|---|---|---|
| SOP-08 T2 "Withdrawn"; AGENTS.md "UI filter is not access control" | A withdrawn notice is no longer readable by members | Withdraw sets Active=false only; members keep Read on the whole notices list and the portal just filters `Active eq 1` | Med | Move withdrawn notices out of member reach (staff-only list, item permission removal, or recycle bin) |
| SOP-08 §1 Excludes; COM-02; C-04 (only BKG-07 may carry booking detail) | No operational detail in e-mails except the booking confirmation | Reminders, missed-entry/exit nudges, extension and overlap e-mails include times, space and staff notes | Med | Either make these e-mails generic "sign in to view", or get the client to approve an exception and record it in C-04 |
| SOP-08 Step 03 / Exc 2 | Each notice prompt logged once; a retry never re-sends | Notice flow writes nothing back; no NotifiedAt, so a resubmitted run could re-send | Med | Add NotifiedAt and mark it before sending (same pattern as reminders) |
| SOP-08 Step 01 / T1 | Drafts stay private until published | No draft state; members can read every row of the notices list | Med | Staff-only drafts list (or item permissions), publish copies to the member-readable list |
| SOP-08 Step 01 | Publish to all members or a chosen audience | All members only; no audience field | Med | Audience field + filter; audience definition is Q-13 |
| SOP-08 Step 04 / T2 | Updating a notice records a new version | Withdraw only; no edit control; list versioning not confirmed | Low | Edit action on the Notices screen; confirm versioning on the list |
| SOP-09 / DECISION_LOG 2026-11-12 (Eastern month) | Dashboard month = facility (Eastern) month, same as the ledger | Dashboard uses `Text(Today(),"yyyy-mm")` in the device time zone; viewers outside Eastern see the wrong month near month end | Low | Compute the Eastern month in the app (fixed offset with DST rule) or store a "current period" value written by a flow |
| SOP-09 Output 1; RPT-04; scope §8 | Equipment usage reported | No equipment measure on the dashboard | Med | Booked hours per EquipmentId over approved bookings this month; fills in once equipment data arrives |
| SOP-09 §5 B1 | Figures show their refresh time | No "last refreshed" label | Low | Set a refresh timestamp on screen load and refresh; show it |
| SOP-10 §2 Input 1; ADM-01 | Operator cannot change platform functionality outside the screens | "Avenue Flavors Owner" has Edit (includes Manage Lists) on catalog, private and owner lists, so the owner could delete columns or lists the flows need | Med | Give the owner Contribute (or a custom level without Manage Lists) on these lists; site owner can do this without tenant admin |
| SOP-10 §4 T1 | Leaving Inactive needs a deliberate, recorded action | Saving any edit on an inactive member in the Members screen silently reactivates them (status dropdown has no Inactive and defaults to Active) | Med | Keep Inactive in the dropdown or disable Save for inactive members; add an explicit "Reactivate" with a reason |
| SOP-10 §2 Output 1 | Audit of who changed what, when and why | Only SharePoint Created/Modified and version history; versioning not read back on the live lists; no reason field for member edits or deactivation | Med | Verify versioning on every list; add a reason/actor field (or audit list) for member edits and deactivation |
| SOP-10 Step 02 | Operator maintains plans and equipment in the staff app | Lists exist but there is no Plans or Equipment screen | Med | Add Plans and Equipment screens (values still come from Q-04 / Q-22) |
| SOP-10 Step 05; ADM-03; scope support | Operator/staff raise support tickets to B Street | No support list, flow or screen | Low–Med | Propose a minimal own-items ticket list (Q-13 needs a proposal and client approval) |
| SOP-10 Step 07 | B Street approves platform-level changes | Real site, Eastern time zone and similar tenant changes were made on developer instruction, not recorded as B Street approvals | Low | Record B Street's approval of those changes in DECISION_LOG |

SOP-07 (sensors): nothing is built; all items are blocked by Q-12 (units, thresholds, freshness limit) and the reissued Swift Sensors key / host (Q-01). Original scope: the build follows the scope as amended by client decisions (Stripe instead of QuickBooks, SPFx member portal instead of member Power Apps, equipment instead of stations, native staff dashboard instead of operator Power BI, management approval of every booking); AGENTS.md rules (no QuickBooks, no Power Pages, no member Power Apps/Power BI licences, no replacement database, Phase 1 only, test mode only) are followed.

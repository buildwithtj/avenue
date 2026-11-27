# Phase 1 ship readiness (gap list), 27 Nov 2026

Read-only analysis from docs/STATUS.md, REQUIREMENTS.md, CHECKLIST.md, TEST_CHECKLIST.md, END_TO_END_TEST_GUIDE.md, DECISIONS_AND_OPEN_QUESTIONS.md, STAFF_CRUD_GUIDE.md, STAFF_CRUD_MATRIX.md, MOBILE_UI_V2_PLAN.md, REDESIGN_AND_ADMIN_CRUD_PLAN.md, flows/expressions.md and the latest CHANGELOG entries. Nothing was run for this report. "Tested" below repeats what those documents record; it was not re-run. Note: CHECKLIST.md is partly stale (it predates the host, Join, invoices list and sensors work of 20-23 Nov); where it conflicts with STATUS/CHANGELOG, the newer entry is used.

## 0. Where things stand

| Piece | Live (client) | Staging | Notes |
|---|---|---|---|
| Member portal | 2.19.0.0 (`Member-portal.aspx`) | 1.9.0.0 deployed (`Member-portal-staging.aspx`); 1.10.0.0 being built (browser-audit fixes) | Staging uses the real Join path (MOCK_PAYMENTS off); live still mock pay. Staging and live share the SAME lists. |
| Staff app | "Avenue Staff Console" (older screens) | "Avenue Staff Console (Staging)" with redesign screens + Data admin (Screen24) | Staging copy: 22 checker errors (Category Choice vs Text). |
| Flows | 18 core + 6 Support/Events/Storage live, sensor flows live | same (shared) | R1, R2, R4, R5, R6, R8, R9 specified, not built; R3 blocked (Q-R5). |
| Host (AWS, sslip.io) | test mode, `PAYMENTS_REQUIRED=0` | same | Join -> host -> Onboarding member proven (22 and 25 Nov). Paid sandbox checkout never completed end to end. |
| Lists | 43 lists reconciled 23 Nov | shared | Support Category still Choice on 2 lists. Empty `/sites/Avenue-Staging` site exists, unused. |
| Data | real config + demo-/gaptest- rows mixed in | shared | Test titles visible to members (demo-md-notice-*, demo-plan-std, gaptest-biz, Sample: questions). |

## 1. Gap list

Effort: S = under 2 h, M = 2-6 h, L = over 6 h. "Today" = we can do it without the client. "BLOCKED" = needs a client decision, approval, data or an admin step.

| # | Req | Area | Exists | Missing | Effort | Today? | Risk if shipped without |
|---|---|---|---|---|---|---|---|
| G1 | ADM-03 | Flows | Support flow 1 live (reads `Category/Value`) | R1: category from AvenueSupportCategories + Category Choice->Text on AvenueSupportMessages/Cases (tested on a gaptest list 23 Nov) | M | Today | New staff topics refused; staging staff Support/Setup screens show 22 errors |
| G2 | ADM-03 | Flows | Portal 2.19+ attachment upload sequence | R2: trigger "created or modified" + copy attachments to AvenueSupportFiles | M | Today | Member attachments break or are lost; STATUS says do not enable attachments until R2 |
| G3 | ADM-03 | Flows | Flow 2 echoes Answered/Closed | R9: "Archived" echo | S | Today | Archive re-echoes old reply text; Archived chip never shows |
| G4 | BKG-16/17, Q-25 | Flows | Flows 4/6 echo Approved/Declined/Invoiced | R8: echo "Requested" (re-open) | S | Today | Re-opened case keeps the old decision for the member |
| G5 | CMP, BKG-06, PLT-08 | Flows | Portal reads mirrors with silent fallback | R4 My documents, R5 My hours, R6 My bookings mirrors | L | Today | Staff-made bookings/documents and ledger hours not visible to the member (portal falls back to own items) |
| G6 | — | Staff app | Staging copy published | Fix 22 errors (Screen11/15) after G1; set maDocForm attachments 5 x 10 MB; fix "site recycle bin" toast text (Power Apps delete is permanent); test the untested Data admin sets (dining tables, doc types, checklist, topics, sensors, staff access, applicants) | M | Today (after G1) | Staff screens error or mislead; untested CRUD |
| G7 | — | Staff app | Client's live staff app untouched | Promote the staging copy to the client (or repoint) once approved | S | BLOCKED (client approval of staging) | Client keeps testing the old staff screens |
| G8 | — | Member portal | Staging 1.9 live; 1.10 in build | Deploy 1.10, re-audit on SharePoint at phone AND desktop; desktop not re-checked since 1.8 | M | Today | Unverified layouts on desktop/tablet |
| G9 | — | Member portal | Live 2.19 | Promote the staging design to live (rebuild live package from current source with live ids, real Join decision) | S | BLOCKED (client approval of staging) | Client's link keeps the old UI |
| G10 | — | Data | Mixed real/demo/test rows in shared lists | Rename or remove test-visible rows (demo-md-notice-1..3, demo-plan-std, gaptest-biz, Test Kitchen Co., gaptest-hrs-*, member 12/applicant 2 if not wanted), one id at a time | S | Today (with your OK per row set) | Client sees test artefacts |
| G11 | CHK-01/02, Q-10 | Data/content | 17 "Sample:" questions + "Kitchen Clean?" | Client's real entry/exit/wellness questions; team wellness model | S (load) | BLOCKED (Q-10, Q-M6) | Check-in shows sample wording |
| G12 | CMP-03 | Flows | Renewal reminder flow exists only unsaved | Save and test the 30/15/10-day reminder flow (sends e-mail) | S | Today with your OK (e-mails members) | No renewal reminders |
| G13 | CMP-02 | Flows | Daily status flow saved | Live verification of Current/Expiring/Expired run | S | Today | Wrong compliance status unnoticed |
| G14 | BKG-07 | Flows | Decision e-mail flow runs | Verify the delivered e-mail and its portal link | S | Today | Broken link in members' e-mail |
| G15 | — | Ops | none | Failure alerts on flows + StaffAlertEmail set; second flow owner | S | Today (address from client) | Silent failures (a failed run leaves a member with no outcome) |
| G16 | PLT-06/07/08/13 | Permissions | Config checked as automations@ | Test with a real second member (privacy by direct link), a staff account and an owner account | M | BLOCKED (guest/staff/owner accounts: admin) | Privacy and role rules unproven |
| G17 | PLT-04 | QA | Phone frames in Chrome only | Real phone pass in the SharePoint iOS/Android app with a member sign-in | M | Partly today (your phone), full needs guest account | Device-only bugs (cache, safe areas) |
| G18 | STR-05/06, PAY-01/07 | Payments | Host + Stripe sandbox, 26 prices, webhook verified | One paid sandbox checkout end to end with a Stripe test card (PAYMENTS_REQUIRED=1 on staging), subscription renewal on collection day, invoice in Billing | M | Today (test card is ours to enter in the user's own test app) | Payment path unproven before the client demo |
| G19 | STR-06 | Payments | test mode | Client approval of the demonstrated flow, then live keys | — | BLOCKED (STR-06) | n/a: must not go live without it |
| G20 | PAY-02, Q-06 | Payments | Overage computed and shown (estimate) | Overage invoice with the next payment | M | BLOCKED (Q-06 cut-off/proration) | Extra hours not billed |
| G21 | BKG-14, Q-07 | Payments | Flow refuses PastDue/Unpaid | Definition of overdue (grace, retries) | S | BLOCKED (Q-07) | Block timing may be wrong |
| G22 | ONB-03/06, Q-05, Q-M5 | Onboarding | Join -> Onboarding member; staff activate | First-payment rule, staff approval after payment, rejection path | M | BLOCKED (Q-05, Q-M5) | Onboarding rules unconfirmed |
| G23 | ONB-07, Q-M3 | Onboarding | Guest invite is a manual admin step | Automatic guest invite on acceptance | M | BLOCKED (admin consent User.Invite.All) | Manual invites per member |
| G24 | ONB-05, Q-21/25 | Data | 0 real members in AvenueMembers | Load existing members, plans, collection days | M | BLOCKED (client roster) | No real members to test with |
| G25 | SEN-01..04, Q-12 | Sensors | Lists, flows, staff screen live; 8 units | Hardware online (gateways offline since Jun), mapping, thresholds | S (ours) | BLOCKED (client hardware, Q-12) | Environment shows all Offline |
| G26 | RPT-01/04, Q-16 | Reports | Staff Reports screen (booked hours) | Attended hours, compliance/financial summaries per agreed measures | M | BLOCKED (Q-16) | Reports may mislead |
| G27 | RPT-03 | Reports | none | Power BI for B Street | L | Today (design) / BLOCKED (measures Q-16) | B Street analytics missing |
| G28 | ADM-02, Q-15 | Staff app | Capabilities hide buttons (UI only) | Agreed permission set; SharePoint permissions per capability | M | BLOCKED (Q-15) | Staff may see too much or too little |
| G29 | ADM-04, Q-14 | Members | Deactivate keeps history | Remove sign-in on deactivation (admin), future bookings and subscription cancel rule | S | BLOCKED (Q-14, admin) | Deactivated member keeps access |
| G30 | BKG-11/17, Q-08/22 | Events | Event request -> case -> quote live | Cancellation/refund rules, deposit amounts confirmed | S | BLOCKED (Q-08, Q-22) | Refund disputes |
| G31 | BKG-12, Q-09 | Bookings | No-show credited | Abuse rule | S | BLOCKED (Q-09) | none for testing |
| G32 | COM-01, Q-R1 | Notices | Notices + hide after 24 h [PROPOSED] | Client OK on 24 h default; notice creation test (sends e-mail) | S | BLOCKED (Q-R1) for default; test today with your OK | Notices vanish unexpectedly |
| G33 | ADM-03, Q-R5 | Support | Archive works | Owner hard delete (R3) | S | BLOCKED (Q-R5) | none for testing |
| G34 | PLT-12 | Host | Secrets on the AWS host env file | Secret store/vault | M | Today (design) | Secret handling below target |
| G35 | REL-02 | QA | END_TO_END_TEST_GUIDE (A-N), HTML checklist | One full pass of the guide on staging with results recorded | M | Today | No signed-off test record |
| G36 | — | Hygiene | Empty `/sites/Avenue-Staging` | Delete or keep (decide) | S | Today with your OK | Confusion only |
| G37 | Q-17, Q-19, Q-26 | Content | — | Onboarding on mobile, calendar member name, brand font | S | BLOCKED (client) | Minor |

## 2. Must do before shipping to the client for testing (priority order)

1. G1 R1 + Category Choice->Text (M, 3-4 h): unblocks Support topics and the staging staff app errors.
2. G2 R2 attachments trigger + copy (M, 3-4 h): or hide the attachment button on staging until done (S, 30 min).
3. G6 staff staging app: fix the 22 errors, maDocForm limits, wrong toast, test the remaining Data admin sets (M, 3-4 h).
4. G8 deploy staging 1.10, re-audit phone + desktop + tablet on SharePoint, fix findings (M, 3-5 h).
5. G35 run END_TO_END_TEST_GUIDE once on staging and record results (M, 4-6 h).
6. G18 one paid Stripe sandbox checkout end to end, invoice visible in Billing (M, 2-3 h).
7. G10 clean test-visible data (S, 1 h, per-row OK).
8. G15 failure alerts + StaffAlertEmail + second owner on critical flows (S, 1-2 h).
9. G13 + G14 verify daily document status and the decision e-mail link (S, 1 h).
10. G3 R9 archived echo (S, 1 h).
11. G4 R8 re-open echo (S, 1 h).
12. G12 renewal reminder flow (S, 1-2 h; needs your OK because it e-mails members).
13. G17 real-phone pass in the SharePoint app (M, 2 h).
14. G5 mirrors R4-R6 (L, 6-10 h): can follow the first client test if the limitation is stated.
15. G36 decide on the empty staging site (S, 10 min).

Realistic total for 1-13: about 25-35 hours of work, so not all of it fits in one day; items 1-9 (about 20-25 h) are the minimum for a credible client test.

## 3. Can ship with a known limitation (wording for the client)

- Payments: "Payments are in Stripe test mode. No money is charged. We will switch to live payments after you approve the demonstrated flow."
- Check-in: "The check-in questions are samples. Please send your entry, exit and wellness questions and we will replace them."
- Sensors: "Temperature readings will appear once the Swift gateways at Flavors are powered and online."
- Overage: "Extra hours are shown as an estimate; invoicing them with the next payment starts once we agree the billing cut-off."
- Mirrors (if G5 not done): "Bookings and documents Flavors adds for you appear in your portal after the next update."
- Reports: "Reports show booked hours; attended hours follow once we agree the measures."
- Staging data: "The staging pages use the same data as the live portal; test entries are marked and will be removed."

## 4. Blocked by the client (questions to ask)

| Q | Question |
|---|---|
| Q-10 / Q-M6 | Please send the entry, exit and wellness questions. Does each team member check in on their own phone, or does the lead record the team? |
| STR-06 | After the test demo, do you approve switching Stripe to live? Who on your side completes Stripe's identity checks? |
| Q-06 / Q-M5 | When does the first payment happen (full month, prorated to the collection day, or on the collection day)? Which usage counts for a month's overage invoice? |
| Q-07 | When does a balance count as overdue (grace days, retries), and when does the booking block lift? |
| Q-05 | After a member pays, must staff still approve them? What happens if you reject a paid applicant? |
| Q-21 / Q-25 | Please send the existing members with plan, collection day and payment method, and how old-tier plans map to current ones. |
| Q-12 | Can someone power the two Swift gateways? Which sensor is which fridge/freezer, and what are the limits? |
| Q-15 | Which actions should the staff account be allowed (approve bookings, refunds, members, documents)? |
| Q-14 | When a member is deactivated: cancel future bookings? cancel the subscription? how long to keep records? |
| Q-16 | Which report figures do you need (booked vs attended hours, compliance, revenue)? |
| Q-08 / Q-22 | Event cancellation between 8 and 14 days and under 7 days; deposit amounts. |
| Q-09 | When is a no-show credit refused (abuse rule)? |
| Q-R1 | Should notices hide automatically after 24 hours? |
| Q-R5 | May admins delete support conversations, or only archive them? |
| Admin (Q-M3, PLT-06) | Who creates guest sign-ins for members, and may Avenue invite paid members automatically (User.Invite.All)? |
| Q-17 / Q-19 | Is onboarding allowed on phones? On the shared calendar, show the business name or the person? |

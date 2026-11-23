# Requirements traceability

Maps each requirement in [REQUIREMENTS.md](REQUIREMENTS.md) (source and acceptance criteria live there) to its workflow stage in [WORKFLOW_STAGES.md](WORKFLOW_STAGES.md), the proposed component, and its SOP in `Avenue_Phase1_Complete_Module_SOPs.docx`. Components are [PROPOSED] architecture from [ARCHITECTURE.md](ARCHITECTURE.md), not built unless the Status column says so. Status on 2026-11-10.

Component codes: **SPFx** member web parts · **PA** Power Apps staff app · **SPL** SharePoint lists/libraries and permissions · **FLOW** Power Automate · **SVC** trusted integration service (host not selected, Q-01) · **STRIPE** · **PBI** Power BI · **DOC** documentation/process.

> **Status column refreshed 2026-11-13 from the evidence files and live checks; earlier "Not built" rows that are now built were corrected. Status words mean: built = exists; tested = exercised live as the `automations@` owner account only (no guest, staff, owner or Stripe test).** Earlier note: **Updated 2026-11-11 for the [11 Nov client call](meetings/2026-11-11-client-call.md).** BKG-01..05, BKG-09, BKG-12, BKG-13, CHK-02, PAY-02 and STR-04 changed; BKG-16, BKG-17 and PAY-07 are new. Component mapping for these: booking requests and approval queue = SPFx member portal + staff console + SharePoint lists with a service-owned approval path; billing changes = integration service + Stripe (test mode); dining and private events = same booking lists with a whole-facility block. The Component and Status columns below predate the call for those rows and need a pass during day 2.

| Req | Stages | Component | SOP | Status / gap |
|---|---|---|---|---|
| PLT-01, PLT-02 | scope, access | DOC, tenant | — | Tenant ownership not verified (L-28) |
| PLT-03, PLT-04 | apps | SPFx, PA | — | Portal built (47 unit tests pass), not deployed to the tenant; staff app built and saved, not published. Neither run as a guest/staff/owner. |
| PLT-05 | member-start | SPFx | SOP-02 | [OPEN] Q-17 |
| PLT-06 | access, security, paid-intake | Entra B2B, SPL | SOP-02 | Not verified (L-22) |
| PLT-07, PLT-09 | security, admin | SPL permissions, PA | SOP-10 | Groups provisioned; staff-on-behalf flow path built 13 Nov (code-reviewed, live re-test pending); no staff/owner account test; Q-15 |
| PLT-08 | security, calendar | SPL (separate private lists) | SOP-03 | Calendar projection list and private lists in place; direct-URL tests P1–P9 not run (need guest accounts) |
| PLT-10 | scope | DOC | — | Met in docs; no QuickBooks artefact exists |
| PLT-11 | access | Licences | — | [OPEN] Q-15 (L-20, L-26) |
| PLT-12, PLT-13 | backend, security | SVC, SPL | SOP-01 | Authorisation by list/item permission and flows only; no host. [BLOCKER] Q-01 for Stripe code |
| STR-01, STR-04 | stripe-config | STRIPE, DOC | SOP-01 | [BLOCKER] Q-02 |
| STR-02, STR-03, STR-07 | operator-connect, go-live | SVC, STRIPE, PA/SPFx entry | SOP-01 | Not built |
| STR-05, STR-06 | connect-status, stripe-demo, approval | SVC, STRIPE, DOC | SOP-01 | Not built |
| STR-08 | connect-status, collection | SVC | SOP-01, SOP-06 | Not built (L-05) |
| ONB-01, ONB-02 | member-start | SPFx, SPL | SOP-02 | Not built; Q-04, Q-20 |
| ONB-03 | first-payment | SVC, STRIPE | SOP-02 | Not built; Q-06 |
| ONB-04 | initial-docs | SPFx, SPL library | SOP-02, SOP-05 | Not built |
| ONB-05 | paid-intake | DOC, PA | SOP-02 | Staff Members screen records plan and collection day; payment methods need Stripe; [OPEN] Q-21 |
| ONB-06 | paid-intake | PA, FLOW | SOP-02 | [OPEN] Q-05 |
| ONB-07 | paid-intake, member-ready | FLOW, Entra B2B | SOP-02 | Not built |
| BKG-01 | request | SPFx, SVC/FLOW | SOP-03 | Built: portal form + request flow (equipment, inactive member, document, private-event checks). Live-tested 11–12 Nov; 13 Nov changes saved and code-reviewed, a live test found and fixed an array-input bug, re-test pending. Q-04 |
| BKG-02 | calendar | SPFx, SPL projection list | SOP-03 | Local member seven-day and equipment-day views inspected in owner debug preview on 18 Nov; guest access and device testing outstanding. Staff seven-day source generated locally, runtime and delegation unverified; Q-19. |
| BKG-03, BKG-05 | auto-book | SVC/FLOW, SPL | SOP-03 | Built: all requests start Pending; staff approval queue (tested 11–12 Nov). Q-03 downgraded by call D3 |
| BKG-04 | conflict | FLOW, PA | SOP-03 | Built and tested 2026-11-12: staff see overlaps; the note reaches both the approved member and other overlapping members (docs/evidence/day8-extensions-overlap.md) |
| BKG-06 | request, admin | PA | SOP-03 | Built and tested 2026-11-12 (Book screen). Since 13 Nov it goes through the request flow with OnBehalfOf (saved, re-test pending) |
| BKG-07 | booking-notice | FLOW, email | SOP-03 | Decision e-mail built and tested 12 Nov; portal link added 13 Nov (code-reviewed, not re-tested) |
| BKG-08 | extension | SPFx, PA, FLOW | SOP-03 | Built and tested 2026-11-12 (docs/evidence/day8-extensions-overlap.md) |
| BKG-09, BKG-10 | cancellation | SPFx, PA, FLOW, ledger | SOP-03 | Built and tested 11–12 Nov (docs/evidence/day5-cancellations-hours.md): 24 h rule, hours credit; members cannot shorten |
| BKG-11 | events | PA, STRIPE refund | SOP-03 | [OPEN] Q-08. **No stage dependency recorded** for `events`; event/dining resources are not in the original module list |
| BKG-12 | no-show | FLOW, PA | SOP-03 | [OPEN] Q-09 |
| BKG-13 | catalog | SPL, PA | SOP-10 | [OPEN] Q-04 |
| BKG-14 | overdue | SVC/FLOW eligibility, PA | SOP-03, SOP-06 | [OPEN] Q-07 |
| BKG-15 | compliance-block | Eligibility check, PA | SOP-03, SOP-05 | [OPEN] Q-11 |
| CHK-01, CHK-02 | arrival, exit | SPFx, SPL private list | SOP-04 | [OPEN] Q-10 |
| CHK-03 | reminders | FLOW | SOP-04 | Built and tested 2026-11-12 (docs/evidence/day7-8-emails.md); catch-up [PROPOSED] |
| CHK-04, CHK-06 | missed-entry, exit, exit-escalation | FLOW, PA | SOP-04 | CHK-04 built and tested 2026-11-12 (docs/evidence/day7-8-missed-checkin.md), grace [PROPOSED]; CHK-06 built and tested 2026-11-12 (docs/evidence/day8-complete-build.md), grace [PROPOSED], extension requests not built; Q-10 |
| CHK-05 | failed-entry | FLOW, PA | SOP-04 | Built and tested 2026-11-12 (docs/evidence/day8-complete-build.md); recipients via StaffAlertEmail; Q-10 |
| CMP-01 | initial-docs | SPFx, SPL library | SOP-05 | Upload flow built (portal Documents, document submission flow); exercised during build, no evidence file; staff upload control NOT built (flow accepts OnBehalfOf); Q-11 |
| CMP-02, CMP-03 | expiry, renew | FLOW | SOP-05 | Daily status flow built; renewals now supersede older rows (13 Nov, saved, re-test pending); renewal reminder flow built but unsaved; Q-11, Q-14 |
| PAY-01 | invoice, collection | SVC, STRIPE | SOP-06 | Not built |
| PAY-02 | billing-rule, usage | SVC/FLOW, ledger | SOP-06 | [BLOCKER] Q-06 (L-10) |
| PAY-03 | history, member-summary | SPFx, SPL mirror | SOP-06 | Not built |
| PAY-04 | history, operator-dashboard | PA | SOP-06 | [OPEN] Q-15 |
| PAY-05 | refund-dispute | SVC, STRIPE, PA | SOP-06 | [OPEN] Q-02 |
| SEN-01, SEN-02 | sensor-sync, sensor-ui | FLOW or SVC, SPL, PA/SPFx | SOP-07 | Not built; Q-12 |
| SEN-03 | sensor-ui | DOC | SOP-07 | Met by exclusion |
| SEN-04 | sensor-map, sensor-sync | FLOW/SVC | SOP-07 | [UNVERIFIED] quota (L-27) |
| COM-01, COM-02 | notices | PA or SharePoint News, FLOW | SOP-08 | [OPEN] Q-13; staff notices screen + "sign in to view" e-mail built and tested 2026-11-12 (docs/evidence/day7-8-emails.md) |
| RPT-01, RPT-02, RPT-04 | operator-dashboard | PA, SPL summary list | SOP-09 | [OPEN] Q-16 (L-07) |
| RPT-03 | hq-reports | PBI | SOP-09 | Not built (L-08) |
| RPT-05 | member-summary | SPFx | SOP-09 | Not built |
| ADM-01, ADM-02 | admin, catalog | PA, SPL permissions | SOP-10 | Members, plans, equipment and required-type screens built (Setup, 13 Nov); owner reduced to Contribute; staff capability set open (Q-15) |
| ADM-03 | support | PA / list | SOP-10 | [OPEN] Q-13 |
| ADM-04 | deactivate, retention | FLOW, Entra groups | SOP-10 | Staff deactivation + booking cancellation + request refusal built and tested 2026-11-12; site-access removal needs admin; retention [OPEN] Q-14 |
| REL-01, REL-02 | test-e2e, approval, go-live, training | DOC | — | [OPEN] Q-18 |

## Omissions and mismatches found

- **Stages without a client requirement of their own** (engineering scope): `backend`, `health`, `retention`, `test-e2e`. They support PLT-12/13 and REL-02.
- **Stages with no recorded dependency** in the workflow: `events`, `no-show`, `failed-entry`, `missed-entry`, `exit-escalation`, `overdue`, `refund-dispute`, `compliance-block`, `support`. Their order is set in [DEVELOPMENT_PLAN.md](archive/DEVELOPMENT_PLAN.md).
- **Team-member (worker) identity** is required by CHK-02 but has no data model, licence check or stage of its own (Q-10).
- **Dining/event bookings** appear only through the cancellation rule BKG-11; no requirement defines how an event is booked, priced or deposited (Q-08, Q-04).
- **Storage rental** is billable (PAY-02) and cancellable (BKG-09) but is not described as a bookable resource anywhere (Q-04).
- **Pre-payment entry point** for applicants has no stage (Q-20).
- `phase2` maps to FUT-01..04 only.

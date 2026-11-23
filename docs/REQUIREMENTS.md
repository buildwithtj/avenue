# Requirements — Avenue Phase 1 (Flavors pilot)

(renamed from REQUIREMENTS_BASELINE.md on 2026-11-13)

Owner of: client behaviour, acceptance criteria, source references. Baseline 2026-11-10, updated for the 11 Nov call. Source IDs are defined in [SOURCES.md](SOURCES.md). Stage behaviour: [WORKFLOW_STAGES.md](WORKFLOW_STAGES.md). Before/after wording of client changes: [CLIENT_DECISIONS.md](CLIENT_DECISIONS.md). Requirement → component → SOP → status: [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md). Open questions and decisions: [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md). Implementation status is **not** kept here: see [STATUS.md](STATUS.md).

## Reading this document

**Source codes**

| Code | Source | Date |
|---|---|---|
| SCOPE §n | `references/original/01-avenue-phase1-scope.docx` and its HTML twin `avenue-phase1-scope.html`, module/section n | 30 Oct 2026 |
| KICKOFF §n | `references/original/02-avenue-phase1-client-requirements.docx` (kickoff checklist), section n | 30 Oct 2026 |
| DEVFLOW §n | `references/original/avenue-phase1-developer-flow.html`, section n | 30 Oct 2026 |
| E1–E10 | Client email screenshots 1–10, **as summarised** in CLIENT_DECISIONS.md | Unknown (not recorded in this repository) |
| CHAT | Later developer/user clarification recorded in archive/CODEX_PROJECT_CONTEXT.md | Unknown |

**[LIMITATION] Email wording.** The raw emails are deliberately excluded from this repository (they contain credentials). Every E-reference below rests on the sanitised summary, not on the client's verbatim text. Where exact wording matters (billing, cancellation, liability), confirm against the original email before building. Tracked as [Q-00](DECISIONS_AND_OPEN_QUESTIONS.md).

**Classification**

| Label | Meaning |
|---|---|
| [CONFIRMED] | Explicit client requirement, or original requirement never contradicted. |
| [SUPERSEDED] | Original requirement replaced by a later client instruction. Not to be built. |
| [PREFERENCE] | Client preference or conditional request ("if feasible", requested date). |
| [PROPOSED] | Engineering proposal or safeguard. Not client-approved. |
| [OPEN] | Requirement exists but a rule/value needed to build it is missing or conflicting. See the linked Q-ID. |
| [FUTURE] | Outside Phase 1. |

**Implementation status:** see [STATUS.md](STATUS.md) and [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md). A requirement being listed here says nothing about whether it is built.
---

## PLT — Platform, ownership, access

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| PLT-01 | B Street HQ owns and hosts Avenue on its Microsoft tenant and purchases the licences. | [CONFIRMED] | E4, E10; supersedes KICKOFF §1 (owner unspecified) | Tenant, site, app catalog and flow ownership verified under B Street identities. |
| PLT-02 | Phase 1 is a single-facility pilot at Flavors Culinary Hub Hyattsville. | [CONFIRMED] | SCOPE Overview, Non-goal 4; E3–E5 | All configuration is facility-scoped; no second facility is delivered. |
| PLT-03 | Members use SharePoint modern pages with custom SPFx (React/TypeScript) web parts; staff use a Power Apps Canvas app. | [CONFIRMED] by continuation — manager recommendation (E1) that the client's later replies proceed on; no explicit approval sentence is recorded | E1; supersedes SCOPE §1–2, DEVFLOW §1 (member Canvas app) | No member-facing Power Apps or Power Pages screen exists. |
| PLT-04 | Member journeys run in desktop and mobile browsers; no native/app-store app. | [CONFIRMED] | SCOPE Overview, Non-goal 3 | Phone-browser pass on a real guest session. |
| PLT-05 | Onboarding is desktop/web only, not a mobile function. | [OPEN] [Q-17] — original statement, never revisited after the move to browser pages | SCOPE §7, Access model "Mobile" | Decision recorded. |
| PLT-06 | Members sign in with their own email as external/guest users; email authenticates identity only. | [CONFIRMED] | SCOPE Access model; KICKOFF §1 | A test guest signs in and reaches only permitted content. |
| PLT-07 | Roles: B Street is platform super-admin and may assign support representatives; Flavors has one operator (owner) account and one restricted staff account; members. | [CONFIRMED] | E4–E6; supersedes SCOPE §9 (two operator admins; super-admin "Doubleklick / the Client") | Role matrix enforced at data access; restricted staff cannot do owner-only actions. |
| PLT-08 | Privacy: the shared calendar shows member name, station, equipment, date and time only. Invoices/balances, compliance documents and checklist answers are visible only to the member and authorised staff. | [CONFIRMED] | SCOPE Access model | Member A cannot fetch member B's private record by direct URL/API. |
| PLT-09 | Staff may act on a member's behalf with an audit trail. | [CONFIRMED] | SCOPE §1, §3, Access model | Each on-behalf action records the acting staff identity and time. |
| PLT-10 | QuickBooks is not used in any form. | [CONFIRMED] removal | E3–E5; supersedes SCOPE §4, DEVFLOW §2/§4, KICKOFF §2 | No QuickBooks field, flow or connector exists. |
| PLT-11 | Build licences supplied: Microsoft 365 Business Basic ×3, Power Automate Premium ×1 (service account), Power BI Pro ×1. No duplicate purchases to be requested. | [CONFIRMED] fact; coverage of production roles [OPEN] [Q-15] | E4, E10, CHAT; supersedes KICKOFF §1 (Business Premium assumed) | Actual entitlements verified in tenant. |
| PLT-12 | Privileged operations (Stripe, sensor credentials) run server-side; no secret reaches SPFx, browser storage, logs or source. | [PROPOSED] safeguard derived from STR-02 | AGENTS.md; stage `backend` | Bundle and repository scans show no secrets; forged requests rejected. |
| PLT-13 | Authorisation is enforced where data is read or changed, not by UI filtering. | [PROPOSED] safeguard | AGENTS.md; stage `security` | Direct REST/URL access tests for each role. |

## STR — Facility Stripe connection

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| STR-01 | Avenue/B Street is the Stripe Connect platform. Each facility client owns its connected account; member payments are direct charges on that account and pay out to the facility. B Street does not receive or hold member funds. | [CONFIRMED] | E3–E5, E9–E10 | A test payment exists on the test connected account, not the platform balance. |
| STR-02 | Never request or store the client's Stripe password, secret key, bank details or verification documents. | [CONFIRMED] | E9–E10 | Only the connected-account ID and status are stored. |
| STR-03 | Facility onboarding is Stripe-hosted and launched from Avenue. | [CONFIRMED] | E9–E10 | Operator completes onboarding on Stripe pages; return to Avenue alone does not mark the account ready. |
| STR-04 | **Call 11 Nov (D6): Stripe transaction fees are paid by the member** with the membership payment; method to be checked (card surcharge rules).  Before enabling, review who bears Stripe fees, refunds, disputes, losses/negative balances and verification, and flag any setting that exposes B Street or routes funds through it. The client's requested allocation is the facility. | [CONFIRMED] (the review); the resulting allocation is [OPEN] [Q-02] until the real account is inspected | E3–E5, E9–E10 | Written responsibility matrix from the actual platform settings, shown to the client. |
| STR-05 | Test that a client connects, payment status returns to Avenue, and the payment appears under the connected account. | [CONFIRMED] | E9 | Demonstrated in Stripe test mode with recorded IDs. |
| STR-06 | Demonstrate the test flow and responsibility settings; obtain client approval before any live activation or production operator invitation. | [CONFIRMED] | E9–E10 | Attributable approval record specific to the tested configuration. |
| STR-07 | After approval, give the operator a secure onboarding link. | [CONFIRMED] (a secure link); implementing it as an authenticated Avenue invitation that mints a fresh Stripe link is [PROPOSED] | E9–E10 | Expired/used links regenerate only for the right operator. |
| STR-08 | Stripe webhooks are signature-verified, tied to the right connected account, de-duplicated and tolerant of retries/out-of-order delivery. | [PROPOSED] safeguard | Stage `connect-status` | Replayed and forged events cause no state change. |

## ONB — Member onboarding

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| ONB-01 | A prospective member enters business details and selects a membership plan. | [CONFIRMED] | SCOPE §7; E3, E6 | Plan is stored against the right applicant. |
| ONB-02 | The member chooses a monthly collection day from the 1st to the 15th. | [CONFIRMED] | E3, E6 | Chosen day drives the recurring collection. |
| ONB-03 | New members pay before operational onboarding starts; successful payment initiates onboarding. | [CONFIRMED]; first-payment amount/proration [OPEN] [Q-06] | E3–E6 | Failed or abandoned payment grants no onboarding access. |
| ONB-04 | Documents are uploaded only by current members or paid new members after login. No public or unapproved-applicant upload. | [CONFIRMED] | E6; supersedes SCOPE §7 (external form with documents) | No anonymous upload endpoint exists. |
| ONB-05 | B Street onboards the initial existing members for January billing. | [CONFIRMED] | E4, E6 | Initial roster loaded by B Street; process documented. |
| ONB-06 | Staff review and approve a new member before full access. | [OPEN] [Q-05] — original rule; not resolved after paid-first onboarding | SCOPE §7; DEVFLOW §3 | Decision recorded. |
| ONB-07 | An accepted member is provisioned as a guest and gains portal access. | [CONFIRMED] | SCOPE §7; DEVFLOW §4 "Onboarding approval" | Guest reaches own area only. |

## BKG — Kitchen bookings

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| BKG-01 | A member requests a booking by **equipment** and time. Booking is by equipment, not stations: about six prep tables exist and every company gets at least two. | [CONFIRMED] (call, D1); equipment list and table rules [OPEN] [Q-04] | [call 11 Nov](meetings/2026-11-11-client-call.md) D1; supersedes SCOPE §1 (station/table) | Invalid duration, inaccessible equipment and forged ownership are rejected. |
| BKG-02 | A shared calendar shows who booked which equipment and when. | [CONFIRMED]; "station" removed by the call (D1) | SCOPE §1; call D1 | All permitted bookings in range appear (beyond one page); no private field is present. |
| BKG-03 | **Management reviews and approves every booking.** Requests arrive as pending. | [CONFIRMED] (call, D3), **superseding Email 3 automatic confirmation**; confirm in writing | [call 11 Nov](meetings/2026-11-11-client-call.md) D3; supersedes E3 | Every booking is pending until a Flavors operator or staff member approves it. |
| BKG-04 | Overlaps are judged mainly by equipment. Two caterers are never in the kitchen together; a member needing only, say, the mixer may be approved alongside another; an overlap may be approved if the first member is done with the equipment before the second needs it. Both members are told. | [CONFIRMED] (call, D3); rules for "caterer" and "light use" [OPEN] | [call 11 Nov](meetings/2026-11-11-client-call.md) D3 | Staff see equipment of each request beside overlapping bookings; approval of an overlap records a note to both members. |
| BKG-05 | Staff are shown overlapping requests; Avenue does not need to prevent every overlap. | [CONFIRMED] by the call (D3). The earlier simultaneous-confirmation safeguard is no longer a release blocker; Q-03 is downgraded | call D3 | Two requests for the same equipment both reach the approval queue; neither is confirmed automatically. |
| BKG-06 | Staff can create bookings on a member's behalf with an audit stamp. | [CONFIRMED] | SCOPE §1 | Audit shows actor. |
| BKG-07 | The member receives a simple booking confirmation email with a portal button to change/cancel and view details. | [CONFIRMED] | E6; narrows COM-02 | Link opens the authorised booking; retries do not resend. |
| BKG-08 | Member, owner and staff can request extra time when available; conflicts alert the Flavors owner/staff. | [CONFIRMED] | E6 | Extension updates availability and reminders; actor audited. |
| BKG-09 | Cancelling 24 or more hours ahead: the member cancels and hours return. Under 24 hours: the member cannot cancel and must message management in Avenue; management cancels and returns the hours. | [CONFIRMED] (call, D8), changes E6 | [call 11 Nov](meetings/2026-11-11-client-call.md) D8 | Member has no cancel action under 24 h; management cancellation returns hours. |
| BKG-10 | Finishing early does not return unused booked time; members cannot shorten a booking to reclaim hours; only owner/staff may adjust. | [CONFIRMED] | E6 | Member-side shortening has no credit effect. |
| BKG-11 | Dining/event cancellation: 15+ days' notice → full refund; at 7 days' notice the security deposit and payments made are forfeited with nothing further owed. | [CONFIRMED] for the two stated points; 8–14 days and boundaries [OPEN] [Q-08] | E6 | Stated points tested; no invented interpolation. |
| BKG-12 | **No-shows are credited back** to the member's hours unless the member abuses this. | [CONFIRMED] (call, D8), **superseding Email 6**; abuse rule and detection timing [OPEN] [Q-09] | [call 11 Nov](meetings/2026-11-11-client-call.md) D8 | No double credit; abuse decision recorded by staff. |
| BKG-13 | Plans carry monthly hour allowances; base plan is 10 hours a month, **no rollover**; hours are deducted only for time in the facility, not for equipment used. Tiers are on FlavorsCulinaryHub.com; some members are on older tiers. | [CONFIRMED] (call, D2, D4); tier names, prices, extra-hour rate and old-tier mapping [OPEN] [Q-04, Q-25] | [call 11 Nov](meetings/2026-11-11-client-call.md) D2, D4 | Allowance resets each month; ledger counts approved facility time only. |
| BKG-14 | An overdue balance blocks new bookings. Only the Flavors owner may override — not staff. | [CONFIRMED]; definition of "overdue" [OPEN] [Q-07] | E6 | Block enforced on the mutation path; staff override attempt fails. |
| BKG-15 | Expired required documents block new bookings. Only the Flavors owner may override. | [CONFIRMED]; treatment of existing future bookings [OPEN] [Q-11] | E6 | Same control via UI and direct request; override records reason and actor. |
| PAY-07 | Members may pay by any method Stripe offers, including ACH, cards, Apple Pay and Google Pay. Avenue replaces the two systems used today (Engage auto-pay and a card system). | [CONFIRMED] (call, D7); the supported list [PROPOSED] from Stripe documentation | call D7 | Methods enabled in test mode; recurring collection works for each enabled method. |
| BKG-16 | The dining room can be booked instead of the kitchen, using member hours (pickups, meetings, tastings). A member books some tables or the whole room and states how many people. It seats about 60. | [CONFIRMED] (call, D9); table and chair counts [OPEN] [Q-04, Q-22] | call D9 | Dining bookings coexist with kitchen bookings. |
| BKG-17 | A private event books the entire facility; nothing else can be booked for that time. | [CONFIRMED] (call, D9); cost, approval and refund rules [OPEN] [Q-22] | call D9 | Approved private event blocks all other requests. |

## CHK — Check-in / check-out and alerts

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| CHK-01 | Every booking requires an entry and an exit checklist, logged with name and time. | [CONFIRMED]; question set [OPEN] [Q-10] | SCOPE §2 | Answers private, attributed and versioned. |
| CHK-02 | **Preference:** one lead completes the kitchen checklist; every team member can complete the wellness check-in on their phone. Today one person completes the paper checklist. Whether this is in Phase 1 is not confirmed (the team said it would try to include it). | [PREFERENCE] (call, D10), replacing the earlier "every team member checks in" | [call 11 Nov](meetings/2026-11-11-client-call.md) D10 | Lead checklist works; per-member wellness only if confirmed in scope [Q-10]. |
| CHK-03 | Reminders go out 3, 2 and 1 hour before the booking, once each. | [CONFIRMED]; catch-up/grace [OPEN] [Q-10] | SCOPE §2; DEVFLOW §4 | Retries and overlapping runs do not resend. |
| CHK-04 | A missed checklist is flagged to the member, then escalated to a staff view with contact details and a logged one-off reminder. | [CONFIRMED]; grace periods [OPEN] [Q-10] | SCOPE §2; KICKOFF §3 | No escalation after a valid entry or a cancellation. |
| CHK-05 | A failed checklist notifies the member business owner and the Flavors owner/staff. The member business stays responsible for its team; facility or other-member issues are handled through Flavors. | [CONFIRMED]; pass/fail criteria [OPEN] [Q-10] | E5–E6 | Only authorised recipients can read answers; no automatic ban is applied. |
| CHK-06 | At session end the member completes the exit checklist or requests an extension; unresolved cases are flagged to staff. | [CONFIRMED] | SCOPE §2; DEVFLOW §3–4 | Exit never silently extends a booking. |

## CMP — Compliance documents

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| CMP-01 | Members, or staff on their behalf, upload permits, licences, insurance and certifications with type, issue and expiry dates. | [CONFIRMED]; required types [OPEN] [Q-11] | SCOPE §3; KICKOFF §3 | Direct download by another member is denied. |
| CMP-02 | A daily check sets each document Current / Expiring / Expired. | [CONFIRMED]; warning window (original default 30 days) [OPEN] [Q-11] | SCOPE §3; KICKOFF §3 | Date-only boundary is consistent; status refresh does not re-notify each run. |
| CMP-03 | Members receive renewal reminders before expiry; renewals keep version history. | [CONFIRMED]; retention [OPEN] [Q-14] | SCOPE §3; DEVFLOW §3 | Replacement inherits private permissions. |

## PAY — Billing and payments

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| PAY-01 | Stripe generates monthly membership invoices and collects recurring payments under the facility's account. | [CONFIRMED] | E3–E4, E9; supersedes SCOPE §4 | Subscription and invoices live on the connected account. |
| PAY-02 | When a booking takes a member past the month's hours, Avenue creates an **overage invoice shown as a negative balance, due with the next monthly payment**; nothing is charged at booking. The admin dashboard shows it. | [CONFIRMED] (call, D5); rate [OPEN] [Q-04]; in-person extra time [OPEN] [Q-23]; late-month rules [OPEN] [Q-06] | [call 11 Nov](meetings/2026-11-11-client-call.md) D5 | Example: 10 h plan, 15 h booked → 5 h invoice generated that month, due with the next payment. Repeat runs never double-count. |
| PAY-03 | Members see their own invoices, full payment history, upcoming charges and booking overages inside Avenue. | [CONFIRMED] | E3, E5, E7 | Another member cannot retrieve them; estimates are distinguished from finalised amounts. |
| PAY-04 | The operator and permitted staff see facility financial activity according to their permissions. | [CONFIRMED]; exact staff capabilities [OPEN] [Q-15] | E5, E7 | Restricted staff see only what the operator enabled. |
| PAY-05 | Refunds and disputes are handled under the reviewed responsibility model, by authorised users only. | [PROPOSED] process; ownership [OPEN] [Q-02] | Stage `refund-dispute` | Tested in test mode only. |
| PAY-06 | Read-only QuickBooks invoice/balance dashboard; "no payment gateway". | [SUPERSEDED] by PAY-01..03 | SCOPE §4, Non-goal 2 | — |

## SEN — Environmental monitoring

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| SEN-01 | Show the latest refrigerator/freezer temperature per unit with Normal / Out-of-range status. | [CONFIRMED]; unit mapping and thresholds [OPEN] [Q-12] | SCOPE §5; KICKOFF §2 | Each tile maps to the right physical unit; a stale reading is never shown as current. |
| SEN-02 | Keep a historical log of readings for compliance records. | [CONFIRMED]; retention [OPEN] [Q-14] | SCOPE §5 | Duplicate polls do not duplicate history. |
| SEN-03 | Swift Sensors remains the real-time breach-alert system; Avenue does not duplicate it. | [CONFIRMED] | SCOPE §5, Non-goal 5 | No Avenue feature is presented as an alarm. |
| SEN-04 | Stay within the Swift Sensors API allowance of 100,000 calls/month; only Flavors is sensor-tracked. | [CONFIRMED] fact; cadence [OPEN] [Q-12] | E5 | Documented call budget for the chosen cadence. |

## COM — Communication

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| COM-01 | Staff publish announcements, notices and newsletters to all members or an audience; content lives in the portal. | [CONFIRMED]; storage model News vs Notices list [OPEN] [Q-13] | SCOPE §6; DEVFLOW §2 | Drafts stay private. |
| COM-02 | On publish, members get a generic "log in to view" email; no operational content in email bodies — except the booking confirmation allowed by BKG-07. | [CONFIRMED] | SCOPE §6; E6 | No financial, compliance or wellness data in any email. |

## RPT — Reporting

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| RPT-01 | Flavors sees facility bookings, utilisation, member activity, compliance and financial summaries inside the Avenue admin experience. | [CONFIRMED] | E7–E8; supersedes SCOPE §8 (Power BI for these) | Sample totals match source records beyond query limits. |
| RPT-02 | Build RPT-01 with Power Apps/SharePoint, without another Power BI Pro seat. | [PREFERENCE] — "if feasible" | E7–E8 | Feasibility proven or the cost is put to the client. |
| RPT-03 | B Street gets Power BI analytics (revenue, bookings, utilisation, membership, adoption) on one Pro seat plus temporary development access. | [CONFIRMED]; measure definitions [OPEN] [Q-16] | E7–E8 | Booked vs attended hours are distinguished; totals reconcile. |
| RPT-04 | Reports cover document-compliance status, monthly booked hours per member and overall, and equipment usage. | [CONFIRMED] (original, not contradicted) | SCOPE §8 | Present in RPT-01 and/or RPT-03. |
| RPT-05 | Members see their own reservations, invoices and balances in Avenue, not in Power BI. | [CONFIRMED] | E7–E8 | No member Power BI access exists. |

## ADM — Administration and support

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| ADM-01 | The operator adds/edits members, updates membership plans and posts announcements for the facility, without changing platform functionality. | [CONFIRMED] | SCOPE §9; E4–E5 | Forbidden changes fail outside the UI; plan edits do not rewrite past invoices. |
| ADM-02 | The staff account has permissions selected by the operator. | [CONFIRMED]; the selectable set [OPEN] [Q-15] | E4–E5 | Capability matrix enforced. |
| ADM-03 | Client/staff can submit a support ticket to B Street for help or on-behalf changes. | [CONFIRMED]; mechanism [OPEN] [Q-13] | E4–E5 | Support users reach only assigned facility data; actions audited. |
| ADM-04 | Deactivating a member removes Avenue access and stops reminders while keeping history. | [CONFIRMED]; future bookings and subscription cancellation [OPEN] [Q-14] | DEVFLOW §4 "Access revoke" | Inactive user cannot book; records remain. |

## REL — Delivery

| ID | Requirement | Class | Source | Acceptance criteria |
|---|---|---|---|---|
| REL-01 | Operator training in the week of 27 December, launch 1 January, handover 31 December. | [PREFERENCE] — requested dates; year not stated in this repository; feasibility not validated [Q-18] | E3; supersedes SCOPE "eight-week sequence" as the client's expectation | Re-estimate agreed before any commitment. |
| REL-02 | Testing with real roles, UAT, documentation and handover. | [CONFIRMED] | SCOPE Delivery wk 7–8 | Evidence pack per [IMPLEMENTATION_PLAN.md](archive/IMPLEMENTATION_PLAN.md). |

## Exclusions and future scope

| ID | Item | Class | Source |
|---|---|---|---|
| EXC-01 | Duplicate real-time temperature alerting. | Excluded | SCOPE Non-goal 5 |
| EXC-02 | Custom native / app-store app. | Excluded ([FUTURE]) | SCOPE Non-goal 3 |
| EXC-03 | Physical door/access control. Booking blocks are application eligibility only. | Excluded (never requested) | CODEX_PROJECT_CONTEXT §8 |
| EXC-04 | Member Power Apps, Power Pages, member Power BI, replacement database, QuickBooks. | Excluded | AGENTS.md; E1, E3–E5, E7–E8 |
| FUT-01 | Standalone configurable multi-client platform. | [FUTURE] | SCOPE Non-goal 4; E4–E5 |
| FUT-02 | School client rollout. | [FUTURE] | E4–E5 |
| FUT-03 | AI features. | [FUTURE] | E4–E5 |
| FUT-04 | Additional paid staff accounts. | [FUTURE] | E4–E5 |

## Conflicts between sources

| ID | Conflict | State |
|---|---|---|
| C-01 | SCOPE HTML §2 lists "wellness and food-safety items"; SCOPE DOCX §2 omits them. | Resolved by client: wellness retained (E5–E6) → CHK-02. |
| C-02 (resolved 11 Nov: management approves every booking) | SCOPE Non-goal 1 "no database-level double-booking lock — staff approve" vs automatic confirmation (E3). | [OPEN] engineering: BKG-05, [Q-03]. The non-goal's premise (staff approve everything) no longer holds. |
| C-03 | Collection day 1–15 (E3, E6) vs "add that month's overages to that month's invoice" (E3–E4). Usage after the collection day has no stated destination. | [OPEN] [BLOCKER] for billing: [Q-06]. |
| C-04 | "No operational content in email" (SCOPE §6) vs booking confirmation email (E6). | Resolved narrowly: BKG-07 is the only exception. |
| C-05 | "Staff see all" payments/records (SCOPE §4, Access model) vs a restricted staff account with selected capabilities (E4–E5). | Latest wins; the capability set is [OPEN] [Q-15]. |
| C-06 | DEVFLOW §2 uses a plain-text `MemberEmail` column as the member key and filter; current guidance says email must not be the only identity boundary. | [PROPOSED] stable internal IDs; see [DATA_AND_ACCESS.md](DATA_AND_ACCESS.md). |
| C-07 | Announcements stored in "SharePoint News" (SCOPE §6) vs a "Notices list" (DEVFLOW §2). | [OPEN] [Q-13]. |
| C-08 | Onboarding "desktop only" (SCOPE §7) vs browser-based member journeys on phone and desktop. | [OPEN] [Q-17]. |
| C-09 | "~8 weeks" (SCOPE) vs requested late-December training / 1 January launch (E3), with billing scope added since. | [OPEN] [Q-18]. |
| C-10 | Information sheet (S-07), Booking Rules tab, prefilled "Extra hours billed: Invoice at booking, due with next monthly payment" vs call D5 "no charge at booking; invoice shown as a negative balance due with the next monthly payment". | [OPEN]: wording to correct in the sheet before it goes to the client; PAY-02 follows D5. |

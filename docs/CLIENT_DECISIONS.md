# Client changes and reconciled email decisions

> Note (2026-11-10): each distinct change has an ID, implications and approval status in [CLIENT_CHANGE_REGISTER.md](CLIENT_CHANGE_REGISTER.md). The before/after wording below remains authoritative.

The entries below are the comparison annotations from the current workflow: 38 affected stages, not 38 independent requests. Email numbers refer to the ten screenshots supplied in order. Old text is retained only to show what changed. Engineering annotations must not be mistaken for separate client approvals.

## scope — Reconcile the project baseline

**Annotation:** Client

- **Earlier:** Phase 1 included read-only QuickBooks visibility and no payment gateway.
- **Current:** Client explicitly replaces QuickBooks with Stripe billing, then adds Stripe Connect. Flavors remains the pilot; the standalone multi-client platform remains the Phase 2 goal.
- **Source:** Emails 3–5 and 9–10

## access — Activate accounts and environments

**Annotation:** Client

- **Earlier:** Tenant owner was unspecified and Business Premium was assumed.
- **Current:** B Street HQ owns/hosts Avenue and purchases licenses. Business Basic ×3, Power Automate Premium ×1 and Power BI Pro ×1 are the stated build setup; account details were later confirmed supplied.
- **Source:** Emails 4 and 10; later chat clarification

## security — Model identities and permissions

**Annotation:** Client

- **Earlier:** Generic member, operator-admin and super-admin tiers; up to two operator admins.
- **Current:** B Street retains super-admin access and can assign support staff. Flavors gets one operator and one restricted staff account; only the Flavors owner can override overdue-balance/expired-document booking blocks.
- **Source:** Emails 4–6

## catalog — Configure the facility catalog

**Annotation:** Client

- **Earlier:** Plans, resources and rates were requested but booking limits were not established.
- **Current:** Plans include different hour allowances and tier-specific extra-hour rates. Provide membership prices, equipment/storage charges and resource configuration; B Street will onboard the initial members for January billing.
- **Source:** Emails 4 and 6

## apps — Create the two interfaces

**Annotation:** Manager

- **Earlier:** Members and staff both use the Canvas App.
- **Current:** Manager recommends SharePoint pages with custom web parts for members, retaining the Power Apps admin app for staff. The client’s later replies proceed on this approach.
- **Source:** Email 1; continued in client replies

## stripe-config — Review Stripe Connect responsibilities

**Annotation:** Client

- **Earlier:** No payment gateway; invoices and balances came from QuickBooks.
- **Current:** Avenue/B Street is the Connect platform. Facility clients connect their own Stripe accounts; direct charges and payouts belong to the facility. Review all fees, refunds, disputes, losses and verification responsibilities; flag possible B Street exposure before enabling.
- **Source:** Emails 3–5 and 9–10

## operator-connect — Launch Stripe-hosted operator onboarding

**Annotation:** Client

- **Earlier:** Facility Stripe account onboarding was not part of the original scope.
- **Current:** Launch Stripe-hosted client-account onboarding from Avenue. Do not collect/store the client’s Stripe password, secret key, bank details or verification documents. Provide the operator invitation only after test approval.
- **Source:** Emails 9–10

## connect-status — Verify account readiness and events

**Annotation:** Client

- **Earlier:** Only scheduled QuickBooks invoice/balance synchronization was described.
- **Current:** Test that a client connects, payment status returns to Avenue and the payment appears under the connected account.
- **Source:** Email 9

## stripe-demo — Demonstrate the test flow

**Annotation:** Client

- **Earlier:** No Stripe demo or payment go-live approval gate was specified.
- **Current:** Demonstrate the completed test flow and exact client-facing onboarding. Confirm platform settings and responsibilities, obtain approval, then proceed to the real operator/live flow.
- **Source:** Emails 9–10

## member-start — Select plan and payment date

**Annotation:** Client

- **Earlier:** Prospective member supplied details, selected membership and uploaded initial documents before staff approval.
- **Current:** Members pay before onboarding starts; select a recurring collection date between the 1st and 15th. No public/unapproved document uploads. First-payment and invoice-cutoff calculations still need decisions.
- **Source:** Emails 3 and 6

## first-payment — Complete initial membership payment

**Annotation:** Client

- **Earlier:** Avenue did not collect payments; payment stayed in QuickBooks.
- **Current:** Use the facility’s Stripe billing/payment setup for the initial and recurring membership payment. Successful payment initiates member onboarding.
- **Source:** Emails 3–6

## paid-intake — Start authenticated onboarding

**Annotation:** Client

- **Earlier:** Application/documents came before approval and access provisioning.
- **Current:** Only paid new members and current members enter onboarding and upload after login. B Street handles initial member onboarding. The exact remaining manual approval step is still unresolved.
- **Source:** Email 6

## initial-docs — Upload permits and compliance files

**Annotation:** Client

- **Earlier:** Initial documents were submitted through an external application form before full access.
- **Current:** Collect documents only from current members or paid new members after login/onboarding begins. Public document upload is not wanted.
- **Source:** Email 6

## auto-book — Automatically confirm an available booking

**Annotation:** Client

- **Earlier:** Staff approved or denied every booking; conflicts were flagged for manual resolution.
- **Current:** Automatically approve when station, equipment and date/time are available, following first-come, first-served allocation. Send conflicts to staff. Safe concurrent confirmation is an implementation decision, not a client-specified database lock.
- **Source:** Email 3

## conflict — Route conflicts to facility staff

**Annotation:** Client

- **Earlier:** Staff reviewed all reservation requests.
- **Current:** Only conflicting requests require staff resolution, subject to the other eligibility rules.
- **Source:** Email 3

## booking-notice — Send confirmation and portal actions

**Annotation:** Client

- **Earlier:** No operational content in email; generic login-only nudges.
- **Current:** Client permits a simple booking confirmation and a portal button to change/cancel and view details. This does not authorize emailing private wellness answers or unrestricted financial details.
- **Source:** Email 6

## extension — Request additional time

**Annotation:** Client

- **Earlier:** Developer flow mentioned exit or extend without defining billing and permissions.
- **Current:** Member, owner and staff can request extra time when available. Conflicts alert the Flavors owner/staff; excess hours or storage allowances produce additional charges.
- **Source:** Email 6

## cancellation — Cancel or shorten a booking

**Annotation:** Client

- **Earlier:** No detailed cancellation or unused-hour policy was supplied.
- **Current:** Kitchen/storage: 24-hour cancellation notice. Late requests require owner/staff approval and discretionary credit loss/restoration. Leaving early does not automatically restore hours; only owner/staff can adjust the booked time.
- **Source:** Email 6

## events — Apply event-specific cancellation rules

**Annotation:** Client

- **Earlier:** No separate dining/event cancellation policy.
- **Current:** 15+ days: full refund. At seven-day notice: security deposit and payments already made are forfeited with no further balance owed. Unspecified intervals/boundaries remain open.
- **Source:** Email 6

## no-show — Handle a no-show

**Annotation:** Client

- **Earlier:** No-show consequences were unspecified.
- **Current:** No-shows lose booked hours. Flavors owner/staff can override.
- **Source:** Email 6

## arrival — Check each team member in

**Annotation:** Client

- **Earlier:** Fixed entry/exit checklist per booking; HTML included wellness while DOCX omitted it.
- **Current:** Wellness is explicitly retained, and every team member must check in on arrival so the supervisor can follow up where needed. Individual team identities and exact questions still need configuration.
- **Source:** Emails 5–6

## failed-entry — Notify responsible people of a failed checklist

**Annotation:** Client

- **Earlier:** Missed checklists escalated to staff; failure handling was not defined.
- **Current:** Failed answers notify the member business owner and Flavors owner/staff for correction and follow-up. The member business remains responsible for its team; facility/other-member issues go through Flavors.
- **Source:** Emails 5–6

## billing-rule — Define the invoice cycle

**Annotation:** Client

- **Earlier:** Read-only financial dashboard; no recurring invoice or collection logic.
- **Current:** Generate monthly membership invoices, automatically add approved extra usage, let members select payment day 1–15. The reconciliation between calendar-month overages and that debit date is still open.
- **Source:** Emails 3–4 and 6

## usage — Calculate usage and overages

**Annotation:** Client

- **Earlier:** Usage reporting existed, but Avenue did not calculate billable invoice additions.
- **Current:** Avenue calculates extra booked hours, equipment and applicable storage amounts, then sends the charges to Stripe for invoicing/collection. Apply plan allowances and authorized cancellations/no-shows.
- **Source:** Emails 3–6

## invoice — Create the recurring invoice

**Annotation:** Client

- **Earlier:** QuickBooks supplied existing invoices and balances.
- **Current:** Stripe generates monthly invoices and collects recurring membership payments under the facility account; Avenue supplies plan/usage charges.
- **Source:** Emails 3–4 and 9

## history — Show invoices and payment history

**Annotation:** Client

- **Earlier:** Members saw own invoices/balances synchronized from QuickBooks.
- **Current:** Members see Stripe-based invoices, full payment history, upcoming charges and booking overages inside Avenue. Authorized operator/staff get permitted financial visibility without collecting private banking credentials.
- **Source:** Emails 3, 5 and 7

## overdue — Block booking for overdue balances

**Annotation:** Client

- **Earlier:** No automatic booking block for unpaid balances was specified.
- **Current:** Overdue balances block booking. Only the Flavors owner may override, not staff. Exact overdue timing remains a configuration decision.
- **Source:** Email 6

## compliance-block — Enforce expired-document booking blocks

**Annotation:** Client

- **Earlier:** Document expiry tracking and renewal nudges only; booking restriction unspecified.
- **Current:** Expired documents block booking, with an override available only to the Flavors owner. Treatment of existing future bookings remains open.
- **Source:** Email 6

## sensor-map — Map sensors to facility units

**Annotation:** Client

- **Earlier:** Swift Sensors API access, documentation, limits and mapping were requested.
- **Current:** API access and documentation were supplied with a 100,000-calls/month limit. Flavors is the only sensor-tracked client in the pilot. Unit mapping and thresholds still need validation. Credentials are not included in this artifact.
- **Source:** Email 5

## admin — Manage members, plans and staff access

**Annotation:** Client

- **Earlier:** Up to two operator-admin accounts with generic plan/member management.
- **Current:** One Flavors operator account plus one staff account with selectable permissions. B Street retains full platform administration and may assign representatives; extra staff accounts are a future paid option.
- **Source:** Emails 4–5

## support — Route support requests to B Street

**Annotation:** Client

- **Earlier:** No dedicated ticket/request workflow in the nine original modules.
- **Current:** Client/staff should submit a support ticket to B Street for assistance or on-behalf updates during the pilot. Specific ticket-tool/workflow design is not selected.
- **Source:** Emails 4–5

## operator-dashboard — Build the Flavors operational dashboard

**Annotation:** Client

- **Earlier:** Compliance and usage dashboards were assigned to Power BI.
- **Current:** Flavors needs facility bookings, utilization, activity, compliance and financial summaries inside the Avenue admin dashboard. Client asks to build these with Power Apps/SharePoint without another Power BI Pro seat if feasible.
- **Source:** Emails 7–8

## hq-reports — Create B Street Power BI analytics

**Annotation:** Client

- **Earlier:** Power BI audience and final seat count were unresolved.
- **Current:** Power BI primarily serves B Street’s business/platform analytics. Start with one B Street Pro seat plus temporary development coverage if needed. Ordinary members do not use Power BI.
- **Source:** Emails 7–8

## member-summary — Keep personal summaries in the member portal

**Annotation:** Client

- **Earlier:** Member own-account views existed, but report distribution was unresolved.
- **Current:** Members see individual reservations, invoices and balances directly in Avenue, not in Power BI.
- **Source:** Emails 7–8

## approval — Obtain client test approval

**Annotation:** Client

- **Earlier:** Generic UAT and handover; no explicit Stripe live approval gate.
- **Current:** Client must approve the test onboarding/payment experience and responsibility configuration before live Stripe activation.
- **Source:** Emails 9–10

## go-live — Connect the real operator and activate production

**Annotation:** Client

- **Earlier:** No connected-account production setup or operator link handoff.
- **Current:** After approval, provide secure operator onboarding access and confirm the live account configuration. A forwardable Avenue invitation is the proposed safe implementation; the client asked for a secure onboarding link.
- **Source:** Emails 9–10

## training — Train operator and hand over ownership

**Annotation:** Client

- **Earlier:** Approximately eight-week sequence, starting when prerequisites and advance are in place.
- **Current:** Client requests operator training in the week of December 27 before a January 1 launch. This is a requested milestone, not evidence that a revised schedule has been validated.
- **Source:** Email 3

## phase2 — Separate future platform expansion

**Annotation:** Client

- **Earlier:** A full multi-client platform was deferred to Phase 2.
- **Current:** Client reiterates a future standalone configurable platform, mentions a potential school client and future AI, while using Flavors to learn. These are future directions, not automatically delivered Phase 1 features.
- **Source:** Emails 4–5

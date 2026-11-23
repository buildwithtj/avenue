# Avenue Phase 1 — authoritative working context

## 1. Product and ownership

Avenue is a facility operations and membership platform. Phase 1 pilots it at **Flavors Culinary Hub Hyattsville**, a shared commercial kitchen. **B Street HQ / B Street Headquarters owns and operates Avenue**, owns the hosting Microsoft tenant, buys the licenses, and has platform-level administration. Flavors is a client facility with its own operator and staff. A member is a kitchen customer/business, not a Microsoft subscription seat. A member may have team members working in the kitchen; their exact identity/account model remains to be designed.

B Street wants to commercialize the platform for further clients. A possible school client, broader standalone multi-client functionality, configurable feature assignment, additional paid staff accounts and AI ambitions belong to future planning unless explicitly added to Phase 1. Stripe Connect must support the platform/client relationship now, without implying that every Phase 2 feature is included.

The original files describe nine modules: bookings; entry/exit checklists and alerts; compliance documents; payments; sensor temperatures; communications; onboarding; reporting; administration. They remain in Phase 1, with the later email changes below. The change from read-only QuickBooks visibility to automated Stripe billing is a material expansion, not a connector rename.

## 2. Source precedence and limits

The four original documents are included under references/original. The sanitized email decisions and workflow stage records capture subsequent client changes. The original HTML and Word versions differ in places; notably the client expressly retained wellness check-ins, resolving that discrepancy. Latest explicit decisions take precedence; unresolved details must remain visible.

There is no evidence in this package that the actual Microsoft tenant, Stripe platform settings, deployments or API connectivity have been verified. The user confirms that Microsoft 365, Power Automate and Power BI subscriptions and account login details have been supplied. The Stripe invitation sent to the development team is already relevant access; do not ask for a replacement solely because it was addressed to a named teammate. Swift Sensors API access and its documentation were supplied separately. No secrets are reproduced here.

## 3. Platforms and boundaries

| Layer | Current approach | Purpose / boundary |
|---|---|---|
| Member interface | SharePoint modern pages; SPFx, React, TypeScript | Browser portal on desktop/mobile; custom web parts replace the originally proposed member Power Apps app. |
| Staff/operator interface | Power Apps Canvas; Power Fx | Facility administration and workflows with role-scoped access. |
| Operational records | SharePoint Lists | Plans, memberships, bookings, checklists, invoices/status mirrors and operational configuration; final schema still to be approved. |
| Files | SharePoint Document Libraries | Private authenticated compliance upload, review and renewal. |
| Identity | Microsoft Entra ID B2B / SharePoint guest access | External member sign-in and actual permissions; guest eligibility/settings must be verified. |
| Automation | Power Automate | Scheduled reminders, compliance, synchronization, notifications and controlled workflow changes. |
| Payments | Stripe Connect and Stripe invoicing/subscriptions | Client-owned connected account, direct charges, recurring billing, payment history and usage extras. |
| Trusted integrations | Server-side API endpoints, HTTPS webhooks, secret store | Required for secure Stripe handling; hosting/provider has not been selected. |
| Sensors | Swift Sensors API | Flavors temperatures, latest readings and history. |
| Email | Microsoft 365 Outlook/Exchange connection | Approved notifications and portal links. |
| HQ reporting | Power BI; Power Query/M and DAX as needed | B Street business/platform analysis. |
| Operator reporting | Native Avenue dashboard using Power Apps/SharePoint summaries | Facility reports inside Avenue; no operator Power BI viewer seat assumed. |

React is a library within the approved SPFx approach, not a requirement to replace Microsoft services with an unrelated standalone React SaaS. No approved need exists for QuickBooks, Power Pages, Supabase, Firebase or a replacement database. A secure server component is necessary, but Azure Functions, another host or any paid subscription must be an explicit implementation decision. No exact runtime or library versions are established here; verify current SPFx compatibility first.

The member guest model and staff Microsoft 365 seeded Power Apps rights are design assumptions to validate against actual identities, app connectors and Microsoft terms. A service-account Premium license does not automatically cover every premium flow/app pattern. Embedding an actual Power BI report inside Avenue does not remove Power BI licensing obligations. Native dashboard summaries are a separate implementation.

## 4. Supplied subscriptions

The latest setup email lists Microsoft 365 Business Basic x3 (two build accounts plus a service account), Power Automate Premium x1 for the service account, and Power BI Pro x1 on a build account for the reporting stage. Quoted email prices were $21 + $15 + $14 per month; those are historical planning quotes, not a verified present-day price commitment.

The description mentioning a QuickBooks connection is stale: it is removed. Swift Sensors remains. Stripe integration coverage and any additional hosting/Stripe Billing costs need review. Client later requested one HQ Power BI seat, with temporary development access as needed, and a native operator dashboard to keep recurring costs low. Production operator/staff identities and entitlements need verification; do not assume three build/service seats already cover all production roles.

## 5. Roles and privacy

B Street is platform super-admin and may assign representatives to support a client. Flavors initially receives one operator account and one restricted staff account. The operator configures facility data, plans and permissions but cannot change platform functionality. The staff account has selected capabilities. Additional staff accounts may become a paid option later. B Street assistance should be auditable and support requests are expected; the ticket system is not selected.

Members see their own documents, compliance, booking actions, invoices and account balance. A shared calendar may show the permitted member name, station, equipment and time; it must not expose financial, compliance or wellness information. Team-member access must not be invented by treating every worker as the business owner.

Only the Flavors **owner/operator** can override booking blocks caused by expired documents or overdue balances; ordinary staff cannot. Staff/operator can handle booking conflicts and specified cancellation/no-show adjustments. Permissions must be checked on server/data access, including direct SharePoint URLs. Do not grant broad list access and rely on UI filters. SharePoint does not offer a simple field-level security boundary: protected financial/approval states need a trusted mutation path or separately protected records.

## 6. Client facility connection and payment architecture

Avenue is the platform operated by B Street. Each client owns its Stripe connected account. Launch Stripe-hosted onboarding from Avenue. Charge member payments directly on the relevant client's connected account and pay out to that client. B Street must not collect or hold those member funds.

Do not request/store the client's Stripe password, secret API key, bank account details or verification documents. The platform's own integration credentials are different and belong only in a server-side secret store. Record connected-account identifiers and necessary operational payment references, not sensitive financial documents.

Before enabling a configuration, inspect account/controller settings, permitted account model, charge type and applicable responsibilities. Confirm who pays Stripe fees and handles refunds, disputes, negative balances and verification. The client's requested allocation is the facility/client, not B Street. Direct charges alone are not proof that every platform responsibility disappears. Flag any setting/contract that can route funds through B Street or create unwanted platform responsibility before enabling it.

Test the full client-facing onboarding experience in Stripe test mode, including return/refresh handling, incomplete verification, connection readiness, a test payment under the connected account, and status flowing back to Avenue. Validate webhook signatures and connected-account context. Deduplicate events and handle retries/out-of-order delivery. A success redirect is not proof of payment.

Demonstrate the test flow and responsibility allocation for client approval before live activation. Only after approval provide the secure production onboarding route to the requester to forward. Prefer an authenticated Avenue invitation that creates a fresh short-lived Stripe onboarding session when the operator uses it; do not assume a raw single-use Stripe Account Link can be forwarded like a permanent URL. Verify the appropriate Stripe-supported onboarding model for the selected account configuration.

Facility connection is distinct from member enrollment: the facility connects Stripe; members buy membership and complete operational onboarding.

## 7. Member payment-first onboarding and compliance

Members select their plan and a monthly collection day from the 1st to the 15th. Initial payment must be verified before operational onboarding starts. New/current paid members then sign in and upload compliance documents. Public/unapproved applicants should not upload documents. Do not build the old public Microsoft Forms file-upload workaround. B Street will onboard the initial existing members for January billing.

The exact staff approval step for new membership was not explicitly resolved by the booking auto-approval decision. Initial payment amount, first billing date and proration also remain open. Maintain explicit payment, onboarding, document and eligibility states rather than inferring all readiness from a single flag.

Store document types, review status and expiry dates privately. Show current/expiring/expired status, renewals and versions. Run the daily expiry check; the original 30-day warning is a proposal unless confirmed. Expired required documents block new bookings. Owner-only overrides need reason, actor and scope. Renewal granting must fail closed and must not expose another member's documents.

## 8. Booking workflow

Member selects station, equipment and time. Evaluate account eligibility, operating rules, plan allowances and overlap. **Auto-confirm if station, equipment and time are available**, first come first served. Send conflicts to Flavors staff/operator. Check availability again at the authoritative mutation point; concurrent requests cannot both be confirmed. The exact serialization/concurrency implementation remains an engineering decision that must be proven under contention.

Extensions can be requested by members, operator and staff. Permit available extra time; route a conflict for resolution. Extra usage above included hours, equipment allowance or storage rental becomes billable. The charging unit, rounding, actual-vs-booked usage and duplicate-prevention ledger must be specified.

Kitchen/storage cancellation uses 24 hours' notice. Late requests go to staff/operator to decide whether some/all hours are lost or returned. Early finishing does not automatically restore unused booked time; members cannot shorten the booking to reclaim those hours. Authorized owner/staff may adjust when appropriate. No-shows lose booked hours; owner/staff can override.

Dining/event cancellation: 15 days' notice allows full refund; at 7 days' notice the client described forfeiting the deposit/payments made without further amounts owed. The 8–14-day range and exact boundary behavior are not supplied. Do not implement an invented interpolation.

Expired required documents or overdue balances block booking. The owner alone may override those blocks. This is application booking eligibility; no physical door-control integration is implied.

## 9. Kitchen session, checklists and reminders

Retain entry/exit checklists and wellness questions. The client wants every team member to check in on arrival. Clarify team identity and whether exit is per individual or per booking. Wellness responses are sensitive; store and expose them only to approved roles, with an explicit retention decision. Do not invent a medical diagnosis or automatic exclusion rule.

Failed checklist: notify the member business owner and Flavors owner/staff for correction/follow-up. The business remains responsible for its team's checklist unless the issue belongs to the facility or another member. Exact questions and pass/fail criteria must be supplied.

Original reminders are 3/2/1 hours before booking, with an automation polling proposal around 15 minutes. Define reminder ledger keys, reschedule versioning, retries and missed-entry grace. Escalate missing arrival or overdue exit to the agreed contacts. Deduplication reduces duplicate sends; do not promise exactly-once email when a provider response is ambiguous.

## 10. Billing, history and reconciliation

Stripe generates monthly membership invoices and collects recurring card payments. Avenue calculates extra hours, equipment and storage charges and sends appropriate invoice items to the client's connected account. Members see invoice/payment history, balances and upcoming charges in Avenue; operator financial activity is scoped to the facility and staff permissions.

Choosing collection days 1–15 creates an unresolved interaction with 'add that month's overages to that month's invoice' when usage happens after collection day. Decide usage cutoff, arrears/advance treatment, invoice finalization, first payment/proration, failed-payment grace, tax, credits and authorized refunds before implementing the billing scheduler. Do not quietly choose next month or generate extra immediate charges.

Use an append-only usage/adjustment ledger, stable idempotency keys and source-linked invoice items. Stripe is the authoritative payment source. Reconcile webhooks against Stripe rather than editing paid flags manually. Define when a balance becomes overdue and how a successful payment clears the block. Cancelling Avenue access and cancelling a Stripe subscription are separate operations requiring an agreed lifecycle policy.

## 11. Swift Sensors and communications

Swift Sensors measures facility equipment/environment temperatures. API access and docs were supplied; the stated cap is 100,000 API calls/month. Only Flavors is sensor-tracked in this pilot. Device-to-unit mapping, thresholds and retention still need configuration. Do not repeat the API key from emails. Check whether API calls batch readings; include endpoints, pagination and retries in a usage budget before selecting polling cadence. Original 15–30-minute polling is conditional on this budget.

Show latest values, units, timestamps/freshness, history and stale/offline states. Avenue is not replacing existing real-time breach alerts with a polling dashboard. Use source timestamps and deduplication for history.

Notices/announcements/newsletters remain. The client explicitly allows a simple booking confirmation email with a portal button to change/cancel and view details. This relaxes the old blanket restriction for that use; it does not authorize emailing full operational, financial or wellness data. Audience selection and private portal links must respect access. Resolve the original News vs Notices naming into a canonical entity.

## 12. Reporting and administration

B Street Power BI analysis covers revenue, bookings, utilization, membership and platform adoption, with cross-facility scope only as facilities are added. Flavors needs facility-specific booking/capacity, member activity, compliance and financial summaries directly inside its Avenue admin experience. Build native summaries/charts where feasible to avoid requiring a separate operator Power BI license. Regular members do not need Power BI.

Define booked-vs-actual usage, utilization denominator, cancellation statuses, cross-month bookings, compliance counts and payment dates. Validate totals against source data. Avoid misleading partial aggregates caused by Power Apps delegation or SharePoint query limits. Large lists need indexed, scoped queries and retention/capacity planning.

Administration includes members, plans, resources, staff permissions, configuration, support and audit. Deactivation revokes Avenue rights, stops inappropriate reminders and preserves required historical records. Do not delete an entire Entra guest identity used elsewhere merely to deactivate Avenue. Define retention, backups, support ownership and billing cancellation separately.

## 13. Delivery and release boundaries

Original planning described eight weeks after prerequisites; the client requested training in the week of December 27 for a January 1 launch, with a December 31 handover. Treat these as requested dates (year/context to confirm), not a guaranteed schedule. Updated Stripe billing, auto-booking and role requirements need a fresh solo-developer estimate. B Street's later analytics reference to January 1, 2028 is a commercial objective, not a Phase 1 release date.

Validate roles and failure paths using test identities: two unrelated members, team-member scenarios, operator, restricted staff, HQ admin, inactive member and unpaid applicant. Test direct URL access, concurrent bookings, cancellation boundaries, expired documents, owner-only overrides, webhook duplicates, billing cutoffs, API outages and stale sensors. Produce test evidence, training, configuration documentation, deployment/rollback steps and a client-owned handover. No real payment or live operator onboarding before the specified approval.

See the full stage catalog for individual click/event paths, technologies, data and acceptance checks. Proposed engineering safeguards are requirements for a sound implementation, not claims that the client already selected a particular hosting provider or library.

# Workflow stage catalog

All 57 stages from the latest interactive workflow. Status is planning status, not proof of implementation or an approved infrastructure choice. Client changes are also listed in CLIENT_DECISIONS.md.

## Establish the foundation

Ownership, access, security and the implementation baseline.

### scope — Reconcile the project baseline

**Planning status:** Confirmed

Apply the latest email decisions over the older scope.

**Technologies:** Project documentation, Decision register

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Replace QuickBooks references with Stripe throughout schema and flows.
- Record the nine Phase 1 modules and the new billing/booking decisions.

**Rules**

- Flavors is the pilot; a standalone multi-client product remains Phase 2.
- Stripe Connect is configured for the platform model without assuming the entire Phase 2 application is included.

**Data / artifacts**

- Revised scope
- Acceptance criteria
- Open decisions

**Acceptance checks**

- Every original module has a destination in this map.
- No QuickBooks connection or customer mapping remains.

### access — Activate accounts and environments

**Planning status:** Confirmed

Use the supplied Microsoft accounts and Stripe invitation.

**Technologies:** Microsoft 365 Business Basic, SharePoint Online, Power Platform, Stripe Dashboard

**Depends on:** scope

**Event / actions**

- Verify assigned rights, service connections and access to test resources.
- Enable tenant/site guest sharing and a site-level app catalog.

**Rules**

- Subscriptions and account details have been provided; access still needs testing.
- B Street hosts the tenant and owns Avenue.

**Data / artifacts**

- Build identities
- Service identity
- App catalog
- Environment IDs

**Acceptance checks**

- Deploy a sample web part and read a test list.
- Confirm service-account ownership without putting credentials in code.

### security — Model identities and permissions

**Planning status:** Confirmed

Separate platform, facility, member business and team-member access.

**Technologies:** Microsoft Entra ID B2B, SharePoint permissions, Power Automate

**Depends on:** access

**Event / actions**

- Map each identity to its member/facility and authorized role.
- Keep payments, files and checklist answers private; expose only agreed calendar fields.

**Rules**

- B Street is super-admin; Flavors has an operator and a restricted staff account.
- Only the Flavors owner may override expired-document or overdue-balance booking blocks.

**Data / artifacts**

- Identity mapping
- Role matrix
- Private libraries
- Audit events

**Acceptance checks**

- Member A cannot fetch B’s private record by direct URL/API.
- Restricted staff cannot perform owner-only overrides.

**Exception / unresolved:** If permission setup fails, keep private records inaccessible and queue repair.

### catalog — Configure the facility catalog

**Planning status:** Needs decision

Load plans, bookable spaces, equipment and operating settings.

**Technologies:** SharePoint Lists, Power Apps, Power Fx

**Depends on:** scope, security

**Event / actions**

- Create plans with included hours and extra-hour rates.
- Configure stations, equipment, storage and the clarified event/dining resources.

**Rules**

- Plan tiers affect allowances and rates.
- Exact prices, resource capacities, checklist questions and grace periods still need supplied configuration.

**Data / artifacts**

- Plans
- Resources
- Equipment
- Members
- Settings

**Acceptance checks**

- Validate representative member plans and prices with the operator.
- Use the facility timezone for booking and billing boundaries.

**Exception / unresolved:** Do not invent missing rates or timing values.

### apps — Create the two interfaces

**Planning status:** Confirmed

Keep members in the browser and staff in the admin app.

**Technologies:** SharePoint Pages, SPFx, React, TypeScript, Power Apps, Power Fx

**Depends on:** security, catalog

**Event / actions**

- Build responsive member web parts and role-aware navigation.
- Build operator/staff screens with shared authoritative data and workflows.

**Rules**

- No member-facing Power Apps app or Power Pages.
- No custom native app; member journeys run in desktop/mobile browsers.

**Data / artifacts**

- Member portal
- Admin app
- Reusable UI components

**Acceptance checks**

- Test a real guest browser session and phone layout.
- UI visibility never substitutes for record-level authorization.

### backend — Establish trusted integration endpoints

**Planning status:** Needs decision

Privileged operations run outside member browser code.

**Technologies:** Secure server endpoint — to select, Power Automate, Secret storage — to select

**Depends on:** access, security

**Event / actions**

- Select and approve server-side execution for Stripe operations and HTTPS webhooks.
- Validate callers, store secrets securely and record idempotent operations.

**Rules**

- SPFx must not contain Stripe secrets or sensor credentials.
- Existing subscriptions do not prove that backend hosting and every premium flow are covered.

**Data / artifacts**

- Webhook endpoint
- Platform credentials
- Operation ledger

**Acceptance checks**

- Reject forged requests and incorrect signatures.
- Document costs and ownership before activating any extra service.

**Exception / unresolved:** Backend host and credential-storage implementation remain unselected.

## Connect the facility

Stripe setup and operator onboarding before live payments.

### stripe-config — Review Stripe Connect responsibilities

**Planning status:** Confirmed

Confirm the platform’s direct-charge SaaS configuration.

**Technologies:** Stripe Connect, Stripe Dashboard

**Depends on:** backend

**Event / actions**

- Inspect fees, refunds, disputes, verification and negative-balance settings.
- Document which party handles each responsibility and flag platform exposure.

**Rules**

- B Street/Avenue should not receive or hold client payment funds.
- Do not promise zero platform liability solely because direct charges are used.

**Data / artifacts**

- Configuration record
- Responsibility matrix
- Connected-account model

**Acceptance checks**

- A payment is created on the test connected account.
- Client receives payouts; any platform-risk setting is reviewed.

**Exception / unresolved:** Do not enable a setting that changes funds routing or liability before approval.

### operator-connect — Launch Stripe-hosted operator onboarding

**Planning status:** Confirmed

A facility operator connects its own payment account from Avenue.

**Technologies:** SharePoint member/admin entry, Secure server endpoint, Stripe-hosted onboarding

**Depends on:** stripe-config

**Event / actions**

- Authenticate the authorized operator and start Stripe onboarding.
- Stripe collects financial and verification information directly.

**Rules**

- Do not collect/store the client’s Stripe password, secret key, bank details or verification documents.
- An Avenue invitation can be forwarded; generate Stripe’s short-lived onboarding link after authentication.

**Data / artifacts**

- Facility ID ↔ connected-account ID
- Onboarding progress

**Acceptance checks**

- Expired/used links safely regenerate for the right operator.
- Return to Avenue does not alone prove verification is complete.

**Exception / unresolved:** Resume incomplete onboarding without duplicating the facility connection.

### connect-status — Verify account readiness and events

**Planning status:** Confirmed

Keep Avenue aware of payment capability and onboarding status.

**Technologies:** Stripe API, Verified webhooks, SharePoint Lists

**Depends on:** operator-connect

**Event / actions**

- Verify event signatures and resolve the correct connected account.
- Retrieve current account capability/requirement state when necessary.

**Rules**

- No cross-facility event or payment data leakage.
- Process repeated/out-of-order events safely.

**Data / artifacts**

- Account readiness
- Event IDs
- Integration health

**Acceptance checks**

- Successful, incomplete and failed onboarding states display correctly.
- Replay does not duplicate changes.

**Exception / unresolved:** Unverified events are rejected; failures go to an operational queue.

### stripe-demo — Demonstrate the test flow

**Planning status:** Confirmed

Show the exact operator experience and a simulated payment.

**Technologies:** Stripe test mode, Avenue portal, Test evidence

**Depends on:** connect-status

**Event / actions**

- Connect a test facility, create a test direct payment and return its status to Avenue.
- Show account records, funds routing and the responsibility findings.

**Rules**

- No live onboarding or live payment processing before explicit approval.

**Data / artifacts**

- Demo checklist
- Test payment IDs
- Approval record

**Acceptance checks**

- Client sees the actual onboarding screens and test account payment.
- Open responsibility questions are resolved before release.

## Onboard the member

Payment-first enrollment, document upload and authorized access.

### member-start — Select plan and payment date

**Planning status:** Needs decision

Capture the member’s business and selected membership.

**Technologies:** SharePoint Pages, SPFx / React, SharePoint Lists

**Depends on:** catalog, apps, stripe-demo

**Event / actions**

- Present membership plans and the approved prices.
- Let the member choose a monthly collection date from the 1st through 15th.

**Rules**

- New members pay before operational onboarding begins.
- No public or unapproved applicant document uploads.

**Data / artifacts**

- Application
- Business owner
- Plan
- Payment-day preference

**Acceptance checks**

- The selected plan/date are associated with the correct applicant.
- First-payment amount and proration follow an agreed rule.

**Exception / unresolved:** Initial payment, approval ordering and rejected-application handling need final rules.

### first-payment — Complete initial membership payment

**Planning status:** Proposed implementation

Stripe handles the payment under the facility’s connected account.

**Technologies:** Stripe payment / billing APIs, Stripe-hosted payment UI — proposed, Secure server endpoint

**Depends on:** member-start

**Event / actions**

- Calculate the charge from trusted plan data.
- Confirm successful payment through verified Stripe status.

**Rules**

- Never trust a browser-supplied price or success flag.
- Store Stripe references and necessary status, not payment-card data.

**Data / artifacts**

- Connected customer ID
- Payment reference
- Paid status

**Acceptance checks**

- A failed or abandoned payment does not activate full member access.
- A repeated request cannot create duplicate charges.

**Exception / unresolved:** Payment failure offers an approved retry path; do not grant operational access.

### paid-intake — Start authenticated onboarding

**Planning status:** Needs decision

Collect the member’s operational profile after payment.

**Technologies:** Microsoft Entra ID B2B, SharePoint Lists, Power Automate

**Depends on:** first-payment, security

**Event / actions**

- Provision the permitted guest/onboarding access and capture member details.
- Link member business, authorized team and paid plan.

**Rules**

- B Street will onboard current members for January billing.
- A paid state alone does not establish that every compliance requirement is complete.

**Data / artifacts**

- Member profile
- Guest identity
- Team association

**Acceptance checks**

- Paid members reach their own onboarding area.
- Another applicant cannot access their profile or documents.

**Exception / unresolved:** Staff approval after payment is not conclusively resolved in the trail.

### initial-docs — Upload permits and compliance files

**Planning status:** Confirmed

Documents are collected only after authenticated onboarding starts.

**Technologies:** SharePoint Document Libraries, SPFx upload UI, Power Automate

**Depends on:** paid-intake

**Event / actions**

- Upload required files with document type and issue/expiry dates.
- Apply member-specific permissions and track required/missing documents.

**Rules**

- No public Microsoft Forms upload journey.
- Final document types, warning window and validation requirements must be configured.

**Data / artifacts**

- Private file
- Member ID
- Document metadata

**Acceptance checks**

- Direct download denies other members.
- Staff on-behalf upload grants the correct member access.

**Exception / unresolved:** Failed upload or permission grant remains pending; do not label it compliant.

### member-ready — Evaluate operational eligibility

**Planning status:** Confirmed

Expose the member’s portal once the applicable requirements are satisfied.

**Technologies:** SharePoint Lists, Power Automate, Power Apps, Entra guest access

**Depends on:** initial-docs

**Event / actions**

- Evaluate paid membership and required compliance state.
- Show clear status and what needs attention.

**Rules**

- Booking blocks apply for expired documents and overdue balances.
- Only Flavors owner may override those specific blocks, with audit.

**Data / artifacts**

- Membership status
- Compliance status
- Eligibility
- Override history

**Acceptance checks**

- A blocked member cannot bypass checks through direct requests.
- Owner override is explicit and attributable.

## Book and manage resources

Availability, automatic confirmation, exceptions and changes.

### calendar — Browse the shared calendar

**Planning status:** Confirmed

Members see kitchen occupancy without private operational data.

**Technologies:** SharePoint Lists, SPFx / React calendar

**Depends on:** member-ready, apps

**Event / actions**

- Read the requested calendar range and filter resources.
- Display member name, station, equipment, date and time.

**Rules**

- Private files, balances, answers and contact data do not belong on shared rows.

**Data / artifacts**

- Public booking projection
- Resource catalog

**Acceptance checks**

- All allowed bookings in the range appear, including beyond local row limits.
- Private data never leaks through shared-list access.

### request — Submit a reservation

**Planning status:** Needs decision

Request station/equipment and a start/end interval.

**Technologies:** SPFx / React, SharePoint Lists, Trusted booking action

**Depends on:** calendar

**Event / actions**

- Validate membership, compliance, balance and resource constraints.
- Calculate allowance usage and applicable pricing under agreed rules.

**Rules**

- Plan limits and overage rates affect the request.
- Booking mutations and price calculations require authoritative validation.

**Data / artifacts**

- Booking request
- Equipment lines
- Rate snapshot

**Acceptance checks**

- Reject invalid duration, inaccessible resources and forged ownership.
- Evaluate booking eligibility again at commit.

**Exception / unresolved:** Exact capacity/buffer and booked-versus-attended usage rules still need confirmation.

### auto-book — Automatically confirm an available booking

**Planning status:** Needs decision

Apply first-come, first-served confirmation for conflict-free requests.

**Technologies:** Power Automate, SharePoint Lists, Booking conflict validation

**Depends on:** request

**Event / actions**

- Check station, equipment and date/time conflicts.
- Recheck when confirming and record the confirmed reservation.

**Rules**

- No manual approval for an eligible conflict-free request.
- The original design excludes a database-level lock; the new auto-confirm path needs a tested concurrency strategy.

**Data / artifacts**

- Confirmed booking
- Actor audit
- Reservation version

**Acceptance checks**

- Simultaneous requests cannot silently create conflicting confirmations.
- Confirmed booking appears in the shared calendar.

**Exception / unresolved:** Serialize/recheck confirmation or select another approved safe strategy before acceptance.

### conflict — Route conflicts to facility staff

**Planning status:** Confirmed

An exception branch handles contested resources or times.

**Technologies:** Power Automate, Power Apps staff queue

**Depends on:** request

**Event / actions**

- Notify operator/staff of the conflict.
- Record resolution and only confirm an agreed available alternative.

**Rules**

- A conflict must not silently override another reservation.

**Data / artifacts**

- Conflict case
- Resolution
- Staff actor

**Acceptance checks**

- Pending conflict is clearly distinguishable from confirmation.
- The requestor sees the final outcome.

### booking-notice — Send confirmation and portal actions

**Planning status:** Confirmed

Member receives a simple booking notice with Avenue links.

**Technologies:** Power Automate, Microsoft 365 email, Avenue portal

**Depends on:** auto-book

**Event / actions**

- Send an approved booking confirmation.
- Provide authenticated change/cancel links into Avenue.

**Rules**

- The email trail permits booking confirmation wording and portal links.
- Permission to send booking notices is not permission to email private wellness or financial details.

**Data / artifacts**

- Notification log
- Booking link

**Acceptance checks**

- Clicking the link opens the authorized booking.
- A retry does not cause unintended repeated notices.

### extension — Request additional time

**Planning status:** Confirmed

Members, operator and staff can request an extension.

**Technologies:** SPFx / React, Power Apps, Power Automate

**Depends on:** booking-notice

**Event / actions**

- Check the extra interval against other reservations.
- Add eligible overage charges and update reminder targets.

**Rules**

- Conflicts alert the Flavors owner/staff for resolution.
- Extra usage above included credits/storage allowance becomes billable.

**Data / artifacts**

- Booking revision
- Extra time
- Charge lines

**Acceptance checks**

- A change does not leave stale reminders active.
- Member, operator and staff actors are audited.

**Exception / unresolved:** The invoice cutoff for late-month extensions is still a billing decision.

### cancellation — Cancel or shorten a booking

**Planning status:** Confirmed

Apply notice windows and controlled adjustments.

**Technologies:** Avenue portal, Power Apps, Power Automate, Charge ledger

**Depends on:** booking-notice

**Event / actions**

- Allow kitchen/storage cancellation with 24-hour notice.
- Route late requests to owner/staff to decide credit restoration or forfeiture.

**Rules**

- Members do not automatically receive unused time back for leaving early.
- Owner/staff can adjust the booking and credited hours.

**Data / artifacts**

- Cancellation request
- Credit adjustment
- Audit

**Acceptance checks**

- A late request cannot self-grant a refund of credits.
- Confirmed changes update availability and billing.

### events — Apply event-specific cancellation rules

**Planning status:** Needs decision

Dining/events have different cancellation and refund rules.

**Technologies:** Power Apps, Power Automate, Stripe refund API

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Apply the stated 15-day/full-refund and 7-day/forfeit rules.
- Record the security deposit and paid amounts when relevant.

**Rules**

- For seven-day notice the client says deposit/payments are forfeited with no further amount owed.
- Rules for 8–14 days and other unlisted boundaries are not supplied.

**Data / artifacts**

- Event booking
- Deposit
- Refund / forfeiture record

**Acceptance checks**

- Correct notice boundary and authorized refund action are tested.
- Refunds follow the connected-account responsibility configuration.

**Exception / unresolved:** Do not invent the policy for unspecified notice periods.

### no-show — Handle a no-show

**Planning status:** Needs decision

Booked hours are forfeited unless authorized staff override.

**Technologies:** Power Apps, Power Automate, SharePoint Lists

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Identify a missed booking under the agreed detection rule.
- Record consumed hours and any owner/staff exception.

**Rules**

- No-shows lose booked hours.
- Owner/staff can override this rule; this is distinct from owner-only debt/compliance overrides.

**Data / artifacts**

- No-show state
- Hours ledger
- Override reason

**Acceptance checks**

- Exception is auditable and does not double-deduct hours.

**Exception / unresolved:** No-show detection timing has not been specified.

## Run the kitchen session

Timed reminders, individual check-in, safety and exit.

### reminders — Run 3 / 2 / 1-hour reminders

**Planning status:** Needs decision

Scheduled reminders prepare members for the booking.

**Technologies:** Power Automate scheduled flows, SharePoint Lists, Microsoft 365 email

**Depends on:** booking-notice

**Event / actions**

- Find eligible confirmed bookings and due reminder events.
- Check booking revision, cancellation and member state before sending.

**Rules**

- Source flow proposes a 15-minute scan; exact-minute delivery is not guaranteed.
- Deduplicate logical events and track ambiguous send outcomes.

**Data / artifacts**

- Reminder ledger
- Booking version
- Send result

**Acceptance checks**

- Retries and overlapping runs do not blindly resend.
- Late-booking catch-up policy is approved.

**Exception / unresolved:** Catch-up, grace periods and uncertain-send recovery need configuration.

### arrival — Check each team member in

**Planning status:** Needs decision

Capture wellness and food-safety answers on arrival.

**Technologies:** SPFx / React, SharePoint Checklists list

**Depends on:** reminders, member-ready

**Event / actions**

- Resolve the member business and individual submitting the checklist.
- Capture answers, question version, identity and timestamp.

**Rules**

- Client requires every team member to check in with wellness items.
- Individual team-member identity/access model needs completion beyond the original member-only schema.

**Data / artifacts**

- Entry checklist
- Team identity
- Booking ID

**Acceptance checks**

- Answers are private and attributed to the actual submitter.
- Duplicate submission rules are applied.

**Exception / unresolved:** Exact questions and per-team identity permissions are configuration dependencies.

### failed-entry — Notify responsible people of a failed checklist

**Planning status:** Confirmed

Route failures for correction and follow-up.

**Technologies:** Power Automate, Power Apps exception view, Private member portal

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Alert the Flavors operator/staff and the member business owner.
- Track follow-up and corrective action.

**Rules**

- The member business remains responsible for its team’s issue.
- Facility or another member’s issues are handled by Flavors with the appropriate party.

**Data / artifacts**

- Failed checklist
- Follow-up case
- Resolution

**Acceptance checks**

- Only authorized recipients can read the answer details.
- Failure detection does not invent an unapproved automatic access ban.

**Exception / unresolved:** Detailed safety responses belong in the private portal, not broad emails.

### missed-entry — Escalate missing check-in

**Planning status:** Confirmed

Detect missing entry after the configured grace period.

**Technologies:** Power Automate scheduled monitor, Power Apps staff queue

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Nudge the member, then escalate to staff when unresolved.
- Record staff outreach and suppress reminders once resolved.

**Rules**

- Grace periods and escalation contacts must be supplied.

**Data / artifacts**

- Overdue entry
- Outreach log

**Acceptance checks**

- No escalation after a valid entry or cancelled booking.
- One resolved incident does not repeatedly reopen.

### exit — Complete exit and close the session

**Planning status:** Confirmed

Submit the exit checklist or request an authorized extension.

**Technologies:** SPFx / React, Power Automate, SharePoint Checklists list

**Depends on:** arrival

**Event / actions**

- Prompt exit at session end.
- Save private exit answers and update session state.

**Rules**

- Original scope requires entry and exit checklists per booking.
- The trail explicitly expands individual entry; whether exit is per person needs clarification.

**Data / artifacts**

- Exit answers
- Session status
- Usage basis

**Acceptance checks**

- Exit cannot silently extend the reservation.
- Actual versus booked-hour reporting remains explicit.

**Exception / unresolved:** Missing exit routes to staff; never fabricate completion.

### exit-escalation — Resolve overdue exit and outreach

**Planning status:** Confirmed

Staff handle unresolved end-of-session cases.

**Technologies:** Power Automate, Power Apps, Audit log

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Flag a missing exit after the approved interval.
- Log one-off staff follow-up and final resolution.

**Rules**

- Retain booking and checklist history.

**Data / artifacts**

- Exception state
- Outreach
- Resolved by/at

**Acceptance checks**

- Resolved cases stop generating overdue notices.

## Bill and reconcile

Recurring memberships, usage charges, collection and recovery.

### billing-rule — Define the invoice cycle

**Planning status:** Needs decision

Resolve calendar-month usage against the chosen debit date.

**Technologies:** Billing configuration, SharePoint Lists, Stripe billing APIs

**Depends on:** catalog, member-start

**Event / actions**

- Define first payment, recurrence anchor and invoice cutoff.
- Define late-month overages, proration, plan changes, credits and taxes if applicable.

**Rules**

- Client wants payment dates 1–15 and overages added to the month’s invoice.
- How usage after that date is collected is not resolved; do not silently choose next-month billing.

**Data / artifacts**

- Approved pricing examples
- Cycle rules
- Tax / credit rules

**Acceptance checks**

- Example invoices reconcile for members paying on day 1 and day 15.
- Month-end usage has an agreed destination.

### usage — Calculate usage and overages

**Planning status:** Confirmed

Translate reservations and authorized adjustments into charges.

**Technologies:** SharePoint booking / credit ledgers, Power Automate, Trusted billing logic

**Depends on:** billing-rule, extension, cancellation

**Event / actions**

- Apply included plan hours and approved resource rates.
- Account for extensions, cancellations, no-shows and storage/equipment charges.

**Rules**

- Avenue calculates charges; Stripe invoices/collects.
- Bookable hours versus actual attendance must be agreed.

**Data / artifacts**

- Usage lines
- Rate snapshot
- Allowance balance
- Charge key

**Acceptance checks**

- A booking revision does not double-charge.
- Every charge traces to a reservation or approved adjustment.

### invoice — Create the recurring invoice

**Planning status:** Proposed implementation

Build membership plus approved extra-charge lines.

**Technologies:** Stripe subscriptions / invoices, Secure server endpoint, Power Automate

**Depends on:** usage, connect-status

**Event / actions**

- Create/update the facility-connected member billing records.
- Apply the approved collection date and usage cutoff.

**Rules**

- Payment objects belong to the correct facility’s connected Stripe account.
- Stripe Billing/API capabilities, fees and exact route need configuration review.

**Data / artifacts**

- Connected customer
- Subscription
- Invoice ID
- Line items

**Acceptance checks**

- Retry cannot create a second invoice/line.
- Invoice matches manually calculated reference examples.

### collection — Collect payment through Stripe

**Planning status:** Confirmed

Automatic collection updates the member’s balance and history.

**Technologies:** Stripe, Verified webhooks, SharePoint Payments list

**Depends on:** invoice

**Event / actions**

- Track success, authentication-needed and failure states.
- Update Avenue from verified events, with source reconciliation.

**Rules**

- Funds go to the connected facility; payout timing is controlled by Stripe/account settings.
- A browser return page alone cannot mark an invoice paid.

**Data / artifacts**

- Payment status
- Invoice balance
- Event ledger

**Acceptance checks**

- Payment appears on connected account.
- Repeat or out-of-order webhooks cannot corrupt the balance.

**Exception / unresolved:** Surface failures to authorized users and retry under the agreed policy.

### history — Show invoices and payment history

**Planning status:** Confirmed

Give each member one place for past and upcoming charges.

**Technologies:** SPFx / React, SharePoint Lists, Stripe references

**Depends on:** collection

**Event / actions**

- Show invoices, payments, outstanding balance and upcoming/estimated overages.
- Show financial summaries to operator and permitted staff.

**Rules**

- Members see only their own data.
- B Street analytics can use approved operational financial data without collecting private bank credentials.

**Data / artifacts**

- Private payment projection
- Last verified update

**Acceptance checks**

- Another member cannot retrieve the record directly.
- Estimated and finalized charges are clearly distinguished.

### overdue — Block booking for overdue balances

**Planning status:** Needs decision

Apply the client’s owner-only override policy.

**Technologies:** Power Automate, Power Apps, Booking eligibility check

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Update overdue state using the agreed due-date rule.
- Block new booking actions and allow an audited Flavors-owner override.

**Rules**

- Staff cannot override overdue/expired-document booking blocks.
- The email specifies booking blocks, not a physical door-lock integration.

**Data / artifacts**

- Overdue status
- Override record

**Acceptance checks**

- Server-side booking action enforces the block.
- Payment reconciliation clears the block when appropriate.

**Exception / unresolved:** Failed-payment retry timing and exact overdue boundary need approval.

### refund-dispute — Manage refunds and disputes

**Planning status:** Confirmed

Handle adjustments under the reviewed account responsibility model.

**Technologies:** Stripe Connect, Stripe Dashboard / API, Power Apps, Audit log

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Authorize refund requests and track their final status.
- Record disputes and inform the designated responsible facility owner.

**Rules**

- Cancellation credit restoration is not automatically a cash refund.
- Flag any platform liability or fund-flow change before enabling.

**Data / artifacts**

- Refund reference
- Dispute status
- Authorized actor

**Acceptance checks**

- Test refund/dispute event handling in the allowed test environment.
- Only permitted users initiate financial adjustments.

**Exception / unresolved:** Refund authorization and exception procedures need documented ownership.

## Maintain compliance

Renewal, expiry reminders and booking eligibility.

### expiry — Review document expiry daily

**Planning status:** Confirmed

Track required documents over the membership lifecycle.

**Technologies:** SharePoint Document Libraries, Power Automate daily flow

**Depends on:** initial-docs

**Event / actions**

- Set Current / Expiring / Expired using configured dates.
- Identify missing requirements separately from expired uploads.

**Rules**

- Original default warning window is 30 days, still to confirm.
- Retain renewal history under an agreed retention policy.

**Data / artifacts**

- Document status
- Expiry
- Required types

**Acceptance checks**

- Date-only expiry boundary is consistent.
- Status refresh does not send a new reminder every scan unintentionally.

### renew — Request and record renewal

**Planning status:** Confirmed

Members or authorized staff replace expiring documents.

**Technologies:** SPFx upload UI, Power Apps, Power Automate, Microsoft 365 email

**Depends on:** expiry

**Event / actions**

- Send an appropriate renewal notice with authenticated portal access.
- Upload the new document and link it to the superseded version.

**Rules**

- Staff on-behalf uploads require actor audit.
- Do not delete compliance history without a retention decision.

**Data / artifacts**

- Renewal link
- Document versions
- Reminder state

**Acceptance checks**

- Private permissions apply to each replacement.
- Eligibility reflects the authoritative current document.

### compliance-block — Enforce expired-document booking blocks

**Planning status:** Needs decision

Only the Flavors owner can grant a recorded exception.

**Technologies:** Booking eligibility logic, Power Apps, SharePoint permissions

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Recheck compliance when a reservation is submitted/confirmed.
- Record owner override reason and scope.

**Rules**

- Restricted staff cannot override.
- Treatment of already-confirmed future bookings after expiry needs a rule.

**Data / artifacts**

- Eligibility
- Override
- Affected bookings

**Acceptance checks**

- UI and direct requests obey the same control.

**Exception / unresolved:** Do not cancel existing bookings automatically without an approved rule.

## Monitor the environment

Flavors-only Swift Sensors integration and historical visibility.

### sensor-map — Map sensors to facility units

**Planning status:** Needs decision

Use supplied API access without repeating credentials in the map.

**Technologies:** Swift Sensors API, Secure credential storage, SharePoint configuration

**Depends on:** backend

**Event / actions**

- Map device IDs to refrigerators/freezers and temperature units.
- Configure the approved min/max threshold for each unit.

**Rules**

- API access and documentation were supplied; monthly limit is 100,000 calls.
- Sensor tracking is for Flavors only in the pilot.

**Data / artifacts**

- Sensor mapping
- Unit labels
- Thresholds

**Acceptance checks**

- Every displayed tile maps to the correct physical unit.
- No secrets appear in frontend bundles, exports or logs.

**Exception / unresolved:** Device mapping, limits per endpoint and thresholds still require validation.

### sensor-sync — Poll readings and append history

**Planning status:** Confirmed

Scheduled ingestion maintains current and historical values.

**Technologies:** Power Automate HTTP, Swift Sensors API, SharePoint Lists

**Depends on:** sensor-map

**Event / actions**

- Poll within the API budget; deduplicate source readings.
- Store source timestamp and update the latest value per unit.

**Rules**

- Original proposed cadence is 15–30 minutes, subject to actual API limits.
- Calls depend on endpoints, pagination and retries, not just sensor count.

**Data / artifacts**

- SensorReadings
- Latest values
- Sync runs
- Call budget

**Acceptance checks**

- Duplicate polls do not duplicate history.
- Reading time and retrieval time are distinguishable.

**Exception / unresolved:** Rate limits trigger bounded retry; outages remain visible.

### sensor-ui — Display temperatures and history

**Planning status:** Confirmed

Show latest synchronized readings with range and freshness.

**Technologies:** SPFx / React, Power Apps, SharePoint Lists

**Depends on:** sensor-sync

**Event / actions**

- Display units, source timestamp and Normal / Out-of-range status.
- Provide authorized historical views and stale/unavailable indications.

**Rules**

- Swift Sensors retains real-time breach alerts.
- Avenue polling is not a replacement real-time alarm system.

**Data / artifacts**

- Temperature tiles
- History
- Last successful sync

**Acceptance checks**

- A stale normal reading is not presented as current.
- Threshold boundaries and units are correct.

**Exception / unresolved:** History backfill is conditional on provider API capabilities.

## Communicate and administer

Publishing, operator tools and controlled account changes.

### notices — Publish announcements and newsletters

**Planning status:** Needs decision

Staff publish to all members or an approved audience.

**Technologies:** SharePoint News / Notices — choose canonical source, Power Apps, Power Automate

**Depends on:** apps, security

**Event / actions**

- Create, publish and update announcements.
- Send the approved notification with a portal link.

**Rules**

- Audience targeting is not a substitute for permissions on confidential content.
- The original News-versus-Notices storage ambiguity must be resolved.

**Data / artifacts**

- Published content
- Audience
- Publication version

**Acceptance checks**

- Drafts stay private and publication nudges are deduplicated.

**Exception / unresolved:** Choose one authoritative publishing model before implementation.

### admin — Manage members, plans and staff access

**Planning status:** Confirmed

Operator controls facility operations without changing platform functionality.

**Technologies:** Power Apps, Power Fx, SharePoint Lists, Entra / SharePoint permissions

**Depends on:** apps, security

**Event / actions**

- Edit member/plan configuration and assign staff visibility within allowed boundaries.
- Support B Street super-admin and delegated representative actions.

**Rules**

- Flavors receives one operator and one staff account for the pilot.
- Additional accounts are a future commercial option, not unlimited free staff licensing.

**Data / artifacts**

- Roles
- Plans
- Member status
- Audit

**Acceptance checks**

- Forbidden role/owner changes fail outside the UI.
- Plan edits do not silently rewrite historical invoice calculations.

### support — Route support requests to B Street

**Planning status:** Needs decision

Client wants a way to request help or on-behalf changes during the pilot.

**Technologies:** Avenue support entry — implementation to confirm, B Street staff access

**Depends on:** No explicit stage dependency recorded; follow the implementation gates.

**Event / actions**

- Record a support request and assigned representative.
- Audit any action taken on behalf of operator/member.

**Rules**

- The email requests ticket submission; no separate help-desk product is selected.

**Data / artifacts**

- Support case
- Assignee
- On-behalf audit

**Acceptance checks**

- Support users only access assigned/authorized facility data.

**Exception / unresolved:** Confirm minimum ticket workflow and Phase 1 acceptance rather than adding a full help-desk product.

### deactivate — Deactivate or revoke Avenue access

**Planning status:** Needs decision

Retain records while stopping new operations and notifications.

**Technologies:** Power Automate, Entra groups, SharePoint permissions, Power Apps

**Depends on:** admin

**Event / actions**

- Mark inactive, stop eligible nudges and remove Avenue-specific access.
- Reconcile private grants and apply the agreed future-booking policy.

**Rules**

- Do not delete a guest identity used by other client systems without approval.
- Stripe subscription cancellation is a separate decision from login deactivation.

**Data / artifacts**

- Member lifecycle
- Access audit
- Billing lifecycle

**Acceptance checks**

- Inactive users cannot create new bookings.
- Revocation does not destroy required financial/compliance history.

**Exception / unresolved:** Future bookings and subscription termination rules need an approved policy.

## Understand operations

In-app facility dashboards and separate B Street analytics.

### operator-dashboard — Build the Flavors operational dashboard

**Planning status:** Proposed implementation

Provide facility summaries directly inside Avenue.

**Technologies:** Power Apps / SharePoint reporting, Power Fx, SharePoint Lists

**Depends on:** history, exit, expiry, sensor-ui

**Event / actions**

- Show bookings, utilization, peak hours, capacity, member activity and compliance.
- Show financial summaries and outstanding charges according to staff permissions.

**Rules**

- Build native operational summaries; do not assume embedding Power BI avoids viewer licensing.
- Regular members do not need Power BI access.

**Data / artifacts**

- Operational aggregates
- Financial summaries
- Refresh timestamp

**Acceptance checks**

- Sample totals match source records beyond local query limits.
- Do not label a delayed aggregate real-time without a defined freshness contract.

**Exception / unresolved:** Metric aggregation and scale need a tested design; no arbitrary local-only totals.

### hq-reports — Create B Street Power BI analytics

**Planning status:** Confirmed

Platform oversight for the pilot with future expansion kept explicit.

**Technologies:** Power BI Pro, Power Query / M, DAX, SharePoint data

**Depends on:** operator-dashboard

**Event / actions**

- Build revenue, booking, utilization and membership trends.
- Prepare a facility-aware model; populate only actual pilot data.

**Rules**

- Client prefers one B Street Pro seat plus temporary development licensing if needed.
- Other interactive Power BI viewers require appropriate coverage.

**Data / artifacts**

- Semantic model
- Measures
- Report workspace

**Acceptance checks**

- Booked hours are distinguished from attended hours.
- Monthly financial totals and compliance denominators have approved definitions.

**Exception / unresolved:** Cross-location reports do not imply unapproved delivery of Phase 2 facilities.

### member-summary — Keep personal summaries in the member portal

**Planning status:** Confirmed

Members review their own reservations, invoices and balances.

**Technologies:** SPFx / React, SharePoint Lists, Private permissions

**Depends on:** history, calendar, renew

**Event / actions**

- Present personal operational and financial history.
- Link back to permitted booking and renewal actions.

**Rules**

- No member Power BI deployment.
- No member-facing Power Apps license-dependent screen.

**Data / artifacts**

- My bookings
- My documents
- My account

**Acceptance checks**

- Personal records are complete, scoped and clearly timestamped.

## Validate and release

End-to-end acceptance, controlled go-live and recovery.

### test-e2e — Test every role and failure path

**Planning status:** Confirmed

Validate the system as real guests and staff, not just a developer account.

**Technologies:** Test identities, SharePoint, Power Apps, Stripe test mode, Power Automate

**Depends on:** hq-reports, member-summary, notices, deactivate

**Event / actions**

- Run paid enrollment → documents → booking → entry/exit → usage billing.
- Exercise conflicts, restricted accounts, failures, refunds and API outages.

**Rules**

- No cross-member file/payment/checklist exposure.
- Test concurrent auto-booking and retry-safe financial/event processing.

**Data / artifacts**

- Acceptance evidence
- Defects
- Known limitations

**Acceptance checks**

- Operator summaries and B Street reports reconcile to reference examples.
- Phone browser journeys and direct-access denials pass.

### approval — Obtain client test approval

**Planning status:** Confirmed

Review the Stripe demo and the complete pilot acceptance results.

**Technologies:** Client demonstration, Approval record, Updated scope

**Depends on:** test-e2e, stripe-demo

**Event / actions**

- Show the exact operator Stripe onboarding and payment flow.
- Document responsibility settings, outstanding rules and release readiness.

**Rules**

- No live Stripe activity before approval.
- The email requests late-December training and January launch; readiness must be validated, not assumed.

**Data / artifacts**

- Signed-off test flow
- Release checklist

**Acceptance checks**

- Approval is attributable and specific to the tested configuration.

**Exception / unresolved:** If critical access or financial-integrity issues remain, keep test mode.

### go-live — Connect the real operator and activate production

**Planning status:** Confirmed

Use approved live configuration and a controlled first run.

**Technologies:** Authenticated Avenue invitation, Stripe live configuration, Power Automate, SharePoint

**Depends on:** approval

**Event / actions**

- Send an Avenue start/invitation link for the operator.
- After authentication generate Stripe onboarding, verify readiness, then enable approved live operations.

**Rules**

- The forwarded link is not a raw reusable Stripe Account Link.
- No secret keys, banking data or verification documents enter this artifact.

**Data / artifacts**

- Live connected-account mapping
- Deployment version
- Audit

**Acceptance checks**

- Verify the first approved live event in the correct account.
- Pause schedules safely if verification fails.

**Exception / unresolved:** Live setup requires the correct mode-specific credentials and explicit approval.

### training — Train operator and hand over ownership

**Planning status:** Confirmed

Teach daily workflows and exception handling.

**Technologies:** Avenue member portal, Power Apps admin, B Street reporting, Runbooks

**Depends on:** go-live

**Event / actions**

- Demonstrate bookings, checklists, compliance, billing issues and owner-only exceptions.
- Deliver artifacts, configuration inventory, connection owners and recovery instructions.

**Rules**

- No unconditional eight-week or launch-date guarantee from this map.
- Build identities and production operator permissions need deliberate handover.

**Data / artifacts**

- Training guide
- Runbooks
- Release exports
- Account ownership

**Acceptance checks**

- A designated owner can resolve failed jobs and reconnect services.
- Restore/rollback rehearsal does not lose records or resend payments.

## Operate and evolve

Repeat daily operations, retain history and separate future scope.

### health — Monitor failures and reconcile sources

**Planning status:** Confirmed

Keep integrations and scheduled work observable.

**Technologies:** Power Automate run history, SharePoint operational logs, Stripe webhooks, Swift Sensors

**Depends on:** training

**Event / actions**

- Review failed flows, stale sensors, unmapped records and incomplete provisioning.
- Reconcile payment status; replay safely and track API budget.

**Rules**

- Never log secrets or broadly expose wellness answers.
- Avenue is not an emergency response or physical access-control system.

**Data / artifacts**

- Health dashboard
- Retry queue
- Last successful sync

**Acceptance checks**

- A duplicate event or replay does not charge twice.
- Failures have a named operational owner.

### retention — Maintain security and recoverability

**Planning status:** Needs decision

Manage document/sensor history and account lifecycle over time.

**Technologies:** SharePoint retention / versioning, Exported app / flow artifacts, Backup process — to agree

**Depends on:** health

**Event / actions**

- Review private grants, service credentials and projected list/permission growth.
- Apply approved retention, archive and recovery procedures.

**Rules**

- Retention periods and support/warranty terms are not supplied.
- A saved app version alone is not proof of full data recovery.

**Data / artifacts**

- Retention schedule
- Recovery evidence
- Access reviews

**Acceptance checks**

- Historical invoices and compliance records remain available as required.

**Exception / unresolved:** Agree retention before deleting history or claiming legal compliance.

### phase2 — Separate future platform expansion

**Planning status:** Future

Keep the long-term multi-client product distinct from the pilot.

**Technologies:** Future architecture — not selected, Phase 2 backlog

**Depends on:** health

**Event / actions**

- Capture lessons from Flavors and proposed school/client needs.
- Plan facility isolation, configurable feature access and future AI separately.

**Rules**

- Standalone multi-client platform, broader rollout and AI are aspirations in the trail.
- Stripe’s multi-client capability is not proof those application features are delivered.

**Data / artifacts**

- Phase 2 backlog
- Pilot lessons
- Scope decisions

**Acceptance checks**

- New-client functionality is assessed before it is promised.

**Exception / unresolved:** This node records future scope; it is not a committed Phase 1 deliverable.

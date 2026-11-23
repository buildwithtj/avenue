# Open decisions — do not assume

> Tracking note (2026-11-10): open items now carry stable IDs in [DECISIONS_AND_OPEN_QUESTIONS.md](../DECISIONS_AND_OPEN_QUESTIONS.md), which is the authoritative register. This file is kept as the original handoff list.

Subscriptions and login details, B Street tenant ownership, Stripe instead of QuickBooks, supplied Swift API access, auto-confirmation intent, paid-first onboarding and native operator reporting have already been addressed. Verify their implementation; do not re-ask those choices as if unanswered.

## Decisions blocking implementation slices

| Decision | Needed before | Expected input |
|---|---|---|
| Secure host, secret store, webhook endpoint and any added costs | Stripe integration code | Developer proposal and account/admin capability verification. |
| Stripe account/controller model; fee, dispute, refund, negative balance and verification responsibilities | Configuration / test demonstration | Inspect actual Stripe settings and applicable terms; document for client approval. |
| Guest identity and worker/team account model; exact staff privileges and production licenses | Permission provisioning | Test tenant plus role/capability decisions. |
| Catalog, capacities, hours, facility timezone, equipment rules, rate/rounding rules | Booking validation | Facility input; do not invent defaults. |
| Authoritative booking serialization/concurrency strategy | Auto-confirmation release | Developer design with competing request evidence. |
| New member manual approval versus paid/verified activation | Enrollment workflow | Client policy; auto-booking does not answer this. |
| Initial payment, first invoice/proration, cutoff and how post-collection overages are billed | Billing scheduler | Client-approved billing examples for days 1–15. |
| Tax, failed-payment grace/overdue definition, refunds and credits | Collection / eligibility | Finance/owner policy and Stripe configuration. |
| Event cancellation 8–14 days and exact boundaries | Event booking release | Client policy; stated 7/15-day examples do not cover all cases. |
| Checklist questions/pass-fail, worker check-in and exit model, grace/escalation recipients | Session automation | Facility input; confirm wellness access and retention. |
| Required documents, warning lead time, override duration/reason rules | Compliance release | Facility policy; owner-only override is confirmed. |
| Sensor mapping/thresholds, batching/poll budget and retention | Sensor synchronization | Existing API documentation + facility mapping; no need to request the key again. |
| Report measures, native dashboard capability and HQ/temporary viewer identities | Reporting release | Agree definitions and validate actual licensing. |
| Support process, deactivation vs billing cancellation, retention/recovery and operational ownership | Handover | Client/developer agreement; no ticket vendor chosen. |
| Updated solo-developer scope estimate and requested training/launch dates | Delivery commitment | Re-estimate expanded billing and automation; dates in emails are requests. |

## Stage-level unresolved details

The current map marks the following stages “Needs decision.” Some concern implementation design rather than a missing client requirement; read their exceptions and checks before asking.

### catalog — Configure the facility catalog

Load plans, bookable spaces, equipment and operating settings.

**Unresolved detail:** Do not invent missing rates or timing values.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### backend — Establish trusted integration endpoints

Privileged operations run outside member browser code.

**Unresolved detail:** Backend host and credential-storage implementation remain unselected.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### member-start — Select plan and payment date

Capture the member’s business and selected membership.

**Unresolved detail:** Initial payment, approval ordering and rejected-application handling need final rules.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### paid-intake — Start authenticated onboarding

Collect the member’s operational profile after payment.

**Unresolved detail:** Staff approval after payment is not conclusively resolved in the trail.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### request — Submit a reservation

Request station/equipment and a start/end interval.

**Unresolved detail:** Exact capacity/buffer and booked-versus-attended usage rules still need confirmation.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### auto-book — Automatically confirm an available booking

Apply first-come, first-served confirmation for conflict-free requests.

**Unresolved detail:** Serialize/recheck confirmation or select another approved safe strategy before acceptance.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### events — Apply event-specific cancellation rules

Dining/events have different cancellation and refund rules.

**Unresolved detail:** Do not invent the policy for unspecified notice periods.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### no-show — Handle a no-show

Booked hours are forfeited unless authorized staff override.

**Unresolved detail:** No-show detection timing has not been specified.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### reminders — Run 3 / 2 / 1-hour reminders

Scheduled reminders prepare members for the booking.

**Unresolved detail:** Catch-up, grace periods and uncertain-send recovery need configuration.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### arrival — Check each team member in

Capture wellness and food-safety answers on arrival.

**Unresolved detail:** Exact questions and per-team identity permissions are configuration dependencies.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### billing-rule — Define the invoice cycle

Resolve calendar-month usage against the chosen debit date.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### overdue — Block booking for overdue balances

Apply the client’s owner-only override policy.

**Unresolved detail:** Failed-payment retry timing and exact overdue boundary need approval.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### compliance-block — Enforce expired-document booking blocks

Only the Flavors owner can grant a recorded exception.

**Unresolved detail:** Do not cancel existing bookings automatically without an approved rule.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### sensor-map — Map sensors to facility units

Use supplied API access without repeating credentials in the map.

**Unresolved detail:** Device mapping, limits per endpoint and thresholds still require validation.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### notices — Publish announcements and newsletters

Staff publish to all members or an approved audience.

**Unresolved detail:** Choose one authoritative publishing model before implementation.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### support — Route support requests to B Street

Client wants a way to request help or on-behalf changes during the pilot.

**Unresolved detail:** Confirm minimum ticket workflow and Phase 1 acceptance rather than adding a full help-desk product.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### deactivate — Deactivate or revoke Avenue access

Retain records while stopping new operations and notifications.

**Unresolved detail:** Future bookings and subscription termination rules need an approved policy.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.

### retention — Maintain security and recoverability

Manage document/sensor history and account lifecycle over time.

**Unresolved detail:** Agree retention before deleting history or claiming legal compliance.

See the corresponding stage in WORKFLOW_STAGES.md for actions, rules and acceptance checks.


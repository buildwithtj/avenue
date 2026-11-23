# Actionable delivery backlog

Status as of 2026-11-11. Superseding schedule: [EIGHT_DAY_PLAN.md](EIGHT_DAY_PLAN.md) (internal). The 11 Nov call changed the booking model (equipment, management approval); rows for stages request, auto-book and conflict now mean approval-queue work, and the concurrency proof is no longer a blocker. Stage IDs refer to [workflow stages](../WORKFLOW_STAGES.md); sequence and broader gates are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

| Order | Stages | Status and dependencies | Acceptance evidence |
|---|---|---|---|
| 0 | scope | Requirements baseline drafted; reconcile broken links and maintain open decisions. | Client decisions distinguished from proposals; no unapproved scope. |
| 1 | access, security, apps | Not verified; needs access to B Street test tenant, catalog and two test identities. | Test guest signs in; unrelated identity denied private files/records via direct URLs; deployment and flow ownership verified. |
| 2 | catalog, calendar | Read-only SPFx starter built with synthetic data; proposed lists and permissions unverified. Depends on stage 1 and safe projection design. | Test site shows correct facility, resources and calendar including pagination; direct access tests prove intended isolation; no private fields accessible. |
| 3 | backend, auto-book | Not started; host, secret storage and concurrency mechanism open. | Compare compatible options and costs; signed test event and competing requests prove boundaries and permitted capacity. |
| 4 | stripe-config, operator-connect, connect-status, stripe-demo | Not started; depends on host and account/controller review. | Test-mode onboarding and direct test payment; responsibility review and client approval before live activation or production invitation. |
| 5 | member-start, first-payment, paid-intake, initial-docs | Not started; depends on payment-first flow, approval and identity decisions. | Failed payment cannot unlock intake; unrelated member denied private documents. |
| 6 | request, auto-book, conflict | Not started; depends on eligibility, catalog rules and proven serialization. | Concurrency, conflict and owner-only override negative tests pass at mutation boundary. |
| 7 | reminders, arrival, billing-rule, sensor-map, operator-dashboard, hq-reports | Later slices; see open decisions and implementation plan. | Stage-specific workflow checks, retry/idempotency and scoped access evidence recorded before release. |

Immediate dependencies: test tenant/site and app catalog rights; guest and test identity setup; review of shared-calendar data and permissions; a trustworthy projection publisher. Do not infer that credentials supplied separately establish any of these. Billing policy, staff capabilities and other decisions remain in [OPEN_DECISIONS.md](OPEN_DECISIONS.md) and need not block the independent access spike.

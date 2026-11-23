# Solo-developer execution order

> Note (2026-11-10): the next slices are defined in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md); this gate table remains the overall sequence.

This is a dependency sequence, not a calendar commitment. Finish a reviewable slice before expanding to the next. Record status and evidence against workflow stage IDs.

| Gate | Build / establish | Evidence required before progressing |
|---|---|---|
| 0 — Reconcile | Current scope, decisions, roles, resource inputs, repository inventory | No QuickBooks dependencies; unresolved policies visible; Phase 1/2 boundaries documented. |
| 1 — Access and security spike | Tenant/site/app catalog; Entra guests; Power Apps/flow ownership; test environment | One test guest signs in; unrelated member cannot access private records/files through direct URLs; deployment permissions proven. |
| 2 — Integration and booking feasibility | Choose secure host/secret store; test webhook; prove authoritative booking serialization | No browser secrets; signed test event tied to connected account; competing booking tests accept only permitted capacity. |
| 3 — Facility foundation | Proposed Lists/libraries, indexes, configuration, roles, SPFx shell and staff app foundation | Catalog reads correctly; facility/member boundaries tested; state mutations protected. |
| 4 — Connect vertical slice | Account review, Stripe-hosted facility onboarding, readiness/status sync, direct test charge | Demonstrate exact operator flow; payment is under connected account; documented fees/liability allocation and client test approval gate. |
| 5 — Paid member onboarding | Plan/date UI, initial payment, verified onboarding state, guest invite/login and private documents | Payment failure cannot enable onboarding; upload not public; new member approval decision resolved. |
| 6 — Booking vertical slice | Shared calendar, eligibility, atomic confirmation, conflict queue, confirmation and extension | Concurrent booking and owner-only override tests; no financial/checklist leakage on calendar. |
| 7 — Operational session | Entry/exit/wellness, notifications, reminder ledger and escalation | Correct recipients, worker identity, no duplicate retry behavior, reschedule/no-show scenarios. |
| 8 — Billing and compliance | Usage ledger, invoice cycle, collection events/history, expiry/renewal | Policy decisions resolved; repeat runs cannot double-charge; Stripe/source totals reconcile; payment/expiry blocks clear correctly. |
| 9 — Sensors and communications | Sensor map/sync/history/stale state; scoped notices/newsletters | API budget shown; stale data obvious; audience/privacy tests pass. |
| 10 — Dashboards | Native Flavors summaries; HQ Power BI reports | Correct totals and scope; no assumption that embedding removes licensing. |
| 11 — UAT and production readiness | End-to-end cases, runbooks, export/backup, rollback, training | Client review and explicit live Stripe approval; production configuration reviewed separately from test. |
| 12 — Controlled release and operations | Approved operator invitation, production smoke checks, monitoring and support | No accidental live test charges; reconciliations and incident ownership documented. |

Some independent documentation/configuration can proceed in parallel by the same developer, but avoid implementing many unfinished modules at once. Resolve decisions only as early as their dependencies require. Do not delay independent work while waiting on unrelated questions.

## Proposed repository organization after toolchain decisions

- `apps/member-spfx/`: member portal web parts and browser behavior.
- `power-platform/`: exported Canvas app/flows/solution artifacts and connection configuration documentation.
- `services/integrations/`: trusted API and webhook code after host selection.
- `schema/`: versioned SharePoint field/index/permission provisioning definitions.
- `tests/`: meaningful integration and authorization tests; sandbox-only fixtures.
- `docs/`: decisions, backlog, runbooks, release evidence.

These are suggested boundaries, not an assertion that Power Apps is a conventional React source project. Document how binary/exported Power Platform artifacts are built and restored. Create the actual scaffold only after verifying supported tools and packages.

## Definition of done for each slice

Working behavior; authorized and unauthorized cases checked; failure/retry path handled; config documented without credentials; stage IDs and decisions updated; deployment/rollback procedure appropriate to its side effects. Rollback cannot undo an email or payment already issued: financial correction must be explicit and audited.

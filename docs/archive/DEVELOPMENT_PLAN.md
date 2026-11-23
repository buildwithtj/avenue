# Development plan

> **2026-11-11:** the current schedule is [EIGHT_DAY_PLAN.md](EIGHT_DAY_PLAN.md) (internal only). Its scope follows the [11 Nov client call](../meetings/2026-11-11-client-call.md).

Dependency order for one developer. The gate table in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (gates 0–12) remains the overall sequence and evidence list; [BACKLOG.md](BACKLOG.md) tracks status per stage. This file defines the next slices precisely. **No dates are promised**: requested dates are unvalidated (Q-18) and a re-estimate is due after slice 2.

## Where things stand (2026-11-10)

Done: sources reconciled, requirements baselined, feasibility researched, SPFx starter builds locally. Not done: anything in the tenant, Stripe, Power Apps or Power Automate.

## Slice 1 — Tenant access and privacy spike (next)

Goal: prove the member-portal foundation works for a real guest and that privacy holds at the data boundary. Gate 1 of the implementation plan. Requirements: PLT-01, PLT-03, PLT-06, PLT-08, PLT-13. Retires L-21, L-22, L-28; informs L-03, L-25, L-26.

Prerequisites (facts, not client decisions):
1. A dedicated dev/test site on the B Street tenant, with synthetic data only.
2. Confirmation of the roles the build account holds: SharePoint Administrator, site collection administrator on the tenant app catalog and the test site.
3. Two unrelated test guest identities plus one staff test identity.

Steps:
1. Record actual tenant/site sharing settings and Entra guest settings (read-only inspection).
2. Create the site collection app catalog; deploy the starter package; add the web part to a test page in demo mode.
3. Sign in as guest A on desktop and phone: page and web part load.
4. Hand-create the three read-model lists from [schema/README.md](../../schema/README.md) with synthetic rows; switch demo mode off; calendar shows only that facility's rows.
5. Create a private per-member list/folder; as guest B request guest A's items by direct REST and item URL — must be denied. Repeat for a column in a shared list to document L-21.
6. Seed >5,000 calendar rows; confirm the indexed range query and paging still work.

Acceptance: written evidence (screens/requests and results) for steps 3–6 in `docs/evidence/`, DECISION_LOG and LIMITATIONS updated. No production data, no real members.

## Slice 2 — Integration host decision and booking concurrency proof

Depends on slice 1. Gate 2. Requirements: PLT-12, BKG-05, STR-08. Resolves Q-01 and Q-03.

- Compare hosting options with costs for client approval (Azure Functions + Key Vault is one candidate, R-08; it needs a separate Azure subscription).
- Contention test for each candidate booking arbiter (R-04): N parallel requests for one slot must yield exactly one confirmation.
- Stripe sandbox only: verify one signed test webhook end to end. No connected account is created until Q-02 is decided (L-09).
- Re-estimate remaining work and answer Q-18.

## Later slices (order only)

3. Facility foundation: approved schema, roles, staff app shell (needs Q-04, Q-15).
4. Stripe Connect test flow and client demonstration (needs Q-02) → **client approval gate**.
5. Paid member onboarding (needs Q-05, Q-06 first-payment part, Q-20, Q-21).
6. Booking: request, automatic confirmation, conflicts, notices, extension, cancellation (needs Q-04, Q-09; events need Q-08).
7. Session: reminders, check-in/out, escalations (needs Q-10).
8. Billing and compliance: usage ledger, invoices, overdue and expiry blocks (needs Q-06, Q-07, Q-11).
9. Sensors and communication (needs Q-12, Q-13).
10. Dashboards (needs Q-16).
11. UAT, runbooks, training; 12. approved go-live.

Questions are raised with the client when the slice that needs them is two slices away, not all at once.

## Definition of done per slice

As in IMPLEMENTATION_PLAN.md: working behaviour; allowed and denied cases tested; retry/failure path handled; configuration documented without secrets; requirement IDs, backlog, decision log and CHANGELOG updated.

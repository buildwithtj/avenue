# Avenue engineering rules

Shared project policy for any AI coding agent. Tool-specific startup is in [CLAUDE.md](CLAUDE.md); where documents live is in [docs/INDEX.md](docs/INDEX.md). Do not duplicate those here.

## Scope and authority
- The user is the sole developer. Prefer a small, understandable codebase, explicit configuration, narrow vertical slices and actionable setup notes.
- Phase 1 is the Flavors pilot on the B Street-owned Microsoft tenant. Do not silently grow it into the standalone Phase 2 SaaS, school rollout, AI features or a native app.
- Follow the latest verified client requirement ([docs/SOURCES.md](docs/SOURCES.md) precedence). Keep **confirmed client rules**, **engineering proposals** and **open questions** visibly distinct; label proposals `[PROPOSED]`.
- Do not invent billing cut-offs, partial-cancellation policy, approval rules, data retention or licence entitlements. Ask focused questions only when the current slice needs them; continue independent work.
- Keep original references (`references/original/`) unchanged. After an approved scope change, update the current documents and the workflow together. HTML map locks are UI controls, not immutable records.

## Approved stack (do not replace or add without a demonstrated need)
- Member UI: SharePoint modern pages with React/TypeScript SPFx web parts. Staff UI: Power Apps Canvas. Data and files: SharePoint Lists and Document Libraries. Automation: Power Automate. Payments: Stripe Connect and Stripe Billing. Sensors: Swift Sensors. HQ analytics: Power BI. Operator reporting: Avenue's own dashboard.
- Do not introduce QuickBooks (superseded), Power Pages, member Power Apps or Power BI licences, or a replacement database as if approved.
- The secure integration host, secret store, exact Stripe configuration, runtime and package versions, and concurrency mechanism are **not selected**. Propose the minimum compatible option; record choices and costs before adding any paid service, platform or dependency. Verify current official documentation when choosing versions or reading licence terms.
- Supplied subscriptions and logins do not prove tenant, app-catalog, guest-access, flow-ownership or licence rights. Verify them. Never assume a service-account licence covers every flow or user.

## Security and secrets
- Never put keys, passwords, tokens, bank details, verification documents or production records in source, web parts, browser storage, logs, fixtures or documentation. Do not reproduce credentials from screenshots. Use placeholders and server-side secret references; record only a credential's purpose and approved storage.
- Enforce authorisation at the data or mutation boundary. A UI filter is not access control. Keep private member data separate from shared calendar information. Fail closed on incomplete grants.
- Member identity comes from the authenticated item author, never from a field the member can submit.

## Payments
- Stripe client-account credentials are never requested. Platform credentials stay server-side. Verify signatures and connected-account context; make webhook and charge handling idempotent and safe for retries and out-of-order events.
- Test mode first. The client requires review of responsibilities and approval of the demonstrated test flow before **live Stripe activation or the production operator invitation**. Do not initiate real charges, payouts, refunds or live onboarding before that approval.

## Engineering practice
- Make focused, reversible changes; implement small reviewable slices.
- Test meaningful behaviour: security boundaries, concurrent bookings, duplicate processing, retries, payment events, failure and negative paths. **Never state that a test passed unless you ran it**; record what was actually verified, as which account, and what still needs tenant access or a client decision.
- Keep practice, development and production configuration separate. Provide reproducible setup, config templates without secrets, deployment and rollback steps, and handover notes.
- Do not claim live setup, licence compliance or liability allocation from documentation alone.
- Deactivate members; never delete them. Recycle test data by explicit id; never bulk-delete.

## Traceability and records
- After meaningful work update the document that owns the changed information ([docs/INDEX.md](docs/INDEX.md) lists owners), [docs/STATUS.md](docs/STATUS.md) when progress, blockers or next steps change, and add a concise [docs/CHANGELOG.md](docs/CHANGELOG.md) entry.
- Record agreed decisions with source and date in [docs/DECISIONS_AND_OPEN_QUESTIONS.md](docs/DECISIONS_AND_OPEN_QUESTIONS.md). Maintain stage → feature → acceptance-evidence traceability ([docs/REQUIREMENTS_TRACEABILITY.md](docs/REQUIREMENTS_TRACEABILITY.md)).
- Commit or push only when the user asks.

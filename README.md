# Avenue — Phase 1 (Flavors pilot)

Avenue is a facility operations and membership platform owned and operated by B Street HQ. Phase 1 pilots it at Flavors Culinary Hub Hyattsville, a shared commercial kitchen.

**Start here:** [CLAUDE.md](CLAUDE.md) (entry point for AI sessions), [docs/STATUS.md](docs/STATUS.md) (current state and next steps), [docs/INDEX.md](docs/INDEX.md) (which document to read for which task). Shared engineering rules: [AGENTS.md](AGENTS.md).

Status in one line: pilot partly built on the real SharePoint site and Power Automate (bookings, approvals, cancellations, hours, check-in alerts, documents, notices, e-mails; staff app saved, not published); the member portal builds but is not deployed; Stripe, sensors and Power BI are not built. Nothing has been tested with guest, staff or owner accounts. Details and limits: [docs/STATUS.md](docs/STATUS.md).

## Repository map

| Path | Contents |
|---|---|
| `docs/` | Documentation set (see [docs/INDEX.md](docs/INDEX.md)); `docs/archive/` holds superseded planning documents |
| `apps/member-spfx/` | SPFx member portal |
| `apps/staff-powerapps/` | Power Apps screen generator and generated YAML |
| `apps/billing-core/` | Stripe webhook core (tests only, not deployed) |
| `schema/` | SharePoint list definitions, checks, reconcile and test helper scripts |
| `flows/expressions.md` | Exact expressions of the live Power Automate flows |
| `workflow/`, `design/` | Planning atlas (not the application); design prototype |
| `references/original/` | The original client documents (30 Oct 2026). Never edit. |

## Setup and checks

Node.js 22 and npm are needed. Commands and results are in [CLAUDE.md](CLAUDE.md#commands-verified-13-nov-2026) and [docs/DEPLOYMENT_AND_OPERATIONS.md](docs/DEPLOYMENT_AND_OPERATIONS.md). Copy `.env.example` to `.env` for the local tenant domain. Never commit credentials. Stripe work is test mode only until the client approves the demonstrated flow.

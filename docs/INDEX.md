# Documentation index

Open this to find the **one** document you need. Start from [../CLAUDE.md](../CLAUDE.md) and [STATUS.md](STATUS.md); load others only for the task at hand.

**Large files: read by section, not whole.** `REQUIREMENTS.md` (one `## XXX` prefix section, or grep an ID), `DECISIONS_AND_OPEN_QUESTIONS.md` (grep a Q-ID), `WORKFLOW_STAGES.md` (one stage), `REQUIREMENTS_TRACEABILITY.md` (grep an ID), `SOP_SCOPE_AUDIT.md` (one module).

## Task → read

| Task | Read | Then, only if needed |
|---|---|---|
| Continue current work | [STATUS.md](STATUS.md) | the doc owning the item you touch; [evidence/](evidence/) for the last test |
| Change or add booking behaviour | [REQUIREMENTS.md](REQUIREMENTS.md) (BKG-*), [../flows/expressions.md](../flows/expressions.md) (request/calendar/ledger flows) | [DATA_AND_ACCESS.md](DATA_AND_ACCESS.md) invariants; [WORKFLOW_STAGES.md](WORKFLOW_STAGES.md) stage `request`..`no-show`; staff screens `apps/staff-powerapps/README.md` |
| Stripe, billing, payment sync | [INTEGRATIONS.md](INTEGRATIONS.md) (Stripe), REQUIREMENTS STR/PAY | `apps/billing-core/README.md`; Q-01, Q-02, Q-06 in [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md); [RESEARCH_LOG.md](RESEARCH_LOG.md) R-07..R-11 |
| Permissions, lists, privacy | [DATA_AND_ACCESS.md](DATA_AND_ACCESS.md), `schema/lists.v2.json` | [LIMITATIONS_AND_RISKS.md](LIMITATIONS_AND_RISKS.md) L-03, L-21, L-22 |
| Plan the first delivery (Bookings + Communication) | [PLAN_BOOKING_COMMUNICATION.md](PLAN_BOOKING_COMMUNICATION.md), [HOW_TO_TEST_DELIVERY_1.md](HOW_TO_TEST_DELIVERY_1.md) | [meetings/2026-11-16-client-call.md](meetings/2026-11-16-client-call.md), [REQUIREMENTS.md](REQUIREMENTS.md) |
| Plan client access, module by module | [RELEASE_PLAN.md](RELEASE_PLAN.md), [DEMO_SCRIPTS.md](DEMO_SCRIPTS.md), [CHECKLIST.md](CHECKLIST.md) | [ADMIN_DEPLOY_STEPS.md](ADMIN_DEPLOY_STEPS.md), [TEST_CHECKLIST.md](TEST_CHECKLIST.md) |
| Prepare a release or deployment | [DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md) | `apps/member-spfx/README.md`; [DAY2_RUNBOOK.md](DAY2_RUNBOOK.md) (privacy tests P1–P9) |
| Resolve a conflicting or unclear requirement | [SOURCES.md](SOURCES.md) (precedence), [REQUIREMENTS.md](REQUIREMENTS.md) conflicts table | [CLIENT_DECISIONS.md](CLIENT_DECISIONS.md), [meetings/2026-11-11-client-call.md](meetings/2026-11-11-client-call.md), `references/original/` (only to check wording) |
| Record a decision or open question | [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md) | update [STATUS.md](STATUS.md) if blockers or next steps change |
| Understand structure / trust boundaries | [PROJECT_BRIEF.md](PROJECT_BRIEF.md), [ARCHITECTURE.md](ARCHITECTURE.md) | — |
| Write or review SOPs | `Avenue_Phase1_Complete_Module_SOPs.docx`, [SOP_SCOPE_AUDIT.md](SOP_SCOPE_AUDIT.md) | requirements and evidence |
| See what changed | [CHANGELOG.md](CHANGELOG.md) | — |

## Document owners

| File | Owns |
|---|---|
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | purpose, actors, Phase 1 boundary, verified stack |
| [REQUIREMENTS.md](REQUIREMENTS.md) | requirement IDs, acceptance criteria, source references, source conflicts |
| [ARCHITECTURE.md](ARCHITECTURE.md) | components, trust boundaries, confirmed vs proposed design |
| [DATA_AND_ACCESS.md](DATA_AND_ACCESS.md) | permissions as built, invariants, unresolved security decisions |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Stripe, sensors, Microsoft, e-mail, flows, retries |
| [DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md) | environments, commands, release, rollback, ownership |
| [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md) | Q-IDs, decision log, superseded decisions |
| [STATUS.md](STATUS.md) | current state and next actions |
| [CHANGELOG.md](CHANGELOG.md) | what changed, when |
| [SOURCES.md](SOURCES.md) | source register, precedence, missing sources |

## Detail records (kept; load on demand)

[REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) requirement → stage → component → SOP → status · [WORKFLOW_STAGES.md](WORKFLOW_STAGES.md) 57 stages (large; read one stage) · [CLIENT_DECISIONS.md](CLIENT_DECISIONS.md) and [CLIENT_CHANGE_REGISTER.md](CLIENT_CHANGE_REGISTER.md) sanitised email changes · [RESEARCH_LOG.md](RESEARCH_LOG.md) R-IDs · [LIMITATIONS_AND_RISKS.md](LIMITATIONS_AND_RISKS.md) L-IDs · [SOP_SCOPE_AUDIT.md](SOP_SCOPE_AUDIT.md) · [evidence/](evidence/) dated test notes · [meetings/](meetings/) · `../schema/`, `../flows/expressions.md`, `../apps/*/README.md`.

## Archive

[archive/](archive/) holds superseded planning and handoff documents (original handoff prompt, context narrative, 2/8-day plans, development and implementation plans, backlog, original open-decisions and client-questions lists, and the pre-merge open-questions and decision-log files). History only; do not load for current work.

| Member profile drawer (built) | [PROFILE_DRAWER_PLAN.md](PROFILE_DRAWER_PLAN.md) |
| Unbuilt modules plan (onboarding, payments, check-in, events, sensors) | [MODULES_PLAN.md](MODULES_PLAN.md) |
| Remaining modules build contract and doubts (not deployed) | [REMAINING_MODULES_CONTRACT.md](REMAINING_MODULES_CONTRACT.md), [BUILD_DOUBTS.md](BUILD_DOUBTS.md) |
| Member portal UI, motion, fonts, responsive plan | `docs/MEMBER_PORTAL_AUDIT_AND_UI_PLAN.md` |

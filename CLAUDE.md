# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Avenue Phase 1 — entry point

**Project.** Avenue is a facility operations and membership platform owned and operated by B Street HQ. Phase 1 pilots it at Flavors Culinary Hub Hyattsville (a shared kitchen). One developer. Stack: SharePoint pages with SPFx React/TypeScript (members), Power Apps Canvas (staff), SharePoint Lists and restricted libraries (data), Entra B2B guests, Power Automate, Stripe Connect (facility-owned accounts, direct charges), Swift Sensors, Power BI for B Street. **QuickBooks is superseded.** A separate Node/Azure integration host is *proposed, not approved* (Q-01).

**How it fits together.** Members write only to *own-items intake lists* (`AvenueBookingRequests`, `AvenueDocumentSubmissions`, `AvenueCheckInSubmissions`). Power Automate flows (service account `automations@`) re-validate each item and write the authoritative private lists (`AvenueBookings`, `AvenueMemberDocuments`, `AvenueCheckIns`, hours ledger), then echo a display-only `Outcome` text back to the member's own item. The member portal (`apps/member-spfx`) and the staff app (`apps/staff-powerapps`, generated YAML) only read those lists and write intake items; identity is the item author, never a field, and the UI is never a security boundary. `apps/billing-core`, `apps/sensors-core` and `apps/domain-core` are host-independent reference modules (no deployment); `flows/expressions.md` holds the exact live flow expressions.

## Start-up (do exactly this)
1. Read this file. Shared engineering rules are in [AGENTS.md](AGENTS.md); read it only if your tool has not already supplied it.
2. Read [docs/STATUS.md](docs/STATUS.md), then the one row of [docs/INDEX.md](docs/INDEX.md) that matches your task.
3. Load only the documents and code that task needs. Open `references/original/` or the call notes only to resolve a conflict, check a requirement, or validate a documentation change.
4. Stop loading context when you can do the task correctly. Do not reread the repository or unchanged files already in context.

## Hard constraints
- Latest verified client decision wins, only for the requirement it touches; precedence and gaps: [docs/SOURCES.md](docs/SOURCES.md). A proposal, existing code, a screenshot or a supplied login is not client approval or proof of access.
- Phase 1 only. No standalone SaaS, AI, native app, QuickBooks, Power Pages, member Power Apps/Power BI, or replacement database.
- No secrets anywhere (source, docs, logs, Notion, chat). Name a credential's purpose, never its value.
- Authorise at the data or mutation boundary, never in the UI. Member identity comes from the item author. Fail closed.
- **Stripe is test mode only.** No real charges, payouts, refunds or live onboarding before the client approves the demonstrated flow (STR-06).
- Never claim a test passed unless you ran it; say which account ran it. Record unknowns as UNKNOWN.
- Label engineering ideas `[PROPOSED]`. Do not invent billing cut-offs, cancellation edge cases, retention or licence coverage; log a question instead.
- Real site, no test environment: tests use `gaptest-` ids and are removed by explicit id (never bulk delete). The seed set uses the `demo-` prefix and is removed only by `seedCleanup()` in `schema/seed.browser.js`, one id at a time. Deactivate members; never delete them.
- Ask before anything outward-facing or irreversible (sending mail, publishing, saving a flow that e-mails members, changing tenant settings, commit/push).

## Reading map
| Task | Read |
|---|---|
| Continue work | `docs/STATUS.md`, then the owning doc |
| Booking change | `docs/REQUIREMENTS.md` (BKG), `flows/expressions.md`, `docs/DATA_AND_ACCESS.md` invariants |
| Stripe / payments | `docs/INTEGRATIONS.md`, `apps/billing-core/README.md`, Q-01/Q-02/Q-06 |
| Permissions or lists | `docs/DATA_AND_ACCESS.md`, `schema/lists.v2.json` |
| Deployment / release | `docs/DEPLOYMENT_AND_OPERATIONS.md`, `docs/ADMIN_DEPLOY_STEPS.md` |
| Testing / seed data | `docs/TEST_CHECKLIST.md` |
| Server design (proposed) | `docs/SERVER_SPEC.md` |
| Conflicting requirement | `docs/SOURCES.md`, conflicts table in `docs/REQUIREMENTS.md`, then originals |
| Decision or question | `docs/DECISIONS_AND_OPEN_QUESTIONS.md` |
Details, owners and the archive: [docs/INDEX.md](docs/INDEX.md). Current blockers: [docs/DECISIONS_AND_OPEN_QUESTIONS.md](docs/DECISIONS_AND_OPEN_QUESTIONS.md) (🔴 BLOCKER rows).

## Commands (verified 14 Nov 2026)
Node 22 is needed; on this Mac prefix `PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`.
- `cd apps/member-spfx && npm run build` — lint, 126 tests (heft/jest; they run only inside the build), package `sharepoint/solution/member-spfx.sppkg`.
- `cd apps/billing-core && node --test` (34), `cd apps/sensors-core && node --test` (10), `cd apps/domain-core && node --test` (48), `cd apps/integration-host && node --test` (14). Use `cd folder && node --test`; `node --test <folder>` fails on Node 22. One file: `node --test file.test.mjs`.
- `node schema/check.mjs` (schema), `node --test schema/invariants.test.mjs` (8).
- `cd apps/staff-powerapps && python3 gen.py` regenerates `screens/*.pa.yaml` (pasted into Studio by hand); `python3 check.py` validates them.
- Preview the portal without deploying: `cd apps/member-spfx && npm start` serves `https://localhost:4321`; open `https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&loadSPFX=true&debug=true&noredir=true` and click "Load debug scripts" (asked on every load).
No CI; not a git repository. The portal cannot be installed for others until an app catalog exists ([docs/ADMIN_DEPLOY_STEPS.md](docs/ADMIN_DEPLOY_STEPS.md)).

## Gotchas that have already cost time
- **Never run `npm run build` while `npm start` runs:** the production build wipes the dev server's bundle and every web part shows "Something went wrong". Stop the server, build, restart. If the workbench or page shows blank, clear `localStorage` key `sp_webpart_workbench_state`.
- **Flow expressions:** `@{...}` always yields text. A true/false or date value must be a bare `@expr` (`IsStaff`, `DecidedAt` failed this way and every member booking silently failed). After editing a flow, check its run history; a failed run leaves the member with no outcome.
- A flow edit in the designer must go through the expression editor (Code view is read-only); then re-read Code view to confirm the stored form.

## Finish-up
Update the document that owns the changed fact, [docs/STATUS.md](docs/STATUS.md) if progress, blockers or next steps changed, and add a short [docs/CHANGELOG.md](docs/CHANGELOG.md) entry. New decisions and questions go in `docs/DECISIONS_AND_OPEN_QUESTIONS.md` with source and date. Do not edit this file or AGENTS.md for routine progress.

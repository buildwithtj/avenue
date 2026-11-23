# Deployment and operations

Owner of: environments, configuration, build/release, monitoring, recovery, ownership. Facts below are **reported or locally verified, never inferred from files**; the tenant itself was last observed through the developer's signed-in browser on 11–13 Nov 2026 ([evidence/](evidence/)).

## Environments

| Environment | What is there | Evidence |
|---|---|---|
| Microsoft tenant (domain `poweredbyavenue.com`; SharePoint host `bstreethq.sharepoint.com`) | Owned by B Street HQ. Accounts by role: `admin@` (B Street admin, Samia), `developer@` (Power BI Pro), `automations@` (Power Automate Premium; owns flows and connections; owner of the Avenue site). Passwords are not in the repository. | call 11 Nov; evidence/day2 |
| Site `https://bstreethq.sharepoint.com/sites/Avenue` | Team site without a Microsoft 365 group, created 11 Nov by the developer on instruction ("no test site"). 20 lists/libraries, 3 Avenue groups. | evidence/day2; read back 13 Nov |
| Power Platform | Default environment "B Street HQ (default)". **No Dataverse, so no Solutions**: flows and the app are unmanaged and not exportable as a solution. | evidence/day2, ARCHITECTURE |
| Staff app | "Avenue Staff Console", saved, **not published or shared**. | evidence/day7-8 |
| Member portal | Package builds locally; **not uploaded to any app catalog, not on a page**. | no deployment evidence |
| Stripe, Swift Sensors, host | Nothing configured. | — |

There is **no separate development, test and production split**. Tests run on the real site using `gaptest-` ids and explicit cleanup. Practice, staging and production configuration must stay separate once an environment split exists (needs an admin).

## Configuration

`.env.example` holds placeholders only (tenant domain for local work). Facility settings (`EntryGraceMinutes`, `ExitGraceMinutes` = 15 [PROPOSED], `StaffAlertEmail`) live in `AvenueFacilities` and are edited on the staff Settings screen. `StaffAlertEmail` is **empty**, so staff e-mails are skipped. Secrets: none are used locally; the production secret store is UNKNOWN (Q-01).

## Build and verify (commands run on 13 Nov 2026)

| Command (from repo root) | Result |
|---|---|
| `cd apps/member-spfx && npm run build` (Node 22; on this Mac `PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`) | lint, 47 Jest tests passed, package built, exit 0 |
| `cd apps/billing-core && node --test` | 9 passed |
| `node schema/check.mjs` | OK: 20 lists, 157 fields |
| `cd apps/staff-powerapps && python3 gen.py` | writes `screens/*.pa.yaml` (parse-checked); pasted into Studio by hand |

No CI exists and the folder is **not a git repository**.

## Release procedure (manual, current)

1. **Schema:** edit `schema/lists.v2.json`, run `node schema/check.mjs`, then apply to the site with `schema/reconcile.browser.js` (dry run first; additive; read back with a second dry run). `schema/provision.mjs` (m365 CLI) has never been run against the tenant.
2. **Flows:** edit in the Power Automate designer; copy the exact expressions into [../flows/expressions.md](../flows/expressions.md); array inputs must be pure `@expr` (not `@{expr}`). Save, then live-test.
3. **Staff app:** regenerate YAML, paste each screen in Studio (Classic controls), add new data sources, check the app checker, save. Publishing/sharing needs licence confirmation (L-20, Q-15).
4. **Portal:** `npm run build`; upload `sharepoint/solution/member-spfx.sppkg` to a site-collection or tenant app catalog and add the web part to a page — **blocked on admin rights** (app catalog, guest sharing). See [../apps/member-spfx/README.md](../apps/member-spfx/README.md).
5. **Evidence:** record what was tested, as which account, in [evidence/](evidence/) and [STATUS.md](STATUS.md).

## Rollback

Schema is additive: unused fields can stay. Flows: turn off, or restore a previous version from the flow's version history (not exercised). Staff app: restore a previous version in Studio. Test data: move explicit item ids to the SharePoint recycle bin (never bulk deletes). Portal: remove the web part, retract the package. Member deactivation: deactivate, never delete members (recycling a member row before the membership-card flow had run caused a temporary trigger error on 12 Nov).

## Monitoring and recovery

Monitoring: **none configured** (no run-failure alerts; needs a mailbox decision). Run history is checked by hand. Backup and recovery targets: UNKNOWN (Q-14). The SharePoint recycle bin is the only restore path used so far; retention behaviour is not verified.

## Ownership

Flows and connections are owned by one account (`automations@`); co-owners and a service account/principal are an admin task. Tenant, app catalog, guest settings and licences belong to B Street. Handover to a client-owned set-up is not designed (REL-02).

## Admin work that blocks verification

App catalog access; external sharing for the site; three or more test identities (two unrelated guest members, staff, owner); licence confirmation for staff and flows; Entra rights for the developer (L-28). Until then privacy tests P1–P9 in [DAY2_RUNBOOK.md](DAY2_RUNBOOK.md) are **not run**.

# Day 2 runbook — tenant foundation and privacy test

Prepared 2026-11-11, **not yet run**. Part of [EIGHT_DAY_PLAN.md](archive/EIGHT_DAY_PLAN.md) (internal). Use a dedicated **test site with synthetic data only**. Record results in `docs/evidence/day2-<topic>.md` as you go; do not paste passwords, tokens or keys.

## 0. Prepared offline (done)

| Item | File | Checked |
|---|---|---|
| Proposed list definitions (8 lists, 50 fields, three access classes) | `schema/lists.v2.json` | `node schema/check.mjs` passes |
| Idempotent provisioning script using the CLI for Microsoft 365 | `schema/provision.mjs` | Dry run lists 90 steps; bad URL refused. **Not run against a tenant.** |
| SPFx starter package | `apps/member-spfx` | Builds, 13 tests pass (earlier run) |

## 1. Access gate — nothing below can start without these

- [ ] Account with **SharePoint Administrator** and site-collection admin on `poweredbyavenue.com` (who: ______)
- [ ] Test site URL (who creates it: ______)
- [ ] Test accounts: member guest A, member guest B, one lead and one team member (optional), Flavors staff, Flavors owner
- [ ] Staff console platform decided: Power Apps / SPFx (Q-24)
- [ ] Exposed credentials from the 6 Nov email changed and the Swift Sensors key reissued

## 2. Record tenant settings (read-only)

Write down, with date and who looked: organisation sharing level; site sharing level; Entra external collaboration and domain restrictions; whether the site is group-connected; whether a tenant app catalog exists. **Expected change:** site sharing must be "New and existing guests" for guests to be invited (R-02).

## 3. Site, catalog and package

1. Create the site collection app catalog (needs site-collection-admin on both the tenant catalog and the test site) — `m365 spo site appcatalog add --siteUrl <test site>` or the SharePoint admin UI.
2. `cd apps/member-spfx && npm ci && npm run build`
3. Upload `sharepoint/solution/member-spfx.sppkg`, choose **Only enable this app**, add it to the site, add the web part to a new page in demo mode.
4. Sign in as guest A in a private window, on desktop and on a phone. **Pass:** web part loads. **If it does not:** stop and record the error; the member approach needs rethinking (L-22).

## 4. Provision the lists

```bash
npm i -g @pnp/cli-microsoft365
m365 login                       # interactive, uses the admin account; nothing stored in the repo
node schema/check.mjs            # must print OK
node schema/provision.mjs --web <test site URL> --dry-run
node schema/provision.mjs --web <test site URL>
node schema/provision.mjs --web <test site URL>   # second run must say "skip" for everything
```

**Pass:** second run creates nothing. If a step fails, the script stops and prints it; fix and re-run. If the CLI flags differ from the version installed, adjust `schema/provision.mjs` (flags were checked against CLI v12 on 2026-11-11).

Then add the guest accounts to **Avenue Members**, staff to **Avenue Staff**, the owner to **Avenue Owner**.

## 5. Privacy tests (the point of day 2)

Use synthetic rows. Add one row to `AvenueBookings` for member A and one for member B (as admin).

| # | Action | Expected | Result |
|---|---|---|---|
| P1 | Guest A opens `<site>/_api/web/lists/getbytitle('AvenueBookings')/items` in the browser | 403 / access denied (private list excludes Members) | |
| P2 | Guest A opens the list's page `<site>/Lists/AvenueBookings` | Access denied | |
| P3 | Guest A opens `AvenueCalendar` items by REST | Allowed; **only** the agreed columns exist (no balances, documents, answers) | |
| P4 | Guest A tries to create or edit an item in `AvenueCalendar` | Denied (members have Read only) | |
| P5 | Staff account creates an item in `AvenueBookings` | Allowed | |
| P6 | Staff account tries to change list permissions | Denied | |
| P7 | Owner edits an item | Allowed | |
| P8 | As admin, create folders `member-A` and `member-B` in `AvenueBookings`, break inheritance on each, grant only that member's guest Read; guest B requests a `member-A` item by REST and by URL | Denied for guest B, allowed for guest A (this is the proposed per-member design, R-03) | |
| P9 | Seed more than 5,000 `AvenueCalendar` rows (script or import); open the web part with a facility ID | Calendar still pages and loads; indexed filter used (L-04) | |

**Not covered by Microsoft documentation, so each must be observed:** P3 column exposure, P8 behaviour for guests (R-02, R-03, L-21, L-22). Record the exact request and response for each.

## 6. Switch the starter to live data

Set the facility ID in the web part, add one `AvenueFacilities` row and a few `AvenueCalendar` rows, turn off demo mode. **Pass:** calendar shows only that facility's rows. Note: the starter still reads `AvenueResources`, which the v2 lists replace with `AvenueEquipment`; update the reader on day 3 (the starter's own contract is unchanged until then).

## 7. Finish

Update the evidence files, `docs/LIMITATIONS_AND_RISKS.md` (retire or confirm L-21, L-22, L-28), `CHANGELOG.md`, and the plan's day 2 row with what actually happened. If any privacy test fails, day 3 does not start.

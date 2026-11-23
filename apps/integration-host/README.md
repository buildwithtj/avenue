# integration-host

**[PROPOSED] Host not approved (Q-01); test mode only (STR-06).** Dependency-free integration server ([docs/SERVER_SPEC.md](../../docs/SERVER_SPEC.md), contract in [docs/MODULES_PLAN.md](../../docs/MODULES_PLAN.md) §11). `cd apps/integration-host && node --test` (Node 22): 40 tests.

## Payments and onboarding (21 Nov 2026)
- `plans.mjs`: the sheet's 18 plans (planId = lower-case name), card price = +3% for current plans (Q-M1 default), event packages, Stripe lookup keys `avenue-<plan>-bank|card`.
- `bridge.mjs`: SharePoint bridge client over narrow per-list flows (`SP_BRIDGE_APPLICANTS`, `_MEMBERS`, `_INVOICES`, `_LEDGER` read-only, `_GRANT`; upsert/query) and `POST /api/bridge/request` (header `x-avenue-bridge-key` = `BRIDGE_KEY`): Join, PaymentPortal, AccountLink, EventInvoice, CancelSubscription (last three staff only). Identity = item author from the flow.
- `events.mjs`: Stripe webhook: checkout completed, invoice events mirrored to `AvenueInvoices` (read granted to the member), first paid invoice turns an applicant into an Onboarding member, overage on `invoice.upcoming`, subscription status to `AvenueMembers.PaymentStatus`, `account.updated`.
- `join.mjs`: public `/join` page (only when `JOIN_PUBLIC=1`). `catalog.mjs` creates the Stripe prices; `import-members.mjs` loads existing members (both dry run unless `--apply`). Run them on the server with the env loaded: `sudo bash -c 'set -a; . /etc/avenue/host.env; cd /opt/avenue/apps/integration-host; node catalog.mjs'`.
- Env (in `/etc/avenue/host.env`, never in the repo): `STRIPE_SECRET_KEY` (test), `STRIPE_ACCOUNT`, `BRIDGE_KEY`, `SP_BRIDGE_APPLICANTS`, `SP_BRIDGE_MEMBERS`, `SP_BRIDGE_INVOICES`, `SP_BRIDGE_LEDGER`, `SP_BRIDGE_GRANT`, `PORTAL_URL`, `PUBLIC_BASE_URL`, `JOIN_PUBLIC`, `APPLICATION_DAYS`. Stripe webhook destination must add the event types listed above.

- `handlers.mjs`: Stripe webhook (via `billing-core`), `my-invoices`, `health`, `sensorSync` (via `sensors-core`), `reconcile`.
- `store.mjs`: Table Storage adapter for the atomic webhook store (put-if-absent, ETag compare-and-set) plus an in-memory table for tests.
- `auth.mjs`: Entra token claim checks (audience, tenant, expiry, e-mail). Signature verification (`verifyJwt`) is injected by the host.
- `jwt.mjs`: RS256 signature check (`createVerifyJwt`). `tableClient.mjs`: wraps an `@azure/data-tables` client. `graphWriter.mjs`: SharePoint list writes via Graph. `stripeClient.mjs`: test-mode-only Stripe calls.
- `azure.mjs`: Azure Functions v4 registration; `app` is passed in.

Not here (needs access or decisions): the real SDK clients and tenant key fetch (the wrappers above take them as inputs), the Swift Sensors client, Key Vault wiring, the `AvenueInvoices` and sensor lists, and what a paid or failed invoice changes in Avenue (Q-06, Q-07). Stripe test mode only until STR-06.


## AWS Ubuntu host (first deployment, 21 Nov 2026) [PROPOSED, Q-01: supplied by the client; test mode only]
- Instance: AWS EC2, Ubuntu 26.04, 2 vCPU, about 900 MB RAM, `13.207.228.174`. Access is by SSH key held by the developer (never in the repo; `*.pem` is git-ignored).
- Stack: Node 22 (apt) runs `server.mjs` as the `avenue` system user via systemd (`deploy/avenue-host.service`), data in SQLite at `/var/lib/avenue/host.db` (`sqliteTable.mjs`), Caddy terminates HTTPS on 80/443 and proxies to `127.0.0.1:8080`. ufw allows 22, 80, 443.
- HTTPS name: `13-207-228-174.sslip.io` (a wildcard-DNS name that resolves to the IP; Let's Encrypt certificate). Stripe refuses plain-HTTP webhook URLs. **Use a real client-owned domain before any live use.**
- Deploy or update: `KEY=/path/key.pem HOST=13.207.228.174 apps/integration-host/deploy/deploy.sh` (re-runnable, sends no secrets).
- Secrets live only in `/etc/avenue/host.env` (root, mode 600): `STRIPE_WEBHOOK_SECRET` (the sandbox destination's signing secret; set on the server by the developer), `ALLOWED_ACCOUNTS` (the two sandbox connected-account ids, not secret).
- Routes: `GET /api/health`, `POST /api/stripe/webhook`, `POST /api/bridge/request`, `GET|POST /join`, `GET /join/done`. `GET /api/billing/my-invoices` answers 501 until the host has a real domain plus Entra token checks (a SharePoint page cannot call an HTTP or unsigned-token API). Not scheduled here yet: sensor sync and the daily reconcile (the Azure timers have no equivalent on this host).
- Stripe sandbox destination `avenue-host-aws-test` (B Street Headquarters, LLC sandbox): events from connected accounts, snapshot payload, `invoice.paid` and `invoice.payment_failed`.
- Tests: `cd apps/integration-host && node --test` (40).

## Sensors (environment module, built 23 Nov 2026, NOT deployed) [PROPOSED]
Plan: [docs/ENVIRONMENT_PLAN.md](../../docs/ENVIRONMENT_PLAN.md). Off unless `SWIFT_API_KEY`, `SWIFT_USER`, `SWIFT_PASSWORD` **and** the four flow URLs `SP_BRIDGE_SENSORS` (read only), `SP_BRIDGE_SENSOR_LATEST`, `SP_BRIDGE_SENSOR_HOURLY`, `SP_BRIDGE_EXCURSIONS` are set in `/etc/avenue/host.env`. Optional: `SWIFT_BASE_URL`, `SWIFT_VALUE_UNIT` (F or C: forces the unit of the treemap values; default is read from `unitId`), `SWIFT_POLL_MINUTES` (default 10), `SWIFT_MONTHLY_BUDGET` (default 100000). `scripts/set-host-secrets.sh` prompts for the secrets.
- `swiftClient.mjs`: read-only Swift client on the verified API (`X-API-Key`, `POST /sign-in`, `/accounts/{id}/treemap`, `/accounts/{id}/time-series/sensor`). Token cached 23 h, one re-sign-in on 403, a failed sign-in pauses sign-ins for 1 h, one retry on 429/5xx; errors carry the status and Swift error code only. Units are found by their sheet code as a whole word in the sensor/device/collector name or hwId. **Still unverified: the unit of the treemap `value` and where the code appears in the tree; run `sudo node --env-file=/etc/avenue/host.env /opt/avenue/apps/integration-host/swiftdiscover.mjs` on the first real run** (prints sensors, values and matches, no secrets).
- `sensorJob.mjs`: one treemap call per poll; units matched by Swift id (two units share a name); ranges come from `AvenueSensors`; raw readings stay on the host in hourly buckets (90 days); `AvenueSensorLatest` updated only when a unit's state changes; `AvenueSensorHourly` written once per completed hour (idempotent by HourKey); `AvenueTempExcursions` opens after 2 consecutive out-of-range readings and closes after 2 in range (an acknowledged excursion keeps its state); Stale after 30 min, Offline after 2 h; polls stop at 80% of the monthly call budget; a gap over 1 h triggers a history backfill (up to 24 h). Status only, never an alarm (SEN-03).
- Lists and load script: `schema/lists.v2.json` (29 lists), `schema/sensors.seed.mjs` (8 units from the client sheet; the 9th is missing, Q-E1), `schema/sensors.load.browser.js`. `/api/health` adds `sensorsConfigured`, `sensorsReporting`, `sensorsNotFound` (configured codes missing from the Swift tree), `callsThisMonth`, `lastSensorSyncAt`.

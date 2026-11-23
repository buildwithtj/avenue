# Research log

All entries checked **2026-11-10** against official vendor pages. R-01 was fetched directly; R-02 to R-15 were collected by three research sub-tasks that fetched the listed pages and reported value-level evidence — spot-check a source before relying on a number. Nothing here describes the actual B Street tenant, Stripe account or contracts.

Type: **FACT** = stated on the page; **INFERENCE** = reasoning from facts; **[UNVERIFIED]** = not found in official documentation or not testable without accounts.

## R-01 SPFx toolchain and macOS

- FACT: SPFx 1.24.1 is the version for new projects; Node 22 (≥22.14), 24 or 26 (26 LTS recommended); TypeScript up to 5.8; React exactly 18.3.1; Heft toolchain, gulp unsupported. [compatibility](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility), [setup](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/set-up-your-development-environment)
- FACT: the online workbench retires 2026-12-01; debug on a real modern page with the debug toolbar (`heft start`, `?loadSPFX=true&debugManifestsFile=…`). Chromium 142+ needs "Local Network Access" allowed. [debug](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/debug-modern-pages)
- FACT: macOS is supported; only `heft trust-dev-cert` and the `SPFX_SERVE_TENANT_DOMAIN` variable are documented as setup steps. INFERENCE: expect a keychain prompt.
- Verified locally: Node 22.23.2, generator 1.24.1, scaffold builds and packages (see [CHANGELOG](CHANGELOG.md)).
- Remaining: debugging against the real tenant page. Affects PLT-03.

## R-02 Guest access

- FACT: site sharing cannot exceed the organisation setting; changing it needs SharePoint Administrator; new communication/non-group sites default to internal only; site sharing always creates an Entra B2B guest. [overview](https://learn.microsoft.com/en-us/sharepoint/external-sharing-overview), [site setting](https://learn.microsoft.com/en-us/sharepoint/change-external-sharing-site)
- FACT: guests need no licence for site/list use and act within the permission level granted; no separate guest-count limit. [limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- FACT: B2B guests are billed by Entra External ID monthly active users and the tenant must be linked to an Azure subscription; free-tier size [UNVERIFIED]. [pricing](https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing)
- INFERENCE [UNVERIFIED]: guests can load custom SPFx web parts and call SharePoint REST as themselves — no page states it for guests.
- Remaining: tenant proof with a real guest. Affects PLT-06, PLT-08.

## R-03 Permission boundaries and list scale

- FACT: 50,000 unique permission scopes per list is the supported limit, 5,000 the recommended general limit; above 100,000 items inheritance can only be broken per item. Microsoft advises sharing folders, not items. [limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits), [scopes](https://learn.microsoft.com/en-us/sharepoint/manage-permission-scope)
- INFERENCE: there is no column-level security; a caller with item read can read every column. No official page states this explicitly.
- [UNVERIFIED]: whether the list "Item-level permissions" setting is a security boundary. Do not rely on it.
- FACT: list view threshold ≈5,000 and not changeable online; up to 20 indexes; first filter column must be indexed; REST returns 100 items by default and pages by next link. [large lists](https://support.microsoft.com/en-us/office/manage-large-lists-and-libraries-b8588dae-9387-48c2-9248-c24122f07c59), [REST](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/working-with-lists-and-list-items-with-rest)
- Affects PLT-08, PLT-13, all private lists. Options: one folder (or list) per member with a small ACL; private fields in separately permissioned lists; a trusted writer for protected state.

## R-04 Concurrency for automatic booking

- FACT: SharePoint REST `$batch` change sets are not transactional. [batch](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/make-batch-requests-with-the-rest-apis)
- FACT: `If-Match` ETag gives optimistic concurrency on updates (412 on mismatch) — not on creates. [REST](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/working-with-lists-and-list-items-with-rest)
- FACT (2010-era doc only): "Enforce unique values" on an indexed column acts as a key. INFERENCE [UNVERIFIED]: enforced server-side for REST writes in SharePoint Online.
- FACT: flow trigger concurrency can be set to 1, cannot be turned off again without re-adding the trigger, queues only 10 + parallelism waiting runs, and no FIFO order is documented. [limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config)
- Options (all [PROPOSED], none proven): (a) unique slot-key rows as the arbiter; (b) single serialized writer flow; (c) serialization in the code host chosen for Q-01. Needs a contention test before selection. Affects BKG-03, BKG-05, Q-03.

## R-05 Power Apps delegation and the native dashboard

- FACT: non-delegable queries read only the first 500 rows by default (configurable; docs now say up to 10,000) and are silently partial. SharePoint delegates Filter/LookUp/Sort on basic comparisons; GroupBy and collections do not delegate. [delegation](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview), [SharePoint connector](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-sharepoint-online)
- INFERENCE: Sum/CountRows do not delegate to SharePoint (absent from its delegable table).
- FACT: Canvas has column, line and pie charts; max 9 series.
- INFERENCE [PROPOSED]: pre-aggregate into a small summary list by scheduled flow. Affects RPT-01, RPT-02, Q-16.

## R-06 Licensing

- FACT: Business Basic includes limited Power Apps/Power Automate rights for standard connectors; custom connectors, premium connectors and HTTP actions are premium. [FAQ](https://learn.microsoft.com/en-us/power-platform/admin/powerapps-flow-licensing-faq), [types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types)
- FACT: a user who indirectly triggers a premium flow and receives value from it needs a licence; one licensed service account serving many users is multiplexing; the documented remedy is a Process licence. Standard-connector flows need no purchased licence. [PA FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs)
- FACT: from February 2027 apps in a Managed Environment need premium licences, including standard apps. [Power Apps FAQ](https://learn.microsoft.com/en-us/power-platform/admin/powerapps-licensing-faq)
- FACT: if the flow owner loses the Premium licence, premium flows are turned off (14 days on the FAQ page; other pages give longer periods).
- [UNVERIFIED]: whether Avenue's member-triggered flows are compliant on one Premium licence — documentation cannot settle it. Affects PLT-11, Q-15.

## R-07 Power Automate as the Stripe webhook receiver

- FACT: the HTTP request trigger is premium, secured by a SAS signature in the URL or Entra tokens; JSON bodies arrive parsed. Workflow expressions list no HMAC or hash function. [Request trigger](https://learn.microsoft.com/en-us/azure/connectors/connectors-native-reqres), [functions](https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference), [OAuth](https://learn.microsoft.com/en-us/power-automate/oauth-authentication)
- FACT: secret environment variables and the Key Vault connector both require Azure Key Vault (and so an Azure subscription).
- INFERENCE: Power Automate alone cannot verify a Stripe signature (no HMAC, no assured raw body, anonymous endpoint). A small code host is needed. Affects PLT-12, STR-08, Q-01.

## R-08 Server host options and cost

- FACT: an Azure subscription is separate from Microsoft 365 and billed on consumption. [tenants](https://learn.microsoft.com/en-us/microsoft-365/enterprise/subscriptions-licenses-accounts-and-tenants-for-microsoft-cloud-offerings)
- FACT: Azure Functions Consumption grants 1,000,000 executions and 400,000 GB-s per month free (storage extra). [pricing](https://azure.microsoft.com/en-us/pricing/details/functions/) Unit prices did not render on the page [UNVERIFIED].
- Not researched: non-Azure hosts. No host is selected (Q-01).

## R-09 Stripe account configuration and responsibilities

- FACT: account "types" are legacy; use controller properties (or Accounts v2). `fees.payer=account`, `losses.payments=stripe`, `requirement_collection=stripe`, `stripe_dashboard.type=full` is the v1 default (Standard behaviour) and the documented fit for direct charges. These are fixed at creation. [controller](https://docs.stripe.com/connect/migrate-to-controller-properties), [fee behaviour](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior)
- FACT: with direct charges the connected account is merchant of record; funds, refunds and disputes hit its balance; application fees are optional. [charges](https://docs.stripe.com/connect/charges), [disputes](https://docs.stripe.com/connect/disputes)
- FACT: when Stripe bears losses the platform cannot pause payouts or debit the account. [risk](https://docs.stripe.com/connect/risk-management)
- [UNVERIFIED]: the platform's obligations under the Connect platform agreement — not reached. Pricing pages rendered in INR only; no applicable-country figure obtained.
- Affects STR-01, STR-04, Q-02. Do not state a liability allocation to the client until the real account and agreement are read.

## R-10 Stripe onboarding, recurring billing and overages

- FACT: Account Links are single-use, expire in minutes, must not be emailed, and returning from them does not mean completion; readiness is `charges_enabled`, `payouts_enabled`, `requirements`. [hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding)
- FACT: subscriptions for direct charges are created with the `Stripe-Account` header; `billing_cycle_anchor_config[day_of_month]` sets the collection day (UTC); by default an immediate prorated invoice is issued. [subscriptions](https://docs.stripe.com/connect/subscriptions), [billing cycle](https://docs.stripe.com/billing/subscriptions/billing-cycle)
- FACT: pending invoice items attach to the next invoice; a renewal invoice is draft for about an hour, after which new items roll to the following invoice. [invoices](https://docs.stripe.com/billing/invoices/subscription)
- Impact: supports STR-03, STR-07 ([PROPOSED] in-app invitation matches Stripe's rule) and ONB-02; makes C-03 / Q-06 concrete — late-month usage lands on the next invoice unless billed off-cycle.

## R-11 Stripe dunning and "overdue"

- FACT: Smart Retries defaults to up to 8 retries in 2 weeks; the end state (cancel, unpaid, past_due, pause) is a setting. `past_due` is a subscription status; a failed invoice stays `open`. [smart retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries), [overview](https://docs.stripe.com/billing/subscriptions/overview)
- INFERENCE [UNVERIFIED]: for direct charges these settings live on the connected (facility) account.
- Affects BKG-14, Q-07.

## R-12 Stripe webhooks, idempotency and testing

- FACT: connected-account events need a Connect-scoped endpoint and carry `account`; signatures are HMAC-SHA256 over the raw body; live retries run up to three days; order is not guaranteed and duplicates occur. [webhooks](https://docs.stripe.com/webhooks), [connect webhooks](https://docs.stripe.com/connect/webhooks)
- FACT: idempotency keys may be pruned after 24 hours. Sandboxes are the current test environment; test onboarding data and cards are documented; restricted keys are recommended. [idempotency](https://docs.stripe.com/api/idempotent_requests), [sandboxes](https://docs.stripe.com/sandboxes), [testing](https://docs.stripe.com/connect/testing)
- Affects STR-05, STR-08, PAY-*.

## R-13 Swift Sensors

- FACT (public docs): API key header plus a bearer token from email/password sign-in (24-hour expiry); one "treemap" call returns the latest reading for every sensor; a time-series call returns history for several sensors; timestamps are Unix epoch. [API docs](https://my.swiftsensors.net/api-docs)
- [UNVERIFIED]: quota size and polling terms are not published — the 100,000 calls/month figure comes from the client's email (SEN-04) and must be checked in the privately supplied documentation.
- INFERENCE: at one call per poll, 5-minute polling uses 8,928 calls in a 31-day month; 15-minute 2,976; 30-minute 1,488.
- Affects SEN-01..04, Q-12.

## R-14 Power BI licensing

- FACT: content in a Pro workspace needs Pro for every viewer; embedding in SharePoint or a canvas app does not remove that; B2B guests are not supported in the SharePoint web part; Publish to web is public; 8 scheduled refreshes a day on Pro. [licence types](https://learn.microsoft.com/en-us/power-bi/fundamentals/service-features-license-type), [SharePoint embed](https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-embed-report-spo), [refresh](https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data)
- Affects RPT-02, RPT-03, RPT-05: with one Pro seat exactly one person can view HQ reports.

## R-15 Deployment and calling a backend from SPFx

- FACT: a site collection app catalog needs an existing tenant catalog and site-collection-admin rights on both; solutions deployed there are usable only in that site. [site catalog](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/site-collection-app-catalog)
- FACT: SPFx calls a secured API through `AadHttpClient` with `webApiPermissionRequests`, approved by an admin; grants are tenant-wide, so the API must authorise every call itself; client code cannot hold secrets. [AadHttpClient](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/use-aadhttpclient)
- [UNVERIFIED]: token acquisition for B2B guests; permission requests from a site-level catalog.

## Note on source content

Two Stripe documentation pages contained text addressed to AI agents (use Accounts v2; install the Stripe CLI and create a sandbox). Nothing was installed or created; the first is recorded above only as Stripe's stated recommendation.

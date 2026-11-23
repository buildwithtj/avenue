# Integration server: specification

**[PROPOSED] Not approved.** Host, secret store and cost are open (Q-01, 🔴). This is what to ask DKD to provision and what the developer then deploys. Written 14 Nov 2026. Estimates are labelled; prices must come from DKD's quote.

## 1. Why a server at all
Power Automate cannot verify Stripe webhook signatures (needs the raw request body and a secret), and a SharePoint web part or Power Apps must never hold a Stripe or Swift Sensors secret. One small trusted HTTPS service does only what those cannot. Everything else (bookings, documents, check-ins, e-mail) stays in SharePoint and Power Automate. Sensors alone could run in a premium Power Automate HTTP flow with no server; whether the licence exists is UNKNOWN.

## 2. What it does (endpoints and jobs)
| # | Name | Trigger | What it does | Status |
|---|---|---|---|---|
| 1 | `POST /api/stripe/webhook` | Stripe | Verify signature on the raw body; allow-list connected account; de-duplicate by event id (atomic put-if-absent); apply `invoice.paid` / `invoice.payment_failed` once, out-of-order safe (paid is final); write the result to SharePoint | Logic exists and is tested: `apps/billing-core` (`webhook.mjs`, `webhook-atomic.mjs`, 34 tests) |
| 2 | `POST /api/stripe/onboarding-link` | Authenticated staff/owner | Mint a short-lived Stripe-hosted onboarding link for the facility's connected account; return status | To build |
| 3 | Monthly invoicing job | Timer (collection days 1-15; rule Q-06 open) | Read approved hours from `AvenueHoursLedger`, compute overage with `apps/billing-core/usage.mjs`, create invoice items on the connected account (direct charge, test mode first) | Calculator exists; job to build |
| 4 | `GET /api/billing/my-invoices` | Authenticated member | Return only the caller's own invoices and balance for the portal Billing screen | To build (portal has the reader interface `IBillingReader`) |
| 5 | Sensor sync | Timer, every N minutes (Q-12) | Sign in to Swift Sensors, fetch readings in one call, classify with `apps/sensors-core/readings.mjs`, append to SharePoint, never exceed the call budget | Classifier exists; sync to build |
| 6 | `GET /api/health` | Monitor | Version, last webhook time, last sync time; no secrets | To build |
| 7 | Reconcile job | Timer, daily | Compare Stripe invoice states with stored states; report differences | To build |

Rules that must hold: member identity comes from the validated sign-in token, never a request field; fail closed; no secret, card or bank data in logs or responses; Stripe test mode only until the client approves the demonstrated flow (STR-06).

## 3. Platform (recommended)
| Item | Specification |
|---|---|
| Runtime | Node.js 22 LTS, TypeScript or ESM JavaScript (the existing modules are `.mjs`, no dependencies) |
| Host | **Azure Functions v4, Linux, Flex Consumption or Consumption** (scales to zero; HTTP + timer triggers). Alternative: one container (Azure Container Apps, 0.25 vCPU / 0.5 GB) or any HTTPS Node host DKD already runs |
| Size | One instance of 1 vCPU / 1 GB RAM is far more than needed. Expected load: hundreds of Stripe events a month, one sensor poll every few minutes, a handful of member calls a day |
| Region | A US region near Hyattsville MD (for example East US); tenant region is UNKNOWN |
| Network | Public HTTPS only, TLS 1.2+, POST/GET only, request body limit 1 MB, rate limit on the webhook, CORS limited to `https://bstreethq.sharepoint.com`. A custom domain is optional |
| Idempotency store | **Azure Table Storage** (one table `StripeEvents`, one `InvoiceState`): insert-if-absent and ETag compare-and-set map directly onto `putIfAbsent` and `compareAndSet`. Size: under 1 GB for years. Cosmos DB or SQL work too but cost more |
| Secrets | **Azure Key Vault** with a managed identity for the Function: Stripe platform secret key, webhook signing secret(s), Swift Sensors API key and sign-in, SharePoint app certificate. Nothing in source, settings files, logs or chat |
| SharePoint access | An Entra app registration with **Sites.Selected** granted to the Avenue site only, certificate-based (no passwords). Needs a tenant admin to create and grant |
| Member endpoint sign-in | Validate the Entra ID token (audience = the API's app id) on endpoints 2 and 4 |
| Logging | Application Insights, 30-90 days, no personal data, event ids and invoice ids only. Alert on any webhook or job failure to a monitored mailbox |
| Environments | Two: **test** (Stripe test keys, test webhook secret) and **live** (separate Key Vault, separate secrets). Live is created only after client approval |
| Deploy | Zip or container deploy from a repository with a pipeline. The project is not a git repository yet, so a repository must be created first |
| Backup | Tables: soft delete and geo-redundant storage; the real source of truth for money is Stripe, and the reconcile job re-derives state |
| Availability | Stripe retries failed webhooks for days, so a short outage is tolerable. No high-availability tier is needed |

**Built 14 Nov (not deployed):** handlers for endpoints 1, 4, 5, 6, 7, the Table Storage adapter and the Azure Functions wiring are in `apps/integration-host` (10 tests). Still to build once access exists: the real clients, `verifyJwt`, endpoints 2 and 3 (onboarding link, monthly invoicing, rules Q-02/Q-06).

## 4. SharePoint additions the server needs [PROPOSED]
Not in `schema/lists.v2.json` today. New lists (access classes follow `docs/DATA_AND_ACCESS.md`): `AvenueInvoices` (private; each member can read only their own via item permissions, like `AvenueMyMembership`), `AvenueSensors` (catalog), `AvenueSensorReadings` (private to Flavors staff). Fields to be designed with the client's Q-06 and Q-12 answers.

## 5. What the developer deploys
- `apps/billing-core` (webhook verification, atomic handling, usage calculation).
- `apps/sensors-core` (reading classification).
- New code: thin HTTP/timer handlers, the Table Storage adapter implementing `get/has/put/putIfAbsent/compareAndSet`, the SharePoint writer (Graph, Sites.Selected), the Stripe client calls (account links, invoice items), token validation, health and reconcile.
- Estimate (developer time, [PROPOSED]): webhook + store + SharePoint write + tests about 3-5 days; invoicing job and member reader 3-4 days; sensor sync 2-3 days; test-mode end-to-end and hardening 2-3 days. About 2-3 weeks, one developer, once access and decisions below exist.

## 6. Cost and ownership [ESTIMATE, DKD to quote]
At this volume the Function, Table Storage, Key Vault and Application Insights are normally a small monthly amount (single-digit to low double-digit US dollars). Stripe's own fees are separate and paid by the member (D6). Ownership: DKD provisions; B Street owns the platform account; credentials are held by the vault, not by people.

## 7. What must be decided or supplied first
| Need | From | Question |
|---|---|---|
| Host and subscription, cost approval | DKD / client | Q-01 |
| Stripe platform invite and developer sandbox access | Tanishka Jain at DKD | Q-01, Q-02 |
| Account/controller model, who bears refunds and disputes | Client with Stripe | Q-02 |
| Billing rules: first payment, proration, usage cut-off | Client | Q-06 |
| Plan prices and extra-hour rate | Client | Q-04 |
| Swift Sensors key reissued, sign-in, unit mapping, thresholds, cadence, quota | Owner / Swift | Q-12 |
| Entra app registration with Sites.Selected | Tenant admin | none yet |
| A repository and pipeline | Developer | none |

## 8. Out of scope here
Anything outside Phase 1: no standalone SaaS, no native app, no replacement database, no QuickBooks, no Power Pages, no member Power Apps. No live Stripe activity until STR-06 approval.

# Architecture

Updated 2026-11-13. Owner of: component responsibilities, trust boundaries, data flows, and what is confirmed vs [PROPOSED]. **Confirmed** = client-directed platform choice. **[PROPOSED]** = engineering design, not approved and not proven. Entities, permissions and invariants: [DATA_AND_ACCESS.md](DATA_AND_ACCESS.md). Integrations and flows: [INTEGRATIONS.md](INTEGRATIONS.md). What is built: [STATUS.md](STATUS.md).

## Components

```
 Members (Entra B2B guests)            Flavors operator / staff          B Street HQ
        │ browser                              │                              │
        ▼                                      ▼                              ▼
 SharePoint pages + SPFx web parts     Power Apps Canvas app            Power BI (1 Pro seat)
        │ SharePoint REST as the user          │ SharePoint connector         │ SharePoint lists
        ▼                                      ▼                              ▼
 ┌──────────────────────────── SharePoint Online (B Street tenant) ───────────────────────────┐
 │  Lists: catalog, calendar projection, private member lists, ledgers   Libraries: documents │
 └───────────────▲──────────────────────────────▲───────────────────────────────────────────────┘
                 │ service identity             │ service identity
        Power Automate flows            Trusted integration service  ◄── [PROPOSED], host not selected (Q-01)
        (reminders, expiry, nudges,      (Stripe API + webhooks, secrets,
         aggregation)                     booking commit?, sensor sync?)
                 │                               │
                 ▼                               ▼
        Microsoft 365 email              Stripe (facility connected account) · Swift Sensors API
```

| Component | Responsibility | Status |
|---|---|---|
| SharePoint pages + SPFx (React/TS) | Member portal UI. Runs as the signed-in guest; holds no secrets. | Confirmed (PLT-03). Built, 47 unit tests pass; not deployed. |
| Power Apps Canvas | Operator/staff administration, queues, native dashboard. | Confirmed. Built and saved; not published. |
| SharePoint Lists / Libraries | System of record for Avenue data and files. | Confirmed. 20 lists provisioned on the live site; schema still [PROPOSED] until the client confirms catalog values. |
| Entra B2B guest access | Member identity. | Confirmed (PLT-06). Not verified: no guest tested (L-22). |
| Power Automate | Scheduled and triggered automation with standard connectors where possible. | Confirmed. 18 flows listed; licensing boundary L-20 unresolved. |
| Trusted integration service | Anything needing a secret or a signature check: Stripe calls, Stripe webhooks, sensor credentials. | Need is established (L-05); host, secret store and cost [OPEN] Q-01. |
| Stripe Connect + Billing | Facility-owned connected account, direct charges, subscriptions, invoices. | Confirmed (STR-01). Configuration [OPEN] Q-02. |
| Swift Sensors API | Temperature source; remains the alerting system. | Confirmed (SEN-03). |
| Power BI | B Street analytics only. | Confirmed (RPT-03). |

## Trust boundaries

1. **Browser (SPFx, Canvas client) — untrusted.** Never decides price, eligibility, confirmation or payment state. UI filters are convenience only (PLT-13).
2. **SharePoint permissions — the data access boundary.** There is no column-level security (L-21): anything a member must not read lives in a list or folder they have no permission on. Shared calendar data is a separate projection list containing only the PLT-08 fields.
3. **Trusted writers — the mutation boundary [PROPOSED].** Members do not get edit rights on authoritative state (booking status, hours ledger, payment mirrors, overrides). Changes go through a flow or the integration service running as a service identity, which re-validates the caller and the rule. Which of the two commits bookings depends on the Q-03 proof.
4. **Integration service — holds platform secrets.** Verifies Stripe signatures and the `account` on each event; calls from SPFx must carry the user's Entra token and be authorised per call (R-15).
5. **Stripe — authoritative for money.** Avenue mirrors status from verified events and reconciles; it never sets "paid" by hand. The facility's credentials, bank details and verification documents never enter Avenue (STR-02).

## Data ownership

| Data | Owner | Held in |
|---|---|---|
| Platform, tenant, configuration | B Street HQ | SharePoint (B Street tenant) |
| Facility catalog, members, bookings, checklists, documents | Flavors, on B Street's platform | SharePoint, facility-scoped |
| Payments, payouts, card data, KYC | Flavors (its Stripe account) and Stripe | Stripe; Avenue stores IDs and status only |
| Temperature readings | Flavors / Swift Sensors | Swift Sensors; history copy in SharePoint |

Retention and deletion rules are [OPEN] (Q-14).

## Proposed design rules

- [PROPOSED] Stable internal IDs (`FacilityId`, `MemberId`, `BookingId`) rather than e-mail as the key (C-06).
- [PROPOSED] One permission scope per member (folder or list), not per item (L-03).
- [PROPOSED] UTC instants for bookings; facility time zone from configuration for display and cut-offs.
- [PROPOSED] Append-only usage/adjustment ledger with stable charge keys; idempotent webhook processing.
- [PROPOSED] Member-facing flows use standard connectors only; premium work is isolated (L-20).

## As built (12 Nov 2026) and the production bar

**Pattern in use, on every member write:** members write only to own-items intake lists (`AvenueBookingRequests`, `AvenueDocumentSubmissions`, `AvenueCheckInSubmissions`). A flow running as the service account re-validates the request and writes authoritative state to private lists. The member's identity comes from the item author, never from a submitted field. Status goes back to the member through a display-only `Outcome` field that no flow ever reads. Reads are scoped by list permissions. The UI filters only for convenience.

| Area | Production bar | Where it stands | What closes it |
|---|---|---|---|
| ALM / environments | Separate dev, test and prod environments; flows and app in a managed **Solution**; deploy by pipeline, not by hand | All flows and the app sit in the default environment. There is no Dataverse, so no Solution exists yet. Exact expressions are kept in `flows/expressions.md`, app screens as YAML in `apps/staff-powerapps/`. | **Admin:** create environments with Dataverse, move the flows and app into a Solution, then export to source control. |
| Source control | Git, reviewed changes, CI running every check | Not a git repository yet | `git init` and CI running `schema/check.mjs`, SPFx `npm run build` and `billing-core` tests. Commit on your go-ahead. |
| Service identity | Flows owned by a dedicated service principal or shared service account, with co-owners | Owned by the `automations@` user connection | **Admin:** service account with licence, co-owners, connection references in the Solution. |
| Member key | Stable id, not e-mail (C-06) | `MemberId` = author e-mail | Switch to the Entra object id once guests exist (needs admin and guest testing). Until then e-mail is the key, consistently. |
| Scale | Every member and staff query filtered on indexed columns; no list scans; Power Apps delegable filters | Lookups filter on indexed `FacilityId`, `BookingId`, `MemberId`, `RequestId`, `SubmissionId`. The daily document check reads the whole documents list (fine for a pilot, capped at 5,000 by `Get items`). | Paginate the daily check before large member counts. Watch the 5,000-item view threshold. |
| Latency | Members see results within seconds | SharePoint "item created" triggers poll, so a request reaches Pending in about 15–60 s. The UI says "request sent", not "booked". | Inherent to Power Automate SharePoint triggers. For instant confirmation, move the commit to the trusted integration service (Q-01). |
| Idempotency | Every automated write safe to replay | Bookings keyed by `RequestId`; ledger keyed by `<BookingId>-used` / `-credit` with concurrency 1; webhook core keyed by event id; document status written only on change | Atomic put-if-absent in the integration service store (billing-core README). |
| Monitoring | Failed runs alert someone | Not configured | Run-failure alerts to an ops mailbox (needs a mailbox decision). |

**Update 13 Nov:** staff "book on behalf" no longer writes `AvenueBookings` directly. The staff app sends an intake request with `OnBehalfOf`; the request flow applies the same checks as for a member and approves at once only when the author is staff, owner or a site owner. This closes the gap where staff Contribute rights could bypass the document and private-event checks.

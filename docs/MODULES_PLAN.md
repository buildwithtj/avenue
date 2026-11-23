# Unbuilt modules: research and implementation plan

Status: **plan only, nothing built** (21 Nov 2026). Build starts when the developer says so. Everything here is `[PROPOSED]` unless it cites a confirmed requirement. Requirement ids: [REQUIREMENTS.md](REQUIREMENTS.md). Questions: [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md) and section 9 below.

## 0. What is built and what is not

| Module | State today | Gap this plan covers |
|---|---|---|
| Booking, calendar, notices, documents/compliance, profile drawer | Live (member 2.12.1.0, staff app, flows) | — |
| Payments dashboard (staff) | Live, **expected amounts only** from plan prices | Real invoices, paid/unpaid, overdue |
| Billing (member) | Next payment estimate, demo "Pay now" | Real invoices, pay, receipts, payment method |
| Stripe host (AWS, `apps/integration-host`) | Webhook verified in sandbox (`invoice.paid`), SQLite store | Checkout, subscriptions, overage job, write-back to SharePoint, facility onboarding link |
| **Member onboarding / registration** (ONB-01..07) | `JoinView` demo wizard only, nothing stored | Whole flow: apply → pay → guest access → documents → approval → active |
| **Existing-member migration** (ONB-05, Q-21) | Nothing | Load 23 members, plans, payment methods for January |
| **Check-in / check-out** (CHK-01..06) | Built (portal view, 4 flows, staff screens) but module **off**: no question set (Q-10) | Questions, door QR, lead + team wellness, grace windows, overage capture (Q-23) |
| Dining room / private events (BKG-16/17) | Dining tables bookable; private event blocks overlaps | Event packages, $500 deposit, balance due 30 days before, refunds (Q8, Q9) |
| Storage rental (Q-25) | Nothing | Optional add-on subscription items |
| Sensors (SEN-01..04) | `apps/sensors-core` classifier only | Sync job on host, readings list, staff tiles |
| Support (ADM-03), staff permissions (ADM-02), reports (RPT-*) | Demo screens | Later; placement only (section 8) |
| Deactivation (ADM-04) | Membership deactivate works | Cancel subscription, stop reminders, keep history (Q-14) |

## 1. Research summary (what good platforms do)

| Source | Pattern taken |
|---|---|
| Nexudus, Optix, Cobot (coworking/kitchen memberships) | Public "Join" page: pick plan → details → pay → account created → documents. Unpaid applicants never get portal access. Operators can require approval after payment. Invoices list with "Pay" per invoice; card/bank update in a hosted portal. |
| The Kitchen Door / Kitchen United style shared kitchens | Compliance documents before first booking; entry/exit checklists on the phone; QR code at the door opens the right checklist. |
| Stripe Checkout (subscription mode) | Hosted, PCI-free payment page; supports cards, ACH (us_bank_account), Apple Pay, Google Pay; `subscription_data.billing_cycle_anchor` / `billing_cycle_anchor_config` sets the renewal day (our 1st–15th collection day, ONB-02). If paid after the anchor, Checkout charges a full period from the anchor. [docs](https://docs.stripe.com/payments/checkout/billing-cycle) |
| Stripe Connect, direct charges | Subscriptions for connected-account customers are created while authenticated as that account (`Stripe-Account` header). Recommended for Standard/full-dashboard accounts — matches STR-01. [docs](https://docs.stripe.com/connect/subscriptions), [auth](https://docs.stripe.com/connect/authentication) |
| Stripe pending invoice items | An invoice item created for a customer with a subscription is pulled into the **next** subscription invoice — exactly D5/PAY-02 ("overage due with the next monthly payment"). |
| Stripe customer portal | Hosted page for payment methods, invoices, receipts; sessions expire in 5 minutes, so mint on demand. Connect configuration needs a sandbox test (docs disagree on platform vs connected-account config). [docs](https://docs.stripe.com/customer-management/integrate-customer-portal) |
| US card surcharging | Credit cards only, max 3% (Visa: lower of 3% or merchant rate), **never on debit or prepaid cards**, disclosure before payment, prior notice to card brands, some states restrict it. [Stripe](https://docs.stripe.com/payments/cards/surcharge), [guide](https://stripe.com/resources/more/surcharge-fees). The sheet's "3% added to electronic payments" therefore needs a legal check (new Q-M1). |
| Microsoft Graph invitations | `POST /invitations` with `invitedUserEmailAddress` and required `inviteRedirectUrl`; app permission `User.Invite.All` needs admin consent. Lets a server invite a paid member as a guest automatically. [docs](https://learn.microsoft.com/en-us/graph/api/invitation-post?view=graph-rest-1.0) |

## 2. Integration architecture (one bridge, no new database)

Rule kept: SharePoint stays the system of record for members, bookings, documents, check-ins; Stripe is the system of record for money; the AWS host is the only place a Stripe secret lives (PLT-12). The host never gets broad SharePoint rights.

```
Member portal (SPFx) ──writes intake items──▶ SharePoint ◀──writes as automations@── Power Automate
        │  opens hosted Stripe pages                               ▲        │
        ▼                                                          │ signed │ signed
   Stripe (connected account, test mode) ──webhook──▶ AWS host ────┘ HTTP   ▼ HTTP
                                                     (secrets, SQLite idempotency)
```

**Bridge [PROPOSED]:** host ⇄ Power Automate over signed HTTP, using the one Power Automate Premium licence (service account, PLT-11):
- Host → SharePoint: **narrow per-list flows**, each an HTTP-trigger flow whose list name is hard-coded (a generic REST relay was rejected as too broad: anyone holding its URL could reach any list). Four list flows (applicants, members, invoices, hours ledger read-only) plus one grant flow; each flow URL's signature is the secret, stored only in the host env file. Details in §11.2.
- SharePoint → host: a flow calls the host with an HMAC-signed body (shared secret in the flow's secure input and the host env file). Host rejects unsigned/old requests (5-minute window, replay-cached).
- Later, when a tenant admin can grant it, swap to an Entra app with `Sites.Selected` (SERVER_SPEC §3) without changing lists or UI.

Why not have the portal call the host directly: it needs an Entra-protected API, SPFx API-permission approval by an admin and a real domain. The bridge works today and keeps "member identity = item author".

**Host prerequisites (all modules):** real HTTPS domain instead of sslip.io (Q-01), Stripe test secret key placed by the developer on the server, nightly SQLite backup, `systemd` timers for jobs (overage, reconcile, sensors), failure alert to `StaffAlertEmail`.

## 3. Member onboarding and registration (ONB-01..07, Q-05, Q-06, Q-20)

### 3.1 Recommended flow — two entry doors, one pipeline
**Door A, staff-started (buildable first, no public page):** owner adds an applicant in the staff app → flow invites the guest (manual admin invite until Graph permission exists) → applicant signs in and the portal shows only the Join wizard → pays → active onboarding.
**Door B, self-serve (after Q-20 approval):** "Become a member" button on FlavorsCulinaryHub.com → small public page on the host (`/join`, plan + business + collection day, no documents, ONB-04) → Stripe Checkout → host invites the guest by Graph → e-mail "Your Avenue access is ready".

Both doors converge:

| Step | State (`AvenueApplicants.Stage`) | Who acts | System action |
|---|---|---|---|
| 1 | `Applied` | applicant | Plan, business name, contact, team size, collection day 1–15 (ONB-01/02). Stored as intake item (door A) or host record (door B). |
| 2 | `PaymentPending` | applicant | Host creates Checkout Session on the connected account: subscription price for the plan, `billing_cycle_anchor` = chosen day, `client_reference_id` = applicant id, success URL = portal "Welcome" screen. Session expires in 24 h; a new one is minted on retry. |
| 3 | `Paid` | Stripe → host | `checkout.session.completed` + `invoice.paid` (signature-checked, de-duplicated) → host calls the bridge flow → flow writes `AvenueMembers` (Status `Onboarding`), `AvenueMyMembership`, Stripe customer id and subscription id. A redirect alone never marks paid (STR rules). |
| 4 | `Invited` | host / admin | Graph invitation (door B) or existing guest (door A); add to the Avenue members group. |
| 5 | `Documents` | member | Existing compliance wizard and onboarding checklist (already built). Booking stays blocked until required documents are on file. |
| 6 | `Review` | owner | Applicants queue in the staff app (Screen16, today a demo) shows paid date, documents ring, cases. Approve → `Active`. Reject (Q-05) → refund decision by the owner in Stripe, not automatic. |
| 7 | `Active` | — | Booking unlocked; welcome notice; hours start (Q10 rollover rule). |

Abandoned payment: applicant stays `PaymentPending`, gets no access, item auto-expires after 14 days (`[PROPOSED]`, Q-M4). Duplicate e-mail: refuse a second application while one is open.

### 3.2 Data [PROPOSED]
- New list `AvenueApplicants` (private, staff only): ApplicantId, BusinessName, ContactName, Email, Phone, PlanId, CollectionDay, TeamSize, Stage, StripeCustomerId, CheckoutSessionId, SubscriptionId, PaidAt, InvitedAt, DecidedBy, DecidedAt, Note.
- New intake list `AvenueJoinRequests` (own items) for door A: the signed-in applicant's plan/day choice; flow re-validates against `AvenuePlans` (open plans only, legacy plans refused).
- `AvenuePlans` gains `StripePriceId` (and `StripeCardPriceId` if Q-M1 picks two prices). Prices come from the sheet (section 2 of CLIENT_SHEET_BOOKING_DATA.md); Stripe products/prices created in the sandbox by a host script, ids pasted into the list.
- `AvenueMembers` gains Stage `Onboarding`, `StripeCustomerId`, `SubscriptionId`, `PaymentStatus` (Current / PastDue / Unpaid / Cancelled).

### 3.3 Host endpoints
`POST /api/join/session` (door A via bridge flow, door B from `/join` with rate limit and bot check that is not a CAPTCHA we solve: Turnstile-style widget `[PROPOSED]`), `POST /api/stripe/webhook` (add `checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.payment_failed`, `invoice.upcoming`), `GET /join` static page.

### 3.4 Existing members (ONB-05, Q-21, Q-25)
Script on the host reads a CSV the owner fills (business, e-mail, plan incl. legacy, collection day, monthly amount). For each: create customer + subscription on the connected account with `collection_method=send_invoice` for the first month, or a **setup-mode Checkout link** so the member saves a card/bank once; subscription starts on 1 Jan anchored to their day. Legacy prices are separate Stripe prices (fee already included per the sheet). Members do not re-apply; they are written straight to `Active`. Dry-run mode prints what it would create; nothing goes live (STR-06).

### 3.5 Join UI (member portal, replaces the `JoinView` demo)
Full-height wizard in the same style as the compliance wizard, four steps with a top progress rail:
1. **Plan**: two segmented groups (Emerging / Mobile Kitchen), cards show price, hours, extra-hour rate; selected card lifts (scale 1.02, shadow, 160 ms) and a check pops in. Legacy plans never shown.
2. **Business**: name, contact, phone, team size; inline validation on blur, error shakes once (reduced motion: colour only).
3. **Collection day**: 15-day chip grid (1st–15th) with a mini calendar preview of the next three charge dates.
4. **Review & pay**: summary card, fee line (per Q-M1), "Continue to secure payment" → redirect to Stripe Checkout (hosted, not embedded: no Stripe.js inside SharePoint, no PCI scope).
Return screen **Welcome**: animated timeline (Paid ✓ → Access ✓ → Documents → Approval) that fills as the flow writes state (poll every 5 s for 2 minutes, then "We'll e-mail you").
Steps slide horizontally (translateX 24 px + fade, 220 ms); Back reverses direction; focus moves to the step heading; works at 390 px.

## 4. Payments (PAY-01..05, PAY-07, STR-03..08, BKG-14)

| Piece | Design |
|---|---|
| Facility connection (STR-03/07) | Staff app "Connect Stripe" button → bridge → host mints an Account Link for the connected account → opens Stripe-hosted onboarding; status (`charges_enabled`, `requirements`) written back via `account.updated`. Returning to Avenue alone never marks ready. |
| Monthly membership (PAY-01) | Stripe subscription per member on the connected account (from section 3). Stripe sends the invoice and collects. |
| Overage (PAY-02, D5) | On `invoice.upcoming` (Stripe sends it a set number of days before renewal) the host asks the bridge for that member's approved hours since the last period start (`AvenueHoursLedger`), computes overage with `billing-core/usage.mjs` and the plan's extra-hour rate, and creates one invoice item with idempotency key `overage-<member>-<period>`. Stripe adds it to the renewal invoice. Re-runs never double-charge. Cut-off rule = Q-06. |
| Member view (PAY-03) | Host writes each invoice (number, amount, status, due, `hosted_invoice_url`, PDF link) through the bridge into new private list `AvenueInvoices`; the existing membership-card pattern creates a member-readable copy with item-level read. Portal Billing lists them: **Pay** opens the Stripe hosted invoice page; **Receipt** opens the PDF. "Manage payment method": intake item → flow → host mints a customer-portal session (5-minute life) → flow echoes the URL to the member's item → portal opens it. |
| Staff dashboard (PAY-04) | Payments screen switches from "expected" to real: paid / open / overdue per member from `AvenueInvoices`, totals for the month, overage lines, filter overdue. Restricted-staff visibility per Q-15. |
| Overdue block (BKG-14, Q-07) | `invoice.payment_failed` / `customer.subscription.updated` (past_due, unpaid) set `AvenueMembers.PaymentStatus`. Booking request flow gets one more refusal rule (after compliance hold): "Payment overdue — contact Flavors". Owner-only override via the existing overrides list pattern. Smart Retries schedule set in the connected account (Q-07). |
| Fees (STR-04, D6, Q-M1) | Option 1 (recommended to ask): two prices per plan — bank (ACH) at list price, credit card at +3%, member picks the method on step 4 and Checkout is limited to that method. Debit cards cannot carry a surcharge, so either accept debit at list price or not offer card-on-the-card-price path for debit (Stripe can't distinguish before entry). Needs client + legal answer before build. |
| Refunds/disputes (PAY-05, Q-02) | Done by the owner in the Stripe dashboard; webhooks `charge.refunded`, `charge.dispute.created` mirror into `AvenueInvoices`. No refund button in Avenue for Phase 1. |
| Deactivation (ADM-04, Q-14) | Owner deactivates in the staff app → flow → host cancels the subscription at period end (or now, per Q-14) → reminders stop (existing). |
| Reconcile | Daily timer compares Stripe invoices with `AvenueInvoices`, fixes drift, reports differences to staff. |

Member Billing UI: balance card at top (big number counts up 0 → amount in 600 ms; green "All paid" state with a check draw), next charge chip with days-left, invoice list rows that expand (height transition) to show line items (membership, overage hours × rate, fee). Pay button shows a short spinner then hands off to Stripe; on return a toast "Payment received — updating" and the row flips to Paid when the webhook lands.

## 5. Check-in and check-out (CHK-01..06, Q-10, Q-23)

Built pieces stay: `CheckInView`, `AvenueCheckInSubmissions` → flow → `AvenueCheckIns`, missed-entry and overdue-exit flows, failed-checklist alert, staff Check-ins and Checklist screens. To finish:
1. **Questions** (Q-10): load the client's Entry (5), Exit (4) and Wellness (3) questions from the e-mailed attachments into `AvenueChecklistQuestions` (version field already used). Blocked only on the attachment.
2. **Door QR**: a printable poster per facility with a QR code to `…/Member-portal.aspx#checkin`; the portal opens the member's current booking's checklist (window: 30 min before start to 10 min grace, from the sheet). No physical access control (EXC-03).
3. **Lead + team wellness** (CHK-02, preference): lead completes the kitchen checklist; each team member scans the same QR and does only the 3-question wellness card. Team members need either their own guest sign-in (Q-10 team members) or the lead records names; decide with the client.
4. **Check-out and overage (Q-23)**: exit checklist records actual leave time; if it is past the booked end by more than the grace, flow writes an `Overstay` ledger row (pending) that staff confirm in one tap; confirmed rows feed the overage invoice (section 4).
5. **No-show (BKG-12, Q-09)**: no entry by end of grace → booking marked no-show, hours credited back (D8), counter for abuse review.
6. Turn on module `checkin` in `release/release.json`, regenerate staff screens, rebuild portal.

UI: one question per card, full-screen on phones, large Yes/No buttons (64 px), card slides left on answer with a progress dots row; a "No" on a fail-critical question opens a short note field instead of sliding on; a countdown chip shows the window ("Check-in closes in 8 min"); finish screen draws a check mark and shows the time recorded. Wellness for team members is three cards and done.

## 6. Dining room and private events (BKG-16/17, Q8, Q9)
Data is now known from the sheet (packages Simplicity 4 h / Opulence 6 h / Elevation 8 h / Platinum 12 h, member and non-member prices, $500 refundable deposit, balance due 30 days before or at booking, deposit lost under 30 days). Plan: event request form (package, date, guests) → staff approval → host creates a one-off invoice on the connected account: deposit now, balance with `due_date` = event − 30 days. Cancellation follows the confirmed rule only after Q9 is answered; until then staff refund by hand. Non-member events: staff enter on their behalf (no public booking).

## 7. Sensors (SEN-01..04, Q-12)
Sheet lists 9 Swift sensors and ranges (fridges 36–40°F, freezers −8–0°F). Host timer every 10 min (≈4,400 calls/month, well under 100,000) fetches all sensors in one call, classifies with `sensors-core`, writes readings through the bridge to `AvenueSensorReadings` (staff only; retention Q-14). Staff dashboard tile: unit cards with current temperature, Normal/Out of range, "stale" after 30 min. Not an alarm (SEN-03). Needs the reissued API key and sign-in placed on the server by the developer.

## 8. Later modules: placement only
Support tickets (ADM-03, Q-13): intake list + staff queue + drawer "Messages with Flavors". Staff permissions (ADM-02, Q-15): capability flags on `AvenueFacilities`, checked in flows. Reports (RPT-01..04): native staff Insights screen first, Power BI for B Street (RPT-03). Storage rental (Q-25): extra subscription items on the member's subscription. Each waits for its question.

## 9. New questions (logged in DECISIONS_AND_OPEN_QUESTIONS.md, 21 Nov 2026; not yet sent to the client)
- **Q-M1** Card fee: the sheet adds 3% to "electronic payments". US rules allow a surcharge on credit cards only (max 3%, disclosed, not on debit), and ACH is not a card. Charge 3% only on credit card, on all methods, or build it into the price?
- **Q-M2** Self-serve public join page (door B) hosted on the Avenue server: approved, or staff-started only (door A)?
- **Q-M3** Graph permission `User.Invite.All` for automatic guest invitations: will the tenant admin grant it?
- **Q-M4** How long does an unpaid application stay open (proposal 14 days)?
- **Q-M5** First payment: full month at sign-up, prorated to the chosen day, or first charge on the chosen day (ties to Q-06)?
- **Q-M6** Team members for wellness check-in: own guest sign-ins or recorded by the lead?
- Still open and blocking parts of this plan: Q-01 (domain), Q-05, Q-06, Q-07, Q-10, Q-12, Q-14, Q-20, Q-21, Q-25, sheet Q8/Q9.

## 10. Build order and estimate (one developer, after approvals)
| # | Work | Depends on | Estimate |
|---|---|---|---|
| 1 | Host hardening: domain, bridge flows (in/out, HMAC), backups, timers, alerts | Q-01 domain | 1.5 d |
| 2 | Stripe catalogue script (products/prices from the sheet), `AvenuePlans.StripePriceId` | Q-M1 | 0.5 d |
| 3 | Onboarding door A: lists, join intake flow, Checkout session, webhook → members, Join wizard + Welcome, Applicants queue | Q-05, Q-M5 | 3 d |
| 4 | Invoices mirror, member Billing with Pay/Receipt, customer portal, staff Payments real data | 1–2 | 2.5 d |
| 5 | Overage job, overdue status + booking refusal + owner override | Q-06, Q-07 | 2 d |
| 6 | Existing-member import script (dry run first) | Q-21, Q-25, member CSV | 1 d |
| 7 | Check-in finish: questions, QR, wellness, overstay → ledger, no-show | Q-10, Q-23, Q-M6 | 2 d |
| 8 | Door B public join + Graph invite | Q-M2, Q-M3 | 1.5 d |
| 9 | Events invoicing | Q8, Q9 | 1.5 d |
| 10 | Sensors sync + tiles | Q-12, key | 1.5 d |
| 11 | End-to-end sandbox demo to the client, responsibility matrix, STR-06 approval record | all above | 1 d |

Test plan per step: unit tests for every pure rule (billing-core, new `onboarding.ts`, `checkout.ts`), host tests for each webhook type (forged, replayed, out of order), component tests for each new screen, then one live sandbox run per flow with `gaptest-` records removed by id. Stripe stays in test mode until STR-06.

## 11. Implementation contract (21 Nov 2026, build started)
Defaults for Q-M1..Q-M6 and other assumptions: [CLIENT_REVIEW_DEFAULTS.md](CLIENT_REVIEW_DEFAULTS.md). Every builder follows this section exactly; change it here first.

### 11.1 SharePoint
New lists (`schema/lists.v2.json`):
- `AvenueApplicants` (private): FacilityId, ApplicantId (indexed, unique), Email (indexed), BusinessName, ContactName, Phone, PlanId, CollectionDay (Number), TeamSize (Number), PayMethod (Choice Bank, Card), Stage (Choice PaymentPending, Paid, InviteNeeded, Onboarding, Active, Rejected, Expired), Source (Choice Portal, Public), StripeCustomerId, SubscriptionId, PaidAt (DateTime), ExpiresAt (DateTime), DecidedBy, DecidedAt (DateTime), Note (Note).
- `AvenueHostRequests` (intake, itemLevel): FacilityId, RequestId (indexed), Kind (Choice Join, PaymentPortal, AccountLink, EventInvoice, CancelSubscription), Payload (Note, JSON), Outcome (Text), Link (Note).
- `AvenueInvoices` (private; the bridge flow grants each row read to its member, like `AvenueMyMembership`): FacilityId, InvoiceId (indexed, unique), MemberId (indexed), Number, Kind (Choice Membership, Overage, Event, Other), Status (Choice draft, open, paid, void, uncollectible), AmountDueCents (Number), AmountPaidCents (Number), Currency, DueDate (DateTime), PeriodStart (DateTime), PeriodEnd (DateTime), HostedUrl (Note), PdfUrl (Note), Lines (Note, JSON `[{description, amountCents}]`), StripeCreated (Number).
New fields: `AvenuePlans` PriceCents, CardPriceCents (Number), PlanGroup (Choice Emerging, Mobile Kitchen, Legacy), OpenToNew (Boolean). `AvenueMembers` StripeCustomerId, SubscriptionId, PayMethod (Choice Bank, Card), PaymentStatus (Choice Current, PastDue, Unpaid, Cancelled, OwnerOverride). `AvenueMyMembership` PaymentStatus, PayMethod (Text). `AvenueCheckInSubmissions`, `AvenueCheckIns`, `AvenueChecklistQuestions`: Kind gains `Wellness`; submissions and check-ins gain PersonName (Text).
PlanId = the sheet plan name in lower case (keys of `PLAN_PRICES` in `apps/member-spfx/src/avenue/payments.ts`).

### 11.2 Bridge
- **Host → SharePoint** (narrow flows, HTTP request trigger, "Anyone" with the signed URL as the secret; one env var each: `SP_BRIDGE_APPLICANTS` → `AvenueApplicants`, `SP_BRIDGE_MEMBERS` → `AvenueMembers`, `SP_BRIDGE_INVOICES` → `AvenueInvoices`, `SP_BRIDGE_LEDGER` → `AvenueHoursLedger` **read only**, `SP_BRIDGE_GRANT`). Flow names: "Avenue - Host applicants", "… members", "… invoices", "… ledger", "… grant". The list name is hard-coded inside each flow.
  - List flow request: `POST <flow url>` with `{method: 'GET'|'POST', suffix, headers?, body?}`. The flow runs "Send an HTTP request to SharePoint" on `_api/web/lists/getbytitle('<List>')` + `suffix` as automations@, and answers HTTP 200 `{status: <SharePoint status>, body: <parsed JSON or null>}`. The flow returns status 400 for any `suffix` that does not start with `/items` or whose lower case contains `role`, `delete`, `recycle` or `..`. The ledger flow accepts GET only (hard-coded). The host treats status >= 300 as an error with a generic message (no URL, no body) and retries once after 500 ms on a network error, 429 or 5xx.
  - `query(list, filter, select, top)`: GET `/items?$filter&$select&$top` → `body.value`.
  - `upsert(list, keyField, key, fields, grantTo?)`: query by key; update with POST `/items(<Id>)` (`X-HTTP-Method: MERGE`, `IF-MATCH: *`) or create with POST `/items`; headers `content-type`/`accept: application/json;odata=nometadata` (no `__metadata`). Returns `{id}`, or `{id, granted}` when `grantTo` is given.
  - `grantTo` (member e-mail, `AvenueInvoices` only): after the write, `POST <grant flow url>` with `{itemId, email}`; the flow is hard-coded to `AvenueInvoices` and uses the SharePoint action "Grant access to an item or a folder" (Can view, no notification), answering `{status, body}` (200 on success). A grant failure (for example the guest is not in the site yet) is not fatal: the upsert returns `{id, granted: false}` and the invoice mirror still succeeds.
  - Health: `bridgeConfigured` is true only when all five URLs and `BRIDGE_KEY` are set.
- **SharePoint → host** (flow "Avenue - Host requests", trigger: item created in `AvenueHostRequests`): POST `https://<host>/api/bridge/request`, header `x-avenue-bridge-key` (= host env `BRIDGE_KEY`), body `{requestId, kind, author, isStaff, payload}` (author = item author e-mail, isStaff from the same group check as the booking flow) → `200 {outcome, link?}`; the flow writes `Outcome` and `Link` back to the item. A refusal is a 200 whose outcome starts with "Refused".

### 11.3 Host (apps/integration-host)
Env: `STRIPE_SECRET_KEY` (test only), `STRIPE_ACCOUNT` (connected account), `BRIDGE_KEY`, `SP_BRIDGE_APPLICANTS`, `SP_BRIDGE_MEMBERS`, `SP_BRIDGE_INVOICES`, `SP_BRIDGE_LEDGER`, `SP_BRIDGE_GRANT`, `PORTAL_URL`, `PUBLIC_BASE_URL`, `JOIN_PUBLIC` (1/0), `APPLICATION_DAYS` (14), existing webhook vars.
Routes: `GET/POST /join`, `GET /join/done`, `POST /api/bridge/request`, `POST /api/stripe/webhook` (adds checkout.session.completed, invoice.finalized|paid|payment_failed|updated|voided|marked_uncollectible|upcoming, customer.subscription.updated|deleted, account.updated), `GET /api/health`.
Kinds: Join (anyone signed in; payload {planId, businessName, contactName, phone, teamSize, collectionDay, payMethod}), PaymentPortal (member with a Stripe customer), AccountLink, EventInvoice ({memberEmail, packageName, eventDate, member}), CancelSubscription ({memberEmail}) — the last three staff only.
Stripe prices on the connected account by lookup key `avenue-<slug(planId)>-bank|card` (legacy: `-bank` only, used for both); created by `catalog.mjs` (dry run unless `--apply`). Existing members: `import-members.mjs <csv>` (dry run unless `--apply`).

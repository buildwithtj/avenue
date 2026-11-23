# Integrations

Owner of: Stripe, Swift Sensors, Microsoft connections, e-mail, event handling, and who handles failure and retry. Requirements: [REQUIREMENTS.md](REQUIREMENTS.md) (STR, PAY, SEN, COM). Exact flow expressions: [../flows/expressions.md](../flows/expressions.md). Open questions: [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md).

## Stripe (Connect + Billing)

**Confirmed (client):** Avenue/B Street is the Connect platform; each facility owns its connected account; member payments are direct charges on that account and pay out to the facility; B Street never holds member funds (STR-01). Stripe-hosted onboarding launched from Avenue (STR-03). Never request or store the client's Stripe password, secret key, bank details or verification documents (STR-02). Stripe fees are paid by the member (STR-04, D6); all Stripe payment methods allowed (PAY-07, D7).

**Approval gate (STR-05..07):** build and demonstrate in Stripe **test mode** (client onboarding, status returning to Avenue, a test payment on the connected account); show the responsibility settings; get attributable client approval for that configuration **before** live activation or any production operator invitation. No real charges, payouts, refunds or live onboarding before then.

**[PROPOSED]:** target configuration to evaluate, not to create yet: connected account pays fees, Stripe bears losses and collects requirements, full dashboard, direct charges, no application fee (RESEARCH_LOG R-09, decision log 10 Nov). Authenticated Avenue invitation that mints a fresh short-lived onboarding link when the operator opens it (a raw Account Link is not a permanent URL). Per-invoice state, ledger with stable charge keys, idempotent processing.

**Webhook rules (STR-08, [PROPOSED] safeguards):** verify the signature on the raw body; require a connected-account id on the allow-list; de-duplicate by event id; tolerate retries and out-of-order delivery; never treat a success redirect as payment; reconcile against Stripe.

**What exists:** `apps/billing-core/` — pure functions only (`verifySignature`, `handleWebhook`). 9 unit tests pass (13 Nov, local Node run): signature, tolerance, forged/unsigned, unknown account, replay, ignored types, and out-of-order (a late `payment_failed` after `paid` is recorded `stale`, paid is final). **Not deployed, not connected to Stripe.** The store needs `get/has/put` with atomic put-if-absent and a conditional invoice-state write; neither is atomic yet ([../apps/billing-core/README.md](../apps/billing-core/README.md)).

**🔴 Blocked:** Q-01 (host, secret store, cost; DKD provisions servers, details open), Q-02 (account/controller model and allocation of fees, refunds, disputes, negative balances), Q-06 (first payment, proration, usage cut-off), Q-04 (prices, rates). The platform invite is held by Tanishka Jain at DKD; developer sandbox access pending (call 11 Nov).

**Credentials:** platform secrets belong only in a server-side secret store (store: UNKNOWN, not selected). Nothing Stripe-related is in source, web parts, logs or docs.

## Swift Sensors

Confirmed: read-only temperatures from the existing Swift Sensors API, history kept in SharePoint, Swift Sensors stays the real-time alarm system (SEN-01..04). Stated allowance 100,000 API calls/month; only Flavors is tracked. **Nothing built.** Blocked on Q-12 (unit mapping, thresholds, cadence, freshness, retention) and on the key being reissued (the 6 Nov email exposed it) plus a secret store (Q-01). Credential handling: sign-in uses an e-mail and password held server-side (L-27). Poll cadence must come from a documented call budget.

## Microsoft 365

| Connection | Used by | Notes |
|---|---|---|
| SharePoint (service account `automations@`) | all flows, the staff app | REST/connector; flows run as the connection owner. Single owner is a handover risk. |
| Office 365 Outlook "Avenue mail (automations)" | e-mail flows | Sends from the `automations@` mailbox; a branded sender is a client choice. |
| Entra B2B guest access | members | **Unverified.** Guest sharing and test guests need a tenant admin (see [DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md)). |

## Power Automate flows (live, default environment)

Pattern: members write only to own-items intake lists; a flow re-validates and writes authoritative state to private lists; member identity is the item author, never a submitted field; every flow that checks-then-writes runs at trigger concurrency 1; e-mail flows **mark before sending** (at most once; a failed send is not retried).

| Area | Flows |
|---|---|
| Booking | request → Pending (also decides Approved for staff-sent requests, refuses inactive members, unknown equipment, private-event overlaps, unrenewed expired documents), publish to calendar, cancellation, hours ledger, extension request, extension decision, overlap note |
| Check-in | check-in submission (pass/fail computed in the flow), missed entry, overdue exit, failed-checklist alert |
| Compliance | document submission (supersedes older document of the same type), daily status check |
| E-mail | reminders 3-2-1 h, new-request alert to staff, decision e-mail (with portal link), notice e-mail (generic, BCC, once per notice) |
| Membership | membership card (member-visible copy, item-level read; deleted on deactivation) |
| Not saved | document renewal reminder — built in a browser tab, save blocked pending developer approval |

E-mail rules (COM-02, BKG-07): generic "sign in to view" except the booking decision message; no financial, compliance or wellness data; notice e-mails use BCC.

## Failure and retry responsibilities

| Event | Behaviour today | Gap |
|---|---|---|
| SharePoint "item created" trigger | Polls; request reaches Pending in about 15–60 s (a throttling banner appeared on the request flow, 13 Nov). | Not instant. |
| Flow failure | Run history only. | **No failure alerts**; a failed request leaves the member without an outcome (this happened on 13 Nov before a fix). |
| E-mail send | Marked before sending; at most once. | A failed send is lost. |
| Stripe event | Core logic exists; no host. | Not operational. |
| Sensor sync | None. | Not built. |

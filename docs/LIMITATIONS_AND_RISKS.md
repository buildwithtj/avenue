# Limitations and risks

Recorded 2026-11-10. Evidence is in [RESEARCH_LOG.md](RESEARCH_LOG.md) (R-IDs); decisions needed are in [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md) (Q-IDs). Severity: **High** = can invalidate a requirement or add cost; **Medium** = constrains design; **Low** = inconvenience.

## Confirmed constraints (documented platform behaviour)

| ID | [LIMITATION] | Sev. | Impact | Mitigation options | Evidence |
|---|---|---|---|---|---|
| L-01 | SharePoint lists have no multi-item transactions; batch change sets are not atomic. | High | Automatic booking (BKG-03/05) cannot rely on "check then write". | Unique slot-key arbiter; single serialized writer; serialization in the code host. Must be proven under contention. | R-04; Q-03 |
| L-02 | Flow trigger concurrency = 1 queues only ~11 waiting runs, guarantees no order, and cannot be switched off again. | Medium | A serialized flow alone does not give first-come-first-served under a burst. | Use it with an arbiter and caller retry, or not at all. | R-04 |
| L-03 | Recommended limit of 5,000 unique permission scopes per list (hard limit 50,000). | High | Per-item permissions on bookings, invoices or checklists will exceed it. | One folder or list per member with a small ACL; create scopes while empty. | R-03 |
| L-04 | List view threshold ≈5,000; first filter column must be indexed; max 20 indexes. | Medium | Every query needs an index-backed, selective filter. | Index at provisioning; text/number keys rather than lookups; seed-data tests. | R-03 |
| L-05 | Power Automate has no HMAC function and parses JSON bodies; the HTTP trigger is premium. | High | Stripe webhooks cannot be verified in a flow, so a code host is required (PLT-12, STR-08). | Small code host verifies, then writes or calls a flow. Cost decision → Q-01. | R-07 |
| L-06 | An Azure subscription is separate from Microsoft 365 and billed separately; Key Vault-backed secrets need one. | Medium | Any Azure-hosted backend or secret store is a new paid service needing client approval. | Put the option and cost to the client; alternatives not yet researched. | R-08 |
| L-07 | Canvas aggregates over SharePoint are not delegated; non-delegable queries are silently partial. | Medium | Native operator dashboard totals (RPT-01) can be wrong without warning. | Pre-aggregated summary list; bounded date windows. | R-05; Q-16 |
| L-08 | Every Power BI viewer of a Pro workspace needs Pro; embedding does not change this; guests unsupported in the SharePoint web part; 8 refreshes/day. | Medium | One Pro seat = one HQ viewer; no operator viewing without a licence. | Native dashboard for Flavors (client preference RPT-02); budget seats for extra HQ viewers. | R-14 |
| L-09 | Stripe fee/loss/dashboard configuration is fixed when the connected account is created. | High | A wrong first configuration means re-onboarding the facility. | Decide and record Q-02 before creating any account, including in test. | R-09 |
| L-10 | Stripe invoice items added after a renewal invoice finalises roll to the next invoice. | High | Conflicts with "that month's overages on that month's invoice" for usage after the collection day (C-03). | Client chooses: next invoice, off-cycle invoice, or a cut-off before collection. | R-10; Q-06 |
| L-11 | Stripe Account Links are single-use, short-lived and must not be emailed. | Low | The operator "secure link" must be an in-app action. | In-app invitation that mints a link on demand (STR-07, [PROPOSED]). | R-10 |
| L-12 | The SPFx online workbench retires 2026-12-01. | Low | Debugging needs a real page on the tenant. | Dedicated dev site with synthetic data. | R-01 |
| L-13 | If the flow owner's Premium licence lapses, premium flows are turned off (as little as 14 days). | Medium | Stripe/sensor automation stops. | Licence monitoring; documented ownership in handover. | R-06 |
| L-14 | Client emails are not in the repository. | Medium | Requirements rest on summaries; exact wording unverifiable here. | Re-check originals for billing/cancellation/liability rules. | Q-00 |

## Potential risks (uncertain; need inspection, proof or a ruling)

| ID | [UNVERIFIED] risk | Sev. | Impact | Verification needed | Evidence |
|---|---|---|---|---|---|
| L-20 | Licensing of flows triggered by unlicensed guests through one Premium service account (multiplexing). | High | May require a Process licence or redesign. | Microsoft/partner ruling; keep member-facing flows standard-connector-only where possible. | R-06; Q-15 |
| L-21 | Column-level privacy and the "Item-level permissions" setting are not documented as security boundaries. | High | Private fields in a shared list would be readable (PLT-08). | Tenant test as a guest over REST; design assumes separate lists regardless. | R-03 |
| L-22 | Guest behaviour for SPFx asset loading and `AadHttpClient` tokens is undocumented. | High | The member portal or its backend calls might fail for guests. | Slice 1 tenant proof. | R-02, R-15 |
| L-23 | Stripe platform agreement and actual platform settings unread; pricing for the applicable country not obtained. | High | Liability allocation (STR-04) cannot be stated. | Account inspection with B Street HQ. | R-09; Q-02 |
| L-24 | "Enforce unique values" is only documented in 2010-era material. | Medium | Preferred booking arbiter may not behave as assumed. | Parallel-write test. | R-04 |
| L-25 | Entra External ID guest billing requires an Azure-linked tenant; free tier unverified. | Medium | Possible unplanned cost or setup step. | Check tenant and pricing page. | R-02 |
| L-26 | From February 2027 a Managed Environment requires premium licences even for standard apps. | Medium | Staff app on Business Basic could stop being covered. | Check the environment type. | R-06 |
| L-27 | Swift Sensors quota size and polling terms are not public; sign-in needs an email and password held server-side. | Medium | Budget and credential handling (SEN-04). | Private documentation; Q-01 host. | R-13; Q-12 |
| L-28 | Whether the developer's accounts hold SharePoint Admin, site-collection-admin and Application Administrator rights. | High | Blocks deployment and API approval. | Slice 1. | R-15 |
| L-29 | An unpaid applicant cannot reach a sign-in-protected portal page. | Medium | Pay-first enrolment needs an entry design. | Q-20. | — |
| L-30 | One developer; billing scope added after the eight-week estimate; requested dates unvalidated. | High | Schedule. | Re-estimate after slices 1–2. | Q-18 |

## Repository-level notes

| ID | Note | Status |
|---|---|---|
| L-40 | The SPFx starter contains a read-only calendar path built before the scope was narrowed to "minimal starter". It runs on invented demo data, is not deployed and is not tenant-tested. | Kept, flagged; developer to decide keep/strip. |
| L-41 | `npm install` reported 24 advisories (1 low, 23 moderate) in the SPFx 1.24.1 toolchain dependencies. | Not triaged; `npm audit fix --force` would break the pinned toolchain. |
| L-42 | `Avenue_Phase1_Complete_Module_SOPs.docx` was checked for XML validity and first-page layout only; it has not been opened in Microsoft Word. | Open and review in Word. |

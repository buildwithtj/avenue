# Eight-day development plan — INTERNAL ONLY

**Do not share with the client.** The Delivery Hub rule is that internal delivery targets never appear in client material; the client-facing timeline stays as written in the DKD scope documents.

Written 2026-11-11 (Wed, 20:00 IST). Replaces [TWO_WEEK_PLAN.md](TWO_WEEK_PLAN.md). One developer (Aman Raj) full time; Madhav Agarwal is project manager and client contact. Requirements come from [REQUIREMENTS.md](../REQUIREMENTS.md) as updated by the [11 Nov client call](../meetings/2026-11-11-client-call.md); question IDs refer to [DECISIONS_AND_OPEN_QUESTIONS.md](../DECISIONS_AND_OPEN_QUESTIONS.md).

**Status: day 1 done. Day 2 prepared offline (list definitions, provisioning script, runbook: [DAY2_RUNBOOK.md](../DAY2_RUNBOOK.md)); nothing has been run against a tenant.**

## Dates

Eight consecutive days, **Wed 11 Nov to Wed 18 Nov 2026**, with day 1 being today (planning only). If Sunday is not a working day, every day from day 5 moves one day later and the plan ends Thu 19 Nov. The weekly project review is Saturday 14 Nov at 11:00 IST.

## What eight days can deliver

**Goal:** a working Phase 1 pilot on the B Street test site, in Stripe test mode, with test accounts. It is good enough for an internal demo and for the client's test-flow review, but **not live**: live Stripe and the production operator invitation still need the client's approval (STR-06).

**In scope (in priority order):**
1. Member portal: equipment-based booking requests, dining room and private-event requests, hours bucket, cancellations.
2. Staff console: approval queue with equipment overlaps, under-24-hour cancellations, no-show credits, booking for a member.
3. Billing in Stripe test mode: monthly membership with chosen day 1–15, overage invoice as a balance due with the next payment, multiple payment methods.
4. Join flow: plan, pay first, guest invitation, document upload.
5. Compliance: document expiry, booking block on expired document or overdue balance, owner-only override.
6. Check-in: lead checklist and reminders; per-member wellness only if confirmed in scope (Q-10).
7. Notices, temperature display, basic operator dashboard.

**Out of these eight days:** B Street Power BI reports; staff phone layout; support ticketing beyond a simple request form; live Stripe and production go-live; training; migrating existing members and old tiers (needs the roster); temperature history retention tuning; anything multi-client.

**This is very tight for one developer.** Days 5–8 depend on the server, Stripe sandbox access and master data arriving on time. If any slip, items 6–7 drop first, then the join flow moves to staff-entered members.

## Decisions needed before building

| Needed by | Decision | Who | Default if late |
|---|---|---|---|
| Day 2 | **Staff console platform:** Power Apps canvas (agreed architecture; the Flavors owner and staff need Microsoft licences) or a second SPFx web part (no extra licence, shares the member code). Changing from Power Apps is an architecture change. | Madhav with DKD, then B Street | Stay on Power Apps |
| Day 2 | Access: who holds SharePoint admin on poweredbyavenue.com, a test site, test accounts (two member guests, a lead and a team member, staff, owner) | B Street via DKD | Days 2–8 slip |
| Day 2 | Exposed passwords changed and Swift Sensors key reissued (from the 6 Nov email) | B Street | Sensors work waits |
| Day 4 | Server from DKD for Stripe events and keys, and its cost (Q-01) | DKD / B Street | Days 5–6 billing slips |
| Day 4 | Stripe sandbox access on B Street's platform account (invite currently with TJ at DKD) | DKD | Billing slips |
| Day 3 | Master data: equipment list, dining tables/chairs, membership tiers and hours, overage rate (Q-04) | Samia | Build on placeholders |
| Day 5 | How the member pays Stripe fees: a separate fee line or built into the price. Card surcharges have card-network and state rules, and debit cards generally cannot be surcharged, so this needs checking before it is built. | Samia; legal check | Build without the fee line |
| Day 7 | Is per-member wellness in Phase 1 (Q-10)? | Samia / DKD | Lead checklist only |

## Day-by-day

| Day | Date | Build | Done when | Depends on |
|---|---|---|---|---|
| 1 | Wed 11 Nov | Read the 11 Nov call, update requirements, change register, open questions and schema contract, write this plan, list decisions. **No code.** | **Done 2026-11-11** | — |
| 2 | Thu 12 Nov **(non-admin part done 2026-11-11; see docs/evidence/day2-provisioning.md)** | Tenant check and foundation: test site, app catalog, guest sharing, test accounts. Deploy the existing SPFx starter. Provision lists by script: Equipment, Dining room, Plans, Members, Bookings (with equipment and people count), Hours ledger, private Documents library, Checklists, Notices. First privacy test: guest B cannot read guest A's records by URL or API. | Guest signs in and sees the web part; privacy test passes; list script re-runs cleanly | Access decision |
| 3 | Fri 13 Nov **(request form built and unit-tested 2026-11-11; intake flow to Pending booking built and tested 2026-11-11; hours bucket and deployment NOT done)** | Member booking: pick date and time and the equipment needed (stations removed); dining room with tables or whole room and number of people; private event requests the whole facility. Show equipment already requested at that time. Requests go in as **Pending approval**. Hours bucket shows hours used of the monthly allowance (no rollover). Apply branding if received. | A request saves as pending with its equipment; dining and private-event requests work; hours bucket reads correctly | Master data (else placeholders) |
| 4 | Sat 14 Nov **(approve/decline and calendar publishing built and tested 2026-11-11 as the automations account; emails, book-on-behalf, private-event blocking NOT done; see docs/evidence/day4-staff-approval.md)** | Staff console: approval queue showing each request's equipment beside overlapping bookings; approve, decline, or approve an overlap with a note to both members. Private event approval blocks everything else that day. Book on a member's behalf. Emails: management alerted on each request; member told when approved or declined. **11:00 IST review: demo days 2–4.** | Approve and decline work end to end; overlap approval records the note; blocked times refuse new requests | Staff platform decision |
| 5 | Sun 15 Nov **(cancel rule, ledger, no-show credit built and tested 2026-11-11/12; overage NOT done; see docs/evidence/day5-cancellations-hours.md)** | Cancellations and hours: 24+ hours member self-cancels and hours return; under 24 hours shows "Message management", which creates a request; management cancels and hours return; no-show credit button. Hours ledger counts approved time in the facility only. Overage: when an approved booking takes the member past the allowance, record the extra hours. | Every path returns or deducts hours correctly; repeat runs never double-count | — |
| 6 | Mon 16 Nov **(only the host-independent webhook core is built, apps/billing-core; everything needing the server, Stripe sandbox access and Q-02/Q-06 is blocked)** | Stripe test mode: connect Flavors' test account; monthly subscription on the member's chosen day; overage added as a pending invoice item on the next invoice and shown as balance due; enable cards, Apple Pay, Google Pay, Link and ACH; verified webhooks update Avenue; duplicate events ignored. Admin dashboard lists overages and balances. | Test payment appears on the connected account; overage shows as owed and lands on the next invoice; replayed event changes nothing | Server and sandbox access |
| 7 | Tue 17 Nov **(document upload, daily expiry check, expired-document block, owner override, checklists and staff screens built and tested 12 Nov; 3/2/1-hour reminders built and tested 12 Nov (docs/evidence/day7-8-emails.md); missed check-in nudge and staff follow-up built and tested 12 Nov (docs/evidence/day7-8-missed-checkin.md); payment-gated join NOT done; see docs/evidence/day7-8-staff-screens.md)** | Join and compliance: plan selection from the supplied tiers, pay first, guest invitation after payment; document upload with type, issue and expiry dates; daily expiry check; booking blocked by expired document or overdue balance; owner-only override. Check-in: lead checklist, 3/2/1-hour reminders, missed check-in alert to staff; per-member wellness if confirmed. | Unpaid applicant gets no access; blocked member is refused by UI and API; staff cannot override | Tiers; Q-10 answer |
| 8 | Wed 18 Nov **(notices, operator dashboard and "sign in to view" notice e-mail built and tested 12 Nov; temperature and staff-account tests NOT done)** | Notices with the generic "sign in to view" email; temperature display if the reissued key is available; basic operator dashboard (bookings, hours, overages, compliance). Full test with every test account; fix defects; write setup, deployment and rollback notes; prepare the Stripe test-flow demo and responsibility matrix for the client. | Test evidence saved; known issues listed; demo ready; logs updated | — |

## What changed from earlier plans because of the 11 Nov call

- **Automatic confirmation is replaced by management approval.** The double-booking proof (Q-03) is no longer a release blocker; staff now see overlaps and decide.
- **Stations are replaced by equipment.** The booking form, lists and prototype change accordingly.
- **No-shows and late cancellations return hours** instead of losing them.
- **Overages are owed, not charged at booking.** They are added to the next monthly invoice.
- **The dining room is a bookable space using hours**, and private events block the whole facility.
- **Stripe fees move to the member** and more payment methods are enabled.

The clickable prototype still shows the old model (stations, automatic confirmation, no-shows losing hours). It is not updated in this plan.

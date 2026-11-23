# Two-week development plan

> **Superseded 2026-11-11** by [EIGHT_DAY_PLAN.md](EIGHT_DAY_PLAN.md) after the 11 Nov client call. Kept for history.

Written 2026-11-11. Ten working days, Thursday 12 November to Wednesday 25 November 2026, one developer full time. Requirement, question and risk IDs refer to [REQUIREMENTS.md](../REQUIREMENTS.md), [DECISIONS_AND_OPEN_QUESTIONS.md](../DECISIONS_AND_OPEN_QUESTIONS.md) and [LIMITATIONS_AND_RISKS.md](../LIMITATIONS_AND_RISKS.md). The longer sequence is in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## What two weeks can and cannot deliver

**Goal:** a working booking slice on the real B Street tenant, with test accounts and synthetic data: a guest member signs in, sees the calendar, books, gets confirmed or sent to staff; staff resolve conflicts; an expired document blocks booking and only the owner can lift it.

**Not in these two weeks:** Stripe billing and invoices, pay-first onboarding, check-in/check-out and reminders, sensors, notices, dashboards and Power BI, B Street HQ screens, training. The whole of Phase 1 does not fit in ten days for one developer. A re-estimate for the rest is the last deliverable (Q-18).

**Assumptions.** If any is false, the affected days slip and the plan is re-cut on that day.

1. The build account has SharePoint Administrator and site-collection-admin rights (L-28). Checked on day 1.
2. Guests can load a custom web part and call SharePoint as themselves (L-22). Proved on day 1.
3. Two test guest accounts, one staff and one owner test account exist by day 1.
4. Synthetic catalog data is acceptable until Flavors supplies the real one (Q-04).

## Week 1 — foundation and proofs

| Day | Date | Work | Done when | Covers |
|---|---|---|---|---|
| 1 | Thu 12 Nov | Record tenant and site sharing settings. Create the test site and app catalog. Deploy the existing starter. Sign in as a guest on desktop and phone. | Guest sees the web part in demo mode. Settings and roles written down. | PLT-01, PLT-03, PLT-06; L-22, L-28 |
| 2 | Fri 13 Nov | Provision lists by script: facility, resources, calendar projection, bookings, members, role assignments. One private scope per member. Privacy test: guest B requests guest A's items by REST and URL. | Guest B is denied. Script re-runs cleanly. Evidence saved in `docs/evidence/`. | PLT-08, PLT-13; L-03, L-21 |
| 3 | Mon 16 Nov | Booking concurrency proof. Build the candidate (unique slot-key rows written by one service-owned flow) and fire parallel requests for the same slot. Try the fallback if it fails. | Exactly one confirmation per slot across 50 parallel attempts, or a recorded decision to use the code host instead. | BKG-05; Q-03, L-01, L-02, L-24 |
| 4 | Tue 17 Nov | Port the approved prototype design into the SPFx web part: shell, tabs, home, calendar timeline, phone layout. Read live lists. | Guest sees real list data on both layouts. Unit tests pass. Lists seeded with 5,000+ rows still page correctly. | BKG-02, PLT-04; L-04 |
| 5 | Wed 18 Nov | Booking request end to end: side panel, trusted commit, automatic confirmation or conflict record, calendar projection update, confirmation email. | A free slot confirms; an overlapping one becomes a conflict; a forged request for another member is rejected. | BKG-01, BKG-03, BKG-04, BKG-07 |

## Week 2 — staff side, rules and hardening

| Day | Date | Work | Done when | Covers |
|---|---|---|---|---|
| 6 | Thu 19 Nov | Power Apps canvas app: shell, role detection, Today screen, conflict queue with move or decline. | Staff resolve a conflict and the member sees the outcome. A confirmed booking is never overridden. | BKG-04, PLT-07 |
| 7 | Fri 20 Nov | Booking detail: extend, cancel with the 24-hour rule, late-cancel queue for staff, staff booking on a member's behalf with audit. | Late cancel cannot return its own hours. Every staff action records who did it. | BKG-06, BKG-08, BKG-09, BKG-10, PLT-09 |
| 8 | Mon 23 Nov | Eligibility at the commit point: expired document or overdue flag blocks booking. Owner-only exception with reason. Private document library with upload and a daily expiry flow. | Blocked member is refused through the UI and by direct request. Staff account cannot grant an exception. Another member cannot open the file. | BKG-14, BKG-15, CMP-01, CMP-02 |
| 9 | Tue 24 Nov | Stripe groundwork, sandbox only: if a host is approved, verify one signed test webhook; either way, inspect the platform settings and write the responsibility matrix. No connected account is created. | Matrix ready for the client. Signed-event proof, or a written hosting proposal with cost. | STR-04, STR-08; Q-01, Q-02 |
| 10 | Wed 25 Nov | End-to-end test with two guests, staff and owner. Fix defects. Record evidence. Demo. Re-estimate the remaining modules. | Test evidence saved. Backlog, decision log and changelog updated. Written estimate for the rest. | REL-02; Q-18 |

## Decisions needed, and by when

| Needed by | Decision | Who | If late |
|---|---|---|---|
| Day 1 | Test site, admin rights, four test accounts | B Street HQ | Everything waits |
| Day 2 | Real stations, equipment, hours and time zone (Q-04) | Flavors owner | Continue on synthetic data |
| Day 5 | Approval and budget for a server-side host (Q-01) | B Street HQ | Day 9 produces a proposal only |
| Day 8 | What "overdue" means and how long an exception lasts (Q-07, Q-11) | Flavors owner | Built as a manual flag and an open-ended exception, marked provisional |

## Main risks to the plan

- **Guest access (L-22).** If guests cannot load the web part, day 1 stops the plan and the member approach needs rethinking.
- **Concurrency (Q-03).** If no SharePoint-only arbiter passes, bookings must commit through the code host, which needs the day-5 approval and pushes days 5 to 8 back.
- **Licensing (L-20).** Flows triggered by unlicensed guests may need a different licence. The plan keeps member-facing flows on standard connectors; a ruling is still needed before production.
- **Canvas app speed.** Days 6 to 8 assume the staff screens are kept to lists and forms as designed.

## After these two weeks

In dependency order: pay-first onboarding and Stripe test flow with the client demo and approval gate; billing and usage invoices (blocked on Q-06); check-in, check-out and reminders (Q-10); sensors and notices; dashboards and Power BI; user acceptance testing, training and go-live. The day-10 estimate will say how this compares with the client's requested late-December training and 1 January launch.

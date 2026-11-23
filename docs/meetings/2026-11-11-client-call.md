# Client call — 11 November 2026

**Source:** Notion "Meeting @Today" (AI meeting notes, summary and transcript), https://app.notion.com/p/4153fad0b55c80c68550d1bbbad46e7e, and the Notion Avenue Delivery Hub. Read 2026-11-11.
**Attendees:** Samia Bingham (B Street HQ / Flavors), Tanishka Jain (Doubleklick Designs), Madhav Agarwal and Aman Raj (Polarein).
**Status:** client statements in a recorded call. Not yet confirmed in writing. Where they conflict with the earlier emails, the call is the later statement and is treated as current, subject to written confirmation.

**Not reviewed:** the Google Docs "Avenue – Client decisions log" linked from the Delivery Hub returned "not found" with this account. No other Avenue meeting exists in Notion (Meeting Logs — Avenue has one record).

## Decisions stated by the client

| # | Decision | Replaces | Requirement IDs |
|---|---|---|---|
| D1 | Booking is by **equipment, not stations**. There are about six prep tables and every company gets at least two. Cook stations "really don't have any value". | Station-based booking in scope and prototype | BKG-01, BKG-02 |
| D2 | **Hours are deducted only for time in the facility.** Equipment does not count against hours. | — | BKG-13, PAY-02 |
| D3 | **Management reviews and approves every booking.** Overlaps are judged by equipment. Two caterers are never in the kitchen together; a member who only needs, say, the mixer can be approved alongside another. Overlaps may also be approved when the first member is done with equipment before the second needs it; both members are told. | Email 3 auto-confirmation (5 Nov per the Delivery Hub) | BKG-03, BKG-04, BKG-05 |
| D4 | **Base membership is 10 hours per month, no rollover.** Tiers are on FlavorsCulinaryHub.com › Memberships. Some members are on older tiers (to discuss later). | — | BKG-13, ONB-01 |
| D5 | **Overages:** a booking beyond the month's allowance generates an invoice that shows as a negative balance on the member's account, due with the next monthly payment. **No charge at booking.** The admin dashboard must show it. Example: 10-hour member books 15 hours in November → invoice for 5 hours generated in November, due with the December payment. | Q-06 partly answered | PAY-02, RPT-01 |
| D6 | **Stripe transaction fees are paid by the member** with the membership payment. | Earlier assumption that the facility bears fees | STR-04, PAY-01 |
| D7 | **Payment methods:** as many as Stripe offers, including ACH, cards, Apple Pay and Google Pay. Today two systems are used (Engage for auto-pay, another for cards); Avenue should replace both. | Cards only | PAY-01 |
| D8 | **Cancellations:** 24+ hours ahead the member cancels and hours return. Under 24 hours the member cannot cancel and must message management in Avenue; management cancels and returns the hours. **No-shows are credited back** unless a member abuses this. | Email 6 (no-shows lose hours; late cancels at staff discretion) | BKG-09, BKG-12 |
| D9 | **Dining room** can be booked instead of the kitchen, using member hours: pickups, team meetings, tastings. It seats about 60; a member books some tables or the whole room and states how many people are coming. A **private event books the entire facility**: nothing else can be booked. | Q-22 partly answered | BKG-11, new |
| D10 | **Check-in (preference, not final):** one lead completes the kitchen checklist; every team member does the wellness check on their phone. The team said it would "try to incorporate it as a feature if possible". | Every team member does the full check-in | CHK-01, CHK-02 |

## Action items

| Owner | Action | Due |
|---|---|---|
| Madhav / Tanishka | Prepare the master-data list and share with Samia: spaces and equipment, member roster, people and logins, compliance documents and reviewers, dining-room tables and chairs. Built as the Google Sheet "Avenue Phase 1 – Information Needed from B Street & Flavors"; whether it has been sent is unconfirmed. | Not stated |
| Samia | Send logo and branding (logos, colours, possible new logo). | 12–13 Nov |
| Samia | Send memberships page link and tier details. | Not stated |
| Team | Check which payment methods Stripe supports and enable as many as possible. | Not stated |

## Open questions raised

1. Overage hours when a member stays longer in person without updating the booking: who records the extra time?
2. Do the 15-day / 7-day deposit rules apply to private events? What does a private event cost?
3. Is the all-member wellness check-in in Phase 1 scope?
4. How are members on old tiers mapped to current plans?
5. Prep tables: are they booked (two per company minimum), or only noted?
6. Storage rentals: in Phase 1 or not? (Delivery Hub)
7. Staff app: Power Apps (needs licences for the Flavors owner and staff) or an SPFx staff console. Internal decision with DKD. (Delivery Hub)
8. Who owns the DKD-provisioned servers, keys and credentials after delivery? (Delivery Hub)

## Other facts recorded in the Delivery Hub

- Tenant: poweredbyavenue.com. Accounts: admin@ (Samia), developer@ (Power BI Pro), automations@ (Power Automate Premium); 3 × Business Basic.
- Servers and hosting are provisioned by DKD. This answers who hosts (Q-01 in part); cost and service type still to confirm.
- The Stripe Connect invite went to TJ at DKD. Build in test mode first.
- Samia's 6 Nov email contained passwords and the Swift Sensors API key in plain text. They should be changed and the key reissued.
- The internal delivery target is internal only and must not appear in client material.

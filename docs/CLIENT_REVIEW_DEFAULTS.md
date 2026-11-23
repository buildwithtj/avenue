# Defaults built without a client answer — review with the client

Written 21 Nov 2026 (Saturday) for the Monday delivery. The developer asked to build the recommended answer to each open question now and to confirm or change each one with the client afterwards. **Every item below is `[PROPOSED]` and test mode only (Stripe sandbox, STR-06 not given).** The "To change it" column says what changes if the client answers differently.

## Q-M1 to Q-M6

| ID | Question | What is built (default) | Why | To change it |
|---|---|---|---|---|
| Q-M1 | 3% card fee | Two Stripe prices per current plan: **bank (ACH) at list price**, **card at list + 3%**. The member picks the method on the last join step; Checkout is limited to that method and shows a fee note before payment. Legacy plans: one price (fee already included, per the sheet). | US rules: surcharge on credit cards only, max 3%, disclosed; ACH is not a card. | Fee on all methods: drop the bank price. Fee built into price: one price per plan. **Known gap:** Stripe cannot refuse debit cards on the card price; a debit card would also pay +3%, which card rules forbid. Client and their adviser must decide. |
| Q-M2 | Public join page | Built on the Avenue server at `/join`, on in test mode. Staff-started join (signed-in guest uses the portal Join wizard) also built. | Lets the Monday demo show both doors. | Switch off with `JOIN_PUBLIC=0` on the server; portal door stays. |
| Q-M3 | Automatic guest invite | **Not automatic.** After a public-door payment the applicant shows "Invite needed" in the staff Applicants queue; an admin sends the SharePoint guest invite by hand. | Needs tenant admin consent for Graph `User.Invite.All`, not available. | Grant the permission and add the app credentials on the server; the host then invites and sets the stage itself. |
| Q-M4 | Unpaid application lifetime | Stripe payment link lasts 24 h (Stripe maximum); a new one is made on retry. An application unpaid after **14 days** is shown as Expired. | — | Change `APPLICATION_DAYS` on the server. |
| Q-M5 | First payment | Pay at sign-up a **prorated amount up to the chosen collection day**, then the full plan price on that day every month (Stripe Checkout with billing-cycle anchor and proration). | Meets "pay before onboarding" (ONB-03) and fixes the monthly day (ONB-02). | Full month now: no proration. First charge on the day: needs a trial until the day (then payment is not before onboarding). |
| Q-M6 | Team wellness check-in | The lead adds each team member's name and answers that person's 3 wellness questions on the lead's own phone; each person is recorded as a separate Wellness check-in. No extra guest accounts. | No extra sign-ins or licences. | Own sign-ins: invite each person as a guest; the same screen then works from their phone. |

## Other assumptions made while building (also to confirm)

| Area | Default built | Related question |
|---|---|---|
| Overage billing | Extra hours of a calendar month are added once to the **first renewal invoice after that month ends** at the plan's extra-hour rate (+3% if the member pays by card). Hours reset on the 1st for everyone. | Q-06, sheet Q10 |
| Overdue | A failed payment marks the member **PastDue** at once (Stripe's own retries still run); new bookings are refused until paid. Owner can set "Owner override" in the staff app. Stripe's late fee is not added automatically ($99 rule is shown, not charged). | Q-07, BKG-14 |
| Overdue override | The staff app shows the override button to the owner only, but SharePoint lets staff edit the member row too (same gap as today's list permissions). | Q-15 |
| Rejected applicant | Staff mark Rejected; any refund is done by the owner in Stripe by hand. | Q-05, Q-02 |
| Approval after payment | Paid applicants become **Onboarding** (documents, no booking); staff press Approve to make them **Active**. | Q-05 |
| Deactivation | Cancelling a membership in the staff app cancels the Stripe subscription **at the end of the paid period**; history kept. | Q-14 |
| Private events | Staff create the event invoice: **$500 deposit due now**, package balance due 30 days before the event (or now if the event is under 30 days away). Refunds by hand. Prices from the sheet's member / non-member packages. | Q8, Q9, Q-22 |
| Existing members | Import script, dry run first; first invoice sent by e-mail (Stripe) on the member's collection day in January, member then saves a card or bank in the Stripe portal. Needs the "Current Members" file. | Q-21, Q-25, sheet Q11/Q12 |
| Payment methods | Card (incl. Apple Pay and Google Pay where the device offers them) and US bank account (ACH). | PAY-07 |
| Plan ids | SharePoint `AvenuePlans.PlanId` = the sheet plan name in lower case (as the portal's price table already uses). **Done live 21 Nov:** the 10 existing legacy and mobile rows were renamed from short ids (for example `mobile-10`, `legacy-emerging-10a`) to the sheet names (`mobile kitchen-10`, `legacy: emerging-10a`); only `demo-plan-std` was referenced by any member, so nothing broke. `demo-plan-std` is now closed to new members. | Q-04 |
| Not built (blocked) | Sensors (no Swift key, Q-12), storage rental (Q-25), support tickets (Q-13), staff permission sets (Q-15), checklist question text (attachments not received, Q-10), automatic overstay billing from check-out time (Q-23). | — |

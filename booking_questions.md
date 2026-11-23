# Booking and communication: open questions and assumptions (20 Nov 2026)

Everything below is already implemented with the default shown. Change any answer and I will adjust. Source for client facts: the master-data sheet, see docs/CLIENT_SHEET_BOOKING_DATA.md.

| # | Question | What is implemented now |
|---|---|---|
| 1 | Private event: does it block the kitchen as well as the dining room? The rates say "dining room only", the pricing rows say "blocks kitchen + dining room". | Blocks both (whole facility), as the pricing rows say. |
| 2 | Private event packages 4/6/8/12 h and prices: should the member pick a package and see the price? | Shortest booking is 4 hours (screen rule); the packages and $500 refundable deposit are shown as information. No price is calculated or charged (Stripe stays in test mode). |
| 3 | Refunds: the text says the deposit is lost if cancelled under 30 days, the sheet columns say 15+/8–14/under 7 days. | Not implemented (billing, Stripe test mode). |
| 4 | New-member rollover (first 2 months): needs a member start date, and the members list has none. | Not implemented. Plan hours reset monthly with no rollover. |
| 5 | Hours reset on the 1st for everyone, including members who pay on another day? | Calendar month for everyone. |
| 6 | Expired documents block new bookings: only one member has documents on file. | The existing flow declines a request from a member whose document is expired; members with no documents on file are not blocked. |
| 7 | Reminder lead times (the sheet says "an alert when reminded about an upcoming booking"). | Bell alerts 24 hours and 1 hour before an approved booking starts. No e-mail or text reminders. |
| 8 | The 1-hour gap: should the approval flows enforce it, or only the Book page? | Book page keeps 60 minutes (30 entry + 30 clean-up) free around other bookings on the same equipment; the flows still decide by approval. |
| 9 | Plan mapping for legacy plans (Emerging-10A–E and Mobile Kitchen-10A–D prices/counts) and the real member list (the "Current Members .xlsx" was not in the sheet). | 18 plans loaded with hours and extra rate. Real members not loaded; five test members remain. |
| 10 | Max companies in the kitchen: 2 by fridge count. | Each equipment booking gets one of the 2 fridges automatically, so a third company is refused. |
| 11 | Outside guests booking private events: through Avenue or by staff only? | Members only. |
| 12 | Whole-kitchen booking: should it be limited to one booking at a time, and is it charged hours? | Blocks all equipment, prep tables and fridges; uses plan hours like any booking. |

## Compliance and payments (20 Nov)
| # | Question | What is implemented now |
|---|---|---|
| 13 | Late fee: the sheet says $99 "not made by their due date" but also a grace to the 5th for 1st-due members. Is the fee charged after the due date or after the 5th? | Shown as "a $99 late fee applies after the due date"; the 5th is shown as the latest safe day. Nothing is charged. |
| 14 | Card fee: 3% on every electronic payment. Does ACH carry it? | 3% shown on all current plans; legacy plans already include it. |
| 15 | Extra hours: the sheet says "invoice at booking" (C-10) but the call said no charge at booking. | Shown as an estimate billed with the next payment; nothing at booking. |
| 16 | Team-member food handler cards: one upload per person or per business? | One card at a time, repeatable; no per-person tracking yet. |
| 17 | Workers' comp "or waiver": one document type or two? | One type, "Workers comp or waiver". |


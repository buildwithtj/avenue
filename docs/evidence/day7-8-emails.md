# Days 7–8 evidence: reminder and notice e-mails (2026-11-12)

Approved by the developer in chat ("Yes, create it"): Office 365 Outlook connection "Avenue mail (automations)", owned by automations@poweredbyavenue.com. Mail is sent from that mailbox. Expressions: `flows/expressions.md`.

## Built
1. **Avenue - Booking reminders 3-2-1 h** (e5bb9dc5-48c5-4545-8415-459f1505e3da). Runs every 15 minutes with concurrency 1. For each approved booking starting within 3 h, it works out which reminder is due, marks it in `RemindersSent` before sending (at most once), and e-mails the member the start time in Eastern time plus the portal link.
2. **Avenue - Notice e-mail (sign in to view)** (d89ad065-dc16-4bc4-8135-b9f98f680b52). Triggers when an active notice is created. It e-mails all active members of the facility in a single message with the members in **BCC**. The e-mail is generic and never contains the notice text. A parallel browser agent built it, and a second agent checked it read-only against the spec (no mismatches).

## Verified live (all mail went only to automations@, the only address in the test data)
- **Reminder flow:**
  - Booking starting in 50 min: `RemindersSent` = "3,2,1" and one e-mail, "starts at 2:34 AM" (07:34 UTC, correct for Eastern).
  - Booking starting in 150 min: `RemindersSent` = "3" and one e-mail, "starts at 4:14 AM".
- **No duplicates:** a scheduled run fired at the same minute as the manual test, and a manual re-run followed two minutes later. All three runs succeeded, and the inbox still held exactly 2 reminders, with `RemindersSent` unchanged.
- **Notice flow:**
  - With one active test member, publishing an active notice gave one run and one e-mail ("New notice from Flavors Culinary Hub", Bcc set, no notice text).
  - Publishing an inactive notice gave no run.
- **Cleanup:** all test rows went to the site recycle bin: 2 bookings, plus the 2 calendar rows and 2 hours-ledger rows the other flows created for them, 1 member and 2 notices. The test e-mails stay in the automations@ inbox.

## Known limits / open
- Late-approved bookings get only the reminder that is currently due, with no catch-up. This is [PROPOSED] until client question 35 / Q-10 is answered.
- A reminder whose send fails is not retried, because the "sent" mark is written first. That avoids duplicate sends but can lose a reminder (CODEX_PROJECT_CONTEXT §9: do not promise exactly-once).
- Deactivated members: the reminder flow does not check member status. Deactivation (ADM-04) must cancel future bookings, which then stops their reminders.
- Missed check-in alert to staff (CHK-04) is not built; its grace periods are open (Q-10).
- A notice e-mail can carry at most 500 recipients per message.
- The sender is the automations@ mailbox. A branded sender or shared mailbox is a client choice.
- Not tested with a real guest member's mailbox (no guest accounts yet).

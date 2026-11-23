# Day 8 evidence: extra time (BKG-08) and overlap note to other members (BKG-04), 2026-11-12

Built:
- Fields: `AvenueBookingRequests.ExtendBookingId`. `AvenueBookings`: ExtensionTo, ExtensionRequestedAt, ExtensionRequestId, ExtensionConflict, ExtensionDecision, ExtendedBy, ExtendedAt, OverlapNotified. Schema has 130 fields.
- Flows "Avenue - Extension request", "Avenue - Extension decision" and "Avenue - Overlap note to other members", plus a trigger guard on the request flow. Each was built by a browser agent and independently reviewed (no mismatches). Two builds hit a network error and were resumed; the existing flows were finished, not duplicated.
- Portal: "Ask for more time" on My bookings, and the status of extra-time requests. An approved extension moves the displayed end. 43 unit tests pass (5 new).
- Staff app, Approved screen: extra-time request list with the overlap warning, Approve/Decline, and "Extend now" for staff or the owner.

Verified live (all mail to automations@ and its plus-address automations+other@), 13:25–13:31 UTC:

| Case | Result |
|---|---|
| Member asks +60 min on own booking that has an overlapping booking | Pending; "1 approved booking(s) overlap the extra time"; member sees "Extension requested"; staff e-mail |
| Member asks to extend someone else's booking | "Not accepted: …"; nothing changed |
| Extension request item | No booking created from it (request-flow guard) |
| Staff approves in the app | End moved 13:55 → 14:55 UTC; calendar updated; ledger +1 h (key test-ext-1-ext-test-ext-req-1); "Extension approved · now ends 9:55 AM"; member e-mail |
| Staff "Extend now" on another booking | End 14:40 → 15:10 UTC; calendar updated; ledger +0.5 h; member e-mail |
| Second request on the same booking, declined | Accepted as Pending (allowed after the first was decided); decline left the end unchanged and added no ledger row; "Extension not approved"; e-mail |
| Approved booking with a staff note overlapping another member's booking | One "Another booking overlaps yours" e-mail to the other member only; OverlapNotified = yes |

Cleanup: 14 test rows went to the recycle bin; StaffAlertEmail cleared.

Limits:
- Cancelling a booking after an extension credits only the original hours, not the extension. This is rare, because extensions happen at the end of a session.
- The staff app's overlap preview for "Extend now" uses the app's cached data; press Refresh first.
- Extensions stay on the same day (no past midnight).

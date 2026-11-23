# Demo scripts per release wave

> **Audience (clarified 14 Nov):** the developer builds everything at their own pace and shows it, module by module, to **B Street HQ**, who commissioned and own Avenue. Only the developer decides what is released (`release/release.json`); nobody at B Street or Flavors can switch modules on or off. Where this document says "the client" it means B Street HQ; Flavors staff and members see only what B Street later approves for go-live.


[PROPOSED] Written 14 Nov 2026 for the waves in [RELEASE_PLAN.md](RELEASE_PLAN.md). Each script is about 15 minutes, uses a member account for the member side and a staff account for the staff side, and ends with what is real and what is not. Run [TEST_CHECKLIST.md](TEST_CHECKLIST.md) for the wave first. Say out loud before each wave: "sample data" or "real data".

## Wave 1: Booking and Calendar
1. **Member (phone):** open the portal; Home shows next booking or "Book kitchen time". Tap Book time, choose equipment, date, start and end, submit.
2. **Point out:** the request shows "being checked", then Pending with a plain-language outcome (the flow re-validates; the page never decides).
3. **Staff (desktop):** Requests shows the same request within about a minute. Approve it. Approved list shows it.
4. **Member:** Bookings shows Approved. Open Facility calendar: the booking is on it, other members' bookings show without names.
5. **Try to break it (shows the rules work):** request an overlapping time or a past date; the outcome explains why not.
6. **Real vs not:** bookings, approvals and calendar are live. Not in this wave: documents, check-in, billing.

## Wave 2: Documents and Compliance
1. **Member:** Documents lists required documents with state (valid, expiring, expired).
2. **Staff:** Compliance shows a member with an expired document; booking is blocked for that member (Home shows "Renew your ...").
3. **Member:** upload or submit the renewed document; it shows "being reviewed".
4. **Staff:** verify it; the block lifts on the next booking attempt.
5. **Owner only:** the compliance override; show that a non-owner cannot use it.
6. **Real vs not:** document types are still to be confirmed (Q-11). Staff-side upload control is not built.

## Wave 3: Check-in and Notices
1. **Member:** with an approved booking inside the next 24 hours, open Check-in, answer the entry checklist, send; it shows "Recorded".
2. **Point out:** a "No" answer is shown to Flavors but has no automatic consequence.
3. **Staff:** Check-ins shows the record; Checklist edits the questions (Q-10 confirms the wording).
4. **Staff:** post a Notice. **Member:** the notice appears on Home and in Notices.
5. **Real vs not:** no e-mail or SMS is sent; notices are in-app only.

## Wave 4: Hours and billing view
1. **Member:** Billing and My membership show plan, hours used and left, and collection day.
2. **Staff:** Settings, Setup (plans, equipment, hours adjustments) and Reports (booked hours).
3. **Say clearly:** Reports show booked hours, not attended hours (Q-16). Invoices and payment status show "not connected" until Stripe is connected; no real charge exists.
4. **Real vs not:** hours are real; money is not.

## Wave 5: Payments, Sensors, Applicants, Permissions, Support
Not for the client until the matching integration or decision exists (Stripe Q-01/02/06, Swift Q-12, Q-05, Q-15, Q-13). If shown earlier, say "demo only" on every screen and show nothing as live.

## After every demo
Write down what the client said that changes a rule, and log it as a question or decision with the date. Do not promise dates for anything not built.

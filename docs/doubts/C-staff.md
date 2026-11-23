# Doubts: builder C (staff app), 23 Nov 2026

Built, not pasted or published: `support`, `events` (new, Screen21), `storage` (new, Screen22), `permissions`, `reports` screens plus the More hub. `python3 check.py` is OK (1445 controls, 22 files). Compliance, Payments, Members and every other existing screen are byte-identical to before; only `more.pa.yaml` differs. Nothing below was run in Power Apps Studio.

## Cannot be verified without Studio (paste, then press App checker > Recheck all)
- Every formula was written to Studio's rules learned today (bare `AddColumns` names, no text `<`, `Patch` on `LookUp` records, no `ForAll`+`With` records) and bracket-linted offline, but none has been seen by the real checker. Expect delegation warnings only. A red mark right after paste can be a name defined later in the same screen (the collection `colRepM`); Recheck all clears it.
- Reports: `GroupBy` then `AddColumns(..., N, CountRows(Rows), H, Sum(Rows, Hrs))` follows the shape already used on the Dashboard, but `colRepB`/`colRepM` are new collections built by a 600 ms timer; if the tiles show 0 for a moment after opening, that is the timer, press Refresh.
- Choice columns are assumed exactly as the contract lists them (`Status`, `Category`, `Package`, `Item`, `Kind`); a Text column instead of Choice would turn `.Value` into an error on all five screens.
- `Title` is set when staff create rows (`AvenueHostRequests`, `AvenueStaffCapabilities`) because SharePoint's Title is required by default; if the provisioning makes Title optional the extra value is harmless.
- `Match.Email` in `IsMatch` is reused from the Payments screen (already live); not new.

## Assumptions
- Support: a reply is written to `AvenueSupportCases` only. Nothing in this build tells the member except the (unbuilt) echo flow: "The member sees it in the portal" assumes that flow exists. Suggested question: should staff replies also send a generic "sign in to view" e-mail (COM-02 allows it)?
- Support: the screen shows only the member's LAST message (`LastMessage`); earlier messages of a thread are not shown because the contract keeps one case row per thread. Question: is a full thread history needed on the staff side?
- Events: the quote field is recorded in `QuoteCents` but the invoice is created by the server from its own sheet price table; editing the quote does not change the invoice amount. The screen says so. Question: should the server accept a quote override (extra hours, non-sheet add-ons)?
- Events: Approve patches the case, then creates one `AvenueHostRequests` item (kind `EventInvoice`, `member:true`). If the request is created but the server refuses (past date, bad package), the case already says Approved; the outcome text shows the refusal but the status does not roll back. Approve is disabled for a past event date to reduce this. Question: should a refusal reopen the case automatically (needs a flow)?
- Events: "Mark invoiced" is manual; no code reads the host's result to set `Invoiced` or `InvoiceId` (the host returns a link, not an invoice id, in its outcome). `InvoiceId` is never written. Question: link the invoice by e-mail/date, or just track by hand?
- Events: the event date is shown and sent in Eastern (facility) time with the existing `f_local` helper. If the portal stores a date-only value as midnight UTC, the day could display one day earlier. Needs the portal builder's storage choice (see A) or a test row.
- Events: only member packages are used (member rate, `member:true`); non-member events are not created from this screen (the Payments screen already has a form with a member toggle). Question: should this screen allow a non-member (guest) event?
- Events: refund and cancellation (8-14 days, under 7 days, boundaries) are not built, only described in the screen text (Q8, Q9, Q-08, Q-22).
- Storage: the sheet's prices are ambiguous (single vs double unit, "per door" vs "per unit"), so the screen shows them as a reference note and the owner types the monthly amount; no price table drives anything. Billing is by hand; no Stripe object is created. Question: confirm the exact storage price list and whether storage is Phase 1 at all (Q-25).
- Permissions: the contract has no `Active` column, so "deactivate, not delete" is implemented as every capability off plus a Note ("Deactivated by ... on ..."); the row stays. A separate Active flag would be cleaner. Question: add `Active` to `AvenueStaffCapabilities`?
- Permissions: nothing reads these switches yet. The staff app does not hide buttons by capability anywhere, and SharePoint lets staff edit lists directly, so this is a record, not enforcement (Q-15). The capability set (7 items) is proposed. Question: which actions must the owner be able to withhold from the restricted staff account?
- Permissions: owner = the two owner e-mails hard-coded in `gen.py` (same rule as the payment override and sensor settings); a different owner login would not see the editor.
- Reports: "bookings per month" groups by `Text(StartUtc, "yyyy-mm")`, which uses the device clock, not the facility clock; a booking near midnight on the 1st may count in the wrong month. Hours-by-member uses the facility month (existing helper). Question: is a day boundary at midnight Eastern acceptable, or must months match billing periods exactly?
- Reports: no utilisation percentage: the denominator (open hours, equipment available, member capacity) is undefined (Q-16), so the screen shows bookings, booked hours and hours per booking only. Booked hours are not attended hours (a note says so).
- Reports: last-6-months window is 190 days from now, so the oldest month can be partial. Equipment usage counts bookings whose `EquipmentIds` contain the unit; a fridge assigned automatically to every booking will show near-total hours.
- Reports reuse the Payments screen's invoice macros (`INV`, `OVERDUE`, `MONEY`, `MS`, `NM`) as values only; the Payments screen's output is unchanged (verified byte-identical).

## Release plumbing
- `release/release.json` gains `support`, `permissions`, `reports`, `events`, `storage`. `release.py` renamed the old `reports-demo` module to `reports`; nothing else referenced it. The More hub now has 9 cards.
- `check.py`: DEMO_SCREENS is now empty (Sensors, Applicants, Support, Permissions, Reports are real); only `permissions.pa.yaml` must still mention Q-15; nav targets extended to Screen22; four data sources added.

## What could affect a frozen module
- Nothing found: Compliance, Payments and Members files are byte-identical. Adding modules to `release.json` could in principle turn a `Navigate(Screen15/17/18)` link on a frozen screen from a no-op into a real link; none exists (verified by the byte comparison).
- The More hub (`more.pa.yaml`) is the only existing screen that changes. Pasting it replaces the live hub: it keeps Setup, Payments, Sensors, Applicants and adds Support, Permissions, Reports, Events, Storage.

# Doubts: member portal (builder A), 23 Nov 2026

Build 2.14.0.0, not uploaded, not deployed. 358 tests pass. Nothing here was run against a live site, a guest account or a phone. Each line: the doubt, then a suggested question or check.

## Not verified without a live site
- No screen was seen in a browser, in the SharePoint debug preview, at 390 px, with a screen reader, or with reduced motion on; only jsdom tests ran. Check: open each new screen in the debug preview as a guest before upload.
- The four intake lists (`AvenueSupportMessages`, `AvenueEventRequests`, `AvenueStorageRequests`, `AvenueTeamMembers`) do not exist on the live site yet. If a tab is opened before they exist, the view shows the SharePoint error text with no retry button (the reads reject rather than return an empty list). Check: create the lists first (builder B's schema), then test.
- "Own items only" relies on item-level permissions and the `AuthorId` filter, the same as the other intake lists. Not tested with two real members. Check: a second guest must not see the first guest's messages by direct URL.
- No Power Automate flow exists for any of these lists, so `Outcome` and `Reply` stay empty on a real site until the six specified flows are built. The screens then show "Waiting for Flavors." Check: confirm the flows before telling members these features work.
- Team removal updates the member's own item (`Active = false`). Whether a Contribute-with-own-items member can edit their own item on an item-level-secured list is the same assumption the existing compliance flag and document writers make, but "update" (not "add") is untested live. Check: test Remove and Bring back as a guest.

## Release flags
- `release/release.json` (changed by another builder after my first build) lists `support`, `events` and `storage` but **not `team`**. In a real (non-demo) build the Messages, Event request and Storage screens are therefore ON and My team plus the wellness name prefill are OFF. Demo mode shows all four. Question: should `team` be added to `release/release.json` when the others are deployed?
- A module absent from `release.json` is hidden from the drawer and unreachable, but its code ships in the bundle. Fine, but it means turning a module on needs a new build and upload.

- The "hidden in a real release" drawer test now asserts only `My team`, because `release/release.json` changed under it (it failed once at 357/358 when `support` was added). It will need updating again if `team` is listed.

## Support (Messages with Flavors)
- A thread is identified by `ThreadId` (the first message's id). Staff must echo the reply onto the member's newest item for the "Reply received" dot to work; a reply echoed onto an older item is still shown in the thread but does not raise the dot. Question for the flow design: always echo onto the newest message of the thread.
- "Reply received" has no read state. It stays on until the member writes again; there is no "mark as read". Question: is that acceptable, or add a `ReadAt` column?
- The reply box is capped at 2000 characters like a new message; attachments are not supported. Question: do members need to send photos (for example of broken equipment)?
- No reply time is promised and no contact e-mail or phone is shown (Q-13, Q-P1). Question: what should the screen say about when to expect a reply?
- Messages from members with a hold or an overdue payment are not blocked. Question: should support always stay open for them? (Built: yes, always open.)

## Event request
- Prices are the sheet's **member** package prices. Non-member events are staff-entered; the portal never shows them.
- The sheet says "$500 refundable deposit" and a separate package price. I treat the deposit as **in addition to** the package price (as the host's `EventInvoice` does), not included in it. Question: is the $500 deposit on top of the package price?
- "Balance due 30 days before the event, immediately if booked less than 30 days before" is shown as written. For an event exactly 30 days away the balance is due today. Question: is "30 days before" counted from the event start date?
- No refund or cancellation text is shown (8-14 days and under 7 days are open, Q8/Q9). Question: what should members be told about cancelling?
- Extra hours are shown at $100 each, but the form cannot ask for extra hours, so any extra time is a note. Question: should the form ask for a start time and end time?
- Package hours (4/6/8/12) are not checked against the date or against bookings; a private event blocks the whole facility (BKG-17) but the request does not check the calendar for clashes. Question: should the form show whether the date is free?
- Guests are limited to 1-60 (the 11 Nov call said about 60; the sheet says 50 seats with the current set-up). Above 50 the screen says Flavors quotes extra seating. Question: confirm 50 or 60.
- The date is stored as noon UTC so no time zone can move it a day; there is no start time at all.
- Dates use `<input type="date">`; very old browsers show a text box (validation still rejects bad dates).

## Storage
- Priced: half-door fridge or freezer $250 per door per month; full-door fridge or freezer $400 per door per month; daily dry $50 and daily cold $75 per shelf per day. **Not priced** ("price on request"): dry shelf single and dry shelf double, because the sheet gives two numbers per size ($250 / $135 and $450 / $235) without saying which is which.
- Full-door is shown at $400 per door, but the sheet also says "$700 per unit". The screen adds that note. Question: is a full unit $700, or $400 per door?
- Daily items are "per shelf per day"; quantity means shelves, not days, and the form has no start or end date. Question: should a daily request ask for dates?
- The estimate multiplies price by quantity only; no tax, no proration, no minimum term. It is labelled "About" and "before Flavors confirms".
- Availability is not checked (no unit inventory exists). Question: how many doors and shelves exist?

## Team roster
- Roles are Lead and Member only; more than one Lead is allowed and nothing enforces one Lead. Question: should exactly one Lead be required (CHK-02)?
- "Remove" only deactivates (the writer interface has no delete); removed people can be brought back. Nothing is ever deleted, so a member cannot erase a name.
- The roster only prefills the wellness names; it grants no access and is not shown to staff in this build. Question: should staff see each member's team?
- Wellness names are prefilled once when the check opens; a name removed for "today" in the wellness screen is not removed from the roster.
- Personal data: team names are personal data. Retention and deletion are unanswered (Q-14).

## Profile drawer
- Rows added: Account → Event request, Storage, My team; Help → Messages with Flavors. The drawer now also reads the member's support messages when it opens (one more request) and treats any failure as "no reply".
- The existing drawer tests mock a source without the new methods; the drawer guards with `typeof ... === 'function'`, so an old mock or a source built before this version still works. Real `AvenueReadSource` always has them.
- Opening a deep-linked screen whose module is off is not possible (the tab is refused); there are no direct URLs for the new screens.

## Existing test changed
- `ConsoleScreens.test.tsx` "schedule › shows the board…" failed after 18:00 UTC because the demo sample bookings end at 18:00 UTC and the unit then reads "Free for the rest of today". I added that text to the accepted pattern (comment in the test). It was already time-of-day dependent before this build; not caused by these changes. Question: replace it with a fixed clock in a later clean-up?

## Not touched on purpose
- Frozen: `DocumentsView.tsx`, `ComplianceWizard.tsx`, `compliance.ts`, `BillingView.tsx`, `JoinView.tsx`, `WelcomeView.tsx`. The drawer's Member Onboarding "Getting started" block is unchanged.
- `release/delivery-1-member-spfx.sppkg` is the 21 Nov file; the new package is only at `apps/member-spfx/sharepoint/solution/member-spfx.sppkg` (2.14.0.0).
- The 4 existing lint warnings (CalendarView, feedback, ProfileDrawer null, LEGACY_HEAD unused) are unchanged.

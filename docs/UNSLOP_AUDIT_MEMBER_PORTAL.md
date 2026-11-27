# Unslop audit: member portal copy and view

Check mode only; no source file was changed. Date: 27 Nov 2026.

- **Method:** the unslop skill (`.claude/skills/unslop`, MIT) in its product-UI-microcopy register.
- **Sources read:** ~1,350 user-facing strings pulled from `apps/member-spfx/src`, and the rendered text of the deployed staging page.
- **Staging build:** 1.8.0.0, bundle `01310b49`.
- **How it was read:** signed in as `automations@`, an Active member with demo data, at desktop width, plus a 412 px frame for Home, Bookings, Book, Schedule and the More sheet.
- **Not read:** TDDAdmin's own view, because that browser's session had expired.
- **Not opened:** the Profile sheet was read at desktop width only. Join, Welcome and Inactive were not opened; they were reviewed from source only.

## Summary

| Severity | Copy (source) | View (rendered) | Total |
|---|---|---|---|
| P0 trust breakers | 1 | 3 | 4 |
| P1 clear tells / inconsistencies | 9 | 5 | 14 |
| P2 polish | 9 | 3 | 12 |

The word level is clean: no tier-1 vocabulary (seamless, leverage, unlock, elevate, journey, etc.), no chat artefacts, and no em or en dashes left in UI strings after 1.8.

The problems are structural and view-level:
- the same promise repeated on one screen;
- one action under several names;
- dev or test artefacts visible to members;
- facts that disagree between screens.

**Findings by page:**

| Page | Count | Severities |
|---|---|---|
| Home | 5 | P0 ×2, P1 ×2, P2 ×1 |
| Book | 5 | P1 ×4, P2 ×1 |
| My bookings | 3 | P1 ×1, P2 ×2 |
| Check in | 3 | P0 ×1, P1 ×1, P2 ×1 |
| Documents | 2 | P0 (shared), P2 ×1 |
| Billing | 2 | P0 ×1, P2 ×1 |
| Membership | 1 | P0 (shared) |
| Notices | 1 | P1 ×1 |
| Messages | 1 | P1 ×1 |
| Events / Storage | 2 | P1 ×1, P2 ×1 |
| Schedule | 2 | P1 ×1, P2 ×1 |
| Policies | 2 | P2 ×2 |
| More sheet / Profile / app-wide | 3 | P1 ×2, P2 ×1 |

## P0: trust breakers

1. **Raw equipment ids shown to members.**
   - **Where:** Check in, "Which booking?" card. `CheckInView.tsx:150` renders `b.equipmentIds`.
   - **On screen:** "Kitchen | stove-1 | fryer-table | +6".
   - **Fix:** show unit names, as My bookings already does through `equipmentChips`, for example "Gas Stove w/Under Oven #1 · Fryer table · +6".

2. **Test and demo records visible on the member pages.** This is a data issue, not code.
   - **Home and Notices:** notice titles "demo-md-notice-1", "demo-md-notice-2".
   - **Home, Membership and Documents:**
     - "My plan · demo-plan-std".
     - "Plan: demo-plan-std".
     - "demo-plan-std, payment day 5".
     - Business name "gaptest-biz".
   - **Schedule:** "Test Kitchen Co."
   - **Check in:** every question starts with "Sample: …".
   - **Fix:** clear or rename before the client sees staging. Use `mdCleanup` and the seed cleanups by id. The real checklist wording is still open (Q-10).
   - **Separate code fallback:** when a plan has no name, Membership and Home print the plan id. `MembershipView.tsx:95` and `HomeView.tsx:359–361` should show "Plan not named yet" instead of the id.

3. **Internal status notes on member pages.** Fine on staging, a defect on live.
   - **Billing:**
     - "Collected automatically by Stripe (test mode until Flavors approves live payments)." (`BillingView.tsx:123`)
     - "No invoices yet. Payments are in test mode, so Flavors has not issued any invoices through Avenue. Your estimate above is the guide." (`BillingView.tsx:176`)
   - **Billing and Join:**
     - "Payments are switched off in test mode. Nothing is charged." (`BillingView.tsx:75,196`)
     - "Payments are switched off during the preview…" (`JoinView.tsx:196`)
   - **Fix:** keep these behind the mock or test flag only, which is already partly done. For live, use "No invoices yet." and "Collected automatically on your payment day."

4. **Facts that disagree between screens.** Same member, same moment.
   - **Documents:**
     - **Home:** "Documents · 1 on file · Needs attention · 2 to review" and the banner "2 documents need attention".
     - **Documents page:** "0 of 7 current · 7 to send".
     - **Profile:** "Your Licence expires on Nov 30, 2026".
     - "Licence" is not one of the 7 required types. A legacy document type is counted on Home and Profile but not on Documents.
   - **Payment day:**
     - **Home:** "Collected on the 5th".
     - **Membership:** "payment day 5".
     - **Billing and Profile:** "Next payment · Not set yet · Shown once Flavors confirms your plan".
   - **Fix:** each fact should come from one helper. This needs a logic decision, not wording. **Gap:** which source is right? Probably the plan isn't found by id, so Billing falls back.

## P1: clear tells and inconsistencies

5. **The same promise repeated on one screen.** Pattern: core point stated more than once.
   - **Book:** "Flavors confirms every request" appears:
     - in the lede: "Pick a day, your hours and the equipment. Flavors confirms every request; nothing is charged now." (`BookFlow.tsx:374`);
     - in the cart fine print: "Nothing to pay now. Flavors confirms every request." (`BookFlow.tsx:312`);
     - in the review sheet: "Nothing to pay now. Flavors confirms every request, and the answer appears in My bookings." (`BookFlow.tsx:357`).
   - **Events:** the lede "Book the dining room for a private event. Flavors confirms every request." (`AvenuePortal.tsx:102`) and the card text "Book the dining room for a private event. Flavors approves every request; sending one charges nothing." (`EventsView.tsx:46`).
   - **Also on Home:** "Open 24 hours · Flavors confirms every booking." (`HomeView.tsx:276`).
   - **Fix:** say it once per screen, at the decision point: the review sheet, or the Events send button. Drop the lede repeats; for Book use "Pick a day, your hours and the equipment."

6. **Messages says "write to Flavors, they reply here" five times.**
   - Lede: "Ask a question or report a problem. Flavors replies here, in Avenue."
   - "Ask Flavors anything".
   - Empty state: "Use New message to write to Flavors. Replies appear here."
   - Pane: "Select a conversation / Or start a new message to Flavors."
   - Sidebar: "Need a hand? Message Flavors and they reply here in Avenue."
   - **Fix:** keep the lede and the empty state; drop "Ask Flavors anything" and the "Or start a new message" line. Files: `AvenuePortal.tsx:101,489`, `SupportView.tsx:96,100,160`.

7. **Notices repeats the facility name three times at the top.**
   - **On screen:** eyebrow "Flavors Culinary Hub", lede "News and updates from Flavors Culinary Hub Hyattsville.", card eyebrow "Flavors Culinary Hub Hyattsville", then the title "Notices" again.
   - **Where:** `NoticesView.tsx:64–69`.
   - **Fix:** lede "News and schedule changes."; no card eyebrow.

8. **One action, many names.** The booking verb varies across screens:
   - "Book kitchen time", "Book the kitchen", "Book equipment" (`MonthCalendar.tsx:61`);
   - "Request this slot" (`BookBoard.tsx:385`), "Send request", "Review request";
   - "Make another request" (`BookBoard.tsx:263`), "Book something else" (`BookFlow.tsx:334`).
   - **Fix:** choose one pair, for example "Book kitchen time" to start and "Send request" to submit, and use them everywhere.

9. **Same destination, different names.**

   | More sheet hint | Page title or lede |
   |---|---|
   | "News from Flavors" | "Notices" |
   | "Talk to Flavors" | "Messages with Flavors" |
   | "Fridge and dry store" | "Fridge, freezer and dry storage" |
   | "Entry, exit, wellness" | Check in lede "Arrive, leave, wellness." |
   | "Private events" (Events) | Profile "Event request · Dining room and private events" |

   **Where:** `MoreSheet.tsx:21–30`, `AvenuePortal.tsx:97`. **Fix:** reuse the page's own lede as the hint.

10. **Voice switches between "Flavors" and "our team".**
    - "Seating confirmed by our team" (`BookBoard.tsx:350`).
    - "…our team will check it." (`BookBoard.tsx:365`, `BookFlow.tsx:449`).
    - Elsewhere the facility is always "Flavors". **Fix:** use "Flavors".

11. **Unsourced timing promises.** This is a gap.
    - "This usually takes under a minute." (`bookingFlow.ts:78`).
    - "Flavors will reply, usually within minutes." (`MyBookings.tsx:135`).
    - "…within a minute or two" (`DocumentsView.tsx:188,233`).
    - The flows poll every minute, which supports the automatic steps. "Reply within minutes" depends on staff, and no response time has been agreed.
    - **Fix:** drop "usually within minutes" from the staff-reply line: "Request sent. Flavors will reply here."

12. **Marketing fragments that state nothing checkable.** Pattern: portable filler.
    - "Every unit, just for you" (`ui-view.ts:40`) → "All equipment and prep tables".
    - "Your right to operate" (`compliance.ts:23`) and "Cover for you and the kitchen" (`compliance.ts:30`) → "Permits and licences you need to trade" and "Insurance Flavors requires".
    - "Hot line" (`ui-view.ts:37`) is kitchen jargon; its subtitle already says "Stove and flat-top grill". Fine for chefs, so this is optional.

13. **Status casing is inconsistent.**
    - Book "Recent bookings" shows "DECLINED" and "APPROVED" in capitals; every other screen shows "Approved".
    - The all-caps eyebrows sit above titles that say the same thing:
      - "POLICIES" above every policy card;
      - "PRIVATE EVENTS / Event request";
      - "STORAGE / Storage";
      - "MEMBERSHIP", "CURRENT PLAN", "THIS MONTH", "HISTORY", "COMPLIANCE", "UPLOAD", "ON FILE";
      - "BEFORE AND AFTER YOUR BOOKING / Checklist".
    - **Where:** `PoliciesView.tsx:48–92`, `EventsView.tsx:46,77`, `MembershipView.tsx:80–131`, `CheckInView.tsx:122,140,187`, `DocumentsView.tsx:170,188,219`.
    - **Fix:** drop eyebrows that repeat the title; sentence case for any that remain.

14. **View: Home shows the next booking three times in two formats.**
    - Hero pill "Next booking in 22h 8m", KPI tile "22h 8m · To start · Tomorrow, 12:00 AM", and the next-booking card "22h 8m TO START · Starts in 22 h 9 min".
    - **Fix:** keep the hero pill and the card; make the KPI tile something else, or drop it; use one duration format ("22 h 8 min").

15. **View: the Book lede is clipped on phones.** At 412 px the line-clamp cuts it to "Pick a day, your hours and the equipment. Flavors confirms every reque…". The fix is item 5, which shortens the lede.

16. **View: Schedule says "Free now 11 of 11", while Home "Kitchen right now" totals 17 units** (2+2+2+2+6+3). The two are counted differently, probably because Schedule leaves out prep tables. **Gap:** decide the scope, then label it, for example "11 of 11 equipment units free (prep tables not counted)".

17. **View: a historic decline reads as current.**
    - My bookings shows "Refused automatically: this membership is not active." on a booking for a member who is now Active. The text comes from the flow Outcome.
    - **Fix (wording only):** "Not accepted at the time: the membership was not active." This would be a flow change, so it's out of scope here.

18. **View: the My bookings header stat "Waiting for Flavors 0"** reads as a status, not a count (`MyBookings.tsx:228`). Use "Waiting for a decision: 0", or hide it at 0.

## P2: polish

19. **Trailing period on page titles.** "Book the kitchen.", "My bookings.", "Kitchen schedule." and "Good morning, Avenue." use a gold dot as a brand device. It is defensible; check that screen readers don't read it awkwardly. Keep.
20. **Text about the UI itself.**
    - "The Documents page walks you through them one question at a time." (`home.ts:72`) → "Answer one question per document on the Documents page."
    - "Your invoices and payment history. Select one for its details." (`BillingView.tsx:162`) → "Your invoices and payments."
21. **"Tip: press Y or N"** (`ChecklistStepper.tsx:109`) shows on phones, where there is no keyboard. Show it only with a fine pointer.
22. **False agency.** "Avenue hit a problem showing this page." (`ui.tsx:82`) → "This page could not load. Refresh; if it keeps happening, tell Flavors."
23. **Time formats are mixed:** "12:00 AM - 12:00 PM", "12:00a" (the My bookings date strip), "2:00 AM - Midnight", and axis labels "12 AM". The strip label could be "12 AM".
24. **Long policy sentences on Events and Storage.** The package and price lists are one dense paragraph (`PoliciesView.tsx:89–90`); a small table would read better. The facts must stay as they are.
25. **Billing fallback explanation is long:** "Your estimate above is the guide. Check your connection and try again; if it keeps happening, tell the Flavors team." (`BillingView.tsx:166`) → "Invoices could not load. Try again."
26. **Join:** "Your sign-in e-mail is used for your account; you do not need to type it." (`JoinView.tsx:152`) → "We use your sign-in e-mail." Optional.
27. **Developer-style errors.** "Avenue: facility id is missing or invalid." and similar (`readSource.ts`) appear only when the page is misconfigured, and are shown to members as-is. Prefix-free wording would be friendlier. Low priority.
28. **"Quiet day" as the value for "Busiest"** (`CalendarView.tsx:67,82`) reads oddly. Use "Busiest: none".
29. **Home "More ways to book"** repeats Book's own mode selector (Whole kitchen, Dining room, Private event). Consider dropping it, given the user's "no redundant buttons" rule.
30. **Check in lede "Arrive, leave, wellness."** is a three-fragment slogan. Use "Entry and exit checklists, and team wellness." It matches the More hint (see 9).

## Client-confirmed wording: flagged but keep

The policy texts in `PoliciesView.tsx` follow the client sheet of 19 Nov 2026:
- "Closer than 24 hours, ask Flavors from My bookings. Flavors decides.";
- the 3% card fee;
- the 30, 15 and 10-day reminders;
- the documents list;
- event packages and deposit;
- storage prices.

"Flavors decides." is a little curt, but it is the agreed rule. Keep these unless the client approves a change. The compliance questions and COI requirements (`compliance.ts:23–41`) are also client content: keep.

## Fine as is: keep

- **Validation and error messages** in `availability.ts`, `booking.ts`, `join.ts`, `documents.ts`, `events.ts`, `storage.ts`, `support.ts` and `team.ts`. They are specific and actionable, and they state limits ("Book at least 60 minutes.", "The file must be smaller than 10 MB.", "Choose a payment day from the 1st to the 15th.").
- **Cancellation copy:** "It is 24 hours or more away, so it will be cancelled and your hours returned." / "It is less than 24 hours away, so Flavors staff review it…" It is clear and conditional.
- **Booking windows copy** in `copy.ts`: entry, clean-up and "Only booked time uses hours".
- **Join plan text:** "Bank payments are at this price; card payments add 3%. Hours reset on the 1st and do not roll over."
- **Statuses and empty states:** "Waiting for verification", "Not sent yet", "No upcoming bookings", "You are all caught up."
- **Word level:** no tier-1 words, no chat artefacts, no staged emphasis, and no dashes in UI strings.

## Second pass

I re-read this report against the guardrails:
- No suggested replacement adds a fact, time, price or policy.
- Where a fix needs a decision (items 4, 11 and 16), it is marked as a gap.
- Client wording is kept.

## Resolution (27 Nov 2026, staging 1.9.0.0)

| # | Result | What changed |
|---|---|---|
| 1 | fixed | Check in shows unit names via `equipmentChips`; unknown ids are humanised ("stove-1" -> "Stove 1") in `ui-helpers.equipmentChips`, so no screen shows a raw id. |
| 2 | fixed (code) + data follow-up | `memberPlan` never uses the plan id as a name ("Plan not named yet"). "Sample:" questions render a small "Sample" chip. Data rows need human titles (below). |
| 3 | fixed | One `PAYMENTS_TEST_MODE` / `TEST_MODE_NOTE` in `avenue/billing.ts`: one "Test mode: no money is charged" pill on Billing and Join review; long test-mode sentences removed. Set the constant to false at go-live. |
| 4 | fixed | Documents: Home KPI and Profile use the Documents page computation (`requiredRows`); a type that is no longer required (legacy "Licence") gives no "expires soon" note (expired ones still show, because the booking check counts them). Payment day comes from CollectionDay on Home, Billing, Profile and onboarding; "Payment day not set yet" when empty. |
| 5 | fixed | "Flavors confirms every request" once per screen: Book review sheet, Events card; Book lede and cart line shortened; Home lede "Open 24 hours." |
| 6 | fixed | Messages: dropped "Ask Flavors anything" and "Or start a new message"; sidebar "Need a hand? Message Flavors." |
| 7 | fixed | Notices lede "News and schedule changes."; card eyebrow removed, card title "All notices". |
| 8 | fixed | "Book" (nav, page title, Schedule), "Book kitchen time" (hero only), "Send request" (submit), "Book again" (after sending). |
| 9 | fixed | Page titles equal nav labels (Documents, Billing, Membership, Messages, Events); More hints reuse the page ledes; Profile labels match. |
| 10 | fixed | "our team" -> "Flavors". |
| 11 | fixed | Removed "under a minute", "usually within minutes", "within a minute or two". |
| 12 | fixed | "All equipment and prep tables", "Permits and licences you need to trade", "Insurance Flavors requires". "Hot line" kept (optional). |
| 13 | fixed | Eyebrows that repeated titles removed; remaining ones sentence case ("Current plan", "This month"); status chips sentence case. |
| 14 | fixed | Home: Next booking KPI tile removed (hero pill + card remain); one countdown format (`durationText`, "22 h 8 min"). |
| 15 | fixed | Book lede shortened (item 5). |
| 16 | fixed | Home "Kitchen right now" counts the same set as Schedule: bookable cooking units, prep tables not counted (they come with every booking). |
| 17 | kept | Text comes from the booking flow Outcome; flow change out of scope. |
| 18 | fixed | "Waiting for a decision". |
| 19 | kept | Gold dot on titles is the brand device. |
| 20 | fixed | Home and Billing wording. |
| 21 | fixed | "Tip: press Y or N" hidden on touch devices. |
| 22 | fixed | "This page could not load. Refresh; if it keeps happening, tell Flavors." |
| 23 | fixed | Short times "12 AM" / "2:30 PM" on the date strip and board ruler. |
| 24 | fixed | Event packages and storage prices as lists; figures unchanged. |
| 25 | fixed | "Invoices could not load. Try again." |
| 26 | fixed | "We use your sign-in e-mail." |
| 27 | kept | Misconfiguration errors only; low priority. |
| 28 | fixed | "Busiest: None". |
| 29 | fixed | Home "More ways to book" removed. |
| 30 | fixed | Check in lede "Entry and exit checklists, and team wellness." |

**Data rows needing a human title (not changed by code):** notices "demo-md-notice-1/2/3" (AvenueNotices); plan "demo-plan-std" (AvenuePlans Title, or the member's PlanId pointing at it); business name "gaptest-biz" (AvenueMembers BusinessName); "Test Kitchen Co." (calendar/booking business name); checklist questions starting "Sample:" (client wording still open, Q-10).


## Pass 2 (1.12), 27 Nov 2026

Second unslop pass on the written copy of staging 1.11 (check, then edit in place). Product-UI register; client policy wording in `PoliciesView.tsx` untouched. Earlier decisions (items 1 to 30 above, `BROWSER_AUDIT_STAGING_1.9.md`) not reopened. `BookBoard.tsx` is not mounted by the app (imported only by a test) and was skipped.

Findings: P0 0, P1 6, P2 11 (17 total, all fixed; 2 related open points listed below).

| # | Sev | File:line (1.11 source) | Before -> after | Pattern |
|---|---|---|---|---|
| 1 | P1 | `SupportView.tsx:131` | "Chat assistant coming soon" under the Other topic -> removed | Unsourced promise |
| 2 | P1 | `SupportView.tsx:249` | "Chat assistant (coming soon). For now your message goes straight to the Flavors team." -> removed | Unsourced promise; text about a feature that does not exist |
| 3 | P1 | `bookingFlow.ts:84` | "The result appears in Bookings." -> "...in My bookings." | One thing, two names |
| 4 | P1 | `ui-helpers.ts:272` | notice dates "2 Nov" (en-GB) -> "Nov 2" (en-US, like every other date) | Mixed date formats |
| 5 | P1 | `HomeView.tsx:359`, `PoliciesView.tsx:74`, `BookFlow.tsx:189` | `$${rate}` -> `formatPrice(...)`: same "$12" / "$12.50" as the rest, never "$12.5" | Mixed currency formats |
| 6 | P1 | `CheckInView.tsx:125` | eyebrow forced to capitals ("ENTRY CHECKLIST") -> "Entry checklist" | Sentence-case rule (item 13) |
| 7 | P2 | `SupportView.tsx:250` | "Write your first message below. Flavors replies here, in Avenue." -> "Write your first message below." | Repeated promise (lede and empty state already say it) |
| 8 | P2 | `TeamView.tsx:39` | card lede "People who work with you. Their names are filled in for you in the wellness check at check-in." -> removed (page lede says it) | Repeated explanation |
| 9 | P2 | `StorageView.tsx:40` | "Ask for fridge, freezer or dry storage. Flavors confirms availability and the price..." -> "Flavors confirms availability and the price before anything is billed." | Repeats page lede |
| 10 | P2 | `MoreSheet.tsx:29` | My team hint "People on your account" -> "Names for the wellness check" (same as the Profile row) | One thing, two names |
| 11 | P2 | `HomeView.tsx:77,338`, `MyBookings.tsx:274` | "Choose a day... Flavors confirms." / "Choose a day and your hours; Flavors confirms." -> "Pick a day, your hours and the equipment." / "Pick a day and your hours..." | Same empty-state sentence in three shapes; verb matches the Book lede |
| 12 | P2 | `HomeView.tsx:313` | "Review docs" / "View docs" -> "Review documents" / "View documents" | Abbreviation; the page is "Documents" |
| 13 | P2 | `compliance.ts:23` | "Permits & licences" -> "Permits and licences" | "&" mixed with "and" |
| 14 | P2 | `AvenuePortal.tsx:596` | footer link "Event request" -> "Events" | Nav label is Events |
| 15 | P2 | `CalendarView.tsx:90` | "Week view" -> "Week" (the others: Calendar, Equipment, Timeline) | Inconsistent switcher labels |
| 16 | P2 | `JoinView.tsx:187` | "10 h/month" -> "10 h a month" | Mixed unit phrasing (Profile uses "h a month") |
| 17 | P2 | `BillingView.tsx:169`, `BookFlow.tsx:510`, `ui-helpers.ts:266` | "Invoices are not available right now." + "Invoices could not load. Try again." + Try again button -> one sentence and the button; "...are offered on the left." -> "Only times when everything is free are offered."; relative time "now" -> "Just now" (Home already used it) | Triple statement; text about layout; two spellings |

Open points, not changed (need a decision):
- **Schedule counts:** "units free" (Schedule day card), "cooking stations free" (Schedule header) and "equipment" (Home) name the same set three ways. Pick one noun once the scope question from item 16 is settled.
- **Join step eyebrows** ("Choose your plan" above "Which plan fits your kitchen time?") repeat the heading. They sit under the step indicator, so they were left; drop them if the client dislikes the repetition.

Dashes: none in UI strings (em/en dash check over all non-test sources). Word level: no tier-1 vocabulary found.

Also in 1.12: support attachments are hidden (see `CHANGELOG.md`).

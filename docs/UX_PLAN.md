# Member portal UX plan (18 Nov 2026)

Owner: member portal (`apps/member-spfx`). Status per phase below. Colours are fixed (client brand); everything else (shape, spacing, type, motion, feedback, phone layout) may change.

## 1. Problem (from the 18 Nov audit and client feedback)
- The portal reads as generic: rounded white cards everywhere, little motion, nothing that says "kitchen".
- It feels static: an action (send, cancel, pick a time) gives no physical or audible confirmation, and nothing tells a member when Flavors answers unless the page is open on the right tab.
- Concrete defects: headings lose their spacing (base reset outranks components), Home goes blank while scrolling (scroll-reveal), tabs keep the old scroll position, Schedule header breaks on phone, the Book bar floats mid-screen on phone, cramped Home timeline, duplicated calls to action, 31-day grid on My bookings, footer too heavy on phone, top bar overflow at mid width, desktop Home still in the old style.

## 2. Research summary
- Shared-kitchen booking tools (The Food Corridor, Spacebring, Optix) sell **real-time availability first** and book by **station / equipment / shift**, back to back. Kitchen vocabulary: stations, shifts, the pass, tickets.
- Restaurant and reservation apps converge on: date strip → time slots → confirmation, with zero-friction feedback and a clear "what happens next".
- Physical metaphors that are native to a working kitchen and not generic UI: the **order ticket on a rail** (KOT), the **menu row with dotted leaders**, **ticket stubs**, **tear-off calendar**, **burner indicator**, **subway tile**.
- Web platform capabilities (all browser-native, no new dependency):
  - Vibration API: Android Chrome/Firefox. Not on iOS Safari; iOS 18+ gives a light haptic when a `<input type="checkbox" switch>` is toggled, usable as a fallback.
  - Web Audio API: short synthesized sounds, allowed after a user gesture.
  - Notification API: desktop browsers on HTTPS after the member grants permission; iOS only for installed web apps.
- Microsoft platform: Fluent UI is already in the bundle; the same SPFx package can later run as a Teams personal app (`supportedHosts`), which gives Teams presence and, with a flow, Teams activity notifications. That needs an admin decision, so it is **[PROPOSED]**, not in this round.

## 3. Principles
1. Kitchen language, same palette: ink `#0F4C5C`, gold `#C9A24D`, cream `#F4F5F7`, steel greys.
2. Every tap answers: visual press, then haptic where the device supports it, then a sound only for meaningful results (sent, approved).
3. Members control feedback: Sound, Vibration and Desktop alerts toggles in the account menu, remembered per browser. Reduced-motion users get no animation.
4. Nothing hides content while it waits for an animation.
5. No new dependencies; no change to data, flows or permissions.

## 4. Phases
| Phase | Scope | Acceptance | Status |
|---|---|---|---|
| A. Defects | All audit items 1–12 | Each item re-checked live at 375 px and 1440 px | Deployed 18 Nov, checked live 375/800/1440 px |
| B. Visual language | Order tickets (My bookings), menu rows (Book availability), ticket-stub time slots, tear-off dates, burner lights (Home stations), subway-tile page heads, pinned notice slip, kitchen icons in the tab bar and bell | Screens read as one system; no generic rounded cards left on live screens | Deployed 18 Nov, checked live |
| C. Motion | Mount-only staggered rise, press scale, selection pop, burner glow, raised active tab | Smooth at 60 fps on a mid phone; off under reduced motion | Deployed 18 Nov |
| D. Feedback | `feedback.ts`: haptic (tap / success / warn), service-bell chime, toast, desktop notification when Flavors answers; settings toggles | Send request → toast + chime + haptic; approval while page open → bell + toast (+ desktop alert if allowed) | Deployed 18 Nov; sound/haptic not felt on a real device yet |
| E. Teams / Outlook | Teams personal app host, activity-feed notifications, Outlook calendar invite | Client/admin approval first | [PROPOSED] |

## 4a. Navigation and confirmation (added 18 Nov)
- Sections stay mounted once visited (no reload on return); data refreshes after a request is sent.
- Two motions on one clock (0.34 s): the nav indicator slides with a slight overshoot; the page enters from the side of travel with a calm settle.
- Confirmation: spinner while sending, ring draws closed then a tick; gold burst on approval, shake on decline; toast + chime + haptic.

## 5. Defaults that need a client yes
- **[PROPOSED]** Sound on by default for results of the member's own actions; off for background events until the member turns it on.
- **[PROPOSED]** Desktop alerts asked for only when the member taps the toggle (never on page load).

## 6. Risks
- iOS: no Vibration API; haptic relies on the switch-input fallback (iOS 18+). Desktop notifications on iPhone only for installed web apps.
- SharePoint chrome (app bar) changes the visible area on narrow screens; fixed bars are positioned against the viewport.
- Test data visible to the client (`gaptest-` company, `demo-` notice) is not a layout issue; removal follows the id rules in CLAUDE.md and is a separate decision.

## 7. v4 rebuild (18 Nov, after client/owner review: "dull, cards everywhere, text over photo, too many slot buttons")
Review findings, owned: v3 changed surfaces, not structure. Every section was still a box in a padded column.

Root causes found
- Side/bottom gaps and the "boxed" footer: the portal root itself had 16 px padding on all sides (`.avenuePortal` base style), not SharePoint.
- Text over photo: the headline was laid over the dining-room photo; neither reads well.
- Booking time: one button per 30 min (30+ buttons) instead of showing when the kitchen is actually free.
- Scroll motion: time-based reveal waited for the observer; fast scrolls showed blanks.

Decisions
1. Edge to edge: remove root padding; sections are full-bleed bands, content aligned to one 1240 px grid inside them.
2. Navigation: solid ink bar with the light logo, gold sliding indicator, bell and avatar on ink.
3. Home hero: split, never overlaid. Text and live status on the left; photo on the right edge (phone: photo band on top, text below).
4. Live booking = a status panel with a progress ring (time left in the kitchen, or time to start), one line of meta, two actions. Not a paragraph.
5. "Kitchen right now" = one equipment board (category, art, free count, one bar segment per unit) replacing the status strip and the category grid; tapping books.
6. Coming up = a time rail (time, dot on a line, details), not cards.
7. Book: a day track (6 AM–midnight) with booked time merged into single blocks ("9:30 AM – 5:00 PM booked"), free windows listed as a few rows, and a two-handle range slider for start/end inside the chosen window. Equipment availability stays beside it.
8. Motion: CSS scroll-driven animations (`animation-timeline: view()`, Baseline in Chrome/Edge 115+, Safari 26, Firefox 159) behind `@supports`; progress follows scroll position so fast scrolling never shows blanks. Plus a scroll progress line under the nav and a light photo parallax. Unsupported browsers show content without motion.
Status: deployed 18 Nov (bundle `0807b426d46d30c5d244`); tested end to end, see `docs/UX_TEST_LOG.md`.

## 8. Round 5 (18 Nov): foundation
1. Stylesheet: remove dead rules (done), then merge the live override layers into one set of component rules (next).
2. Type: Archivo, one family; width axis = personality (condensed headings, figures, nameplates; normal width for reading); scale 13/15/17/20/24/30/38/48/60 (done, [PROPOSED] until Flavors confirms brand fonts, Q-26).
3. Then: rebuild My bookings detail, Schedule views, Notices, Book review/confirmation to the Home/Book standard; View Transitions; accessibility audit; real-device test.

## 9. Round 6 (18 Nov): My bookings rebuild
Problems: the left date rail wastes a third of a phone screen; tickets repeat status as a pill and chips as a dot-joined string; the detail sheet is a stack of headings; nothing says how many bookings are waiting or what is next; the screen's CSS is spread over six layers.
Design (kitchen metaphor kept, quieter):
1. Head: title plus three facts with hairline dividers (Next booking, Waiting for Flavors, Booked this month), so the screen answers "what is next" before the list.
2. Day strip: the same tear-off pages as Book (weekday band, number, gold dot on booked days); one scrolling row.
3. Day groups: a full-width condensed day heading ("Today, Wed 18 Nov") with the relative label, instead of the left rail.
4. Ticket: time block (start, end, length) | equipment nameplates (art + names) | a status stamp (the rubber stamp on a kitchen ticket: Approved / Waiting / Declined / Cancelled); the live booking shows a mini progress ring. Past tickets are muted.
5. Detail sheet: date and time as the heading with the stamp; the booking window bar labelled Entry / Booked / Clean-up; nameplate list; the message from Flavors as a quoted slip; actions as one full-width row.
6. CSS: new `mb*` classes in one block; the old agenda/rail/drawer rules become unused and are removed by the prune script. Other screens are checked with the computed-style recorder (must be unchanged).
Kept contracts: `data-booking`, the 31-day strip label and booked marker, drawer texts and actions, Escape closes, Upcoming/Past, deep link to Extend.
Status: deployed 18 Nov (bundle `551dafbac12a9f34bfff`), tested, see `docs/UX_TEST_LOG.md` pass 6. Next: Schedule, Notices, Book review/confirmation.

## 10. Round 7 (18 Nov): Schedule rebuild
Problems: four views with four unrelated looks (rounded month grid with pills and a floating side card, equipment as tall rounded cards, a timeline board in the old style, a heat table); no summary of the kitchen's state; controls stacked over each other on phone.
Design (one language with Home, Book and My bookings):
1. Head: title, facts (Free now N of M stations, Bookings on the chosen day, Busiest window), the view switch and Book in one row.
2. Calendar (month): a prep-sheet grid with square corners; each day shows a short bar per booking (up to 4) instead of name pills and dots; today ringed, the chosen day inked. The chosen day's bookings sit beside the grid as ruled rows (time stub, company, equipment), not a card.
3. Equipment: a departures-board list grouped by type: nameplate, status (Free now / In use until), a 24-hour bar with a time scale and a now marker, and Book. Category tabs and All / Free / In use filters kept.
4. Timeline: lanes with nameplate labels, a condensed hour ruler, ink blocks carrying the company name, a gold now line.
5. Week: the heat table restyled (square cells, figures in the condensed face); the phone list as ruled rows.
6. Day bar (previous / date / next / Today / Refresh) as one compact control.
7. CSS: old board/month/heat/unit-card rules pruned and redefined once (`v7`); unused `KitchenTiles` removed; other screens checked with the recorder.
Kept contracts: view button names, `data-unit`, `data-lane`, the week cell "booked N%" label, phone list per equipment without the board, the load-error alert.
Status: deployed 18 Nov (bundle `01f64b0006285832545e`), tested, see `docs/UX_TEST_LOG.md` pass 7. Next: Notices, then Book review/confirmation.

## 11. Round 8 (18 Nov): Notices rebuild
Problems: one dark rounded card for the lead and plain stacked items for the rest; category chips as rounded pills wrapping onto two lines on phone; nothing says how many are unread until you scan; the screen's rules sit in four layers.
Design (the board by the walk-in):
1. Head: title, facts (Unread, Pinned, Latest date), Mark all as read.
2. Filters: category tabs with counts (the underline tabs used on Schedule), one scrolling row on phone.
3. Desktop: the lead notice on the left as a pinned paper slip (pin, ruled paper, square corners), the rest on the right as ruled rows; phone: one column.
4. Each notice: a meta line (unread dot, a square category tag with its colour mark, date), the title, the text, Read more / Show less. Urgent: a red rule and tag (contrast-checked).
5. Empty state with direction, not mood.
6. CSS: new `nt*` classes in one block; the old feed/lead/filter rules pruned.
Kept contracts: `h3` titles in pinned-then-newest order, lead as `article[data-notice]`, `unread-dot`, filter button names, Read more, Mark all as read, markup shown as text, empty-state text.

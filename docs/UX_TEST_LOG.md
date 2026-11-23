# Member portal: test and improvement log

Live site, signed in as the TD admin account in the built-in browser. Widths: 375 (phone), ~800 (mid), 1440 (desktop).
No booking request, cancellation or extension is sent during these passes (they create real records on the live site).

## Pass 1 (18 Nov, after v4 deploy)
| # | Where | Finding | Fix | Status |
|---|---|---|---|---|
| 1 | Home, phone | White strip opens above the hero photo while scrolling: the parallax moved the photo inside its frame | Parallax by background position, not by moving the layer | Fixed, retested |
| 2 | Book | Window end shows "12:00 AM", which reads as the start of the day | Show "Midnight" | Fixed, retested |
| 3 | Book | Past part of today looks the same as free time on the day track | Past shown as its own faded block | Fixed, retested |
| 4 | Everywhere | Design-skill critique: tracked ALL-CAPS labels over every heading (template chrome) | Sentence-case labels, no tracking; keep caps only where it is a real status tag | Fixed, retested |
| 5 | Everywhere | Meta joined with middle dots ("Today · 9:00 AM") | Commas and plain words | Fixed, retested |
| 6 | Everywhere | Monospace on small data labels everywhere | Keep monospace only on order tickets and the time readouts; tabular figures elsewhere | Fixed, retested |
| 7 | Home | Hero kicker repeated the facility name already in the nav | Greeting only | Fixed, retested |
| 8 | Feedback | `navigator.vibrate` called before the visitor's first tap (background alerts): Chrome blocks it and logs an error each time | Vibrate only after `navigator.userActivation.hasBeenActive` | Fixed, retested |
| 9 | Console | "Uncaught (in promise)" and a ReferenceError | Traced to Microsoft's own search box script (`suiteux.shell.searchbox`), not the portal | Outside our code |
| 10 | Bell menu, phone | Notifications menu opened at x = -59 px (cut off on the left) | Fixed full-width menu under the bar on phone | Fixed, retested (x 12–363) |
| 11 | Book, desktop | Equipment rows looked blank in a screenshot | Not a bug: opacity was 1; the pane had not repainted | No change |
| 12 | Motion | Scroll-linked animations were silently off in production: the minifier moved the `animation` shorthand after `animation-timeline` and reset it | Longhand properties only | Fixed; live check shows `ViewTimeline`, and an instant jump to the page bottom lands items at progress 1.00 / opacity 1.00 in the next frame |
| 13 | Page entrance | The slide used `transform`, which made the page the containing block of the fixed Book bar for 0.34 s | Slide with `left` instead | Fixed, retested (bar at 750 = tab bar top, during and after) |
| 14 | Book, phone | "Taken till 5:30 PM" ran 4–12 px past the screen for long equipment names | Name column can shrink (ellipsis); status stays whole | Fixed, retested |
| 15 | Page entrance | Horizontal scrollbar could flash while a page slides in | `overflow-x: clip` on the main area | Fixed |

## Pass 2 result (phone 375 px, desktop 1440 px)
All checks pass on the live build `0807b426d46d30c5d244`:
- Layout: no root padding, SharePoint app bar hidden, no horizontal overflow on Home, Book, My bookings, Schedule, Notices (after the entrance slide settles).
- Navigation: 5 sections stay mounted; a half-built booking survives switching tabs; nav indicator and page slide share one clock.
- Book: free windows listed; both range handles move; "Midnight" label; equipment pick; Review enabled; Review step and Back work; action bar pinned on the tab bar.
- My bookings: 15 tickets; details sheet opens and closes; Upcoming/Past.
- Schedule: Calendar, Equipment, Timeline, Week view; month next/previous; day select.
- Notices: category filter. Account menu: Full screen, Sounds, Vibration, Desktop alerts. Bell menu on screen.
- Motion: scroll-linked reveals, photo parallax and the scroll-progress line run on scroll timelines.

Not tested (needs a real device or would create live records): sound and vibration on a phone, desktop alerts, sending a request (so the send → tick animation against the live approval flow), cancel, extend.

## Pass 3 (18 Nov)
- Footer headings now sentence case; live check on bundle `b1f6922e917b748597ce`.
- Test data: not removed. Member #10 `gaptest-tdd` is the TD account's own active membership (its bookings drive the Home demo); notice #5 `demo-notice-published` is the only notice and `demo-` rows may only go through `seedCleanup()` (which removes every `demo-` row); equipment #21 "Oven 2", #22 "Prep table #20", #23 "Oven #21" are not seed rows (origin UNKNOWN). Owner decision 18 Nov: rename the display only; leave the demo notice and the three extra pieces of equipment. Done as the TD admin: `BusinessName` on AvenueMembers #10 and AvenueMyMembership #9, `MemberDisplayName` on AvenueCalendar #39–41 changed from `gaptest-tdd` to "Tech DoubleKlick Designs"; `Title` (the id) unchanged in all rows. Live check: Schedule shows the new name, "gaptest-tdd" appears nowhere on the page.

## Next candidates (not done)
- Still visible by decision: notice "demo-notice-published" (replace with a real notice from Flavors), equipment "Oven 2", "Prep table #20", "Oven #21" (origin UNKNOWN; confirm with Flavors).

## Pass 4 (18 Nov): stylesheet clean-up and type system
- Dead CSS removed by a selector-aware script (a rule goes only when its selector needs a class no component uses; `art_*` kept because it is built dynamically): Site.module.scss 1,152 → 988 lines, AvenuePortal.module.scss 1,235 → 756 lines (467 rules). Unused `DayTimelineBar.tsx` deleted. Build and 259 tests green before and after.
- Not done yet: the live override layers (v2.2 → v4.1) are still stacked; merging them into one set of component rules is the next clean-up step. `BookBoard.tsx` is only used by a test (not shipped).
- Typeface: Archivo bundled (inlined data URI, registered once by `useBrandFont`), condensed for headings, figures and equipment names; normal width for reading. Live check: font loaded, headline "Avenue Archivo" at 72% width.
- Found and fixed: `#SuiteNavPlaceholder` left a 48 px empty strip above the portal on some loads → hidden in immersive mode. Known limit: SharePoint shows its own chrome for about a second before the web part starts (cannot be removed from inside the web part).
- Regression at 375 px on bundle `fb9eb32c775c61c0aa0a`: all five sections fit; Book bar pinned (750/750); range, equipment pick, Review; booking details sheet; fast scroll lands visible; bell menu on screen. Test note: with the pane hidden, `requestAnimationFrame` never fires and timers are throttled, so checks use short timers and finish entrance animations first.

## Pass 5 (18 Nov): layer merge, verified by computed-style diff
- Tool: a recorder stores the computed style of every element on all five screens (43 properties: box, spacing, type, colour, borders, layout; not opacity/transform, which scroll animations drive) in the browser, and a diff compares two recordings. Noise floor measured by two back-to-back recordings: about 34 width/height changes from time-dependent text, zero style changes.
- First merge attempt (move every repeated rule to its last copy) failed the diff: nav links lost weight/width and the active-link colour, the active phone tab lost its colour, out-of-month calendar cells lost their grey (cascade order changed against `.linkOn`, `.tabOn`, `.mcOut` and the type rules). Rolled back.
- Cascade-safe merge (a declaration moves only if no rule in between sets the same property family; declarations always overridden by a later copy of the same selector are dropped): 94 never-applied declarations removed, duplicate copies 87 → 79. Diff after deploy (bundle `01dc0d8e430022cd0a62`): 375 px, 1,343 elements, zero style changes, 35 size changes (noise); 1,440 px, zero real changes (container auto-margins 99 → 100 px from a 2 px scrollbar difference in the baseline).
- Remaining 79 copies are cascade-entangled; they go away as each screen is rebuilt with one clean rule set (next round), checked with the same recorder.

## Pass 6 (18 Nov): My bookings rebuild
- Live bundle `551dafbac12a9f34bfff`. Regression: computed-style diff of all other screens at 375 px shows zero style changes (8 size changes, noise); My bookings' old structure replaced (359 old / 406 new elements), as intended.
- My bookings checks at 375 px, all pass: three facts (Now / Waiting for Flavors / Booked this month); 14 tickets; cancelled and declined tickets muted; 31-day strip with 3 booked days, tapping one focuses and scrolls to the day; nothing overflows; sheet opens with the window lines, nameplates and the message slip; "Add to calendar" builds the .ics (intercepted, not downloaded); Extend dialog opens with end + 1 h (closed, not sent); cancel correctly not offered for a booking that has started; Escape closes; Upcoming/Past (9 past tickets). Desktop 1440 px checked visually.
- Found and fixed while testing: (1) every sheet rendered in a serif fallback font, because sheets are portals outside `.site` and the portal root had no body font; the font now sits on the shared `.avenuePortal` root. (2) "Next" showed a later start while a booking was live; it now says "Now, in the kitchen until …". (3) Cancelled/declined tickets were as loud as live ones; now muted. (4) The phase line in the sheet was gold text on white (about 2.3:1 contrast); now deep accent, 9.5:1.
- Stylesheet: old agenda/rail/drawer/strip rules removed (39 blocks); the screen's styles are one `v6` block.

## Pass 7 (18 Nov): Schedule rebuild
- Live bundle `01f64b0006285832545e`. Regression at 375 px: Home, Book and Notices zero changes; My bookings only 3 auto-margin shifts on relative-day labels (data); Schedule changed as intended.
- Schedule checks, all pass: facts (Free now 3 of 11 / Bookings today 3 / Busiest 9:00–11:00 AM); month grid fits, 6 days with booking bars, day select shows its rows, next/previous month; Equipment: 18 rows, Free filter (6), category tab; Timeline on phone is a per-equipment list without the board, on desktop a board with 19 lanes; Week: 133 labelled cells ("Stove #1, 18 Wed: booked 44% of the day"), phone list; nothing overflows in any view at 375 px. Existing schedule contract tests unchanged and passing.
- Found and fixed while testing: (1) desktop timeline lanes had no equipment names: the board auto-scrolls to now and the name column scrolled away; names, the ruler corner and group labels are now sticky. (2) The phone day bar wrapped Refresh to a second line, then overflowed by 12 px (date inputs have a large intrinsic width); Refresh is now an icon button and the date field shrinks: one row, 359/375 px. (3) Now line 2 → 3 px so it reads at a glance.
- Not visually reviewed: the desktop Week table (the pane did not repaint while hidden; functionally checked).

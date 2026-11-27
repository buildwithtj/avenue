# Browser audit: member portal staging 1.9.0.0 (27 Nov 2026)

How: Browser 1 (Chrome, signed in as automations@poweredbyavenue.com, a member), window 372 x 658 px (phone width), staging page `/sites/Avenue/SitePages/Member-portal-staging.aspx`, service worker cleared, bundle `avenue-portal-web-part_0ba26e03697c4fcdb957.js` confirmed. Every page opened from the bottom nav or the More sheet and read on screen. Desktop width was only seen briefly on 1.8 before the deploy; not re-checked on 1.9. Read only: nothing submitted.

No horizontal page overflow on Home (scrollWidth 372 = viewport).

## Bugs (fix first)
| # | Page | What is wrong |
|---|---|---|
| B1 | Policies and help | The section chip row (Booking, Cancelling, Plans and payments, Documents, Events and storage, Terms) renders on top of itself: the labels overlap into one unreadable line. |
| B2 | Home, Your month | The Documents tile value is cut off: "0 of 7 curr…" (should read "0 of 7 current"). |
| B3 | My bookings | The date strip still shows square tiles with a square gold border (Fri 27) and a square dark tile (Sat 28). The 1.8 change to rounded, shadow-free date bubbles is not visible here. |
| B4 | Book | The sticky "Pick your hours / Review" capsule shows before anything is chosen and covers the booking-type cards. It should appear only after an item is added (as planned). |
| B5 | Check in (opened from More) | The bottom nav highlights "Bookings" instead of nothing or More: the active tab does not match where the member came from. |

## Layout and visual
| # | Page | Finding |
|---|---|---|
| V1 | Home | Your month has 3 tiles in a 2-column grid: Balance due sits alone on the last row with empty space beside it. |
| V2 | Home | "Needs attention" chip wraps to two lines inside the Documents tile. |
| V3 | Home | Next booking card: equipment icons wrap to a second row with "+3"; Coming up card: the date badge "28" sticks out past the card's left edge. |
| V4 | Home, Book, Bookings | Countdown formats still differ on one screen: hero pill "21h 54m", card "21 h 54 min", pill "Starts in 21 h 54 min". |
| V5 | My bookings | Stat labels wrap to 3 lines ("Waiting / for a / decision", "Booked / this / month"). The eyebrow sits tight under the top bar. |
| V6 | Book | Large empty gap between the eyebrow and the title; "How booking works" floats centred on its own; "Recent bookings" sits above the booking options, pushing the actual booking controls below the fold. |
| V7 | Check in | The three checklist buttons wrap to three lines each ("Arriving: / entry / checklist"). |
| V8 | Membership, Billing | Each page starts with a full-width dark primary button linking to the other page ("Billing and payments" / "My membership"); it looks like the main action of the page. A small text link would do. |
| V9 | Storage | The page title "Storage" repeats as the card title "Storage"; the item picker is a plain native select ("Choose…"). |
| V10 | Events | Prices show as "$1200.00", "$1850.00": no thousands separator, trailing ".00". |
| V11 | More sheet | Tiles have different heights (Check in taller than Membership), so the grid is ragged. |
| V12 | Notices | Two "All" controls on one screen: the Recent/All toggle and the "All 3" filter chip. |

## Text
| # | Page | Finding |
|---|---|---|
| T1 | Documents | "To do: Compliance documents. 0 of 7 sent. Still needed: County food permit, MD good standing, …" is one long comma list; show the 7 types as a checklist or chips. |
| T2 | Membership, Profile | Contradiction: Membership shows "Active" for the member and the plan, then "Current plan · Not set yet" right below. |

## Test data still visible (data, not code)
Membership and Profile show "gaptest-biz" and "demo-plan-std"; Home and Notices show "demo-md-notice-1/2/3"; Check in shows "Sample:" questions (now as a chip on 1.9 where applicable). These come from the shared lists; renaming them is a data change.

## Fine as is
Bottom nav and Book button, Messages page with the New message pill, Billing test-mode pill, Event package cards, Schedule header and view switcher, Profile sheet layout, hero CTA contrast at phone width.

## Resolution (staging 1.10.0.0, built 27 Nov 2026, not yet deployed or checked in a browser)
| # | Resolution |
|---|---|
| B1 | Fixed: phone/tablet chip row items no longer shrink (`flex: 0 0 auto`, padding, scroll row). |
| B2 | Fixed: tile value is "0 of 7"; "Current ·" moved to the caption. |
| B3 | Fixed at the root: a later `.datePanel` rule (`border-radius: 0 !important`, higher specificity) beat the 1.8 rounded rule; the rounded rule now includes the `.datePanel` selector. |
| B4 | Fixed: the capsule counts as empty until hours are picked or (equipment mode) a unit is added; the always-included prep tables no longer count. |
| B5 | Fixed: pages opened from the More sheet light "More" on the phone tab bar; any other navigation clears it. |
| V1 | Fixed: an odd last Your-month tile spans the row (phone and tablet). |
| V2 | Fixed: status pills stay on one line (12 px on phone, ellipsis if ever too long). |
| V3 | Fixed: next-booking card shows 3 equipment icons + "+N" on phone (one row); Coming up rows get left padding so the date badge clears the ticket notch. |
| V4 | Already one format on 1.9 for countdowns ("21 h 54 min" via durationText); notice ages now say "5 min ago" / "3 h ago" instead of "5m" / "3h". |
| V5 | Fixed: labels shortened to "Waiting" and "This month"; every page head gets the same 14 px top space on phone. |
| V6 | Fixed: Recent bookings moved below the booking controls; "How booking works" is a left-aligned link. The eyebrow-to-title gap was not measured in a browser. |
| V7 | Fixed: buttons read "Arriving", "Leaving", "Wellness" (full names kept as aria-labels). |
| V8 | Fixed: text links "My membership ›" / "Billing and payments ›". |
| V9 | Fixed: duplicate "Storage" card title removed; the select uses the app's rounded field with a chevron. |
| V10 | Fixed: one formatter. `formatCents` adds thousands separators everywhere ("$1,234.56"); new `formatPrice` drops ".00" on whole dollars for offers (plans on Join, Membership and Policies, event packages, deposit, storage). Invoices and quotes keep cents. |
| V11 | Fixed: More grid rows share one height. |
| V12 | Fixed: the "All" chip is gone; chips are Unread + categories and tapping the active chip clears it. The Recent/All toggle is the only "All". |
| T1 | Fixed: "N of 7 sent. Each one is listed below with its status." The Required documents card below already lists each type with an icon and status chip. |
| T2 | Fixed: the Current plan card shows the price only when the plan has one; it no longer says "Not set yet" next to an active plan. Plan name still comes from the data (demo-plan-std is a data follow-up). |

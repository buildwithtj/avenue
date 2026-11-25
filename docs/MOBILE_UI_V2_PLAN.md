# Mobile UI v2 plan (staging 1.4.0.0)

Source: developer review of staging 1.3.1.0 on a phone-size screen (Chrome device mode / SharePoint mobile). Scope: member portal only.
Status: built in code, not deployed. Items marked UNVERIFIED were not seen on a real iPhone.

## Research
- **Instagram reels** (`/reel/Dfpl-7yxTA7/`, `/reel/DgDZkpuhIuY/`): both sit behind Instagram's login wall; the video could not be viewed and nobody logged in. Only the public captions were readable: reel 1 is a web-design agency promo ("DM me 'site' if your website is still boring"), reel 2 is a "scroll builds a cookie/s'mores sandwich" scroll-driven 3D product website. **What the videos contain is not known**; the work uses the developer's written description (3D depth, animated component appearance, glass, smooth physics) and the reel-2 idea of layered, scroll-linked depth.
- **Bistro by Blinkit / food-delivery apps**: no screens retrievable. Patterns used are the category's well-known ones: image-led cards, standalone round tab buttons (no boxed bar), bottom sheets, order-tracker status, quick-add, sticky action.
- **Netflix mobile hero**: crisp photo at the top, progressive blur in the middle, fade to solid dark at the bottom, copy over the photo that fades out as you scroll.
- **iOS conventions**: safe-area insets, spring easing, bottom sheets with a grab handle, large titles, edge-to-edge content, `dvh/svh` units.

## Library decisions (no new dependency)
| Need | Decision | Why |
|---|---|---|
| Scroll-linked effects | one rAF-throttled scroll listener on the real scroll parent writes CSS variables (`--hero-p`, `--sy`) and toggles `data-solid`; `IntersectionObserver` adds `data-in` for reveals | zero bytes added; SharePoint scrolls an inner element, so `window`-based libraries misread it. GSAP ScrollTrigger (approved) is not needed. |
| Carousels | CSS scroll-snap + scroll-padding | native momentum on iOS, no library |
| Sheets | existing portal sheet pattern + CSS transforms | no dependency |
| Toggles | CSS `:has()` sliding thumb (already present), direction-aware pane keyframes | transform only |
| 3D tilt | tiny pointer hook writing `--rx/--ry`, CSS `perspective` | ~1 KB |
| Lenis / Framer Motion / Embla | rejected | smooth-scroll libs fight SharePoint's inner scroller; others add 20-40 KB for what CSS does |

## Per-screen design
1. **Edge to edge**: root measures its own left offset and the visible width, then sets `margin-left` and `width` so it spans the screen whatever SharePoint wraps it in; safe-area insets on header/tab area.
2. **Header**: transparent, no plate; official logo (white variant over the hero, teal once solid) crossfade; bell and avatar are separate 40 px circles; avatar opens **Profile only**.
3. **Hero (Netflix)**: full width, ~52svh; crisp top, masked backdrop blur band, fade to `#0b1f26`; copy and CTA fade/translate away as you scroll; content sheet rises over it.
4. **CTA**: small gold pill, icon, inner highlight and glow.
5. **Notices**: header row (icon, title, unread count, See all), glass cards with a category icon tile and urgency pill, snap carousel, <=120 px.
6. **KPIs**: 2-column stat tiles with asymmetric corners, icon tile, count-up, mini progress, soft coloured shadow, touch tilt.
7. **Cards**: four variants (hero, glass, ticket with side notches, stat tile); no plain rounded rectangles.
8. **Booking tracker**: bigger nodes, labels, pulse on the current step, line fill and drawing ticks.
9. **Bottom nav**: no container; five standalone round buttons floating over content, active one expands to a labelled pill, Book a larger gold circle; **More** opens its own sheet of destinations.
10. **Toggles**: pill track, spring-eased sliding thumb, direction-aware pane slide; Schedule's four views fit (icon above short label).
11. **Date strips**: 56x72 cells, centred selected date with scale/fill, month label, edge fades; Book day picker becomes a snapping strip.
12. **Carousels** (equipment): arrows inset and round, hidden on touch; cards snap with a peek.
13. **Scroll**: staggered reveal, sticky/condensing header, hero parallax; all off under reduced motion.
14. **Overflow**: `scripts/overflow-scan.browser.js` extended and run on every page at 320 to 430.

## Limits
Nothing was run in a real iOS SharePoint app. Backdrop blur is used on at most four surfaces per screen with a solid fallback.

## Addendum, 24 Nov 2026 (user review of the real 1.4.0 on a phone -> staging 1.5.0.0)
Design decisions (senior-design-engineer pass; each answers one review item):
- **A. One icon primitive.** Every icon container (stat/KPI icon, notice category tile, More-sheet icon, quick-action/shortcut dot, list avatars, help/insight/workspace icons, empty states, section-title icons) is a perfect **circle** with one elevated look: gradient fill, `0 10px 20px rgba(8,24,30,.28), 0 2px 4px rgba(8,24,30,.2)` outer shadow, inset top highlight and inset bottom shade. Size scale 44 / 40 / 32 / 24 only. Leaf corners and rounded squares are removed for icons. Cards keep their shapes (not asked). Equipment illustrations (`artTile`) are pictures, not icons, and stay as they are.
- **B. Notices** become a ~92 px strip: 28 px header row, 64-72 px cards (40 px circular icon, one-line title clamp, 12 px meta).
- **C. Book button** 52 px circle with a 22 px plus (was ~62 px with a 26 px glyph).
- **D. Icon clipping.** Cause audited: SVG glyphs drawn to the very edge of a 24 grid and the default `overflow: hidden` of an inner `<svg>`. Fix: every icon uses `viewBox="-1 -1 26 26"` with `overflow: visible`, so strokes and round joins never touch the clip.
- **E. Check in** gets the same header language as the other pages and a focal "Checklist" title (icon in a circle, heavy type, gold swash). Interaction: one easing family (spring for position, ease-out for fades), transform/opacity only, progress and tick animated.
- **F. Header** keeps a >= 16 px right inset plus the safe-area inset; the full-bleed width now uses the scroller's visible width, not the document width, so a scrollbar or iOS inset can never push the avatar off screen.
- **G. Messages** is a messaging console over the unchanged support logic: list -> new (topic tiles -> subject chips) -> chat; bubbles, day separators, ticks from `Outcome`, pinned composer with attach and round send, `visualViewport` keyboard safety; General shows a "Chat assistant (coming soon)" note only (no AI). Desktop: two panes.
- **H. Date strips**: circular date bubbles (weekday above, number in a circle, today = ring, selected = gradient circle with lift, dot for bookings), start padding so the first cell is fully visible.
- **I.** Book, Membership, Documents pick up the primitives (circular icons, pill buttons, shared headers); no logic changes.

## Addendum 2, 24 Nov 2026 (real Android phone review of 1.5.0.0 -> staging 1.6.0.0)
Decisions (motion budget: transform/opacity only, at most ONE continuous idle animation on screen, idle loops pause off screen through IntersectionObserver, nothing animates on high-frequency or keyboard actions, reduced motion = static):
1. **Book cart = floating glass capsule** (inset 12 px + safe area, above the floating nav with a gap). Circular 3D icon with a count badge that pops on change; line 1 "1 item · 4 h", line 2 the day and times (truncated); a compact pill "Review" with an arrow. Hidden (slid down) until something is chosen; one spring-ish drawer curve, no bounce on dismissal. The same capsule styling applies to the board dock.
2. **Mode picker** = horizontal snap row of mode cards (circular 3D icon, short label, selected = lift + teal ring + check that fades in). Selection is a 200 ms ease-out lift, not a sliding blob (cards scroll, so a moving indicator would fight the scroll).
3. Avatar position unchanged (user retracted).
4. Visual content over text: (a) the date strips sit on a frosted glass panel over a slowly drifting mesh (the page's one idle loop, paused off screen); date bubbles are glass spheres with a specular highlight, the selected one teal with lift. (b) Book's intro sentence becomes a 4-step visual (calendar, clock, equipment, check) with 2-3 word captions; icons pop once in a short stagger (< 300 ms total) and connectors draw once; the full sentence stays for screen readers. (c) Equipment tiles: chosen tile lifts with a soft moving-shadow look (static after a one-off pop) and tilts under the finger; no idle float (it would exceed the one-idle-loop budget with several tiles chosen). (d) Home: ambient light drifts behind the content sheet (Home's only idle loop); plan hours become a 3D-ish ring that fills once. (e) Empty states get a small illustration (a pot with rising steam, paused off screen). (f) Success moments (request sent, checklist sent, document sent, event/storage request sent) play one 700 ms celebration: a check that morphs in and 10 dots bursting outward, once, never on repeat clicks.
5. Copy trimmed to short headings and chips on Book, Home, My bookings, Check in, Documents, Billing, Membership; policy wording stays on Policies.

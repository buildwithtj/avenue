# UI research notes: the reference console and what Avenue does with it

Source: https://culina-rust.vercel.app/ (the developer's own prototype), read 24 Nov 2026 from its live stylesheets and DOM (document.styleSheets, getComputedStyle). Used for the member portal 2.22.0.0 / staging 1.1.0.0. The reference's calendar component is deliberately not used.

## Tokens
Teal `#0f4c5c` (primary), gold `#c9a24d` (accent), charcoal `#1f1f1f`, slate `#6b7280`, page `#f4f5f7`, card white with 1px `#e8eaec`, radii 12 (module cards) / 9 (rows, cards) / 7 (buttons, nav) / 999 (chips), shadow `0 2px 8px rgba(31,31,31,.03)`, primary-button shadow `0 2px 4px rgba(15,76,92,.11)`. Font computes to Arial/Helvetica. Heading 27px/650, letter-spacing -1.1px; eyebrow 12px/700 with a 16px gold line. Page structure: fixed 246px sidebar (72px rail when collapsed), sticky 58px top bar, content padded 35px.

## Motion the reference defines
- Easing `--motion-ease: cubic-bezier(.2,.7,.2,1)`; durations 160-320 ms for interactions, 350-550 ms for first entry, 0.8-1 s for progress/donut fills.
- Entry: `rise-in` / `dashboard-enter` (opacity 0->1, translateY 8-10px) on KPI cards, module views (350 ms), notification popover (200 ms); `modal-enter` (translateY 12px + scale .98, 280 ms) with a 180 ms `fade-in` backdrop; `toast-enter` 240 ms.
- Data: `fill-in` (bar width), `bar-in` (scaleY .2->1), `donut-in` (rotate -45deg->0).
- Hover: module rows / stat cards / tenant cards lift `translateY(-2px)`, gold border, soft shadow; nav items change background + colour in 200 ms; primary button lifts 1px.
- Press: `scale(.97)` on buttons, `.98` on nav items.
- Sidebar: `width .32s` + main-area margin, chevron rotates 180deg in 300 ms.
- A `.shimmer` class exists but the reference never defines a keyframe or a skeleton (it has no loading states; it is a static prototype).
- Reduced motion: it turns every entry animation and the sidebar transition off (`animation: none; transition: none`).
- Focus: global `:focus-visible { outline: 2px solid gold; outline-offset: 2px }` (offset -2px on nav items and rows).
- Disabled (shadcn utility classes): `opacity .5; pointer-events none`.

## Gaps in the reference that Avenue does better
1. **Gold focus ring is 2.4:1 on white** (needs 3:1). Avenue uses a teal ring (9.5:1) with a white halo; white on dark surfaces.
2. **Muted text `#6b7280` is 4.43:1 on the page background and 4.2:1 on the teal-tint chips** (needs 4.5:1). Avenue's muted token is `#5b6370` (5.56 / 5.26 / 6.06 on white).
3. **Gold chip text `#96752f` on `#f5f0e5` is 3.78:1.** Avenue uses `#80601e` (5.12:1).
4. Disabled grey `#9ca3af` on white is 2.54:1; Avenue keeps disabled controls labelled and uses opacity .55 only on controls that also carry a text reason.
5. Reference text is 8-11px in places; Avenue keeps 12px minimum (project rule).
6. No loading, error or empty states, no skeletons, no focus trap in the dialog, no Escape handling, no touch-target sizing. Avenue adds a shimmer skeleton, an empty-state block, dialog focus trap + Escape + focus return (Sheet), 44px targets on coarse pointers.
7. Status is shown by colour only in places; Avenue chips always carry a word.

## Contrast table (computed, WCAG relative luminance)
charcoal/white 16.5; slate(new)/white 6.06; slate(new)/page 5.56; slate(new)/#eaf0f1 5.26; teal/white 9.51; white/teal 9.51; teal/#eaf0f1 8.26; gold text `#80601e`/`#f5f0e5` 5.12; bad `#8a2c2c`/`#f8e7e9` 7.10; ring teal/white 9.51. Enforced by `contrast.test.ts`.

## Motion rules applied
transform and opacity only; 120-250 ms interactions, 240 ms entries, stagger 30 ms capped at 3 steps; nothing blocks input; `prefers-reduced-motion` and the portal's own `data-motion='reduce'` switch every animation and transition off (instant states); GSAP stays only where the Review sheet already uses it.

## Mobile app feel, v11–v14 (24 Nov 2026)
**Reference note.** The "Bisstro/Bistro by Blinkit" app could not be retrieved (no screens, no listing found by search), so it was NOT copied. The patterns below are the common ones of best-in-class food/hospitality and product apps (Blinkit/Zomato/Swiggy/Uber Eats/DoorDash cards and cart bars, Airbnb image-led cards, iOS HIG tab bar and sheets, Material 3 navigation bar, Linear/Stripe/Vercel restraint, Radix/shadcn segmented and tabs behaviour), recorded here as design choices, not as a copy of any one app.
- **Hero.** Phone: full-width, square, edge-to-edge photo banner (~300–340 px) behind the translucent top bar, greeting + status pill + primary button on a dark scrim (white text AA); round quick-action shortcuts and a snap-scrolling notice rail directly below on the page background. Desktop/tablet: full-bleed square banner (360–440 px) flush with the top bar and sidebar, shortcuts overlaid, bottom fade into the page. One image constant (`homeImage`).
- **Bottom nav.** Floating rounded (28 px) light frosted bar, five equal columns, one 24 px / 1.75 px line-icon set, 12 px labels on one baseline, a sliding teal-tint pill behind the active tab, a raised gold circular Book button, badge dot top-right of its icon, safe-area inset; bar height + 16 px reserved at the page bottom.
- **Segmented control.** Pill track with a sliding thumb (transform only, ~240 ms spring), driven by `:has()` (no JS, no re-render); equal segments, 44+ px.
- **Buttons.** 16 px radius, 46 px height; primary = teal gradient + coloured shadow, secondary = tonal tint (no border), disabled clearly legible; press = scale .97 in <100 ms; icons inline (Check in, Book).
- **Progress.** Order-tracker steps (Requested → Approved → In use → Done) on every booking; stepper for check-in; count-up on KPI numbers; staggered card entry.
- **Not done / not measured:** a −/count/+ in-place stepper for equipment (each unit is a unique item, so a toggle with a pop animation + bump on the bottom bar is used instead); loading-spinner/success-tick states inside buttons (no shared loading markup exists yet); swipe gestures on list rows; real-phone measurements.
## Performance (measured in desktop Chrome, 390 px iframe, no CPU throttling, dev bundle)
- Tab switch to two painted frames: 38–51 ms (Bookings 38, Book 45, Schedule 38, Home 51). Long tasks (>50 ms): none recorded during six tab switches. Scroll ≈ 61 fps. CLS: ≈ 0.006 per tab switch after the first load, 0.19 across a first-visit session (first loads of data-driven pages). No horizontal overflow on 12 pages at 343 px.
- Handlers: hero parallax is passive, rAF-throttled, height cached (no layout read while scrolling); only transform/opacity are animated; `content-visibility:auto` on below-the-fold cards; `touch-action: manipulation`; `overscroll-behavior: contain` in sheets.
- Bundle: the unused inlined webfont (64 KB) was removed (the font token is the system stack).
- **Not measured:** 4x CPU throttling, a real phone, INP on a real device, memory.

# Design brief — Avenue prototype v2

Written 2026-11-11 after the first prototype was judged not good enough to show the client. This records what was researched, what changed, and the rules the design keeps so that nothing shown is something the agreed platforms cannot deliver.

## Why v1 fell short

- It read as an admin form: equal-weight cards, no hierarchy, no icons, no sense of "what do I do now".
- Every amount was blank, so billing and plans looked unfinished.
- The demo controls (scenario and role dropdowns) made the presenter do the storytelling.
- The phone view was the desktop layout squeezed, and the calendar needed sideways scrolling.

## Research (checked 2026-11-11)

| Finding | Source | Effect on the design |
|---|---|---|
| Shared-kitchen products lead with self-serve scheduling of space and equipment, automatic payment, compliance documents and member communication; a reviewer highlights members seeing current usage and cost in real time. Vendor and aggregator material, so promotional. | [The Food Corridor](https://www.thefoodcorridor.com), [G2 reviews](https://www.g2.com/products/the-food-corridor), [Optix](https://optixapp.com/solutions-page-shared-kitchens) | Home now leads with the next booking and a usage-and-cost summary. |
| A web part can be offered as a single-part app page (`supportedHosts` includes `SharePointFullPage`); the layout is locked, and the site header and navigation follow the site type. | [Single part app pages](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/single-part-app-pages), [SPFx 1.7 notes](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.7.0) | The prototype keeps SharePoint's top bar and site header visible. It does not pretend they disappear. |
| Canvas apps have Fluent 2 "modern controls". Responsive layouts use auto-layout and grid containers with Scale to fit turned off; Data table and Chart controls are not supported inside layout containers. | [Modern controls](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/overview-modern-controls), [Responsive layouts](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/create-responsive-layout) | Staff screens use gallery-style lists and cards, not data tables. The bar chart is drawn as a gallery of bars. |
| Resource timelines (one row per room) suit desktop; booking products switch to a day list on phones and let users tap an empty slot to book. Single-vendor documentation, not a standard. | [Booking system responsive guide](https://amazscript.github.io/booking-system/responsive.html), [Calendar UI examples](https://www.eleken.co/blog-posts/calendar-ui) | Desktop: click a free time on a station row. Phone: a list of free slots per station with a Book button. |

## Design decisions

1. **One clear next action per screen.** Home opens on the next booking with Check in; the Book button is always in reach.
2. **Booking in a side panel** (Fluent UI Panel on desktop, full-screen sheet on phone) so the calendar stays visible behind it.
3. **Example figures, labelled.** Plan names, prices, allowances and invoice amounts are shown with an "example" tag and can be switched off. They are not Flavors' prices and are not proposals (Q-04).
4. **Guided tour.** Nine steps with a one-line talking point each replace the scenario dropdowns as the main way to present.
5. **Fictional members.** Sweet Maple Bakery, Harvest Table Catering, Green Leaf Foods and Blue Door Dumplings are invented sample names.

## Rules that keep it honest

- Member portal: only what one SPFx web part can render — React, Fluent UI controls, CSS and inline SVG. Icons are stand-ins for Fluent UI icons.
- Staff app: only canvas-app building blocks — galleries, forms, toggles, containers, overlay dialogs, simple charts. Shown at 1366×768 scaled to fit; no phone layout is claimed.
- Stripe pages and Microsoft sign-in remain labelled placeholders.
- Undecided rules keep an amber "to confirm" marker tied to `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.
- The theme colour and the "A" mark are proposals; brand files have not been supplied.
- It is an HTML prototype with sample data. It is not the application and is connected to nothing.

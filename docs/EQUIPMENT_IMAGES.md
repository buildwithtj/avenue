# Equipment images (placeholders)

Status 18 Nov 2026: **no equipment photos exist publicly.** The client asked for real images on the booking page; only one usable photo was found.

## Source decision
The coordinator changed the source on 18 Nov 2026: do not use the Google Meet call recordings. Frames from `Screen Recording 2026-11-16 ... 7.51.22 PM.mov` were examined and then dropped; nothing from them is in the repository. Only public pages (curl, no login) were checked.

| Source | Result |
|---|---|
| https://flavorsculinaryhub.com (home, about-us, memberships and four membership pages) | Mostly stock photography and staff portraits (skipped: identifiable people, third-party stock). One real photo of the client's own dining room. No kitchen, stove, oven, prep-table or warmer photos. |
| https://flavors.nexudus.site/flavors/public/bookings | Client-rendered app (React); the HTML contains no images. Its API at `/api/public/...` is routed to the SPA shell on that host and returns 500 from `spaces.nexudus.com` without a tenant session; I did not probe further. No resource photos reachable. `llms.txt` lists only meeting rooms and event spaces. |

## What ships
| Image | Used for | Source URL (original filename) |
|---|---|---|
| `dining-room.jpg` (960x504, 70 KB) | `heroImage`, `diningRoomImage` | https://flavorsculinaryhub.com/wp-content/uploads/2024/06/Flavors-slider-image.jpg (1561x820 original) |

Selection method: viewed every `<img>`/CSS background on the pages above; kept only photos with no people that show the client's own space. It is the dining room, not the kitchen, and must not be presented as the kitchen.

No per-equipment or per-category images: nothing honest exists, so `equipmentImage(id, category)` returns `undefined` for all 15 ids in `schema/equipment.seed.mjs` and the UI must draw its own placeholder. Nothing was fabricated or borrowed from stock.

## Mechanism (verified)
`apps/member-spfx/src/webparts/avenuePortal/assets/index.ts` exports `equipmentImage(equipmentId, category?)`, `heroImage`, `diningRoomImage`. Images are **inlined as base64 data URIs** in `imageData.generated.ts` (about 94 KB of source for one 70 KB JPEG, so about 1.34x per image).

Why not `import img from './x.jpg'`: the rig copies `.jpg/.png/.svg` into `lib/` (`staticAssetsToCopy`) and generates `*.d.ts` typings, but there is no jest transform for them, so any test that imports a component importing a `.jpg` fails to parse. Data URIs work in webpack, jest and the .sppkg with no extra config. I did not try a webpack emit loader (cannot change config in this scope).

Build: `npm run build` exits 0, 238 jest tests pass (2 new in `assets/assets.test.ts`), `.sppkg` produced. The module is not yet imported by any component, so webpack tree-shakes it out of the current bundle; it ships inside `ClientSideAssets/avenue-portal-web-part_*.js` once the UI imports it. Budget: keep the total of data URIs about 1 MB, since the web part bundle is one JS file.

To add photos: put the JPEG (960 px max, about q72, at most 90 KB) next to `index.ts`, add it to `gen_assets.py` and to `BY_ID` / `BY_CATEGORY` in `index.ts`, and add a row to the table above.

## Replacement [PROPOSED]
These are placeholders. Ask Flavors for proper photos of each unit (stove, grill, convection oven, warmer, pizza oven, prep tables). `AvenueEquipment.PhotoUrl` overrides any bundled image.

## Image to equipment id
| Image | Equipment ids |
|---|---|
| `dining-room.jpg` | none (hero only) |
| stove-1/2, grill-1/2, convection-upper/lower, warmer-1/2, pizza-oven-1-upper, prep-table-1..6 | no image available |

## AI-generated photos (27 Nov 2026, staging 1.15)
The developer asked for realistic photos of every equipment kind and a better Home photo, generated with Higgsfield because the client has supplied none. These are **AI images, not the client's own equipment or room**; replace them with real photos when Flavors sends them (a unit's `AvenueEquipment.PhotoUrl` still overrides the bundled photo).
- Tool: Higgsfield web app, model GPT Image 2.6 Sunburst, **Unlimited mode** (no credits used; balance checked before and after: 357.5 credits throughout), 4:3 for equipment, 16:9 for Home.
- Home: image-to-image from `dining-room.jpg` (same room, better light). Equipment: text-to-image, one per kind: stove, flattop, oven (upper and lower share it), warmer, pizza, prep, fryer, rack, fridge.
- Files: originals in `apps/member-spfx/src/webparts/avenuePortal/assets/photos/src/`, web copies in `assets/photos/*.jpg`, bundled data URIs in `assets/photoData.generated.ts` (run `python3 gen_photos.py` after changing `photos/src`). Equipment 480 px, Home 1440 px.
- Code: `artPhoto(kind)` and `homeImage` in `assets/index.ts`; `EquipmentArt` shows the photo instead of the drawing. New art kinds `fryer`, `rack`, `fridge` in `artKeyFor`.

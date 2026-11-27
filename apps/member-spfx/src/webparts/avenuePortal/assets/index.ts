// Bundled placeholder photos. Only imagery verified as the client's own public photo is included; there are NO equipment photos
// (the client's public site and booking portal expose none), so equipmentImage() returns undefined for every unit until real
// photos are added to imageData.generated.ts / gen_assets.py. AvenueEquipment.PhotoUrl always overrides a bundled image.
// Images are inlined as data URIs: webpack here has no emitting loader and jest has no asset transform (see docs/EQUIPMENT_IMAGES.md).
import { DINING_ROOM } from './imageData.generated';
import { PHOTOS } from './photoData.generated';

const BY_ID: Record<string, string> = {};
const BY_CATEGORY: Record<string, string> = {};

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Bundled photo for a unit (by EquipmentId), else its category, else undefined (caller shows its own placeholder). */
export function equipmentImage(equipmentId: string, category?: string): string | undefined {
  return BY_ID[equipmentId] ?? (category ? BY_CATEGORY[slug(category)] : undefined);
}

/** Client's real dining room photo; NOT the kitchen (no kitchen photo is publicly available). */
export const heroImage: string = DINING_ROOM;
export const diningRoomImage: string = DINING_ROOM;

export { LOGO_ON_DARK as brandLogoOnDark, LOGO_ON_LIGHT as brandLogoOnLight, LOGO_MARK as brandMark } from './brand.generated';

/** The picture on the Home page. Swap the client's final image by changing ONLY this line (any data URI or URL). */
export const homeImage: string = PHOTOS.home || DINING_ROOM;

/** Bundled photo for an equipment kind (ArtKey: stove, flattop, oven, warmer, pizza, prep, fryer, rack, fridge). Upper/lower ovens share 'oven'.
 *  AI-generated (Higgsfield, 27 Nov 2026) because the client has supplied no equipment photos; replace with real ones when they arrive. */
export function artPhoto(kind: string): string | undefined {
  const k: string = kind === 'oven-upper' || kind === 'oven-lower' ? 'oven' : kind;
  return k === 'home' ? undefined : PHOTOS[k];
}

export { LOGO_VIEWBOX as siteLogoViewBox, LOGO_RATIO as siteLogoRatio, LOGO_SERIF as siteLogoSerif, LOGO_SANS as siteLogoSans, LOGO_DOT as siteLogoDot } from './logo.generated';

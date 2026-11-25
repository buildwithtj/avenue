// Bundled placeholder photos. Only imagery verified as the client's own public photo is included; there are NO equipment photos
// (the client's public site and booking portal expose none), so equipmentImage() returns undefined for every unit until real
// photos are added to imageData.generated.ts / gen_assets.py. AvenueEquipment.PhotoUrl always overrides a bundled image.
// Images are inlined as data URIs: webpack here has no emitting loader and jest has no asset transform (see docs/EQUIPMENT_IMAGES.md).
import { DINING_ROOM } from './imageData.generated';

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
export const homeImage: string = DINING_ROOM;

// Starting AvenueEquipment catalogue for the REAL site (not test data: ids carry no "gaptest-" / "demo-" prefix).
// Source: old-system (Nexudus) screens shown by the client on the 16 Nov 2026 call.
// The list is PARTIAL, and the counts (about 6 prep tables) are UNCONFIRMED until the client's Equipment tab arrives (Q-B7).
// PURE: builds records, writes nothing. Loader: schema/equipment.load.browser.js (adds missing rows by EquipmentId only).
export const CATEGORIES = ['Stove', 'Grill', 'Oven', 'Warmer', 'Pizza oven', 'Fridge', 'Mixer', 'Prep table', 'Other'];

// Source: client master-data sheet, 19 Nov 2026 (Spaces tab). Pizza ovens: "keep but leave unavailable for now" (6th element = false).
// Fridges are assigned automatically, one per booking (client, 19 Nov).
const UNITS = [
  ['stove-1', 'Gas Stove w/Under Oven #1', 'Stove', 'Gas stove with an under oven'],
  ['stove-2', 'Gas Stove w/Under Oven #2', 'Stove', 'Gas stove with an under oven'],
  ['grill-1', 'Flat Top Gas Grill #1', 'Grill', 'Flat top gas grill'],
  ['grill-2', 'Flat Top Gas Grill #2', 'Grill', 'Flat top gas grill'],
  ['fryer-table', 'Open Equipment Table Under Hood for Fryer', 'Other', 'Open table under the hood; members bring their own fryer'],
  ['pizza-oven-1-upper', 'Electric Pizza Oven 1 (Upper)', 'Pizza oven', 'Kept, unavailable for now', undefined, false],
  ['pizza-oven-2-middle', 'Electric Pizza Oven 2 (Middle)', 'Pizza oven', 'Kept, unavailable for now', undefined, false],
  ['pizza-oven-3-lower', 'Electric Pizza Oven 3 (Lower)', 'Pizza oven', 'Kept, unavailable for now', undefined, false],
  ['convection-upper', 'Convection Oven (Upper)', 'Oven', 'Double convection oven; the upper and lower racks must be reserved individually', 'convection-oven'],
  ['convection-lower', 'Convection Oven (Lower)', 'Oven', 'Double convection oven; the upper and lower racks must be reserved individually', 'convection-oven'],
  ['warmer-1', 'Electric Warming Holding Cabinet #1', 'Warmer', 'Electric warming cabinet'],
  ['warmer-2', 'Electric Warming Holding Cabinet #2', 'Warmer', 'Electric warming cabinet'],
  ['fridge-1', 'Reach-In Double Door Refrigerator #1', 'Fridge', 'Complimentary: one per booking, assigned automatically, use during the booking only'],
  ['fridge-2', 'Reach-In Double Door Refrigerator #2', 'Fridge', 'Complimentary: one per booking, assigned automatically, use during the booking only'],
  ['baker-rack-1', "Baker's Rack #1", 'Other', "Baker's rack"],
  ['baker-rack-2', "Baker's Rack #2", 'Other', "Baker's rack"],
  ...[1, 2, 3, 4, 5, 6].map(n => [`prep-table-${n}`, `Prep table ${n}`, 'Prep table', 'Prep table'])
];

/** @returns {{key:string, fields:Record<string,unknown>}[]} key = EquipmentId; fields are AvenueEquipment columns. */
export function buildEquipment({ facilityId = 'flavors-hyattsville' } = {}) {
  return UNITS.map(([id, title, cat, description, group, on = true], i) => ({
    key: id,
    fields: {
      Title: title, FacilityId: facilityId, EquipmentId: id,
      Kind: cat === 'Prep table' ? 'Prep table' : 'Equipment',
      Category: cat, Description: description, Location: 'Kitchen',
      SortOrder: (i + 1) * 10, Active: on, BookableByMembers: on,
      ...(group ? { GroupId: group } : {})
    }
  }));
}

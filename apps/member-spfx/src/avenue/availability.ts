// Pure availability rules for the Kitchen Bookings screens. No I/O. Approved calendar entries block; pending requests
// never do (members cannot see each other's pending requests). Everything shown comes from ICalendarEntry, which is
// already the privacy-safe shape: the member display name is the only person data (existing rule), never more.

import type { ICalendarEntry, IFacility, IResource } from './contracts';
import { addDays, localTime, zonedToUtc } from './calendar';

/** Used when the facility does not set minPrepTables (agreed 11 Nov 2026). */
export const DEFAULT_MIN_PREP_TABLES: number = 2;

/** Busy-map keys that are not equipment ids. A whole-facility booking blocks every unit and the dining room. */
export const WHOLE_FACILITY_KEY: string = '*';
export const DINING_KEY: string = '#dining';

export interface IBusyInterval { startMs: number; endMs: number; bookingId?: string; label?: string; /** Quiet gap kept free around the booking (client: 1 hour between bookings on the same equipment). */ padMs?: number }
/** unitId (EquipmentId) -> approved busy intervals. Also holds WHOLE_FACILITY_KEY and DINING_KEY. */
export type BusyMap = Map<string, IBusyInterval[]>;

export type BookingMode = 'equipment' | 'whole-kitchen' | 'dining' | 'private-event';

const MIN_MS: number = 60000;

function add(map: BusyMap, key: string, iv: IBusyInterval): void {
  const list: IBusyInterval[] | undefined = map.get(key);
  if (list) { list.push(iv); } else { map.set(key, [iv]); }
}

/**
 * Builds the busy map from APPROVED calendar entries. `ignoreBookingId` leaves one booking out (editing or extending it
 * must not clash with itself). EquipmentIds are already split by the reader (';' in the list).
 */
export function buildBusyMap(entries: ICalendarEntry[], ignoreBookingId?: string, gapMinutes: number = 0): BusyMap {
  const map: BusyMap = new Map();
  for (const e of entries) {
    const startMs: number = Date.parse(e.startUtc);
    const endMs: number = Date.parse(e.endUtc);
    if (e.bookingId === ignoreBookingId || isNaN(startMs) || isNaN(endMs) || endMs <= startMs) { continue; }
    const iv: IBusyInterval = { startMs, endMs, bookingId: e.bookingId, label: e.memberName, padMs: gapMinutes > 0 ? gapMinutes * MIN_MS : 0 };
    const ids: string[] = e.equipmentIds.slice();
    if (e.resourceId && ids.indexOf(e.resourceId) < 0) { ids.push(e.resourceId); }
    ids.forEach(id => add(map, id, iv));
    if (e.space === 'Whole facility') { add(map, WHOLE_FACILITY_KEY, iv); }
    if (e.space === 'Dining') { add(map, DINING_KEY, iv); }
  }
  return map;
}

function conflicts(unitId: string, startMs: number, endMs: number, busy: BusyMap): IBusyInterval[] {
  // Touching (end == start) is not an overlap.
  return (busy.get(unitId) || []).concat(busy.get(WHOLE_FACILITY_KEY) || []).filter(b => startMs < b.endMs + (b.padMs || 0) && endMs > b.startMs - (b.padMs || 0));
}

export interface IUnitStatus { free: boolean; takenUntilUtc?: string }

/** Is the unit free in [startUtc, endUtc)? When not, `takenUntilUtc` is when the unit is next free (back-to-back bookings chain). */
export function unitStatus(unitId: string, startUtc: string, endUtc: string, busy: BusyMap): IUnitStatus {
  const s: number = Date.parse(startUtc);
  const e: number = Date.parse(endUtc);
  const hits: IBusyInterval[] = conflicts(unitId, s, e, busy);
  if (hits.length === 0) { return { free: true }; }
  const all: IBusyInterval[] = (busy.get(unitId) || []).concat(busy.get(WHOLE_FACILITY_KEY) || []);
  let until: number = Math.max(...hits.map(h => h.endMs + (h.padMs || 0)));
  for (let moved: boolean = true; moved;) {
    moved = false;
    for (const b of all) {
      if (b.startMs - (b.padMs || 0) <= until && b.endMs + (b.padMs || 0) > until) { until = b.endMs + (b.padMs || 0); moved = true; }
    }
  }
  return { free: false, takenUntilUtc: new Date(until).toISOString() };
}

/** Names of the companies holding a unit in the window (display name only, as the calendar already shows). */
export function unitHolders(unitId: string, startUtc: string, endUtc: string, busy: BusyMap): string[] {
  const names: string[] = conflicts(unitId, Date.parse(startUtc), Date.parse(endUtc), busy).map(b => b.label || '').filter(Boolean);
  return names.filter((n, i) => names.indexOf(n) === i);
}

function isFridge(u: IResource): boolean {
  return u.category === 'Fridge';
}
function isPrep(u: IResource): boolean {
  return u.category === 'Prep table' || (!u.category && u.kind === 'Prep table');
}
function bookable(u: IResource): boolean {
  return u.bookable !== false;
}
function bySort(a: IResource, b: IResource): number {
  const sa: number = a.sortOrder === undefined ? Number.MAX_SAFE_INTEGER : a.sortOrder;
  const sb: number = b.sortOrder === undefined ? Number.MAX_SAFE_INTEGER : b.sortOrder;
  return sa - sb || a.title.localeCompare(b.title) || a.resourceId.localeCompare(b.resourceId);
}

/** Bookable prep tables, in display order. */
export function prepTables(units: IResource[]): IResource[] {
  return units.filter(u => isPrep(u) && bookable(u)).sort(bySort);
}
/** Bookable cooking equipment (everything bookable that is not a prep table), in display order. */
export function cookingUnits(units: IResource[]): IResource[] {
  return units.filter(u => !isPrep(u) && !isFridge(u) && bookable(u)).sort(bySort);
}
/** Complimentary refrigerators: never picked by members; one is assigned to every equipment booking (client sheet, 19 Nov 2026). */
export function fridgeUnits(units: IResource[]): IResource[] {
  return units.filter(u => isFridge(u) && bookable(u)).sort(bySort);
}

/** Picks `count` free prep tables by sortOrder. `shortBy` is how many fewer than `count` were free. */
export function assignPrepTables(units: IResource[], busy: BusyMap, startUtc: string, endUtc: string, count: number): { ids: string[]; shortBy: number } {
  const ids: string[] = prepTables(units).filter(u => unitStatus(u.resourceId, startUtc, endUtc, busy).free).slice(0, Math.max(0, count)).map(u => u.resourceId);
  return { ids, shortBy: Math.max(0, count - ids.length) };
}

/** True when every bookable cooking unit is free: drives the "All cooking equipment is free in this window" banner. */
export function cookingEquipmentFree(units: IResource[], busy: BusyMap, startUtc: string, endUtc: string): boolean {
  return cookingUnits(units).every(u => unitStatus(u.resourceId, startUtc, endUtc, busy).free);
}

export interface ISelectionInput {
  mode: BookingMode;
  /** Equipment picked (cooking units). Prep-table ids in here are ignored: prep tables are assigned from prepTableCount. */
  unitIds: string[];
  prepTableCount: number;
  startUtc: string;
  endUtc: string;
  units: IResource[];
  busy: BusyMap;
  facility: IFacility;
  nowMs: number;
}
export interface ISelectionResult {
  ok: boolean;
  /** Short plain sentences for the member. */
  problems: string[];
  unavailable: { unitId: string; title: string; takenUntilUtc?: string }[];
  /** The unit ids to put on the request (picked equipment plus assigned prep tables, or all units for whole-kitchen / private-event). Empty for dining. */
  resolvedUnitIds: string[];
}

/** Checks a booking selection against the rules in the plan (section 4). Length and step are checked only when the facility sets them. */
export function validateSelection(input: ISelectionInput): ISelectionResult {
  const { mode, units, busy, facility, startUtc, endUtc } = input;
  const problems: string[] = [];
  const unavailable: ISelectionResult['unavailable'] = [];
  const tz: string = facility.timeZone;
  const title = (id: string): string => (units.filter(u => u.resourceId === id)[0] || { title: id }).title;
  const taken = (id: string, name: string, tail: string): void => {
    const st: IUnitStatus = unitStatus(id, startUtc, endUtc, busy);
    if (!st.free) {
      unavailable.push({ unitId: id, title: name, takenUntilUtc: st.takenUntilUtc });
      problems.push(`${name} is booked until ${localTime(st.takenUntilUtc as string, tz)}. ${tail}`);
    }
  };

  const s: number = Date.parse(startUtc);
  const e: number = Date.parse(endUtc);
  const timeOk: boolean = !isNaN(s) && !isNaN(e) && e > s;
  if (isNaN(s) || isNaN(e)) {
    problems.push('Choose a start and end time.');
  } else if (e <= s) {
    problems.push('The end time must be after the start time.');
  } else {
    if (s < input.nowMs) { problems.push('The start time is in the past.'); }
    const mins: number = (e - s) / MIN_MS;
    const { minBookingMinutes: lo, maxBookingMinutes: hi, bookingStepMinutes: step } = facility;
    if (lo !== undefined && mins < lo) { problems.push(`Book at least ${lo} minutes.`); }
    if (hi !== undefined && mins > hi) { problems.push(`Book at most ${hi} minutes.`); }
    if (step !== undefined && mins % step !== 0) { problems.push(`Book in steps of ${step} minutes.`); }
  }

  const cooking: IResource[] = cookingUnits(units);
  const prep: IResource[] = prepTables(units);
  let resolved: string[] = [];

  if (timeOk) {
    if (mode === 'equipment') {
      const minPrep: number = facility.minPrepTables === undefined ? DEFAULT_MIN_PREP_TABLES : facility.minPrepTables;
      const picked: string[] = input.unitIds.filter((id, i) => input.unitIds.indexOf(id) === i && !prep.some(p => p.resourceId === id));
      if (picked.some(id => !cooking.some(c => c.resourceId === id))) {
        problems.push('Some of the equipment you chose is not available to book.');
      }
      picked.filter(id => cooking.some(c => c.resourceId === id)).forEach(id => taken(id, title(id), 'Choose another time or equipment.'));
      if (input.prepTableCount < minPrep) {
        problems.push(`Include at least ${minPrep} prep tables.`);
      }
      const tables: { ids: string[]; shortBy: number } = assignPrepTables(units, busy, startUtc, endUtc, input.prepTableCount);
      if (tables.shortBy > 0) {
        problems.push(`Only ${tables.ids.length} prep ${tables.ids.length === 1 ? 'table is' : 'tables are'} free then. Choose another time or fewer tables.`);
      }
      const fr: IResource[] = fridgeUnits(units);
      const freeFridge: IResource | undefined = fr.filter(u => unitStatus(u.resourceId, startUtc, endUtc, busy).free)[0];
      if (fr.length > 0 && !freeFridge) { problems.push('No refrigerator is free then (one comes with every booking). Choose another time.'); }
      resolved = picked.concat(tables.ids, freeFridge ? [freeFridge.resourceId] : []);
    } else if (mode === 'whole-kitchen' || mode === 'private-event') {
      const all: IResource[] = cooking.concat(prep, fridgeUnits(units));
      all.forEach(u => taken(u.resourceId, u.title, 'Choose another time.'));
      resolved = all.map(u => u.resourceId);
      if (mode === 'private-event') { taken(DINING_KEY, 'The dining room', 'Choose another time.'); }
    } else {
      taken(WHOLE_FACILITY_KEY, 'The whole facility', 'Choose another time.');
    }
  }
  return { ok: problems.length === 0, problems, unavailable, resolvedUnitIds: resolved };
}

/**
 * The next start times (ISO UTC, on `stepMinutes` boundaries from `fromUtc`, up to `limit`, within `horizonHours`) when
 * every one of `unitIds` is free for `durationMinutes`.
 */
export function nextFreeSlots(unitIds: string[], durationMinutes: number, fromUtc: string, busy: BusyMap, stepMinutes: number = 30, limit: number = 3, horizonHours: number = 48): string[] {
  const from: number = Date.parse(fromUtc);
  if (isNaN(from) || !(durationMinutes > 0) || !(stepMinutes > 0)) { return []; }
  const stepMs: number = stepMinutes * MIN_MS;
  const result: string[] = [];
  const last: number = from + horizonHours * 60 * MIN_MS;
  for (let t: number = Math.ceil(from / stepMs) * stepMs; t <= last && result.length < limit; t += stepMs) {
    const a: string = new Date(t).toISOString();
    const b: string = new Date(t + durationMinutes * MIN_MS).toISOString();
    if (unitIds.every(id => unitStatus(id, a, b, busy).free)) { result.push(a); }
  }
  return result;
}

export interface ITimelineSegment { startMin: number; endMin: number; label?: string }
export interface IDayTimeline {
  dayStartUtc: string;
  dayEndUtc: string;
  /** Real elapsed minutes in the facility-local day: 1440, or 1380 / 1500 on a daylight-saving change. */
  totalMinutes: number;
  /** Segment minutes are elapsed minutes since local midnight (not wall-clock minutes), so they scale directly to totalMinutes. */
  rows: { unitId: string; title: string; segments: ITimelineSegment[] }[];
}

/** Schedule-board data for one facility-local day (YYYY-MM-DD): bookable units in display order with busy segments clipped to the day. */
export function dayTimeline(units: IResource[], busy: BusyMap, dayYmd: string, timeZone: string): IDayTimeline {
  const dayStart: number = Date.parse(zonedToUtc(dayYmd, '00:00', timeZone));
  const dayEnd: number = Date.parse(zonedToUtc(addDays(dayYmd, 1), '00:00', timeZone));
  const rows = units.filter(bookable).sort(bySort).map(u => {
    const segments: ITimelineSegment[] = (busy.get(u.resourceId) || []).concat(busy.get(WHOLE_FACILITY_KEY) || [])
      .filter(b => b.startMs < dayEnd && b.endMs > dayStart)
      .sort((a, b) => a.startMs - b.startMs)
      .map(b => ({ startMin: (Math.max(b.startMs, dayStart) - dayStart) / MIN_MS, endMin: (Math.min(b.endMs, dayEnd) - dayStart) / MIN_MS, label: b.label }));
    return { unitId: u.resourceId, title: u.title, segments };
  });
  return { dayStartUtc: new Date(dayStart).toISOString(), dayEndUtc: new Date(dayEnd).toISOString(), totalMinutes: (dayEnd - dayStart) / MIN_MS, rows };
}

/** Booked time only (not per piece of equipment). Hours over the plan bill next month; no money is computed here. */
export function hoursPreview(durationMs: number, planHours: number, usedHours: number): { thisBooking: number; leftAfter: number; over: number } {
  const r = (n: number): number => Math.round(n * 100) / 100;
  const thisBooking: number = Math.max(0, durationMs) / 3600000;
  return { thisBooking: r(thisBooking), leftAfter: r(Math.max(0, planHours - usedHours - thisBooking)), over: r(Math.max(0, usedHours + thisBooking - planHours)) };
}

// Pure view helpers for the redesigned member console (kits, board geometry, agenda grouping, heat map, calendar file,
// live phase headline). No React, no network. Availability and booking rules stay in availability.ts / windows.ts; every
// member-facing sentence about windows still comes from copy.ts. Anything marked [PROPOSED] is an engineering idea, not a
// client decision.

import { type BookingMode, type BusyMap, type IDayTimeline, type ITimelineSegment, DEFAULT_MIN_PREP_TABLES, assignPrepTables, cookingUnits, dayTimeline, prepTables } from './availability';
import { addDays, localDay, localTime } from './calendar';
import { approvalNote, cleaningLine, earlyEntryLine, phaseLine } from './copy';
import { EQUIPMENT_CATEGORIES, type EquipmentCategory, type ICalendarEntry, type IFacility, type IMyRequest, type IResource } from './contracts';
import { type IWindowBooking, bookingPhase, bookingWindows, endsInText, startsInText } from './windows';
import { minuteToUtc } from './ui-helpers';

const MIN_MS: number = 60000;

/** "AC" for "Ana Cook", "A" for "Ana", "?" for nothing. */
export function initials(name: string): string {
  const parts: string[] = (name || '').replace(/[^A-Za-z0-9À-ɏ\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) { return '?'; }
  return (parts.length === 1 ? parts[0].slice(0, 1) : parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

// ---- Kits: start from what you are making ----

export type KitKey = 'hot-line' | 'bakery' | 'prep' | 'whole-kitchen' | 'dining' | 'private-event';

export interface IKit {
  key: KitKey;
  title: string;
  sub: string;
  mode: BookingMode;
  /** Categories whose first bookable unit is pre-selected (equipment kits only). */
  categories: EquipmentCategory[];
}

/** [PROPOSED] Kit contents. A category kit picks the first bookable unit of each category; the member toggles the rest on the board. */
export const KITS: IKit[] = [
  { key: 'hot-line', title: 'Hot line', sub: 'Stove and flat-top grill', mode: 'equipment', categories: ['Stove', 'Grill'] },
  { key: 'bakery', title: 'Bakery and ovens', sub: 'Oven, pizza oven and mixer', mode: 'equipment', categories: ['Oven', 'Pizza oven', 'Mixer'] },
  { key: 'prep', title: 'Prep only', sub: 'Prep tables, no cooking', mode: 'equipment', categories: [] },
  { key: 'whole-kitchen', title: 'Whole kitchen', sub: 'Every unit, just for you', mode: 'whole-kitchen', categories: [] },
  { key: 'dining', title: 'Dining room', sub: 'Tables for a meal or pop-up', mode: 'dining', categories: [] },
  { key: 'private-event', title: 'Private event', sub: 'The whole building', mode: 'private-event', categories: [] }
];

export function kitByKey(key: KitKey): IKit {
  return KITS.filter(k => k.key === key)[0];
}

export interface IKitSelection { mode: BookingMode; unitIds: string[]; prepTableCount: number }

/** What a kit pre-selects: the mode, the cooking units, and the facility's minimum number of prep tables (default 2). */
export function kitSelection(key: KitKey, units: IResource[], facility: IFacility): IKitSelection {
  const kit: IKit = kitByKey(key);
  const minPrep: number = facility.minPrepTables === undefined ? DEFAULT_MIN_PREP_TABLES : facility.minPrepTables;
  const cooking: IResource[] = cookingUnits(units);
  const unitIds: string[] = kit.mode !== 'equipment' ? [] : kit.categories
    .map(c => cooking.filter(u => (u.category || 'Other') === c)[0])
    .filter((u): u is IResource => !!u).map(u => u.resourceId);
  return { mode: kit.mode, unitIds, prepTableCount: Math.min(Math.max(minPrep, 0), Math.max(prepTables(units).length, minPrep)) };
}

/** Equipment grouped by category in display order (prep tables only when `withPrep`). */
export function categoryGroups(units: IResource[], withPrep: boolean = false): { category: EquipmentCategory; title: string; units: IResource[] }[] {
  const titles: Record<EquipmentCategory, string> = {
    'Stove': 'Stoves', 'Grill': 'Grills', 'Oven': 'Ovens', 'Warmer': 'Warmers', 'Pizza oven': 'Pizza ovens', 'Fridge': 'Refrigerators', 'Mixer': 'Mixers', 'Prep table': 'Prep tables', 'Other': 'Other equipment'
  };
  const pool: IResource[] = cookingUnits(units).concat(withPrep ? prepTables(units) : []);
  return EQUIPMENT_CATEGORIES.map(c => ({ category: c, title: titles[c], units: pool.filter(u => (u.category || 'Other') === c) })).filter(g => g.units.length > 0);
}

// ---- Board geometry ----

/** Start minute of the slot under a pointer: floor to the step, kept inside the day. */
export function slotFromX(x: number, left: number, width: number, totalMinutes: number, step: number): number {
  const w: number = width > 0 ? width : 1;
  const raw: number = ((x - left) / w) * totalMinutes;
  const snapped: number = Math.floor(raw / step) * step;
  return Math.min(Math.max(0, snapped), Math.max(0, totalMinutes - step));
}

/** A drawn block from two slot starts (either order). The end slot is included, so tapping one slot twice is one step long. */
export function blockFromSlots(a: number, b: number, step: number, totalMinutes: number): { startMin: number; endMin: number } {
  const startMin: number = Math.min(a, b);
  const endMin: number = Math.min(totalMinutes, Math.max(a, b) + step);
  return { startMin, endMin };
}

/** Union of several lanes' busy segments (an aggregate lane such as "Whole kitchen"). */
export function mergeSegments(lists: ITimelineSegment[][]): ITimelineSegment[] {
  const all: ITimelineSegment[] = ([] as ITimelineSegment[]).concat(...lists).sort((x, y) => x.startMin - y.startMin);
  const out: ITimelineSegment[] = [];
  for (const s of all) {
    const last: ITimelineSegment | undefined = out[out.length - 1];
    if (last && s.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, s.endMin);
      if (last.label !== s.label) { last.label = undefined; }
    } else { out.push({ ...s }); }
  }
  return out;
}

/** Stretches of the day where fewer than `count` prep tables are free (the "Prep tables" lane's muted bars). */
export function prepShortSegments(units: IResource[], busy: BusyMap, tl: IDayTimeline, count: number, step: number): ITimelineSegment[] {
  const segs: ITimelineSegment[] = [];
  for (let m: number = 0; m < tl.totalMinutes; m += step) {
    const a: string = minuteToUtc(tl, m);
    const b: string = minuteToUtc(tl, Math.min(tl.totalMinutes, m + step));
    if (assignPrepTables(units, busy, a, b, count).shortBy > 0) {
      const last: ITimelineSegment | undefined = segs[segs.length - 1];
      if (last && last.endMin === m) { last.endMin = Math.min(tl.totalMinutes, m + step); } else { segs.push({ startMin: m, endMin: Math.min(tl.totalMinutes, m + step), label: 'Not enough free' }); }
    }
  }
  return segs;
}

/** True when a slot start falls inside any busy segment. */
export function slotBusy(segments: ITimelineSegment[], minute: number, step: number): boolean {
  return segments.some(s => s.startMin < minute + step && s.endMin > minute);
}

/** The best `count` start times: the earliest, then each next one at least one block (and at least an hour) after the previous. */
export function pickSlots(starts: string[], lengthMin: number, count: number = 3): string[] {
  const gap: number = Math.max(lengthMin, 60) * MIN_MS;
  const out: string[] = [];
  for (const s of starts) {
    if (out.length >= count) { break; }
    if (out.length === 0 || Date.parse(s) >= Date.parse(out[out.length - 1]) + gap) { out.push(s); }
  }
  return out;
}

// ---- Week heat map ----

export interface IHeatCell { day: string; fraction: number; level: 0 | 1 | 2 | 3 | 4; percent: number }
export interface IHeatRow { unitId: string; title: string; cells: IHeatCell[] }

/** Share of each day each unit is booked (equipment rows x `days` day columns), for the week view. */
export function weekHeat(units: IResource[], busy: BusyMap, startYmd: string, days: number, tz: string): IHeatRow[] {
  const perDay: IDayTimeline[] = [];
  for (let i: number = 0; i < days; i++) { perDay.push(dayTimeline(units, busy, addDays(startYmd, i), tz)); }
  const rows: IHeatRow[] = [];
  perDay[0].rows.forEach((row, ri) => {
    rows.push({
      unitId: row.unitId, title: row.title,
      cells: perDay.map((tl, di) => {
        const booked: number = tl.rows[ri].segments.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
        const fraction: number = Math.min(1, booked / tl.totalMinutes);
        const level: 0 | 1 | 2 | 3 | 4 = fraction === 0 ? 0 : fraction < 0.25 ? 1 : fraction < 0.5 ? 2 : fraction < 0.75 ? 3 : 4;
        return { day: addDays(startYmd, di), fraction, level, percent: Math.round(fraction * 100) };
      })
    });
  });
  return rows;
}

// ---- My bookings: agenda, month strip ----

export interface IAgendaDay { day: string; requests: IMyRequest[] }

/** Requests grouped by facility-local start day. Upcoming (not yet over, not cancelled-and-done) soonest first; past newest first. */
export function agendaGroups(requests: IMyRequest[], tz: string, nowMs: number, view: 'upcoming' | 'past'): IAgendaDay[] {
  const list: IMyRequest[] = requests.filter(r => (Date.parse(r.endUtc) > nowMs) === (view === 'upcoming'))
    .sort((a, b) => (view === 'upcoming' ? 1 : -1) * (Date.parse(a.startUtc) - Date.parse(b.startUtc)));
  const out: IAgendaDay[] = [];
  for (const r of list) {
    const day: string = localDay(r.startUtc, tz);
    const last: IAgendaDay | undefined = out[out.length - 1];
    if (last && last.day === day) { last.requests.push(r); } else { out.push({ day, requests: [r] }); }
  }
  return out;
}

export interface IMonthDay { ymd: string; booked: boolean; today: boolean }

/** `count` days from today with the days that hold a live booking marked. */
export function monthStrip(requests: IMyRequest[], todayYmd: string, tz: string, count: number = 31): IMonthDay[] {
  const booked: Set<string> = new Set(requests.filter(r => r.status !== 'Cancelled' && r.status !== 'Declined').map(r => localDay(r.startUtc, tz)));
  const out: IMonthDay[] = [];
  for (let i: number = 0; i < count; i++) { const ymd: string = addDays(todayYmd, i); out.push({ ymd, booked: booked.has(ymd), today: i === 0 }); }
  return out;
}

// ---- Home: today in the kitchen ----

export interface ITodayGroup { category: EquipmentCategory; title: string; items: { who: string; startUtc: string; endUtc: string; live: boolean }[] }

/** Who has what for the rest of today, per equipment group (display names only, as the shared calendar already shows). */
export function todayByGroup(entries: ICalendarEntry[], units: IResource[], nowMs: number): ITodayGroup[] {
  const left: ICalendarEntry[] = entries.filter(e => Date.parse(e.endUtc) > nowMs);
  const groups: ITodayGroup[] = [];
  for (const g of categoryGroups(units, true)) {
    const items: ITodayGroup['items'] = left
      .filter(e => e.space === 'Whole facility' || e.equipmentIds.some(id => g.units.some(u => u.resourceId === id)))
      .map(e => ({ who: e.memberName, startUtc: e.startUtc, endUtc: e.endUtc, live: Date.parse(e.startUtc) <= nowMs }))
      .filter((x, i, all) => all.findIndex(y => y.who === x.who && y.startUtc === x.startUtc) === i);
    if (items.length > 0) { groups.push({ category: g.category, title: g.title, items }); }
  }
  return groups;
}

// ---- Live phase headline (Home status module and drawer) ----

export type PhaseTone = 'pending' | 'soon' | 'entry' | 'live' | 'clean' | 'leave' | 'done';

export interface IPhaseView {
  tone: PhaseTone;
  /** Small label above the headline. */
  label: string;
  /** The one line that matters now. */
  headline: string;
  /** Supporting sentence from copy.ts. */
  detail: string;
  /** Show the Extend button (inside the end-of-booking window). */
  extend: boolean;
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The live state of a booking, in the words of copy.ts. A booking that is not Approved is "Waiting for approval". */
export function phaseView(b: IWindowBooking & { status?: string }, f: IFacility, nowMs: number): IPhaseView {
  const t = (iso: string): string => localTime(iso, f.timeZone);
  if (b.status !== 'Approved') {
    return { tone: 'pending', label: 'Waiting for Flavors', headline: 'Waiting for approval', detail: approvalNote(), extend: false };
  }
  const w = bookingWindows(b, f);
  switch (bookingPhase(b, f, nowMs)) {
    case 'upcoming':
      return { tone: 'soon', label: cap(startsInText(b, nowMs)), headline: (f.earlyEntryMinutes ? `Entry opens ${t(w.entryOpensUtc)}` : `Starts ${t(w.startUtc)}`), detail: earlyEntryLine(b, f), extend: false };
    case 'entry-open':
      return { tone: 'entry', label: 'Entry is open', headline: `You can come in now`, detail: phaseLine(b, f, nowMs), extend: false };
    case 'in-progress':
      return { tone: 'live', label: 'In the kitchen', headline: `In the kitchen until ${t(w.endUtc)}`, detail: cap(endsInText(b, nowMs)) + '.', extend: false };
    case 'ending-soon':
      return { tone: 'clean', label: 'Time to clean up', headline: `Time to clean up, ${endsInText(b, nowMs)}`, detail: 'Need longer? Extend.', extend: true };
    case 'cleanup':
      return { tone: 'leave', label: 'Cleaning time', headline: `Cleaning time: leave by ${t(w.cleanupEndsUtc)}`, detail: cleaningLine(b, f), extend: false };
    default:
      return { tone: 'done', label: 'Finished', headline: 'This booking is finished', detail: '', extend: false };
  }
}

// ---- Equipment artwork key ----

export type ArtKey = 'stove' | 'flattop' | 'oven' | 'oven-upper' | 'oven-lower' | 'warmer' | 'pizza' | 'prep' | 'mixer' | 'dining' | 'generic';

/** Picks the artwork from any mix of category, id and title text ("Stove", "oven-up", "Convection Oven (Upper)"). */
export function artKeyFor(...hints: (string | undefined)[]): ArtKey {
  const h: string = hints.filter(Boolean).join(' ').toLowerCase();
  if (/pizza/.test(h)) { return 'pizza'; }
  if (/prep/.test(h)) { return 'prep'; }
  if (/mix/.test(h)) { return 'mixer'; }
  if (/warm|holding|cabinet/.test(h)) { return 'warmer'; }
  if (/grill|flat ?top|griddle/.test(h)) { return 'flattop'; }
  if (/oven|convection/.test(h)) { return /upper|oven-up\b/.test(h) ? 'oven-upper' : /lower|oven-low\b/.test(h) ? 'oven-lower' : 'oven'; }
  if (/stove|range|burner/.test(h)) { return 'stove'; }
  if (/dining|room|table/.test(h)) { return 'dining'; }
  return 'generic';
}

// ---- Calendar file (.ics), generated in the browser ----

const icsText = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsStamp = (iso: string): string => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 line folding at 75 characters (continuation lines start with one space). */
function fold(line: string): string {
  const parts: string[] = [];
  let rest: string = line;
  while (rest.length > 75) { parts.push(rest.slice(0, 75)); rest = ' ' + rest.slice(75); }
  parts.push(rest);
  return parts.join('\r\n');
}

export interface IIcsInput { id: string; startUtc: string; endUtc: string; summary: string; description: string; location: string }

/** A one-event iCalendar file (UTC times, CRLF line ends). `nowIso` stamps the file. */
export function buildIcs(e: IIcsInput, nowIso: string = new Date().toISOString()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Avenue//Member console//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${e.id.replace(/[^A-Za-z0-9._-]/g, '')}@avenue`, `DTSTAMP:${icsStamp(nowIso)}`, `DTSTART:${icsStamp(e.startUtc)}`, `DTEND:${icsStamp(e.endUtc)}`,
    `SUMMARY:${icsText(e.summary)}`, `DESCRIPTION:${icsText(e.description)}`, `LOCATION:${icsText(e.location)}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function icsFileName(startUtc: string): string {
  return `flavors-booking-${new Date(startUtc).toISOString().slice(0, 10)}.ics`;
}

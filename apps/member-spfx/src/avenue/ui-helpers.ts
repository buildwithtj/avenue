// Small pure helpers for the redesigned member screens (day strip, time options, timeline geometry, notice read state,
// equipment chips). No React, no network. Availability rules themselves live in availability.ts.

import type { IMyRequest } from './contracts';
import type { IDayTimeline } from './availability';
import { addDays } from './calendar';
import type { INotice, IResource } from './contracts';

/** The next `count` facility-local days from `todayYmd`, as YYYY-MM-DD. */
export function dayStrip(todayYmd: string, count: number = 14): string[] {
  const days: string[] = [];
  for (let i: number = 0; i < count; i++) { days.push(addDays(todayYmd, i)); }
  return days;
}

/** "HH:MM" for a minute of the day (0..1439). */
export function toHm(minutes: number): string {
  const h: number = Math.floor(minutes / 60) % 24;
  const m: number = minutes % 60;
  return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
}

/** Facility-local "HH:MM" (24 hour) of a UTC instant. */
export function localHm(iso: string, timeZone: string): string {
  const m: RegExpExecArray | null = /(\d+):(\d+)/.exec(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)));
  return m ? toHm((Number(m[1]) % 24) * 60 + Number(m[2])) : '00:00';
}

/** "2:30 PM" for "14:30". */
export function hmLabel(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${m < 10 ? '0' : ''}${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Start-time choices for a day, every `stepMinutes`. Display granularity only, not a booking rule. */
export function timeOptions(stepMinutes: number): string[] {
  const out: string[] = [];
  const step: number = stepMinutes > 0 ? stepMinutes : 30;
  for (let m: number = 0; m < 24 * 60; m += step) { out.push(toHm(m)); }
  return out;
}

/** "1 h", "1 h 30 min", "45 min". */
export function lengthLabel(minutes: number): string {
  const h: number = Math.floor(minutes / 60);
  const m: number = Math.round(minutes % 60);
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hours as the member reads them: "2 h", "1.5 h", "0.25 h". */
export function hoursLabel(hours: number): string {
  return `${Math.round(hours * 100) / 100} h`;
}

export interface IBounds { min: number; max: number; step: number }

/** Length limits for the length control. Facility values are used only when set; otherwise the step is the minimum and the cap is a full day. */
export function lengthBounds(f: { minBookingMinutes?: number; maxBookingMinutes?: number; bookingStepMinutes?: number }): IBounds {
  const step: number = f.bookingStepMinutes && f.bookingStepMinutes > 0 ? f.bookingStepMinutes : 30;
  const min: number = f.minBookingMinutes !== undefined ? f.minBookingMinutes : step;
  const max: number = f.maxBookingMinutes !== undefined ? f.maxBookingMinutes : 24 * 60;
  return { min, max: Math.max(min, max), step };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Share of the cooking units in use in each `stepMin` slice of the day (0..1). Cells line up with the day's real
 * elapsed minutes, so 23 and 25 hour days still fit.
 */
export function busyLevels(tl: IDayTimeline, cookingUnitIds: string[], stepMin: number = 30): number[] {
  const rows = tl.rows.filter(r => cookingUnitIds.indexOf(r.unitId) >= 0);
  const cells: number = Math.ceil(tl.totalMinutes / stepMin);
  const out: number[] = [];
  for (let i: number = 0; i < cells; i++) {
    const a: number = i * stepMin;
    const b: number = a + stepMin;
    const busy: number = rows.filter(r => r.segments.some(s => s.startMin < b && s.endMin > a)).length;
    out.push(rows.length === 0 ? 0 : busy / rows.length);
  }
  return out;
}

export interface IPercent { left: number; width: number }

/** Where [startUtc, endUtc) sits in the day, as percentages of the day's width. Undefined when it does not touch the day. */
export function windowPercent(tl: IDayTimeline, startUtc: string, endUtc: string): IPercent | undefined {
  const day0: number = Date.parse(tl.dayStartUtc);
  const a: number = Math.max(0, (Date.parse(startUtc) - day0) / 60000);
  const b: number = Math.min(tl.totalMinutes, (Date.parse(endUtc) - day0) / 60000);
  if (!(b > a)) { return undefined; }
  return { left: (a / tl.totalMinutes) * 100, width: ((b - a) / tl.totalMinutes) * 100 };
}

/** Position of "now" as a percentage of the day, or undefined when now is not inside the day. */
export function nowPercent(tl: IDayTimeline, nowMs: number): number | undefined {
  const m: number = (nowMs - Date.parse(tl.dayStartUtc)) / 60000;
  return m >= 0 && m < tl.totalMinutes ? (m / tl.totalMinutes) * 100 : undefined;
}

/** UTC instant of an elapsed minute of the day. */
export function minuteToUtc(tl: IDayTimeline, minute: number): string {
  return new Date(Date.parse(tl.dayStartUtc) + minute * 60000).toISOString();
}

/** A stable small number from a name, so one company keeps one colour on the board. */
export function colourIndex(name: string, buckets: number): number {
  let h: number = 0;
  for (let i: number = 0; i < name.length; i++) { h = (h * 31 + name.charCodeAt(i)) >>> 0; }
  return h % buckets;
}

/**
 * Short chips for what a booking holds: "Stove #1", "2 prep tables", or "Whole kitchen" / "Dining room" / "Private event".
 * Unknown ids are shown as they are.
 */
export function equipmentChips(space: string, ids: string[] | undefined, resources: IResource[]): string[] {
  if (space === 'Dining') { return ['Dining room']; }
  if (space === 'Whole facility') { return ['Private event']; }
  const list: string[] = ids || [];
  const find = (id: string): IResource | undefined => resources.filter(r => r.resourceId === id)[0];
  const isPrep = (id: string): boolean => { const r: IResource | undefined = find(id); return !!r && (r.category === 'Prep table' || (!r.category && r.kind === 'Prep table')); };
  // Every cooking unit means the whole kitchen (prep tables and the complimentary fridges do not decide it).
  const cooking: IResource[] = resources.filter(r => r.bookable !== false && r.kind !== 'Space' && r.category !== 'Fridge' && !isPrep(r.resourceId));
  if (list.length > 0 && cooking.length > 0 && cooking.every(r => list.indexOf(r.resourceId) >= 0)) { return ['Whole kitchen']; }
  const prep: string[] = list.filter(isPrep);
  const chips: string[] = list.filter(id => !isPrep(id)).map(id => (find(id) ? (find(id) as IResource).title : id));
  if (prep.length > 0) { chips.push(`${prep.length} prep ${prep.length === 1 ? 'table' : 'tables'}`); }
  return chips.length > 0 ? chips : [space];
}

// ---- Notices: per-device read state ----
// localStorage is the instant, offline layer. [PROPOSED] useReadIds also merges and saves the member's own AvenueNoticeReads
// items so read state follows them across devices; until that list exists it stays per browser.
export const NOTICES_READ_KEY: string = 'avenue.notices.read';
const READ_CAP: number = 300;

interface IStorageLike { getItem: (key: string) => unknown; setItem: (key: string, value: string) => void }

function store(): IStorageLike | undefined {
  try { return typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { return undefined; }
}

export function readNoticeIds(storage: IStorageLike | undefined = store()): number[] {
  try {
    const raw: unknown = storage ? storage.getItem(NOTICES_READ_KEY) : undefined;
    const parsed: unknown = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch { return []; }
}

/** Adds ids to the read list and returns the new list. A blocked or full store is ignored: the page still works. */
export function markNoticesRead(ids: number[], storage: IStorageLike | undefined = store()): number[] {
  const merged: number[] = readNoticeIds(storage).concat(ids).filter((n, i, all) => all.indexOf(n) === i).slice(-READ_CAP);
  try { if (storage) { storage.setItem(NOTICES_READ_KEY, JSON.stringify(merged)); } } catch { /* private window or full: keep going */ }
  return merged;
}

const DAY_MS: number = 86400000;

/** "Recent" tab: published in the last 7 days. */
export function isRecentNotice(n: { publishedUtc: string }, nowMs: number): boolean {
  return nowMs - Date.parse(n.publishedUtc) <= 7 * DAY_MS;
}

/** "Expires in 5 h" when the notice's ExpiresAt is within 48 hours; otherwise undefined. */
export function noticeExpiryLabel(n: { expiresUtc?: string }, nowMs: number): string | undefined {
  const left: number = n.expiresUtc ? Date.parse(n.expiresUtc) - nowMs : NaN;
  return left > 0 && left <= 2 * DAY_MS ? `Expires in ${Math.max(1, Math.ceil(left / 3600000))} h` : undefined;
}

export function unreadNotices(notices: INotice[], readIds: number[]): INotice[] {
  return notices.filter(n => readIds.indexOf(n.id) < 0);
}

/** Notice body as paragraphs of plain text. React renders them as text, so markup in a body is shown, never run. */
export function noticeParagraphs(body: string): string[] {
  return body.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

/** True when a body is long enough to be worth collapsing. */
export function isLongNotice(body: string): boolean {
  return body.length > 160 || body.split('\n').length > 3;
}

// ---- Alerts: changes to the member's own bookings and things that need them ----
// Derived from what the member can already read (their own requests and documents), so no flow change is needed.
// Seen state is per browser. The first visit sets a baseline so old history does not arrive as a flood of alerts.
export const ALERTS_SEEN_KEY: string = 'avenue.alerts.seen';
export const ALERTS_BASE_KEY: string = 'avenue.alerts.base';

export interface IAlert { key: string; tone: 'ok' | 'bad' | 'info'; title: string; text: string; target: 'bookings' | 'documents' | 'checkin' | 'billing'; requestId?: string }

/** One alert per decided booking state and per extra-time answer. `when` renders the booking's day and time. */
export function bookingAlerts(requests: IMyRequest[], when: (r: IMyRequest) => string, nowMs?: number): IAlert[] {
  const out: IAlert[] = [];
  for (const r of requests) {
    // Reminders (client sheet: "an alert when reminded about an upcoming booking"). [PROPOSED] lead times: 24 hours and 1 hour.
    if (nowMs !== undefined && r.status === 'Approved') {
      const left: number = Date.parse(r.startUtc) - nowMs;
      if (left > 0 && left <= 3600000) { out.push({ key: `${r.requestId}|remind1`, tone: 'info', title: 'Starting within the hour', text: when(r), target: 'bookings', requestId: r.requestId }); }
      else if (left > 3600000 && left <= 86400000) { out.push({ key: `${r.requestId}|remind24`, tone: 'info', title: 'Booking in the next 24 hours', text: when(r), target: 'bookings', requestId: r.requestId }); }
    }
    if (r.status === 'Approved') { out.push({ key: `${r.requestId}|Approved`, tone: 'ok', title: 'Booking confirmed', text: when(r), target: 'bookings', requestId: r.requestId }); }
    if (r.status === 'Declined') { out.push({ key: `${r.requestId}|Declined`, tone: 'bad', title: 'Request declined', text: r.note ? `${when(r)}. ${r.note}` : when(r), target: 'bookings', requestId: r.requestId }); }
    if (r.status === 'Cancelled') { out.push({ key: `${r.requestId}|Cancelled`, tone: 'info', title: 'Booking cancelled', text: when(r), target: 'bookings', requestId: r.requestId }); }
    if (r.extension && r.extension.outcome) { out.push({ key: `${r.requestId}|ext|${r.extension.outcome}`, tone: 'info', title: 'Extra time update', text: r.extension.outcome, target: 'bookings', requestId: r.requestId }); }
  }
  return out;
}

export function seenAlertKeys(storage: IStorageLike | undefined = store()): string[] {
  try {
    const raw: unknown = storage ? storage.getItem(ALERTS_SEEN_KEY) : undefined;
    const parsed: unknown = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch { return []; }
}

export function markAlertsSeen(keys: string[], storage: IStorageLike | undefined = store()): string[] {
  const merged: string[] = seenAlertKeys(storage).concat(keys).filter((k, i, all) => all.indexOf(k) === i).slice(-500);
  try { if (storage) { storage.setItem(ALERTS_SEEN_KEY, JSON.stringify(merged)); } } catch { /* blocked or full: keep going */ }
  return merged;
}

/** Alerts not yet seen. On the very first call everything counts as seen (baseline), so the bell starts empty. */
export function unseenAlerts(all: IAlert[], storage: IStorageLike | undefined = store()): IAlert[] {
  try {
    if (storage && !storage.getItem(ALERTS_BASE_KEY)) {
      storage.setItem(ALERTS_BASE_KEY, '1');
      markAlertsSeen(all.map(a => a.key), storage);
      return [];
    }
  } catch { /* no storage: fall through, everything is unseen */ }
  const seen: string[] = seenAlertKeys(storage);
  return all.filter(a => seen.indexOf(a.key) < 0);
}

/** Calendar day (yyyy-mm-dd) of `iso` in the facility's time zone. */
function ymdIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
const dayNumber = (ymd: string): number => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000;

export type NoticeGroup = 'Pinned' | 'Today' | 'This week' | 'Earlier';
export const NOTICE_GROUPS: NoticeGroup[] = ['Pinned', 'Today', 'This week', 'Earlier'];

/** Group for the notification list: pinned first, then by facility-local day (today, the 6 days before, older). */
export function noticeGroup(n: { pinned: boolean; publishedUtc: string }, nowMs: number, timeZone: string): NoticeGroup {
  if (n.pinned) { return 'Pinned'; }
  const age: number = dayNumber(ymdIn(new Date(nowMs).toISOString(), timeZone)) - dayNumber(ymdIn(n.publishedUtc, timeZone));
  return age <= 0 ? 'Today' : age < 7 ? 'This week' : 'Earlier';
}

/** Short time for a list row: "now", "5m", "3h" today; weekday this week; "12 Nov" older; "12 Nov 2025" another year. */
export function noticeWhen(iso: string, nowMs: number, timeZone: string): string {
  const mins: number = Math.round((nowMs - Date.parse(iso)) / 60000);
  const sameDay: boolean = ymdIn(iso, timeZone) === ymdIn(new Date(nowMs).toISOString(), timeZone);
  if (sameDay && mins < 1) { return 'now'; }
  if (sameDay && mins < 60) { return `${mins}m`; }
  if (sameDay) { return `${Math.floor(mins / 60)}h`; }
  const days: number = dayNumber(ymdIn(new Date(nowMs).toISOString(), timeZone)) - dayNumber(ymdIn(iso, timeZone));
  if (days < 7) { return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date(iso)); }
  const sameYear: boolean = ymdIn(iso, timeZone).slice(0, 4) === ymdIn(new Date(nowMs).toISOString(), timeZone).slice(0, 4);
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(new Date(iso));
}

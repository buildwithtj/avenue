// Pure date helpers for the shared calendar. Bookings are UTC instants; days are
// facility-local (docs/DATA_AND_PERMISSIONS.md). No timezone-offset arithmetic:
// we over-fetch by a day each side and bucket with Intl, which is DST-correct.

import type { ICalendarEntry } from './contracts';

const DAY_MS: number = 24 * 60 * 60 * 1000;

/** Facility-local calendar date (YYYY-MM-DD) of a UTC instant. Throws on an invalid IANA zone. */
export function localDay(instant: string | Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(instant));
}

/**
 * The UTC instant for a facility-local date and time ("2026-11-02", "09:00"). Iterates on the zone's offset so it is
 * correct across daylight-saving changes. A time that does not exist (spring forward) resolves to the next valid instant;
 * an ambiguous time (fall back) resolves to the first occurrence.
 */
export function zonedToUtc(ymd: string, hhmm: string, timeZone: string): string {
  const wall: number = Date.parse(`${ymd}T${hhmm}:00Z`);
  if (isNaN(wall)) {
    throw new Error('Avenue: invalid date or time.');
  }
  const offsetAt = (ms: number): number => {
    // "MM/DD/YYYY, HH:MM:SS" (the lib target has no formatToParts). Hour 24 means midnight in some engines.
    const m: RegExpExecArray | null = /(\d+)\/(\d+)\/(\d+),? (\d+):(\d+):(\d+)/.exec(
      new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ms))
    );
    if (!m) {
      throw new Error('Avenue: could not read the facility time zone.');
    }
    return Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4] % 24, +m[5], +m[6]) - ms;
  };
  // Try the offsets in force a day before and after. A candidate is valid if that offset really applies at it.
  // Both valid (clocks go back: the time happens twice) -> the earlier one. Neither (clocks go forward: the time does not exist) -> the later one.
  const DAY: number = 24 * 60 * 60 * 1000;
  const cands: number[] = [wall - offsetAt(wall - DAY), wall - offsetAt(wall + DAY)];
  const valid: number[] = cands.filter(c => wall - offsetAt(c) === c);
  const pick: number = valid.length > 0 ? Math.min(...valid) : Math.max(...cands);
  return new Date(pick).toISOString();
}

/** Facility-local time of day, e.g. "9:30 AM". */
export function localTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(instant));
}

export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** UTC window that certainly covers `days` facility-local days from `startYmd` (padded ±1 day; offsets are ≤ 14h). */
export function queryWindow(startYmd: string, days: number): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: `${addDays(startYmd, -1)}T00:00:00Z`,
    toUtc: `${addDays(startYmd, days + 1)}T00:00:00Z`
  };
}

export interface ICalendarDay {
  day: string;
  entries: ICalendarEntry[];
}

/**
 * Buckets entries into the requested facility-local days, sorted by start.
 * An entry spanning midnight appears on each day it touches.
 */
export function groupByDay(
  entries: ICalendarEntry[],
  timeZone: string,
  startYmd: string,
  days: number,
  resourceId?: string
): ICalendarDay[] {
  const result: ICalendarDay[] = [];
  for (let i: number = 0; i < days; i++) {
    result.push({ day: addDays(startYmd, i), entries: [] });
  }
  const sorted: ICalendarEntry[] = entries
    .filter(e => !resourceId || e.resourceId === resourceId || e.equipmentIds.indexOf(resourceId) >= 0 || e.space === 'Whole facility')
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  for (const entry of sorted) {
    const first: string = localDay(entry.startUtc, timeZone);
    // End is exclusive: a booking ending exactly at local midnight does not touch the next day.
    const last: string = localDay(new Date(Date.parse(entry.endUtc) - 1), timeZone);
    for (const bucket of result) {
      if (bucket.day >= first && bucket.day <= last) {
        bucket.entries.push(entry);
      }
    }
  }
  return result;
}

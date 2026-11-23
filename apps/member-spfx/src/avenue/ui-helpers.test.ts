import { dayTimeline, buildBusyMap } from './availability';
import type { IResource } from './contracts';
import {
  NOTICES_READ_KEY, busyLevels, colourIndex, dayStrip, equipmentChips, hmLabel, isLongNotice, lengthBounds, lengthLabel, localHm, markNoticesRead, nowPercent, noticeParagraphs, readNoticeIds, timeOptions, toHm, windowPercent
} from './ui-helpers';

const mem = (): { getItem: (k: string) => string | undefined; setItem: (k: string, v: string) => void } => {
  const m: Record<string, string> = {};
  return { getItem: k => (k in m ? m[k] : undefined), setItem: (k, v) => { m[k] = v; } };
};
const TZ = 'America/New_York';
const U = (id: string, title: string, category: IResource['category']): IResource => ({ resourceId: id, title, kind: category === 'Prep table' ? 'Prep table' : 'Equipment', category, bookable: true });

describe('ui-helpers', () => {
  it('formats times and lengths', () => {
    expect(dayStrip('2026-11-30', 3)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(toHm(90)).toBe('01:30');
    expect(hmLabel('00:00')).toBe('12:00 AM');
    expect(hmLabel('14:30')).toBe('2:30 PM');
    expect(timeOptions(30).length).toBe(48);
    expect(lengthLabel(150)).toBe('2 h 30 min');
    expect(localHm('2026-06-02T18:00:00Z', TZ)).toBe('14:00');
  });
  it('uses facility length limits only when set', () => {
    expect(lengthBounds({})).toEqual({ min: 30, max: 1440, step: 30 });
    expect(lengthBounds({ minBookingMinutes: 60, maxBookingMinutes: 480, bookingStepMinutes: 15 })).toEqual({ min: 60, max: 480, step: 15 });
  });
  it('timeline geometry', () => {
    const units = [U('s1', 'Stove', 'Stove'), U('s2', 'Stove 2', 'Stove')];
    const busy = buildBusyMap([{ bookingId: 'b', resourceId: '', space: 'Kitchen', equipmentIds: ['s1'], memberName: 'A', startUtc: '2026-06-02T14:00:00Z', endUtc: '2026-06-02T16:00:00Z' }]);
    const tl = dayTimeline(units, busy, '2026-06-02', TZ);
    const lv = busyLevels(tl, ['s1', 's2']);
    expect(lv.length).toBe(48);
    expect(lv[20]).toBe(0.5); // 10:00 local = 14:00Z
    expect(lv[0]).toBe(0);
    const w = windowPercent(tl, '2026-06-02T14:00:00Z', '2026-06-02T16:00:00Z');
    expect(Math.round((w as { left: number }).left)).toBe(42);
    expect(windowPercent(tl, '2026-06-05T14:00:00Z', '2026-06-05T16:00:00Z')).toBeUndefined();
    expect(nowPercent(tl, Date.parse('2026-06-02T16:00:00Z'))).toBeCloseTo(50, 0);
    expect(nowPercent(tl, Date.parse('2026-06-09T16:00:00Z'))).toBeUndefined();
    expect(colourIndex('Acme', 5)).toBe(colourIndex('Acme', 5));
  });
  it('summarises what a booking holds', () => {
    const res = [U('s1', 'Stove #1', 'Stove'), U('p1', 'Prep 1', 'Prep table'), U('p2', 'Prep 2', 'Prep table')];
    expect(equipmentChips('Kitchen', ['s1', 'p1', 'p2'], res)).toEqual(['Whole kitchen']);
    expect(equipmentChips('Kitchen', ['s1', 'p1', 'p2', 'x'], res.concat(U('o', 'Oven', 'Oven')))).toEqual(['Stove #1', 'x', '2 prep tables']);
    expect(equipmentChips('Dining', [], res)).toEqual(['Dining room']);
    expect(equipmentChips('Whole facility', [], res)).toEqual(['Private event']);
  });
  it('keeps notice read state per device and survives a broken store', () => {
    const s = mem();
    expect(readNoticeIds(s)).toEqual([]);
    expect(markNoticesRead([1, 2], s)).toEqual([1, 2]);
    expect(markNoticesRead([2, 3], s)).toEqual([1, 2, 3]);
    expect(JSON.parse(s.getItem(NOTICES_READ_KEY) as string)).toEqual([1, 2, 3]);
    s.setItem(NOTICES_READ_KEY, '{not json');
    expect(readNoticeIds(s)).toEqual([]);
    const broken = { getItem: (): string => { throw new Error('blocked'); }, setItem: (): void => { throw new Error('blocked'); } };
    expect(readNoticeIds(broken)).toEqual([]);
    expect(markNoticesRead([4], broken)).toEqual([4]);
    expect(readNoticeIds(undefined)).toEqual([]);
  });
  it('splits notice bodies into plain paragraphs', () => {
    expect(noticeParagraphs('One\r\n\r\nTwo\nstill two\n\n\n')).toEqual(['One', 'Two\nstill two']);
    expect(isLongNotice('short')).toBe(false);
    expect(isLongNotice('x'.repeat(200))).toBe(true);
  });
});

import { noticeGroup, noticeWhen } from './ui-helpers';
describe('notice list grouping and times (facility time zone)', () => {
  const tz = 'America/New_York';
  const now = Date.parse('2026-11-23T15:00:00Z'); // 10:00 New York, Monday
  it('groups pinned first, then today / this week / earlier by local day', () => {
    expect(noticeGroup({ pinned: true, publishedUtc: '2025-01-01T00:00:00Z' }, now, tz)).toBe('Pinned');
    expect(noticeGroup({ pinned: false, publishedUtc: '2026-11-23T06:00:00Z' }, now, tz)).toBe('Today');      // 01:00 local, same day
    expect(noticeGroup({ pinned: false, publishedUtc: '2026-11-23T03:00:00Z' }, now, tz)).toBe('This week');  // 22:00 local, yesterday
    expect(noticeGroup({ pinned: false, publishedUtc: '2026-11-17T15:00:00Z' }, now, tz)).toBe('This week');
    expect(noticeGroup({ pinned: false, publishedUtc: '2026-11-16T15:00:00Z' }, now, tz)).toBe('Earlier');
  });
  it('writes short relative times', () => {
    expect(noticeWhen('2026-11-23T14:59:40Z', now, tz)).toBe('now');
    expect(noticeWhen('2026-11-23T14:30:00Z', now, tz)).toBe('30m');
    expect(noticeWhen('2026-11-23T11:00:00Z', now, tz)).toBe('4h');
    expect(noticeWhen('2026-11-20T15:00:00Z', now, tz)).toBe('Fri');
    expect(noticeWhen('2026-11-02T15:00:00Z', now, tz)).toBe('2 Nov');
    expect(noticeWhen('2025-11-02T15:00:00Z', now, tz)).toBe('2 Nov 2025');
  });
});

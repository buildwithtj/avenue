import { type IMonthDay, monthStrip } from './ui-view';
import { isRecentNotice, noticeExpiryLabel } from './ui-helpers';
import { AvenueReadSource, toNotice } from './readSource';
import type { IIntakeWriter, IMyRequest } from './contracts';

const TZ = 'America/New_York';
const r = (id: string, s: string, e: string, status?: IMyRequest['status']): IMyRequest => ({ requestId: id, space: 'Kitchen', startUtc: s, endUtc: e, cancelSent: false, cancelRequested: false, status });

describe('monthStrip (My bookings date strip)', () => {
  const reqs: IMyRequest[] = [
    r('a', '2026-11-19T19:00:00.000Z', '2026-11-19T21:00:00.000Z', 'Approved'),
    r('b', '2026-11-19T15:00:00.000Z', '2026-11-19T17:00:00.000Z', 'Approved'),
    r('c', '2026-11-20T15:00:00.000Z', '2026-11-20T17:00:00.000Z'),
    r('d', '2026-11-20T18:00:00.000Z', '2026-11-20T19:00:00.000Z', 'Approved'),
    // 10 PM on the 21st to 2 AM on the 22nd (New York): spans two days.
    r('e', '2026-11-22T03:00:00.000Z', '2026-11-22T07:00:00.000Z', 'Pending'),
    r('x', '2026-11-23T15:00:00.000Z', '2026-11-23T17:00:00.000Z', 'Cancelled'),
    r('y', '2026-11-23T18:00:00.000Z', '2026-11-23T19:00:00.000Z', 'Declined'),
    r('p', '2026-11-10T15:00:00.000Z', '2026-11-10T17:00:00.000Z', 'Approved')
  ];
  const m = monthStrip(reqs, '2026-11-18', TZ, 7);
  const day = (ymd: string): IMonthDay => m.filter(d => d.ymd === ymd)[0];

  it('counts bookings per day with the earliest start and a status', () => {
    expect(day('2026-11-19')).toMatchObject({ booked: true, count: 2, firstStartUtc: '2026-11-19T15:00:00.000Z', status: 'Approved', carryOver: false });
    expect(day('2026-11-20')).toMatchObject({ count: 2, status: 'Mixed' });
    expect(day('2026-11-18')).toMatchObject({ booked: false, today: true, count: 0 });
    expect(day('2026-11-18').status).toBeUndefined();
  });
  it('marks every day an overnight booking spans; the carried-over day has no start time', () => {
    expect(day('2026-11-21')).toMatchObject({ booked: true, status: 'Pending', firstStartUtc: '2026-11-22T03:00:00.000Z', carryOver: false });
    expect(day('2026-11-22')).toMatchObject({ booked: true, status: 'Pending', carryOver: true });
    expect(day('2026-11-22').firstStartUtc).toBeUndefined();
  });
  it('leaves cancelled and declined out', () => {
    expect(day('2026-11-23').booked).toBe(false);
  });
  it('a booking ending exactly at midnight does not mark the next day', () => {
    const s = monthStrip([r('m', '2026-11-19T01:00:00.000Z', '2026-11-19T05:00:00.000Z', 'Approved')], '2026-11-18', TZ, 3);
    expect(s.map(d => d.booked)).toEqual([true, false, false]);
  });
  it('past view covers the days ending today', () => {
    const past = monthStrip(reqs, '2026-11-18', TZ, 31, 'past');
    expect(past[0].ymd).toBe('2026-10-19');
    expect(past[past.length - 1]).toMatchObject({ ymd: '2026-11-18', today: true });
    expect(past.filter(d => d.booked).map(d => d.ymd)).toEqual(['2026-11-10']);
  });
});

describe('notice helpers', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  it('Recent is the last 7 days', () => {
    expect(isRecentNotice({ publishedUtc: '2026-11-17T12:00:00Z' }, now)).toBe(true);
    expect(isRecentNotice({ publishedUtc: '2026-11-16T11:59:00Z' }, now)).toBe(false);
  });
  it('labels an expiry within 48 hours, in whole hours rounded up', () => {
    expect(noticeExpiryLabel({ expiresUtc: '2026-11-23T16:30:00Z' }, now)).toBe('Expires in 5 h');
    expect(noticeExpiryLabel({ expiresUtc: '2026-11-23T12:10:00Z' }, now)).toBe('Expires in 1 h');
    expect(noticeExpiryLabel({ expiresUtc: '2026-11-25T12:00:00Z' }, now)).toBe('Expires in 48 h');
    expect(noticeExpiryLabel({ expiresUtc: '2026-11-25T13:00:00Z' }, now)).toBeUndefined();
    expect(noticeExpiryLabel({}, now)).toBeUndefined();
  });
});

describe('notices: PublishAt and AvenueNoticeReads', () => {
  const NOW = Date.parse('2026-11-18T12:00:00Z');
  const row = (id: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ Id: id, Title: `N${id}`, PublishedAt: '2026-11-17T10:00:00Z', FacilityId: 'f', ...extra });

  it('hides a notice scheduled for later; an empty PublishAt shows', () => {
    expect(toNotice(row(1, { PublishAt: '2026-11-18T13:00:00Z' }), NOW)).toBeUndefined();
    expect(toNotice(row(1, { PublishAt: '2026-11-18T11:00:00Z' }), NOW)).toBeDefined();
    expect(toNotice(row(1, { PublishAt: null }), NOW)).toBeDefined();
  });
  it('falls back to the old select when PublishAt is not on the list yet', async () => {
    const urls: string[] = [];
    const fetch = (url: string): Promise<unknown> => { urls.push(url); return url.indexOf('PublishAt') >= 0 ? Promise.reject(new Error('400')) : Promise.resolve({ value: [row(1)] }); };
    const src = new AvenueReadSource('https://x', 'f', fetch);
    expect((await src.listNotices(NOW)).map(n => n.id)).toEqual([1]);
    expect(urls.length).toBe(2);
  });
  it('reads own NoticeReads (author filter) and writes one item per notice', async () => {
    const urls: string[] = [];
    const added: Record<string, unknown>[] = [];
    const writer = { add: async (list: string, item: Record<string, unknown>) => { added.push({ list, ...item }); return 1; } } as unknown as IIntakeWriter;
    const src = new AvenueReadSource('https://x', 'f', url => { urls.push(url); return Promise.resolve({ value: [{ NoticeId: 4 }, { NoticeId: 'bad' }, { NoticeId: 9 }] }); }, writer, 7);
    expect(await src.listMyNoticeReads()).toEqual([4, 9]);
    expect(decodeURIComponent(urls[0])).toContain("getbytitle('AvenueNoticeReads')");
    expect(decodeURIComponent(urls[0])).toContain('AuthorId eq 7');
    await src.markNoticesRead([4, -1, 2.5]);
    expect(added).toEqual([{ list: 'AvenueNoticeReads', Title: 'Notice 4', FacilityId: 'f', NoticeId: 4 }]);
  });
  it('rejects when the list is missing (the hook then stays local)', async () => {
    const src = new AvenueReadSource('https://x', 'f', () => Promise.reject(new Error('404')));
    await expect(src.listMyNoticeReads()).rejects.toThrow('404');
  });
});

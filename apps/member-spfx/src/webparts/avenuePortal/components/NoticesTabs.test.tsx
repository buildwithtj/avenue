/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import s from './Site.module.scss';
import type { IFacility, IMyRequest, INotice } from '../../../avenue/contracts';
import { NOTICES_READ_KEY } from '../../../avenue/ui-helpers';
import NoticesView from './NoticesView';
import MyBookings from './MyBookings';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const facility: IFacility = { facilityId: 'f', title: 'F', timeZone: 'America/New_York' };
const H = 3600000;
const now = Date.now();
const iso = (ms: number): string => new Date(ms).toISOString();
const n = (id: number, title: string, ageMs: number, extra: Partial<INotice> = {}): INotice => ({ id, title, body: 'b', category: 'General', pinned: false, publishedUtc: iso(now - ageMs), ...extra });
const list: INotice[] = [n(1, 'Fresh', 2 * H, { expiresUtc: iso(now + 4.5 * H) }), n(2, 'Last week', 3 * 24 * H), n(3, 'Old', 20 * 24 * H)];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const flush = async (): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); }); };
const btn = (text: string): HTMLButtonElement => Array.from(host.querySelectorAll('button')).filter(b => (b.textContent || '') === text)[0];
const titles = (): string[] => Array.from(host.querySelectorAll('[data-notice] strong')).map(x => x.textContent || '');

describe('Notices: Recent and All tabs', () => {
  it('opens on Recent (last 7 days), All shows everything, read notices stay listed and dimmed', async () => {
    localStorage.setItem(NOTICES_READ_KEY, JSON.stringify([2]));
    await act(async () => { root.render(<NoticesView source={{ listNotices: async () => list } as never} facility={facility} />); });
    await flush();
    expect(btn('Recent').getAttribute('aria-pressed')).toBe('true');
    expect(titles()).toEqual(['Fresh', 'Last week']);
    const read = host.querySelector('[data-notice="2"]') as HTMLElement;
    expect(read.className).toContain(s.ntRead);
    expect(read.querySelector('[data-testid="unread-dot"]')).toBeNull();
    await act(async () => { btn('All').click(); });
    expect(titles()).toEqual(['Fresh', 'Last week', 'Old']);
  });
  it('shows "Expires in 5 h" on a notice expiring within 48 hours only', async () => {
    await act(async () => { root.render(<NoticesView source={{ listNotices: async () => list } as never} facility={facility} />); });
    await flush();
    expect((host.querySelector('[data-notice="1"]') as HTMLElement).textContent).toContain('Expires in 5 h');
    expect((host.querySelector('[data-notice="2"]') as HTMLElement).textContent).not.toContain('Expires');
  });
  it('opens on All when nothing is recent', async () => {
    await act(async () => { root.render(<NoticesView source={{ listNotices: async () => [list[2]] } as never} facility={facility} />); });
    await flush();
    expect(btn('All').getAttribute('aria-pressed')).toBe('true');
    expect(titles()).toEqual(['Old']);
  });
});

describe('Notices: AvenueNoticeReads read state', () => {
  it('falls back to this browser silently when the list read fails, and does not try to write', async () => {
    const writes: number[][] = [];
    const src = { listNotices: async () => list, listMyNoticeReads: () => Promise.reject(new Error('404 Not Found')), markNoticesRead: async (ids: number[]) => { writes.push(ids); } } as never;
    await act(async () => { root.render(<NoticesView source={src} facility={facility} />); });
    await flush();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    await act(async () => { (host.querySelector('[data-notice="1"] button') as HTMLButtonElement).click(); });
    await flush();
    expect(JSON.parse(localStorage.getItem(NOTICES_READ_KEY) as string)).toEqual([1]);
    expect(writes).toEqual([]);
  });
  it('merges reads from other devices and saves new ones', async () => {
    const writes: number[][] = [];
    const src = { listNotices: async () => list, listMyNoticeReads: async () => [2], markNoticesRead: async (ids: number[]) => { writes.push(ids); } } as never;
    await act(async () => { root.render(<NoticesView source={src} facility={facility} />); });
    await flush();
    expect(host.querySelectorAll('[data-testid="unread-dot"]').length).toBe(1);
    await act(async () => { (host.querySelector('[data-notice="1"] button') as HTMLButtonElement).click(); });
    await flush();
    expect(writes).toEqual([[1]]);
  });
});

describe('My bookings strip', () => {
  it('fills booked days by status with the start time and tags the first upcoming one "Next"', async () => {
    const day = (d: number, h: number): string => iso(now + d * 24 * H + h * H);
    const reqs: IMyRequest[] = [
      { requestId: 'a', space: 'Kitchen', startUtc: day(2, 0), endUtc: day(2, 2), cancelSent: false, cancelRequested: false, status: 'Approved' },
      { requestId: 'b', space: 'Kitchen', startUtc: day(5, 0), endUtc: day(5, 2), cancelSent: false, cancelRequested: false, status: 'Pending' },
      { requestId: 'c', space: 'Kitchen', startUtc: day(8, 0), endUtc: day(8, 2), cancelSent: false, cancelRequested: false, status: 'Cancelled' }
    ];
    await act(async () => { root.render(<MyBookings source={{ listMyRequests: async () => reqs } as never} facility={facility} onBook={() => undefined} />); });
    await flush();
    const filled = Array.from(host.querySelectorAll('.' + s.monthFill)) as HTMLElement[];
    expect(filled.map(b => b.getAttribute('data-status'))).toEqual(['Approved', 'Pending']);
    expect(filled[0].className).toContain(s.monthOk);
    expect(filled[1].className).toContain(s.monthWait);
    expect(filled[0].querySelector('.' + s.monthTime)?.textContent).toMatch(/^\d{1,2}(:\d{2})? [AP]M$/);
    expect(host.querySelectorAll('.' + s.monthNext).length).toBe(1);
    expect(filled[0].textContent).toContain('Next');
  });
});

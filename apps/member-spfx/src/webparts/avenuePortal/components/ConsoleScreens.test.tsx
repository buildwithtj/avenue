/** @jest-environment jsdom */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import s from './Site.module.scss';
import { toIntakeItem } from '../../../avenue/booking';
import { addDays, localDay, zonedToUtc } from '../../../avenue/calendar';
import type { ICalendarEntry, IFacility, INotice, IMyRequest, IResource } from '../../../avenue/contracts';
import { IMMERSIVE_CLASS, forceReleaseImmersive } from '../immersive';
import AvenuePortal from './AvenuePortal';
import BookBoard from './BookBoard';
import CalendarView from './CalendarView';
import { EquipmentArt, equipmentArt } from './EquipmentArt';
import HomeView from './HomeView';
import MyBookings from './MyBookings';
import NoticesView from './NoticesView';
import { SizeContext } from './motion';
import { NOTICES_READ_KEY } from '../../../avenue/ui-helpers';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TZ = 'America/New_York';
const facility: IFacility = { facilityId: 'f', title: 'Flavors Hub', timeZone: TZ, earlyEntryMinutes: 30, cleanupMinutes: 30, checkoutAlertMinutes: 30 };
const U = (id: string, title: string, category: IResource['category'], sortOrder: number, extra: Partial<IResource> = {}): IResource =>
  ({ resourceId: id, title, kind: category === 'Prep table' ? 'Prep table' : 'Equipment', category, sortOrder, bookable: true, ...extra });
const resources: IResource[] = [
  U('stove-1', 'Stove #1', 'Stove', 1), U('stove-2', 'Stove #2', 'Stove', 2), U('grill-1', 'Flat Top Gas Grill #1', 'Grill', 3),
  U('prep-1', 'Prep table 1', 'Prep table', 4), U('prep-2', 'Prep table 2', 'Prep table', 5), U('prep-3', 'Prep table 3', 'Prep table', 6)
];
const day3: string = addDays(localDay(new Date(), TZ), 3);
const at = (hm: string): string => zonedToUtc(day3, hm, TZ);
const entry = (id: string, ids: string[], a: string, b: string): ICalendarEntry => ({ bookingId: id, resourceId: '', space: 'Kitchen', equipmentIds: ids, memberName: 'Sample Bakery', startUtc: at(a), endUtc: at(b) });

const flush = async (): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); }); };
const click = async (el: unknown): Promise<void> => { await act(async () => { (el as HTMLElement).click(); }); };
const button = (re: RegExp, within: ParentNode = document.body): HTMLButtonElement | undefined => Array.from(within.querySelectorAll('button')).find(b => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));
const setValue = async (el: HTMLInputElement, value: string): Promise<void> => {
  await act(async () => {
    (Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') as PropertyDescriptor).set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
/** Tap a board row at a local hour (the track is mocked 960 px wide: 40 px per hour, 20 px per 30-minute slot). */
const tap = async (lane: string, hour: number): Promise<void> => {
  const track = document.querySelector(`[data-track="${lane}"]`) as HTMLElement;
  await act(async () => { track.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: hour * 40 + 5 })); });
};
const setReduced = (reduced: boolean): void => {
  (window as unknown as { matchMedia: unknown }).matchMedia = (): unknown => ({ matches: reduced, addEventListener: (): void => undefined, removeEventListener: (): void => undefined });
};

let host: HTMLDivElement;
let root: Root;
let rect: jest.SpyInstance;
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); localStorage.clear();
  rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return (this.hasAttribute('data-track') ? { left: 0, width: 960, top: 0, height: 52, right: 960, bottom: 52, x: 0, y: 0 } : { left: 0, width: 1200, top: 0, height: 10, right: 1200, bottom: 10, x: 0, y: 0 }) as DOMRect;
  });
});
afterEach(() => { act(() => root.unmount()); host.remove(); rect.mockRestore(); forceReleaseImmersive(); delete (window as unknown as { matchMedia?: unknown }).matchMedia; });

function bookSource(entries: ICalendarEntry[], sent: Record<string, unknown>[]): never {
  return {
    listCalendar: async () => entries, getMyMembership: async () => ({ monthlyHours: 10 }), listMyRequests: async () => [], listMyInvoices: async () => [],
    submitRequest: async (body: never, id: string) => { sent.push(toIntakeItem(body, id)); }
  } as never;
}
const mountBook = async (source: never): Promise<void> => {
  await act(async () => { root.render(<BookBoard source={source} facility={facility} resources={resources} tables={[{ tableId: 'd1', seats: 30 }]} onSent={() => undefined} />); });
  await flush();
  await setValue(document.querySelector('input[type="date"]') as HTMLInputElement, day3);
  await flush();
};
const pressed = (unit: string): string | undefined => (document.querySelector(`[data-unit="${unit}"]`) as HTMLElement).getAttribute("aria-pressed") || undefined;

describe('top bar and shell', () => {
  const notices: INotice[] = [{ id: 1, title: 'Stove #2 serviced', body: 'x', category: 'Maintenance', pinned: true, publishedUtc: '2026-11-10T15:00:00Z' }];
  const source = {
    getFacility: async () => facility, listResources: async () => resources, listDiningTables: async () => [], listNotices: async () => notices,
    listMyRequests: async () => [], listMyDocuments: async () => [], listMyFlags: async () => [], listRequiredDocTypes: async () => [], listCalendar: async () => [], getMyMembership: async () => ({ status: 'Active' }), listMyInvoices: async () => []
  } as never;
  const mountPortal = async (immersive: boolean): Promise<void> => {
    await act(async () => { root.render(<AvenuePortal source={source} isDemo={false} userDisplayName="Ana Cook" userEmail="a@b.co" immersive={immersive} />); });
    await flush();
  };
  it('someone signed in without a membership sees the join screen instead of booking', async () => {
    const none = { ...(source as object), getMyMembership: async () => undefined, listPlans: async () => [], listMyHostRequests: async () => [] } as never;
    await act(async () => { root.render(<AvenuePortal source={none} isDemo={false} userDisplayName="Ana Cook" userEmail="a@b.co" />); });
    await flush();
    expect(host.textContent).toContain('Become a member');
    expect(host.querySelector('[data-section="home"]')).toBeNull();
  });
  it('a former member (no membership row, earlier requests on record) sees the inactive screen, not Join', async () => {
    const gone = { ...(source as object), getMyMembership: async () => undefined, listMyRequests: async () => [{ requestId: 'r1', status: 'Approved' }], listPlans: async () => [], listMyHostRequests: async () => [] } as never;
    await act(async () => { root.render(<AvenuePortal source={gone} isDemo={false} userDisplayName="Ana Cook" userEmail="a@b.co" />); });
    await flush();
    expect(host.textContent).toContain('Your membership is not active');
    expect(host.textContent).not.toContain('Become a member');
    expect(host.querySelector('[data-section="home"]')).toBeNull();
  });
  it('a failed membership read never shows the join screen', async () => {
    const broken = { ...(source as object), getMyMembership: async () => { throw new Error('400'); } } as never;
    await act(async () => { root.render(<AvenuePortal source={broken} isDemo={false} userDisplayName="Ana Cook" userEmail="a@b.co" />); });
    await flush();
    expect(host.textContent).not.toContain('Become a member');
  });
  it('sidebar (wide layout) lists the member and account pages with the active page marked', async () => {
    await mountPortal(false);
    const side = document.querySelector('nav[aria-label="Avenue menu"]') as HTMLElement;
    const labels: string[] = Array.from(side.querySelectorAll('button')).map(b => (b.textContent || '').trim());
    expect(labels.slice(0, 4)).toEqual(['Home', 'Book', 'My bookings', 'Schedule']);
    expect(side.querySelector('[aria-current="page"]')?.textContent).toContain('Home');
    expect(document.body.textContent).toContain('Need a hand?');
  });
  it('moves the active state with navigation and shows initials (sidebar, wide layout)', async () => {
    await mountPortal(false);
    const nav = document.querySelector('nav[aria-label="Avenue menu"]') as HTMLElement;
    expect(Array.from(nav.querySelectorAll('button')).map(b => (b.textContent || '').trim()).slice(0, 4)).toEqual(['Home', 'Book', 'My bookings', 'Schedule']);
    const current = (): string => (nav.querySelector('[aria-current="page"]')?.textContent || '').trim();
    expect(current()).toBe('Home');
    await click(button(/^Book$/, nav));
    expect(current()).toBe('Book');
    expect(document.querySelector('[aria-label="Book kitchen time"]')).not.toBeNull();
    await click(button(/^Schedule$/, nav));
    expect(current()).toBe('Schedule');
    expect(document.querySelector('button[aria-label$="account menu"]')?.textContent).toContain('AC');
  });
  it('works with and without full screen: the menu toggles the page chrome', async () => {
    await mountPortal(true);
    expect(document.body.classList.contains(IMMERSIVE_CLASS)).toBe(true);
    await click(document.querySelector('button[aria-label$="account menu"]'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    const full = (): HTMLElement => Array.prototype.slice.call(document.querySelectorAll('[role="switch"]')).filter((b: HTMLElement) => /Full screen/.test(b.textContent || ''))[0] as HTMLElement;
    expect(full().getAttribute('aria-checked')).toBe('true');
    await click(full());
    expect(document.body.classList.contains(IMMERSIVE_CLASS)).toBe(false);
    await click(full());
    expect(document.body.classList.contains(IMMERSIVE_CLASS)).toBe(true);
  });
});

describe('book on the board', () => {
  it('a kit pre-selects equipment and the minimum prep tables', async () => {
    await mountBook(bookSource([], []));
    expect(document.querySelectorAll('[data-kit]').length).toBe(6);
    await click(document.querySelector('[data-kit="hot-line"]'));
    expect(pressed('stove-1')).toBe('true');
    expect(pressed('grill-1')).toBe('true');
    expect(pressed('stove-2')).toBe('false');
    expect(document.querySelector('[aria-label="Number of prep tables"] b')?.textContent).toBe('2');
  });

  it('tap start then end draws a block; a clashing tap is refused with the suggestion; sending joins ids with ;', async () => {
    const sent: Record<string, unknown>[] = [];
    await mountBook(bookSource([entry('b1', ['stove-1'], '14:00', '16:00')], sent));
    await click(document.querySelector('[data-kit="hot-line"]'));
    await tap('grill-1', 15);
    expect(document.body.textContent).toContain('Tap where you finish');
    await tap('grill-1', 16);                                   // 15:00 to 16:30 clashes with Stove #1
    expect(document.querySelector('[data-testid="block"]')).toBeNull();
    const alert = document.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Stove #1 is busy until 4:00 PM.');
    expect(alert.textContent).toContain('Stove #2');
    await tap('grill-1', 17);
    await tap('grill-1', 17.5);                                  // 17:00 to 18:00
    const block = document.querySelector('[data-testid="block"]') as HTMLElement;
    expect(block.textContent).toContain('5:00 PM - 6:00 PM');
    expect(document.querySelector('[role="dialog"]')).toBeNull();                 // the dock is one slim row; long text is in Details
    expect((document.querySelector('aside[aria-label="Your booking"]') as HTMLElement).textContent).not.toContain('Entry from');
    await click(button(/^Details$/));
    const text: string = document.body.textContent || '';
    expect(text).toContain('Entry from 4:30 PM.');
    expect(text).toContain('Clean-up until 6:30 PM, free.');
    expect(text).toContain('Flavors reviews every request');
    await click(button(/Send request/));
    await flush();
    expect(sent.length).toBe(1);
    expect(sent[0].EquipmentIds).toBe('stove-1;grill-1;prep-1;prep-2');
    expect(sent[0].Space).toBe('Kitchen');
  });

  it('Find my time proposes slots and one tap applies one', async () => {
    await mountBook(bookSource([], []));
    await click(document.querySelector('[data-kit="prep"]'));
    await click(button(/Find my time/));
    const slots = Array.from(document.querySelectorAll('[aria-label="Suggested times"] button'));
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].textContent).toContain('Earliest');
    await click(slots[0]);
    expect(document.querySelector('[data-testid="block"]')).not.toBeNull();
    expect(button(/Send request/)).toBeDefined();
  });

  it('start and end pickers work without dragging, and a drag draws too', async () => {
    await mountBook(bookSource([], []));
    await click(document.querySelector('[data-kit="hot-line"]'));
    const [start, end] = Array.from(document.querySelectorAll('[aria-label="Start and end, without dragging"] select')) as HTMLSelectElement[];
    expect(end.disabled).toBe(true);
    await act(async () => { (Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value') as PropertyDescriptor).set!.call(start, '540'); start.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(document.querySelector('[data-testid="block"]')?.textContent).toContain('9:00 AM - 11:00 AM');
    const track = document.querySelector('[data-track="grill-1"]') as HTMLElement;
    const ev = (type: string, hour: number): MouseEvent => new MouseEvent(type, { bubbles: true, clientX: hour * 40 + 5 });
    await act(async () => { track.dispatchEvent(ev('pointerdown', 12)); track.dispatchEvent(ev('pointermove', 13)); track.dispatchEvent(ev('pointerup', 13)); });
    expect(document.querySelector('[data-testid="block"]')?.textContent).toContain('12:00 PM - 1:30 PM');
  });
});

describe('my bookings', () => {
  const start = new Date(Date.now() + 2 * 86400000).toISOString();
  const req: IMyRequest = { requestId: 'req-1', space: 'Kitchen', equipmentIds: ['stove-1', 'prep-1'], startUtc: start, endUtc: new Date(Date.parse(start) + 3 * 3600000).toISOString(), cancelSent: false, cancelRequested: false, status: 'Approved', note: 'See you then' };
  const src = { listMyRequests: async () => [req], submitCancel: async () => undefined, submitExtension: async () => undefined } as never;
  const mount = async (deepLink?: { bookingId: string; action?: string }): Promise<void> => {
    await act(async () => { root.render(<MyBookings source={src} facility={facility} resources={resources} onBook={() => undefined} deepLink={deepLink} />); });
    await flush();
  };
  it('groups by day and the drawer shows the three windows, Extend, Cancel and a calendar download', async () => {
    await mount();
    expect(document.querySelector('[data-booking="req-1"]')).not.toBeNull();
    expect(document.querySelectorAll('[aria-label^="Next 31 days"] button[class*="monthBooked"], [aria-label^="Next 31 days"] .' + s.monthBooked).length).toBe(1);
    await click(document.querySelector('[data-booking="req-1"] button'));
    const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(sheet.textContent).toContain('Entry from');
    expect(sheet.textContent).toContain('Booked ');
    expect(sheet.textContent).toContain('Clean-up until');
    expect(sheet.textContent).toContain('See you then');
    expect(button(/^Extend$/, sheet)).toBeDefined();
    expect((document.querySelector('aside[aria-label="Your booking"]') || sheet).getBoundingClientRect).toBeDefined();
    expect(button(/Cancel booking/, sheet)).toBeDefined();
    let href = '';
    const spy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { href = this.href; });
    await click(button(/Add to calendar/, sheet));
    spy.mockRestore();
    expect(decodeURIComponent(href)).toContain('BEGIN:VCALENDAR');
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('the Upcoming and Past switch changes the list', async () => {
    await mount();
    await click(button(/^Past$/));
    expect(document.querySelector('[data-booking="req-1"]')).toBeNull();
  });
  it('?booking=<id>&action=extend opens the drawer and the Extend dialog', async () => {
    await mount({ bookingId: 'req-1', action: 'extend' });
    const titles = Array.from(document.querySelectorAll('[role="dialog"]')).map(d => d.getAttribute('aria-label'));
    expect(titles).toEqual(['Booking details', 'Extend your booking']);
  });
});

describe('home live status', () => {
  it('shows the live phase from the facility settings', async () => {
    const now = Date.now();
    const live: IMyRequest = { requestId: 'r', space: 'Kitchen', equipmentIds: ['stove-1'], startUtc: new Date(now - 3600000).toISOString(), endUtc: new Date(now + 3 * 3600000).toISOString(), cancelSent: false, cancelRequested: false, status: 'Approved' };
    const src = { listMyRequests: async () => [live], listMyDocuments: async () => [], listMyFlags: async () => [], listRequiredDocTypes: async () => [], listCalendar: async () => [], listNotices: async () => [], getMyMembership: async () => ({ monthlyHours: 10 }), listMyInvoices: async () => [] } as never;
    await act(async () => { root.render(<HomeView source={src} data={{ facility, resources, tables: [] }} userEmail="a@b.co" userName="Ana Cook" isDemo={false} onNavigate={() => undefined} />); });
    await flush();
    expect(document.querySelector('[data-testid="live-headline"]')?.textContent).toMatch(/^In the kitchen until \d/);
    expect(document.querySelector('[data-testid="hours-block"]')?.textContent).toContain('left');
    expect(document.body.textContent).toMatch(/Good (morning|afternoon|evening), Ana/);
  });
});

describe('schedule', () => {
  const today = localDay(new Date(), TZ);
  const e: ICalendarEntry = { bookingId: 'b', resourceId: '', space: 'Kitchen', equipmentIds: ['stove-1'], memberName: 'Sample Bakery', startUtc: zonedToUtc(today, '12:00', TZ), endUtc: zonedToUtc(today, '14:00', TZ) };
  const src = { listCalendar: async () => [e] } as never;
  it('shows the board with a lane per unit and switches to the week heat view', async () => {
    await act(async () => { root.render(<CalendarView source={src} facility={facility} resources={resources} />); });
    await flush();
    await click(button(/^Equipment$/));
    await flush();
    expect(document.querySelector('[data-unit="stove-1"]')?.textContent).toMatch(/Next booking|In use|bookings?|Free for the rest of today/);   // the sample bookings end at 18:00 UTC, so later in the day a unit reads Free
    await click(button(/^Timeline$/));
    await flush();
    expect(document.querySelector('[data-lane="stove-1"]')?.textContent).toContain('Sample Bakery');
    expect(document.querySelectorAll('[data-lane]').length).toBe(resources.length + 1);
    await click(button(/^Week$/));
    await flush();
    const cell = document.querySelector('[aria-label^="Stove #1"][aria-label*="booked 8%"]');
    expect(cell).not.toBeNull();
  });
  it('is a list per equipment on phones', async () => {
    await act(async () => { root.render(<SizeContext.Provider value="phone"><CalendarView source={src} facility={facility} resources={resources} /></SizeContext.Provider>); });
    await flush();
    await click(button(/^Timeline$/));
    await flush();
    expect(document.querySelector('[data-testid="schedule-list"] article[data-unit="stove-1"]')?.textContent).toContain('12:00 PM - 2:00 PM');
    expect(document.querySelector('[data-testid="board"]')).toBeNull();
  });
  it('opens a booked day in a sheet on phones, so the member does not scroll past the month grid', async () => {
    await act(async () => { root.render(<SizeContext.Provider value="phone"><CalendarView source={src} facility={facility} resources={resources} /></SizeContext.Provider>); });
    await flush();
    const cell = Array.from(document.querySelectorAll('[role="gridcell"]')).find(c => /, [1-9]\d* booking/.test(c.getAttribute('aria-label') || ''));
    expect(cell).toBeDefined();
    await click(cell);
    await flush();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Sample Bakery');
  });
  it('shows an error instead of an empty schedule when loading fails', async () => {
    const bad = { listCalendar: async () => { throw new Error('offline'); } } as never;
    await act(async () => { root.render(<CalendarView source={bad} facility={facility} resources={resources} />); });
    await flush();
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/could not load the (schedule|calendar)/);
  });
});

describe('notices', () => {
  const n = (id: number, title: string, category: INotice['category'], pinned: boolean, body: string, day: number): INotice => ({ id, title, body, category, pinned, publishedUtc: `2026-11-${10 + day}T15:00:00Z` });
  const list: INotice[] = [
    n(1, 'Newest general', 'General', false, 'Short body', 5),
    n(2, 'Old pinned', 'Maintenance', true, 'x'.repeat(100) + '\n\n<b>bold?</b> <img src=x onerror=alert(1)>' + 'y'.repeat(100), 1),
    n(3, 'Urgent one', 'Urgent', false, 'Water off', 3)
  ];
  it('lists pinned first in groups, filters, opens a notice in the drawer, tracks unread and shows markup as text', async () => {
    const src = { listNotices: async () => list } as never;
    await act(async () => { root.render(<NoticesView source={src} facility={facility} />); });
    await flush();
    const titles = (): string[] => Array.from(document.querySelectorAll('[data-notice] strong')).map(h => h.textContent || '');
    expect(titles()).toEqual(['Old pinned', 'Newest general', 'Urgent one']);
    expect(Array.from(document.querySelectorAll('h3')).map(h => h.textContent)[0]).toBe('Pinned');
    expect(document.querySelectorAll('[data-testid="unread-dot"]').length).toBe(3);
    await click(button(/^Urgent/));
    expect(titles()).toEqual(['Urgent one']);
    await click(button(/^Urgent/)); // 1.10: tapping the active chip again clears the filter (no separate "All" chip)
    await act(async () => { (document.querySelector('[data-notice="2"] button') as HTMLButtonElement).click(); });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Old pinned');
    expect(dialog.querySelector('b')).toBeNull();
    expect(dialog.textContent).toContain('<b>bold?</b>');
    expect(document.querySelectorAll('[data-testid="unread-dot"]').length).toBe(2);
    expect(JSON.parse(localStorage.getItem(NOTICES_READ_KEY) as string)).toEqual([2]);
    await act(async () => { (dialog.querySelector('[aria-label="Close"]') as HTMLButtonElement).click(); });
    await click(button(/^Unread/));
    expect(titles()).toEqual(['Newest general', 'Urgent one']);
    await click(button(/Mark all as read/));
    expect(document.querySelectorAll('[data-testid="unread-dot"]').length).toBe(0);
    expect(document.body.textContent).toContain('You are all caught up.');
  });
  it('shows an empty state', async () => {
    await act(async () => { root.render(<NoticesView source={{ listNotices: async () => [] } as never} facility={facility} />); });
    await flush();
    expect(document.body.textContent).toContain('No notices right now.');
  });
});

describe('equipment artwork', () => {
  it('picks artwork by category, id or title', () => {
    expect(equipmentArt('Stove')).toBe('stove');
    expect(equipmentArt('oven-low', 'Convection Oven (Lower)', 'Oven')).toBe('oven-lower');
    expect(equipmentArt('pizza-up', 'Pizza Oven 1 (Upper)', 'Pizza oven')).toBe('pizza');
  });
  it('draws the SVG, and a non-empty PhotoUrl overrides it with an img that has alt text', async () => {
    await act(async () => { root.render(<><EquipmentArt unit={resources[0]} /><EquipmentArt unit={{ ...resources[1], photoUrl: 'https://example.com/s2.jpg' }} /></>); });
    expect(host.querySelector('[data-art="stove"] svg')?.getAttribute('aria-label')).toBe('Stove #1');
    const img = host.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('Stove #2');
    expect(img.getAttribute('src')).toBe('https://example.com/s2.jpg');
    expect(host.querySelectorAll('svg').length).toBe(1);
  });
  it('animates only when motion is allowed', async () => {
    setReduced(false);
    await act(async () => { root.render(<EquipmentArt unit={resources[0]} />); });
    expect(host.querySelector('.' + s.aFlame)).not.toBeNull();
    act(() => root.unmount()); root = createRoot(host);
    setReduced(true);
    await act(async () => { root.render(<EquipmentArt unit={resources[0]} />); });
    expect(host.querySelector('.' + s.aFlame)).toBeNull();
    expect(host.querySelector('.' + s.aSteam)).toBeNull();
  });
});

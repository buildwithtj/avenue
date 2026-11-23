/** @jest-environment jsdom */
import * as React from 'react';
import { RELEASE_MODULES } from '../../../avenue/release.generated';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import SupportView from './SupportView';
import EventsView from './EventsView';
import StorageView from './StorageView';
import TeamView from './TeamView';
import WellnessCheck from './WellnessCheck';
import ProfileDrawer from './ProfileDrawer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const flush = async (): Promise<void> => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };

let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const draw = async (el: React.ReactElement): Promise<void> => { await act(async () => { root.render(el); }); await flush(); };
const set = async (el: Element, v: string): Promise<void> => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { (Object.getOwnPropertyDescriptor(proto, 'value') as PropertyDescriptor).set!.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
};
const btn = (label: RegExp): HTMLButtonElement => Array.from(host.querySelectorAll('button')).find(b => label.test(b.textContent || '')) as HTMLButtonElement;
const click = async (el: Element): Promise<void> => { await act(async () => { (el as HTMLElement).click(); }); await flush(); };
const field = (label: RegExp): Element => Array.from(host.querySelectorAll('label')).find(l => label.test(l.textContent || ''))!.querySelector('input,select,textarea')!;
const msg = (id: number, thread: string, o: object = {}): object => ({ id, messageId: `m${id}`, threadId: thread, category: 'Billing', subject: 'Invoice question', body: `Body ${id}`, ...o });

describe('SupportView', () => {
  it('shows the empty state and refuses an empty message without calling the source', async () => {
    const sent: unknown[][] = [];
    const src = { listMySupportMessages: async () => [], submitSupportMessage: async (...a: unknown[]) => { sent.push(a); } } as never;
    await draw(<SupportView source={src} facilityId="f" />);
    expect(host.textContent).toContain('No messages yet');
    await click(btn(/New message/)); await click(btn(/^Send$/));
    expect(sent.length).toBe(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Choose what your message is about.');
  });
  it('shows the error the source returns when sending fails', async () => {
    const src = { listMySupportMessages: async () => [], submitSupportMessage: async () => { throw new Error('Avenue: requests cannot be sent from this page.'); } } as never;
    await draw(<SupportView source={src} facilityId="f" />);
    await click(btn(/New message/));
    await set(field(/About/), 'Other'); await set(field(/Subject/), 'Hello there'); await set(field(/Message/), 'Some text here');
    await click(btn(/^Send$/));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('requests cannot be sent');
  });
  it('sends category, subject and body; the thread id is left to the source', async () => {
    const sent: unknown[][] = [];
    const src = { listMySupportMessages: async () => [], submitSupportMessage: async (...a: unknown[]) => { sent.push(a); } } as never;
    await draw(<SupportView source={src} facilityId="fac1" />);
    await click(btn(/New message/));
    await set(field(/About/), 'Billing'); await set(field(/Subject/), 'Invoice'); await set(field(/Message/), 'Please check it');
    await click(btn(/^Send$/));
    expect(sent[0][0]).toEqual({ facilityId: 'fac1', category: 'Billing', subject: 'Invoice', body: 'Please check it' });
    expect(String(sent[0][1])).toMatch(/^msg-/); expect(sent[0][2]).toBeUndefined();
  });
  it('lists threads newest first with Reply received, shows the reply, and replies in the same thread', async () => {
    const sent: unknown[][] = [];
    const rows = [msg(1, 'a', { subject: 'First', reply: 'We fixed it' }), msg(2, 'b', { subject: 'Second' })];
    const src = { listMySupportMessages: async () => rows, submitSupportMessage: async (...a: unknown[]) => { sent.push(a); } } as never;
    await draw(<SupportView source={src} facilityId="f" />);
    const cards = Array.from(host.querySelectorAll('li button')).map(b => b.textContent || '');
    expect(cards[0]).toContain('Second'); expect(cards[1]).toContain('First'); expect(cards[1]).toContain('Reply received'); expect(cards[0]).not.toContain('Reply received');
    await click(host.querySelectorAll('li button')[1]);
    expect(host.textContent).toContain('Reply from Flavors'); expect(host.textContent).toContain('We fixed it');
    await set(field(/Reply/), 'Thank you'); await click(btn(/^Send$/));
    expect(sent[0][0]).toMatchObject({ category: 'Billing', subject: 'Re: First', body: 'Thank you' }); expect(sent[0][2]).toBe('a');
  });
  it('shows a load error', async () => {
    await draw(<SupportView source={{ listMySupportMessages: async () => { throw new Error('boom'); } } as never} facilityId="f" />);
    expect(host.textContent).toContain('We could not load your conversations.');
    expect(host.textContent).not.toContain('boom');
    expect(host.querySelector('[role="alert"] button')?.textContent).toBe('Try again');
  });
});

describe('EventsView', () => {
  const src = (sent: unknown[][], mine: object[] = []): never => ({ listMyEventRequests: async () => mine, submitEventRequest: async (...a: unknown[]) => { sent.push(a); } }) as never;
  it('shows the member prices and the deposit and balance rule once a package and date are chosen', async () => {
    await draw(<EventsView source={src([])} facilityId="f" timeZone="America/New_York" />);
    expect(host.textContent).toContain('$950.00'); expect(host.textContent).toContain('$1850.00');
    await click(host.querySelector('input[value="Opulence"]')!);
    await set(field(/Event date/), '2099-06-15'); await set(field(/Guests/), '60');
    const t = host.querySelector('[aria-live="polite"]')!.textContent || '';
    expect(t).toContain('$1200.00'); expect(t).toContain('$500.00'); expect(t).toContain('30 days before the event'); expect(t).toContain('More than 50 guests');
  });
  it('sends the request with the chosen values', async () => {
    const sent: unknown[][] = [];
    await draw(<EventsView source={src(sent)} facilityId="fac1" timeZone="America/New_York" />);
    await click(host.querySelector('input[value="Simplicity"]')!);
    await set(field(/Event date/), '2099-06-15'); await set(field(/Guests/), '30'); await set(field(/Notes/), 'Birthday');
    await click(btn(/Send request/));
    expect(sent[0][0]).toEqual({ facilityId: 'fac1', pkg: 'Simplicity', eventDate: '2099-06-15', guests: 30, notes: 'Birthday' });
  });
  it('refuses without a package, and lists earlier requests with their status and reply', async () => {
    const sent: unknown[][] = [];
    await draw(<EventsView source={src(sent, [{ id: 1, requestId: 'e1', pkg: 'Platinum', eventDate: '2099-01-02', guests: 20, outcome: 'Received.', reply: 'Approved for that date' }])} facilityId="f" timeZone="America/New_York" />);
    await click(btn(/Send request/));
    expect(sent.length).toBe(0); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Choose a package');
    expect(host.textContent).toContain('Platinum'); expect(host.textContent).toContain('Approved for that date');
  });
});

describe('StorageView', () => {
  const src = (sent: unknown[][], mine: object[] = []): never => ({ listMyStorageRequests: async () => mine, submitStorageRequest: async (...a: unknown[]) => { sent.push(a); } }) as never;
  it('prices only stated items and says price on request for the rest', async () => {
    await draw(<StorageView source={src([])} facilityId="f" />);
    const opts = Array.from(host.querySelectorAll('option')).map(o => o.textContent || '');
    expect(opts.filter(o => /Half-door fridge/.test(o))[0]).toContain('$250.00');
    expect(opts.filter(o => /Dry storage shelf, single/.test(o))[0]).toContain('price on request');
    await set(field(/What do you need/), 'Half-door freezer'); await set(field(/Quantity/), '2');
    expect(host.querySelector('[aria-live="polite"]')!.textContent).toContain('$500.00');
    await set(field(/What do you need/), 'Dry shelf double');
    expect(host.querySelector('[aria-live="polite"]')!.textContent).toContain('Price on request');
  });
  it('sends the request and shows earlier ones', async () => {
    const sent: unknown[][] = [];
    await draw(<StorageView source={src(sent, [{ id: 1, requestId: 's1', item: 'Daily cold shelf', quantity: 3, outcome: 'Received.', reply: 'Shelf A' }])} facilityId="f" />);
    expect(host.textContent).toContain('Daily cold storage × 3'); expect(host.textContent).toContain('Shelf A');
    await set(field(/What do you need/), 'Daily dry shelf'); await click(btn(/Send request/));
    expect(sent[0][0]).toEqual({ facilityId: 'f', item: 'Daily dry shelf', quantity: 1, notes: '' });
  });
  it('refuses with no item', async () => {
    const sent: unknown[][] = [];
    await draw(<StorageView source={src(sent)} facilityId="f" />);
    await click(btn(/Send request/));
    expect(sent.length).toBe(0); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Choose what you need');
  });
});

describe('TeamView', () => {
  it('adds, removes and brings back people', async () => {
    const team = [{ id: 1, teamMemberId: 't1', personName: 'Ana', role: 'Lead', active: true }, { id: 2, teamMemberId: 't2', personName: 'Bo', role: 'Member', active: false }];
    const calls: unknown[][] = [];
    const src = { listMyTeam: async () => team, addTeamMember: async (...a: unknown[]) => { calls.push(['add', ...a]); }, setTeamMemberActive: async (...a: unknown[]) => { calls.push(['set', ...a]); } } as never;
    await draw(<TeamView source={src} />);
    expect(host.textContent).toContain('Ana'); expect(host.textContent).toContain('Removed (1)');
    await set(host.querySelector('#team-name')!, 'Cy'); await set(host.querySelector('#team-role')!, 'Lead'); await click(btn(/^Add$/));
    expect(calls[0].slice(0, 3)).toEqual(['add', 'Cy', 'Lead']);
    await click(host.querySelector('[aria-label="Remove Ana"]')!); expect(calls[1]).toEqual(['set', 1, false]);
    await click(host.querySelector('[aria-label="Bring back Bo"]')!); expect(calls[2]).toEqual(['set', 2, true]);
  });
  it('refuses a duplicate name without calling the source', async () => {
    const calls: unknown[] = [];
    const src = { listMyTeam: async () => [{ id: 1, teamMemberId: 't1', personName: 'Ana', role: 'Lead', active: true }], addTeamMember: async () => { calls.push(1); }, setTeamMemberActive: async () => undefined } as never;
    await draw(<TeamView source={src} />);
    await set(host.querySelector('#team-name')!, 'ana'); await click(btn(/^Add$/));
    expect(calls.length).toBe(0); expect(host.querySelector('[role="alert"]')?.textContent).toContain('already on your team');
  });
});

describe('WellnessCheck roster', () => {
  it('prefills the names from the roster and still lets the lead remove one for today', async () => {
    const src = { submitCheckIn: async () => undefined } as never;
    await draw(<WellnessCheck source={src} facilityId="f" timeZone="America/New_York" bookingId="b1" roster={['Ana', 'Bo']} questions={[{ id: 1, kind: 'Wellness', text: 'Well?', order: 1 }]} onDone={() => undefined} />);
    expect(Array.from(host.querySelectorAll('li span')).map(x => x.textContent)).toEqual(['Ana', 'Bo']);
    await click(host.querySelector('[aria-label="Remove Bo"]')!);
    expect(Array.from(host.querySelectorAll('li span')).map(x => x.textContent)).toEqual(['Ana']);
    expect((btn(/Start wellness check/)).disabled).toBe(false);
  });
});

describe('profile drawer: new entries', () => {
  const base = { getMyMembership: async () => ({ status: 'Active', planName: 'Emerging-10', monthlyHours: 10, collectionDay: 5, businessName: 'Maple' }), listMyRequests: async () => [], listMyDocuments: async () => [], listMyFlags: async () => [], listRequiredDocTypes: async () => [], listMyInvoices: async () => [] };
  const open = async (src: object, isDemo = true): Promise<void> => draw(<ProfileDrawer open={true} onClose={() => undefined} source={src as never} isDemo={isDemo} userName="Ana Cook" userEmail="a@b.co" timeZone="America/New_York" prefs={{ sound: true, haptics: true, alerts: false }} setPref={() => undefined} full={false} setFull={() => undefined} onNavigate={() => undefined} />);
  const dlg = (): string => (document.querySelector('[role="dialog"]') as HTMLElement).textContent || '';
  it('shows Event request, Storage, My team and Messages with Flavors in demo, with a reply dot only when a reply waits', async () => {
    await open({ ...base, listMySupportMessages: async () => [{ id: 1, threadId: 'a', messageId: 'm1', category: 'Billing', subject: 's', body: 'b', reply: 'Hi' }] });
    const t = dlg();
    expect(t).toContain('Event request'); expect(t).toContain('Storage'); expect(t).toContain('My team'); expect(t).toContain('Messages with Flavors'); expect(t).toContain('Reply received');
    expect(t.indexOf('Your account')).toBeLessThan(t.indexOf('Event request'));
    expect(t.indexOf('Help')).toBeLessThan(t.indexOf('Messages with Flavors'));
  });
  it('has no dot when no reply waits, and survives a source without the new methods', async () => {
    await open({ ...base, listMySupportMessages: async () => [{ id: 1, threadId: 'a', messageId: 'm1', category: 'Billing', subject: 's', body: 'b' }] });
    expect(dlg()).not.toContain('Reply received');
    act(() => root.unmount()); root = createRoot(host);
    await open(base);
    expect(dlg()).toContain('Messages with Flavors');
  });
  it('hides an entry in a real release that does not list its module', async () => {
    await open(base, false);
    const t = dlg();
    // Follows the real release list: an entry is shown only when its module is listed in release/release.json.
    expect(t.includes('My team')).toBe((RELEASE_MODULES || []).indexOf('team') >= 0);
    expect(t.includes('Event request')).toBe((RELEASE_MODULES || []).indexOf('events') >= 0);
  });
});

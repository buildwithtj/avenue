import { AvenueReadSource, LISTS } from './readSource';
import { demoFetchJson, demoStore, demoWriter, DEMO_FACILITY_ID } from './demoData';
import type { IIntakeWriter } from './contracts';

const writer = (added: Array<[string, Record<string, unknown>]> = [], updated: Array<[string, number, Record<string, unknown>]> = []): IIntakeWriter => ({
  add: async (l, i) => { added.push([l, i]); return 7; }, update: async (l, id, f) => { updated.push([l, id, f]); }, attach: async () => undefined
});
const src = (rows: unknown[], urls: string[] = [], w?: IIntakeWriter, author?: number): AvenueReadSource =>
  new AvenueReadSource('https://x', 'f1', url => { urls.push(url); return Promise.resolve({ value: rows }); }, w, author);

describe('support reads and writes', () => {
  it('reads only the member\'s own items (AuthorId filter) and drops malformed rows', async () => {
    const urls: string[] = [];
    const rows = [
      { Id: 2, MessageId: 'm2', ThreadId: 'm1', Category: 'Billing', Subject: 'S', Body: 'B', Outcome: 'Received', Reply: 'Hi' },
      { Id: 3, MessageId: 'm3', ThreadId: 'm3', Category: 'Nonsense', Subject: 'S' }, { Id: 4, ThreadId: 'x', Category: 'Billing', Subject: 'S' }
    ];
    const out = await src(rows, urls, undefined, 42).listMySupportMessages();
    expect(out).toEqual([{ id: 2, messageId: 'm2', threadId: 'm1', category: 'Billing', subject: 'S', body: 'B', outcome: 'Received', reply: 'Hi' }]);
    expect(decodeURIComponent(urls[0])).toContain('AuthorId eq 42');
    expect(urls[0]).toContain('AvenueSupportMessages');
  });
  it('writes a validated item, and a reply keeps the thread id', async () => {
    const added: Array<[string, Record<string, unknown>]> = [];
    const s = src([], [], writer(added));
    await s.submitSupportMessage({ facilityId: 'f1', category: 'Billing', subject: 'Invoice', body: 'Please check' }, 'msg-1');
    await s.submitSupportMessage({ facilityId: 'f1', category: 'Billing', subject: 'Re: Invoice', body: 'Thanks' }, 'msg-2', 'msg-1');
    expect(added[0][0]).toBe(LISTS.supportMessages);
    expect(added[0][1]).toMatchObject({ MessageId: 'msg-1' });
    expect(added[0][1]).not.toHaveProperty('ThreadId');
    expect(added[1][1]).toMatchObject({ MessageId: 'msg-2', ThreadId: 'msg-1' });
  });
  it('refuses a bad facility, id or content, and a page that cannot write', async () => {
    const ok = { facilityId: 'f1', category: 'Billing' as const, subject: 'Invoice', body: 'Please check' };
    await expect(src([], [], writer()).submitSupportMessage({ ...ok, facilityId: 'other' }, 'm1')).rejects.toThrow(/different facility/);
    await expect(src([], [], writer()).submitSupportMessage(ok, "a'b")).rejects.toThrow(/invalid message id/);
    await expect(src([], [], writer()).submitSupportMessage({ ...ok, body: '' }, 'm1')).rejects.toThrow(/Your message needs/);
    await expect(src([]).submitSupportMessage(ok, 'm1')).rejects.toThrow(/cannot be sent/);
  });
});

describe('event, storage and team reads and writes', () => {
  it('reads event and storage requests newest first and ignores unknown packages and items', async () => {
    const ev = await src([{ Id: 1, RequestId: 'e1', Package: 'Opulence', EventDate: '2099-01-02T12:00:00Z', Guests: 20 }, { Id: 2, RequestId: 'e2', Package: 'Gold', EventDate: '2099-01-02T12:00:00Z' }, { Id: 3, RequestId: 'e3', Package: 'Platinum', EventDate: '2099-03-04T12:00:00Z', Guests: 5, Reply: 'ok' }]).listMyEventRequests();
    expect(ev.map(e => e.requestId)).toEqual(['e3', 'e1']);
    expect(ev[0]).toMatchObject({ eventDate: '2099-03-04', guests: 5, reply: 'ok' });
    const st = await src([{ Id: 1, RequestId: 's1', Item: 'Half-door fridge', Quantity: 2 }, { Id: 2, RequestId: 's2', Item: 'Closet' }]).listMyStorageRequests();
    expect(st).toEqual([{ id: 1, requestId: 's1', item: 'Half-door fridge', quantity: 2, notes: undefined, outcome: undefined, reply: undefined }]);
  });
  it('validates before writing events and storage', async () => {
    const added: Array<[string, Record<string, unknown>]> = [];
    const s = src([], [], writer(added));
    await s.submitEventRequest({ facilityId: 'f1', pkg: 'Simplicity', eventDate: '2099-01-02', guests: 10, notes: '' }, 'evt-1', '2026-11-23');
    await s.submitStorageRequest({ facilityId: 'f1', item: 'Daily dry shelf', quantity: 1, notes: '' }, 'sto-1');
    expect(added.map(a => a[0])).toEqual([LISTS.eventRequests, LISTS.storageRequests]);
    await expect(s.submitEventRequest({ facilityId: 'f1', pkg: 'Simplicity', eventDate: '2020-01-01', guests: 10, notes: '' }, 'evt-2', '2026-11-23')).rejects.toThrow(/after today/);
    await expect(s.submitStorageRequest({ facilityId: 'f1', item: '', quantity: 1, notes: '' }, 'sto-2')).rejects.toThrow(/Choose what you need/);
    expect(added.length).toBe(2);
  });
  it('reads the team with active defaulting to true, and adds, deactivates through the writer', async () => {
    const added: Array<[string, Record<string, unknown>]> = []; const updated: Array<[string, number, Record<string, unknown>]> = [];
    const s = src([{ Id: 1, TeamMemberId: 't1', PersonName: 'Ana', Role: 'Lead' }, { Id: 2, TeamMemberId: 't2', PersonName: 'Bo', Role: 'x', Active: false }], [], writer(added, updated));
    const team = await s.listMyTeam();
    expect(team).toEqual([{ id: 1, teamMemberId: 't1', personName: 'Ana', role: 'Lead', active: true }, { id: 2, teamMemberId: 't2', personName: 'Bo', role: 'Member', active: false }]);
    await s.addTeamMember('Cy', 'Member', 'team-1', team);
    await s.setTeamMemberActive(1, false);
    expect(added[0]).toEqual([LISTS.teamMembers, expect.objectContaining({ PersonName: 'Cy', Active: true })]);
    expect(updated[0]).toEqual([LISTS.teamMembers, 1, { Active: false }]);
    await expect(s.addTeamMember('ana', 'Member', 'team-2', team)).rejects.toThrow(/already on your team/);
  });
});

describe('demo mode', () => {
  it('serves a sample thread with a reply, a sample team, and echoes what the member sends', async () => {
    const s = new AvenueReadSource('https://x', DEMO_FACILITY_ID, demoFetchJson, demoWriter);
    expect((await s.listMySupportMessages())[0].reply).toMatch(/Sample reply/);
    expect((await s.listMyTeam()).map(t => t.personName)).toEqual(['Sample Lead', 'Sample Cook']);
    await s.submitSupportMessage({ facilityId: DEMO_FACILITY_ID, category: 'Other', subject: 'Hello', body: 'A demo message' }, 'demo-msg-1');
    const mine = await s.listMySupportMessages();
    expect(mine.length).toBe(2); expect(mine[1].outcome).toMatch(/Received/);
    await s.submitEventRequest({ facilityId: DEMO_FACILITY_ID, pkg: 'Simplicity', eventDate: '2099-01-02', guests: 5, notes: '' }, 'demo-evt-1', '2026-11-23');
    expect((await s.listMyEventRequests())[0].outcome).toMatch(/Received/);
    await s.submitStorageRequest({ facilityId: DEMO_FACILITY_ID, item: 'Daily cold shelf', quantity: 1, notes: '' }, 'demo-sto-1');
    expect((await s.listMyStorageRequests())[0].outcome).toMatch(/Received/);
    await s.setTeamMemberActive(9102, false);
    expect((await s.listMyTeam()).filter(t => t.active).map(t => t.personName)).toEqual(['Sample Lead']);
    expect(demoStore[LISTS.supportMessages].length).toBe(1);
  });
});

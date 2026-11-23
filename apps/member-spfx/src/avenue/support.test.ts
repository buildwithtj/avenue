import { anyReplyWaiting, groupThreads, toSupportItem, validateSupport } from './support';
import type { IMySupportMessage } from './contracts';

const m = (id: number, thread: string, o: Partial<IMySupportMessage> = {}): IMySupportMessage => ({ id, messageId: `m${id}`, threadId: thread, category: 'Billing', subject: 'Invoice question', body: 'Hello there', ...o });

describe('support', () => {
  it('validates category, subject and body', () => {
    expect(validateSupport({ facilityId: 'f', category: 'Billing', subject: 'Invoice', body: 'Please check it' })).toEqual([]);
    expect(validateSupport({ facilityId: 'f', category: '', subject: 'ab', body: 'hi' }).length).toBe(3);
    expect(validateSupport({ facilityId: 'f', category: 'Other', subject: 'x'.repeat(121), body: 'y'.repeat(2001) }).length).toBe(2);
  });
  it('builds the intake item without any identity field', () => {
    const it = toSupportItem({ facilityId: 'f', category: 'Billing', subject: ' Invoice ', body: ' text ' }, 'm1', 'm1');
    expect(it).toMatchObject({ MessageId: 'm1', ThreadId: 'm1', Subject: 'Invoice', Body: 'text', Category: 'Billing' });
    expect(Object.keys(it).join()).not.toMatch(/Author|Member|Email/i);
  });
  it('leaves ThreadId out for a new conversation (the flow sets it) and sends it for a reply', () => {
    const base = { facilityId: 'f', category: 'Billing' as const, subject: 'Invoice', body: 'text here' };
    expect(toSupportItem(base, 'm1')).not.toHaveProperty('ThreadId');
    expect(toSupportItem(base, 'm2', 'm1')).toMatchObject({ MessageId: 'm2', ThreadId: 'm1' });
  });
  it('groups into threads, newest activity first, subject from the first message', () => {
    const t = groupThreads([m(1, 'a', { subject: 'First' }), m(3, 'b', { subject: 'Other' }), m(2, 'a', { subject: 'Re: First' })]);
    expect(t.map(x => x.threadId)).toEqual(['b', 'a']);
    expect(t[1].subject).toBe('First');
    expect(t[1].messages.map(x => x.id)).toEqual([1, 2]);
  });
  it('shows a reply only while the newest message is the answered one', () => {
    expect(groupThreads([m(1, 'a', { reply: 'Done, thanks' })])[0].replyReceived).toBe(true);
    expect(groupThreads([m(1, 'a', { reply: 'Done' }), m(2, 'a')])[0].replyReceived).toBe(false);
    expect(groupThreads([m(1, 'a', { reply: '  ' })])[0].replyReceived).toBe(false);
    expect(anyReplyWaiting([m(1, 'a', { reply: 'x' }), m(2, 'b')])).toBe(true);
    expect(anyReplyWaiting([])).toBe(false);
  });
});

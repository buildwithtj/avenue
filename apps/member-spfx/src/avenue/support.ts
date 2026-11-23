// Messages with Flavors: validation, the intake item, and thread grouping. Pure. No promise about reply times (Q-13).
import { SUPPORT_CATEGORIES, type IMySupportMessage, type SupportCategory } from './contracts';

export interface ISupportInput { facilityId: string; category: SupportCategory | ''; subject: string; body: string }

export function validateSupport(i: ISupportInput): string[] {
  const e: string[] = [];
  if (SUPPORT_CATEGORIES.indexOf(i.category as SupportCategory) < 0) { e.push('Choose what your message is about.'); }
  const s: number = i.subject.trim().length, b: number = i.body.trim().length;
  if (s < 3 || s > 120) { e.push('The subject needs 3 to 120 characters.'); }
  if (b < 5 || b > 2000) { e.push('Your message needs 5 to 2000 characters.'); }
  return e;
}

/** `threadId` is the thread being replied to; left out for a new conversation (the flow then sets it to this message's id). */
export function toSupportItem(i: ISupportInput, messageId: string, threadId?: string): Record<string, unknown> {
  const item: Record<string, unknown> = { Title: i.subject.trim().slice(0, 120), FacilityId: i.facilityId, MessageId: messageId, Category: i.category, Subject: i.subject.trim(), Body: i.body.trim() };
  if (threadId) { item.ThreadId = threadId; }
  return item;
}

export interface IThread {
  threadId: string;
  subject: string;
  category: SupportCategory;
  /** Oldest first. */
  messages: IMySupportMessage[];
  /** Staff replied to the newest message and the member has not written since. */
  replyReceived: boolean;
  last: IMySupportMessage;
}

/** Groups the member's own messages into threads, newest activity first. A reply is shown against the message staff answered. */
export function groupThreads(messages: IMySupportMessage[]): IThread[] {
  const by: Record<string, IMySupportMessage[]> = {};
  messages.forEach(m => { (by[m.threadId] = by[m.threadId] || []).push(m); });
  return Object.keys(by).map(id => {
    const ms: IMySupportMessage[] = by[id].slice().sort((a, b) => a.id - b.id);
    const last: IMySupportMessage = ms[ms.length - 1];
    return { threadId: id, subject: ms[0].subject, category: ms[0].category, messages: ms, last, replyReceived: !!(last.reply && last.reply.trim()) };
  }).sort((a, b) => b.last.id - a.last.id);
}

export const anyReplyWaiting = (messages: IMySupportMessage[]): boolean => groupThreads(messages).some(t => t.replyReceived);

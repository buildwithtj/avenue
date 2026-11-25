// Messages with Flavors: validation, the intake item, and thread grouping. Pure. No promise about reply times (Q-13).
import { SUPPORT_CATEGORIES, type IMySupportMessage } from './contracts';

/** `category` is free text: the choices come from AvenueSupportCategories (staff-managed), falling back to SUPPORT_CATEGORIES. */
export interface ISupportInput { facilityId: string; category: string; subject: string; body: string }

/** `categories`: the choices the member was offered (listSupportCategories); the flow checks again. */
export function validateSupport(i: ISupportInput, categories: string[] = SUPPORT_CATEGORIES): string[] {
  const e: string[] = [];
  if (!i.category || categories.indexOf(i.category) < 0) { e.push('Choose what your message is about.'); }
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
  category: string;
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

// ---- Attachments (decision 23 Nov 2026: images and PDF, up to 5 files x 10 MB; checked here and again by the flow). ----
export const ATTACH_EXTENSIONS: string[] = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf'];
export const ATTACH_ACCEPT: string = 'image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.pdf';
export const MAX_ATTACHMENTS: number = 5;
export const MAX_ATTACHMENT_BYTES: number = 10 * 1024 * 1024;

const extOf = (name: string): string => { const d: number = name.lastIndexOf('.'); return d >= 0 ? name.slice(d + 1).toLowerCase() : ''; };

/** Checked by extension, because some browsers give HEIC files no MIME type. */
export function validateAttachments(files: { name: string; size: number }[]): string[] {
  const e: string[] = [];
  if (files.length > MAX_ATTACHMENTS) { e.push(`Attach up to ${MAX_ATTACHMENTS} files.`); }
  files.forEach(f => {
    if (ATTACH_EXTENSIONS.indexOf(extOf(f.name)) < 0) { e.push(`${f.name}: attach a photo (JPEG, PNG, HEIC, WebP) or a PDF.`); }
    else if (f.size <= 0 || f.size > MAX_ATTACHMENT_BYTES) { e.push(`${f.name}: each file must be smaller than 10 MB.`); }
  });
  return e;
}

export const isImageName = (name: string): boolean => ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].indexOf(extOf(name)) >= 0;

export type ThreadStatus = 'Open' | 'Answered' | 'Closed' | 'Archived' | 'Uploading';

/**
 * Ticket status from the newest message's echoed Outcome/Reply (display only). "Closed by Flavors" and "Answered" are what the
 * reply flow writes; [PROPOSED] "Archived…" is the Outcome staff set when they archive a case. "Uploading" means files never finished.
 */
export function threadStatus(t: IThread): ThreadStatus {
  const o: string = (t.last.outcome || '').trim();
  if (o === 'Uploading') { return 'Uploading'; }
  if (/^archived/i.test(o)) { return 'Archived'; }
  if (/^closed/i.test(o)) { return 'Closed'; }
  return t.replyReceived || /^answered/i.test(o) ? 'Answered' : 'Open';
}

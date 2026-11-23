// E-mail content builders with strict privacy guards for Avenue Phase 1
// Pure functions: no network, no sending, no clock reading.
// Enforces COM-02, BKG-07, and CHK-03: no financial, document, wellness,
// checklist, or notice content in e-mails.

import { toEasternParts } from './dates.mjs';

const ALLOWED_DECISION_STATUSES = new Set(['Approved', 'Declined', 'Cancelled']);

function validatePortalUrl(portalUrl) {
  if (typeof portalUrl !== 'string' || !portalUrl.startsWith('https://')) {
    throw new Error('portalUrl must be a string starting with "https://"');
  }
}

function formatEasternDateTime(utcIso) {
  const parts = toEasternParts(utcIso);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  const dateStr = `${parts.year}-${mm}-${dd}`;
  const ampm = parts.hour >= 12 ? 'PM' : 'AM';
  const h12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  const minStr = String(parts.minute).padStart(2, '0');
  const timeStr = `${h12}:${minStr} ${ampm}`;
  return { dateStr, timeStr, parts };
}

/**
 * Builds the generic notice notification e-mail.
 * COM-02: Members receive a generic notification to sign in; notice content stays in Avenue.
 *
 * @param {Object} params - Must ONLY contain {portalUrl}
 * @returns {{subject: string, text: string}}
 */
export function noticeEmail(params) {
  if (!params || typeof params !== 'object') {
    throw new Error('params must be an object');
  }

  const allowedKeys = new Set(['portalUrl']);
  for (const k of Object.keys(params)) {
    if (!allowedKeys.has(k)) {
      throw new Error(`Disallowed property "${k}" passed to noticeEmail`);
    }
  }

  validatePortalUrl(params.portalUrl);

  return {
    subject: 'New notice from Flavors Culinary Hub',
    text: `Flavors has posted a new notice for members. Sign in to Avenue to read it: ${params.portalUrl}`
  };
}

/**
 * Builds the booking reminder e-mail (CHK-03).
 *
 * @param {Object} params - Must ONLY contain {startUtc, portalUrl}
 * @returns {{subject: string, text: string}}
 */
export function reminderEmail(params) {
  if (!params || typeof params !== 'object') {
    throw new Error('params must be an object');
  }

  const allowedKeys = new Set(['startUtc', 'portalUrl']);
  for (const k of Object.keys(params)) {
    if (!allowedKeys.has(k)) {
      throw new Error(`Disallowed property "${k}" passed to reminderEmail`);
    }
  }

  validatePortalUrl(params.portalUrl);

  const { dateStr, timeStr } = formatEasternDateTime(params.startUtc);

  return {
    subject: `Reminder: your Flavors booking starts at ${timeStr}`,
    text: `Your Flavors booking starts on ${dateStr} at ${timeStr} (Eastern Time).\nSign in to Avenue to view or manage your booking: ${params.portalUrl}`
  };
}

/**
 * Builds the booking decision notification e-mail (BKG-07).
 *
 * @param {Object} params - Must ONLY contain {status, space, startUtc, staffNote?, portalUrl}
 * @returns {{subject: string, text: string}}
 */
export function decisionEmail(params) {
  if (!params || typeof params !== 'object') {
    throw new Error('params must be an object');
  }

  const allowedKeys = new Set(['status', 'space', 'startUtc', 'staffNote', 'portalUrl']);
  for (const k of Object.keys(params)) {
    if (!allowedKeys.has(k)) {
      throw new Error(`Disallowed property "${k}" passed to decisionEmail`);
    }
  }

  if (!ALLOWED_DECISION_STATUSES.has(params.status)) {
    throw new Error(
      `status must be one of Approved, Declined, Cancelled; received: ${params.status}`
    );
  }

  if (typeof params.space !== 'string' || params.space.trim() === '') {
    throw new Error('space must be a non-empty string');
  }

  validatePortalUrl(params.portalUrl);

  const { dateStr, timeStr } = formatEasternDateTime(params.startUtc);
  const staffNoteTrimmed = typeof params.staffNote === 'string' ? params.staffNote.trim() : '';

  const lines = [
    `Your Flavors booking is ${params.status}.`,
    `Space: ${params.space}`,
    `Starts: ${dateStr} at ${timeStr} (Eastern Time)`
  ];

  if (staffNoteTrimmed !== '') {
    lines.push(`Note from Flavors: ${staffNoteTrimmed}`);
  }

  lines.push(`View your booking details in the portal: ${params.portalUrl}`);

  return {
    subject: `Your Flavors booking is ${params.status}`,
    text: lines.join('\n')
  };
}

// Facility-scoped read path over SharePoint REST.
//
// SECURITY NOTE: the access boundary is SharePoint permissions on each list, not
// this code. The proposed shared lists must contain no private data, and access grants must be
// verified in the tenant before use (schema/README.md). The FacilityId
// filter and the fail-closed row mapping below are scoping and defence in depth
// against misconfigured or malformed rows. They are not authorization.

import { type EventPackage, EVENT_PACKAGES, type IMyEventRequest, type IMyStorageRequest, type IMySupportMessage, type ITeamMember, type StorageItem, STORAGE_ITEMS, SUPPORT_CATEGORIES, BOOKING_STATUSES, type BookingStatus, type FlagReason, FLAG_REASONS, type IMyFlag, type CheckInKind, CHECKIN_KINDS, type HostRequestKind, type IMyHostRequest, type IPlan, type PayMethod, DOC_TYPES, type DocType, type IBookingRequestInput, type ICalendarEntry, type IChecklistQuestion, type EquipmentCategory, EQUIPMENT_CATEGORIES, type IDiningTable, type IFacility,
  type IIntakeWriter, type IMyCheckIn, type IMyDocumentSubmission, type IMyExtension, type IMyMembership, type IMyRequest, type INotice, type IResource, NOTICE_CATEGORIES, type NoticeCategory, SPACES, type Space } from './contracts';
import { toCancelItem, toExtendItem, toIntakeItem, validateExtension, validateRequest } from './booking';
import { type ICheckInInput, toCheckInItem, validateCheckIn } from './checkin';
import { type IDocumentInput, safeFileName, toDocumentItem, validateDocument } from './documents';
import { type IFlagInput, toFlagItem, validateFlag } from './compliance';
import { parseOutcome } from './outcome';
import { type ISupportInput, toSupportItem, validateAttachments, validateSupport } from './support';
import { type IEventInput, toEventItem, validateEvent } from './events';
import { type IStorageInput, toStorageItem, validateStorage } from './storage';
import { toTeamItem, validateTeamName } from './team';
import { DEFAULT_MIN_PREP_TABLES } from './availability';
import type { IInvoice, IInvoiceLine, InvoiceStatus } from './billing';
import { planFromSheet, sheetPlans } from './join';

/** GETs a SharePoint REST URL and returns parsed JSON; rejects on non-2xx. Injected so tests and demo mode need no SPFx runtime. */
export type FetchJson = (url: string) => Promise<unknown>;

export const LISTS = {
  facilities: 'AvenueFacilities',
  resources: 'AvenueEquipment',
  diningTables: 'AvenueDiningTables',
  calendar: 'AvenueCalendar',
  requests: 'AvenueBookingRequests',
  documentSubmissions: 'AvenueDocumentSubmissions',
  checkInSubmissions: 'AvenueCheckInSubmissions',
  questions: 'AvenueChecklistQuestions',
  notices: 'AvenueNotices',
  myMembership: 'AvenueMyMembership',
  plans: 'AvenuePlans',
  complianceFlags: 'AvenueComplianceFlags',
  requiredDocTypes: 'AvenueRequiredDocTypes',
  invoices: 'AvenueInvoices',
  hostRequests: 'AvenueHostRequests',
  supportMessages: 'AvenueSupportMessages',
  eventRequests: 'AvenueEventRequests',
  storageRequests: 'AvenueStorageRequests',
  teamMembers: 'AvenueTeamMembers',
  /** [PROPOSED] Notices the member has read (own items), so read state follows them across devices. */
  noticeReads: 'AvenueNoticeReads',
  /** [PROPOSED] Member-visible mirror of AvenueMemberDocuments (one row per document, shared only with its member). */
  myDocuments: 'AvenueMyDocuments',
  /** [PROPOSED] Member-visible mirror of AvenueBookings, so bookings staff make for a member show up (A2). */
  myBookings: 'AvenueMyBookings',
  /** [PROPOSED] Staff-managed "About" choices for Messages with Flavors (R16). */
  supportCategories: 'AvenueSupportCategories'
} as const;

/** Intake lists where each member reads only the items they wrote. */
const OWN_ITEMS: string[] = [LISTS.requests, LISTS.documentSubmissions, LISTS.checkInSubmissions, LISTS.complianceFlags, LISTS.hostRequests, LISTS.supportMessages, LISTS.eventRequests, LISTS.storageRequests, LISTS.teamMembers, LISTS.noticeReads];

/** PlanId is the sheet plan name in lower case ("mobile kitchen-10", "legacy: emerging-10a"); no quote can reach the OData filter. */
const PLAN_ID: RegExp = /^[A-Za-z0-9 :._-]{1,80}$/;
const HOST_KINDS: HostRequestKind[] = ['Join', 'PaymentPortal'];
const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'open', 'paid', 'void', 'uncollectible'];

const REF_ID: RegExp = /^[A-Za-z0-9_-]{1,80}$/;

/** A unique id for a member submission. Not secret; it only ties a request to the record a flow makes from it. */
export function newSubmissionId(prefix: string): string {
  const random: string = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function ymd(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
}

const SAFE_ID: RegExp = /^[A-Za-z0-9_-]{1,64}$/;
const PAGE_SIZE: number = 500;
// ponytail: hard page cap; a week of one facility's bookings is far below 25k rows.
// If this ever throws, narrow the query window rather than raising the cap.
const MAX_PAGES: number = 50;

type Row = Record<string, unknown>;

function text(row: Row, field: string): string | undefined {
  const value: unknown = row[field];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function instant(row: Row, field: string): string | undefined {
  const value: string | undefined = text(row, field);
  const ms: number = value ? Date.parse(value) : NaN;
  return isNaN(ms) ? undefined : new Date(ms).toISOString();
}

const EMAIL: RegExp = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;

function count(row: Row | undefined, field: string, min: number, max: number): number | undefined {
  const value: unknown = row ? row[field] : undefined;
  const n: number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Maps the member's membership row and (optional) plan row. Anything missing or out of range is left undefined. */
export function toMembership(row: Row, plan: Row | undefined): IMyMembership {
  const day: number | undefined = count(row, 'CollectionDay', 1, 15);
  return {
    businessName: text(row, 'BusinessName'),
    status: text(row, 'Status'),
    planId: text(row, 'PlanId'),
    planName: plan ? text(plan, 'Title') : undefined,
    monthlyHours: count(plan, 'MonthlyHours', 0.01, 10000),
    extraHourRate: count(plan, 'ExtraHourRate', 0, 10000),
    collectionDay: day !== undefined && Math.floor(day) === day ? day : undefined,
    paymentStatus: text(row, 'PaymentStatus'),
    payMethod: ((m: string | undefined): PayMethod | undefined => (m === 'Bank' || m === 'Card' ? m : undefined))(text(row, 'PayMethod'))
  };
}

function cents(row: Row, field: string): number {
  const n: number | undefined = count(row, field, -100000000, 100000000);
  return n !== undefined ? Math.round(n) : 0;
}

/** Maps an AvenueInvoices row (Stripe mirror). Unknown status or missing id drops the row; links are re-checked before use. */
export function toInvoice(row: Row): IInvoice | undefined {
  const invoiceId: string | undefined = text(row, 'InvoiceId');
  const status: string | undefined = text(row, 'Status');
  if (!invoiceId || !status || INVOICE_STATUSES.indexOf(status as InvoiceStatus) < 0) { return undefined; }
  const created: number | undefined = count(row, 'StripeCreated', 0, 1e11);
  const createdYmd: string | undefined = created ? new Date(created * 1000).toISOString().slice(0, 10) : undefined;
  const periodStart: string = ymd(text(row, 'PeriodStart')) || ymd(text(row, 'DueDate')) || createdYmd || '';
  let lines: IInvoiceLine[] = [];
  try {
    const parsed: unknown = JSON.parse(text(row, 'Lines') || '[]');
    lines = Array.isArray(parsed) ? parsed.filter((l: Row) => l && typeof l.description === 'string' && typeof l.amountCents === 'number')
      .map((l: Row) => ({ description: String(l.description), amountCents: Math.round(Number(l.amountCents)) })) : [];
  } catch { lines = []; }
  const kind: string | undefined = text(row, 'Kind');
  return {
    invoiceId, periodStart, periodEnd: ymd(text(row, 'PeriodEnd')) || periodStart, currency: 'usd',
    amountDueCents: cents(row, 'AmountDueCents'), amountPaidCents: cents(row, 'AmountPaidCents'), status: status as InvoiceStatus,
    dueDate: ymd(text(row, 'DueDate')) || '', isEstimate: false, lines, number: text(row, 'Number'),
    kind: kind === 'Membership' || kind === 'Overage' || kind === 'Event' ? kind : kind ? 'Other' : undefined,
    hostedUrl: text(row, 'HostedUrl'), pdfUrl: text(row, 'PdfUrl')
  };
}

/** Maps an AvenuePlans row; empty price fields fall back to the client sheet (planFromSheet). */
export function toPlan(row: Row): IPlan | undefined {
  const planId: string | undefined = text(row, 'PlanId');
  if (!planId || !PLAN_ID.test(planId)) { return undefined; }
  const name: string = text(row, 'Title') || planId;
  const sheet = planFromSheet(planId, name);
  const g: string | undefined = text(row, 'PlanGroup');
  const open: boolean | undefined = flag(row, 'OpenToNew');
  const price: number | undefined = count(row, 'PriceCents', 1, 100000000);
  const card: number | undefined = count(row, 'CardPriceCents', 1, 100000000);
  const group = g === 'Emerging' || g === 'Mobile Kitchen' || g === 'Legacy' ? g : sheet.group;
  return {
    planId, name, group,
    monthlyHours: count(row, 'MonthlyHours', 0.01, 10000) ?? sheet.monthlyHours,
    extraHourRate: count(row, 'ExtraHourRate', 0, 10000) ?? sheet.extraHourRate,
    priceCents: price ?? sheet.priceCents, cardPriceCents: card ?? price ?? sheet.cardPriceCents,
    openToNew: group !== 'Legacy' && (open ?? sheet.openToNew)
  };
}

/** An unknown time zone name would make every date format throw, so a facility with one is treated as not configured. */
export function isTimeZone(zone: string): boolean {
  try { return !!new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone; } catch { return false; }
}

export function toFacility(row: Row, facilityId: string): IFacility | undefined {
  const title: string | undefined = text(row, 'Title');
  const timeZone: string | undefined = text(row, 'TimeZone');
  if (text(row, 'FacilityId') !== facilityId || !title || !timeZone || !isTimeZone(timeZone)) {
    return undefined;
  }
  const mins = (field: string): number | undefined => count(row, field, 1, 100000);
  const prep: number | undefined = count(row, 'MinPrepTables', 0, 100);
  return {
    facilityId, title, timeZone,
    minBookingMinutes: mins('MinBookingMinutes'), maxBookingMinutes: mins('MaxBookingMinutes'), bookingStepMinutes: mins('BookingStepMinutes'),
    maxCompaniesInKitchen: mins('MaxCompaniesInKitchen'), checkoutAlertMinutes: mins('CheckoutAlertMinutes'),
    minPrepTables: prep !== undefined && Math.floor(prep) === prep ? prep : DEFAULT_MIN_PREP_TABLES,
    entryGraceMinutes: count(row, 'EntryGraceMinutes', 0, 100000), exitGraceMinutes: count(row, 'ExitGraceMinutes', 0, 100000),
    earlyEntryMinutes: count(row, 'EarlyEntryMinutes', 0, 1440), cleanupMinutes: count(row, 'CleanupMinutes', 0, 1440),
    autoApproveWhenFree: flag(row, 'AutoApproveWhenFree') === true
  };
}

function flag(row: Row, field: string): boolean | undefined {
  const v: unknown = row[field];
  if (typeof v === 'boolean') { return v; }
  if (typeof v === 'number') { return v !== 0; }
  const t: string | undefined = text(row, field);
  return t === undefined ? undefined : /^(true|yes|1)$/i.test(t) ? true : /^(false|no|0)$/i.test(t) ? false : undefined;
}

export function toResource(row: Row, facilityId: string): IResource | undefined {
  const resourceId: string | undefined = text(row, 'EquipmentId');
  const title: string | undefined = text(row, 'Title');
  const kind: string | undefined = text(row, 'Kind');
  if (text(row, 'FacilityId') !== facilityId || !resourceId || !title || !kind) {
    return undefined;
  }
  const rawCat: string | undefined = text(row, 'Category');
  const category: EquipmentCategory | undefined = EQUIPMENT_CATEGORIES.filter(c => c === rawCat)[0];
  const groupId: string | undefined = text(row, 'GroupId');
  return {
    resourceId, title, kind, category, description: text(row, 'Description'), location: text(row, 'Location'), photoUrl: safeUrl(text(row, 'PhotoUrl')),
    sortOrder: count(row, 'SortOrder', -1000000, 1000000), bookable: flag(row, 'BookableByMembers') !== false,
    groupId: groupId && REF_ID.test(groupId) ? groupId : undefined
  };
}

/** Only http(s) or site-relative photo links are kept. */
function safeUrl(value: string | undefined): string | undefined {
  return value && /^(https:\/\/|\/)/i.test(value) ? value : undefined;
}

/** Maps a notice row. Returns undefined when it is incomplete or has expired at nowMs. */
export function toNotice(row: Row, nowMs: number): INotice | undefined {
  const title: string | undefined = text(row, 'Title');
  const publishedUtc: string | undefined = instant(row, 'PublishedAt');
  const expiresUtc: string | undefined = instant(row, 'ExpiresAt');
  // Scheduled for later (PublishAt in the future): not shown yet. An empty PublishAt means published now.
  const publishAt: string | undefined = instant(row, 'PublishAt');
  if (typeof row.Id !== 'number' || !title || !publishedUtc || (expiresUtc && Date.parse(expiresUtc) <= nowMs) || (publishAt && Date.parse(publishAt) > nowMs)) {
    return undefined;
  }
  const rawCat: string | undefined = text(row, 'Category');
  const category: NoticeCategory = NOTICE_CATEGORIES.filter(c => c === rawCat)[0] || 'General';
  return { id: row.Id, title, body: text(row, 'Body') || '', publishedUtc, category, pinned: flag(row, 'Pinned') === true, expiresUtc, audience: text(row, 'Audience') };
}

/** Pinned first, then newest. */
export function sortNotices(list: INotice[]): INotice[] {
  return list.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedUtc.localeCompare(a.publishedUtc));
}

/** Allowlist mapping: copies only shared-calendar fields; drops rows that are foreign, incomplete or inverted. */
export function toCalendarEntry(row: Row, facilityId: string): ICalendarEntry | undefined {
  const bookingId: string | undefined = text(row, 'BookingId');
  const rawSpace: string | undefined = text(row, 'Space');
  const space: Space | undefined = SPACES.filter(s => s === rawSpace)[0];
  const resourceId: string = text(row, 'ResourceId') || '';
  const memberName: string | undefined = text(row, 'MemberDisplayName');
  const startUtc: string | undefined = instant(row, 'StartUtc');
  const endUtc: string | undefined = instant(row, 'EndUtc');
  if (text(row, 'FacilityId') !== facilityId || !bookingId || (!resourceId && !space) || !memberName || !startUtc || !endUtc || endUtc <= startUtc) {
    return undefined;
  }
  const equipmentIds: string[] = (text(row, 'EquipmentIds') || '').split(';').map(s => s.trim()).filter(Boolean);
  return { bookingId, resourceId, space, equipmentIds, memberName, startUtc, endUtc };
}

function defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/** Expanded AttachmentFiles (array, or {results} in verbose OData); only site-relative or https links are kept. */
export function attachmentFiles(row: Row): { name: string; url: string }[] {
  const raw: unknown = row.AttachmentFiles;
  const list: unknown[] = Array.isArray(raw) ? raw : raw && Array.isArray((raw as Row).results) ? (raw as Row).results as unknown[] : [];
  return list.map(f => {
    const name: string | undefined = f && typeof f === 'object' ? text(f as Row, 'FileName') : undefined;
    const url: string | undefined = f && typeof f === 'object' ? safeUrl(text(f as Row, 'ServerRelativeUrl')) : undefined;
    return name && url ? { name, url } : undefined;
  }).filter(defined);
}

/** [PROPOSED] Maps an AvenueMyBookings row to the member's booking shape. Foreign, incomplete or inverted rows are dropped. */
export function toMirrorBooking(row: Row, facilityId: string): IMyRequest | undefined {
  const requestId: string | undefined = text(row, 'BookingId');
  const space: string | undefined = text(row, 'Space');
  const startUtc: string | undefined = instant(row, 'StartUtc');
  const endUtc: string | undefined = instant(row, 'EndUtc');
  const status: string | undefined = text(row, 'Status');
  if (text(row, 'FacilityId') !== facilityId || !requestId || !REF_ID.test(requestId) || !space || SPACES.indexOf(space as Space) < 0 || !startUtc || !endUtc || endUtc <= startUtc) {
    return undefined;
  }
  return {
    requestId, space: space as Space, equipmentIds: (text(row, 'EquipmentIds') || '').split(';').map(x => x.trim()).filter(Boolean),
    startUtc, endUtc, cancelSent: false, cancelRequested: false,
    status: BOOKING_STATUSES.indexOf(status as BookingStatus) >= 0 ? status as BookingStatus : undefined
  };
}

/** Adds mirror bookings the member's own requests do not already have (the member's own row wins: it carries the echoed note). */
export function mergeMirrorBookings(own: IMyRequest[], mirror: IMyRequest[], cancelled: string[] = []): IMyRequest[] {
  const have: string[] = own.map(r => r.requestId);
  const extra: IMyRequest[] = mirror.filter(m => have.indexOf(m.requestId) < 0)
    .map(m => (cancelled.indexOf(m.requestId) >= 0 ? { ...m, cancelSent: true } : m));
  return own.concat(extra.filter((m, i) => extra.findIndex(x => x.requestId === m.requestId) === i));
}

/** [PROPOSED] Maps an AvenueMyDocuments row. Its Outcome is phrased so the existing review states read it ("Received…" / "Not accepted…"). */
export function toMirrorDocument(row: Row): IMyDocumentSubmission | undefined {
  const docType: string | undefined = text(row, 'DocType');
  const expiryDate: string | undefined = ymd(text(row, 'ExpiryDate'));
  if (typeof row.Id !== 'number' || !docType || DOC_TYPES.indexOf(docType as DocType) < 0 || !expiryDate) { return undefined; }
  const status: string | undefined = text(row, 'Status');
  const verified: boolean = flag(row, 'Verified') === true;
  const rejected: boolean = /^(rejected|not accepted)/i.test(status || '');
  return {
    submissionId: `record-${row.Id}`, docType: docType as DocType, issueDate: ymd(text(row, 'IssueDate')) || '', expiryDate,
    outcome: rejected ? 'Not accepted by Flavors. Please send it again.' : 'Received. Flavors will verify it.',
    fromRecord: true, verified: verified && !rejected, recordStatus: status
  };
}

/** Records first; a submission that is the same document (type + expiry) as a record is dropped so it is not listed twice. */
export function mergeDocuments(records: IMyDocumentSubmission[], submissions: IMyDocumentSubmission[]): IMyDocumentSubmission[] {
  const key = (d: IMyDocumentSubmission): string => `${d.docType}|${d.expiryDate}`;
  const recorded: string[] = records.map(key);
  return records.concat(submissions.filter(d => recorded.indexOf(key(d)) < 0));
}

export class AvenueReadSource {
  private readonly _webUrl: string;
  private readonly _fetchJson: FetchJson;
  private readonly _writer: IIntakeWriter | undefined;
  public readonly facilityId: string;
  private readonly _authorId: number | undefined;
  private readonly _memberEmail: string | undefined;

  /** `authorId`: the signed-in user's SharePoint id. Own-items lists are also filtered by it, because site owners and admins
   * bypass the list's "read own items only" setting and would otherwise see every member's requests as their own. */
  /** `memberEmail`: the signed-in member; needed to read the mirror lists (no e-mail = mirrors are not read, fail closed). */
  public constructor(webUrl: string, facilityId: string, fetchJson: FetchJson, writer?: IIntakeWriter, authorId?: number, memberEmail?: string) {
    if (!SAFE_ID.test(facilityId)) {
      // Fail closed, and keeps the id safe to embed in an OData filter.
      throw new Error('Avenue: facility id is missing or invalid.');
    }
    this._webUrl = webUrl.replace(/\/+$/, '');
    this.facilityId = facilityId;
    this._fetchJson = fetchJson;
    this._writer = writer;
    this._authorId = typeof authorId === 'number' && Number.isInteger(authorId) && authorId > 0 ? authorId : undefined;
    const email: string = (memberEmail || '').trim().toLowerCase();
    this._memberEmail = EMAIL.test(email) ? email : undefined;
  }

  public async getFacility(): Promise<IFacility> {
    const rows: Row[] = await this._items(LISTS.facilities, 'FacilityId,Title,TimeZone,MinBookingMinutes,MaxBookingMinutes,BookingStepMinutes,MaxCompaniesInKitchen,CheckoutAlertMinutes,MinPrepTables,EntryGraceMinutes,ExitGraceMinutes,EarlyEntryMinutes,CleanupMinutes,AutoApproveWhenFree', '');
    const matches: IFacility[] = rows.map(r => toFacility(r, this.facilityId)).filter(defined);
    if (matches.length !== 1) {
      throw new Error('Avenue: facility configuration not found or ambiguous.');
    }
    return matches[0];
  }

  public async listResources(): Promise<IResource[]> {
    const rows: Row[] = await this._items(LISTS.resources, 'FacilityId,EquipmentId,Title,Kind,Category,Description,Location,PhotoUrl,SortOrder,BookableByMembers,GroupId', ' and Active eq 1');
    return rows.map(r => toResource(r, this.facilityId)).filter(defined);
  }

  public async listDiningTables(): Promise<IDiningTable[]> {
    const rows: Row[] = await this._items(LISTS.diningTables, 'FacilityId,TableId,Seats', ' and Active eq 1');
    return rows.map(r => {
      const tableId: string | undefined = text(r, 'TableId');
      const seats: number = typeof r.Seats === 'number' ? r.Seats : NaN;
      return text(r, 'FacilityId') === this.facilityId && tableId && seats > 0 ? { tableId, seats } : undefined;
    }).filter(defined);
  }

  /**
   * Sends a booking request to the intake list. The request is only a request: management approves every booking
   * (client call 11 Nov). Validation here is for the member's benefit; the processing flow must validate again.
   */
  public async submitRequest(input: IBookingRequestInput, requestId: string, catalog: { equipmentIds: string[]; totalSeats?: number }, nowMs: number): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (input.facilityId !== this.facilityId) {
      throw new Error('Avenue: request is for a different facility.');
    }
    const errors: string[] = validateRequest(input, { ...catalog, nowMs });
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
    await writer.add(LISTS.requests, toIntakeItem(input, requestId));
  }

  /**
   * The signed-in member's own booking requests (the list only returns their own items to a member), each with its
   * latest extra-time request. An approved extension moves the displayed end, as the booking itself was moved by the flow.
   */
  public async listMyRequests(): Promise<IMyRequest[]> {
    const rows: Row[] = (await this._items(LISTS.requests, 'FacilityId,RequestId,Space,EquipmentIds,StartUtc,EndUtc,CancelBookingId,ExtendBookingId,Outcome', ''))
      .filter(r => text(r, 'FacilityId') === this.facilityId);
    const cancelled: string[] = rows.map(r => text(r, 'CancelBookingId')).filter(defined);
    const extensions: IMyExtension[] = [];
    for (const r of rows) {
      const requestId: string | undefined = text(r, 'RequestId');
      const bookingId: string | undefined = text(r, 'ExtendBookingId');
      const endUtc: string | undefined = text(r, 'EndUtc');
      if (requestId && bookingId && endUtc && !isNaN(Date.parse(endUtc))) {
        extensions.push({ requestId, bookingId, endUtc: new Date(endUtc).toISOString(), outcome: text(r, 'Outcome') });
      }
    }
    const result: IMyRequest[] = [];
    for (const r of rows) {
      const requestId: string | undefined = text(r, 'RequestId');
      const space: string | undefined = text(r, 'Space');
      const startUtc: string | undefined = instant(r, 'StartUtc');
      const endUtc: string | undefined = instant(r, 'EndUtc');
      if (!text(r, 'CancelBookingId') && !text(r, 'ExtendBookingId') && requestId && space && SPACES.indexOf(space as Space) >= 0 && startUtc && endUtc && endUtc > startUtc) {
        const outcome = parseOutcome(text(r, 'Outcome'));
        const mine: IMyExtension[] = extensions.filter(e => e.bookingId === requestId);
        const approved: IMyExtension[] = mine.filter(e => (e.outcome || '').indexOf('Extension approved') === 0);
        const shownEnd: string = approved.reduce((end, e) => (e.endUtc > end ? e.endUtc : end), new Date(endUtc).toISOString());
        result.push({
          requestId, space: space as Space, equipmentIds: (text(r, 'EquipmentIds') || '').split(';').map(x => x.trim()).filter(Boolean),
          startUtc: new Date(startUtc).toISOString(), endUtc: shownEnd,
          cancelSent: cancelled.indexOf(requestId) >= 0, status: outcome.status, note: outcome.note, cancelRequested: outcome.cancelRequested, hoursKept: outcome.hoursKept,
          extension: mine[mine.length - 1]
        });
      }
    }
    // A2: bookings staff made for the member live only in the mirror. A missing or failing mirror changes nothing.
    const mirror: IMyRequest[] = await this.listMyBookingsMirror().catch((): IMyRequest[] => []);
    return mergeMirrorBookings(result, mirror, cancelled).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  }

  /**
   * [PROPOSED] The member's rows of AvenueMyBookings (each shared only with its member; the e-mail filter keeps a staff preview
   * to their own). Rejects when the list does not exist; empty without a member e-mail.
   */
  public async listMyBookingsMirror(): Promise<IMyRequest[]> {
    if (!this._memberEmail) { return []; }
    const rows: Row[] = await this._items(LISTS.myBookings, 'FacilityId,BookingId,Space,EquipmentIds,StartUtc,EndUtc,Status,MemberId', ` and MemberId eq '${this._memberEmail}'`);
    return rows.map(r => toMirrorBooking(r, this.facilityId)).filter(defined);
  }

  /**
   * The signed-in member's own membership, or undefined until Flavors has set up the account. SharePoint shares each
   * row only with its member; the e-mail filter also keeps a staff preview to the viewer's own row.
   */
  public async getMyMembership(memberEmail: string): Promise<IMyMembership | undefined> {
    const email: string = (memberEmail || '').trim().toLowerCase();
    if (!EMAIL.test(email)) {
      return undefined;
    }
    const filter: string = ` and MemberId eq '${email}'`;
    // The payment columns arrive with the Stripe release; until they exist the old select still shows the membership.
    const rows: Row[] = await this._items(LISTS.myMembership, 'MemberId,BusinessName,PlanId,CollectionDay,Status,PaymentStatus,PayMethod', filter)
      .catch(() => this._items(LISTS.myMembership, 'MemberId,BusinessName,PlanId,CollectionDay,Status', filter));
    if (rows.length !== 1) {
      return undefined;
    }
    const planId: string | undefined = text(rows[0], 'PlanId');
    let plan: Row | undefined;
    if (planId && PLAN_ID.test(planId)) {
      const plans: Row[] = await this._items(LISTS.plans, 'PlanId,Title,MonthlyHours,ExtraHourRate', ` and PlanId eq '${planId}' and Active eq 1`);
      plan = plans.length === 1 ? plans[0] : undefined;
    }
    return toMembership(rows[0], plan);
  }

  /**
   * Plans a new member may choose from (open, not legacy). If AvenuePlans has none with a price yet, the client sheet's
   * current plans are used so the join screen never shows an empty choice; the host checks the plan again either way.
   */
  public async listPlans(): Promise<IPlan[]> {
    const rows: Row[] = await this._items(LISTS.plans, 'PlanId,Title,MonthlyHours,ExtraHourRate,PriceCents,CardPriceCents,PlanGroup,OpenToNew', ' and Active eq 1')
      .catch(() => this._items(LISTS.plans, 'PlanId,Title,MonthlyHours,ExtraHourRate', ' and Active eq 1'));
    const open: IPlan[] = rows.map(toPlan).filter(defined).filter(p => p.openToNew && p.priceCents !== undefined);
    return open.length > 0 ? open : sheetPlans();
  }

  /** The member's own invoices (each row is shared only with its member; the e-mail filter keeps a staff preview to their own). */
  public async listMyInvoices(memberEmail: string): Promise<IInvoice[]> {
    const email: string = (memberEmail || '').trim().toLowerCase();
    if (!EMAIL.test(email)) { return []; }
    const rows: Row[] = await this._items(LISTS.invoices, 'InvoiceId,MemberId,Number,Kind,Status,AmountDueCents,AmountPaidCents,DueDate,PeriodStart,PeriodEnd,HostedUrl,PdfUrl,Lines,StripeCreated', ` and MemberId eq '${email}'`);
    return rows.map(toInvoice).filter(defined);
  }

  /** Asks the Stripe host for something (a checkout or payment-method page). The flow adds who asked and whether they may. */
  public async submitHostRequest(kind: HostRequestKind, payload: Record<string, unknown>, requestId: string): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (HOST_KINDS.indexOf(kind) < 0 || !REF_ID.test(requestId)) { throw new Error('Avenue: invalid request.'); }
    await writer.add(LISTS.hostRequests, { Title: kind, FacilityId: this.facilityId, RequestId: requestId, Kind: kind, Payload: JSON.stringify(payload) });
  }

  /** The member's own host requests, newest first. */
  public async listMyHostRequests(): Promise<IMyHostRequest[]> {
    const rows: Row[] = await this._items(LISTS.hostRequests, 'Id,FacilityId,RequestId,Kind,Outcome,Link,Created', '');
    return rows.map(r => {
      const requestId: string | undefined = text(r, 'RequestId');
      const kind: string | undefined = text(r, 'Kind');
      return requestId && kind ? { id: typeof r.Id === 'number' ? r.Id : 0, requestId, kind, outcome: text(r, 'Outcome'), link: text(r, 'Link'), createdUtc: instant(r, 'Created') } : undefined;
    }).filter(defined).sort((a, b) => b.id - a.id).map(({ id: _id, ...x }) => x);
  }

  /** Asks Flavors for extra time on one of the member's approved bookings (BKG-08). */
  public async submitExtension(booking: IMyRequest, newEndUtc: string, requestId: string, nowMs: number): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    const problems: string[] = validateExtension(booking, newEndUtc, nowMs);
    if (problems.length > 0) {
      throw new Error(problems.join(' '));
    }
    if (!REF_ID.test(booking.requestId) || !REF_ID.test(requestId)) {
      throw new Error('Avenue: invalid booking id.');
    }
    await writer.add(LISTS.requests, toExtendItem(this.facilityId, requestId, booking, newEndUtc));
  }

  /** Asks to cancel one of the member's bookings. The booking id is the request id it was made with. */
  public async submitCancel(bookingId: string, requestId: string, message?: string): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (!REF_ID.test(bookingId)) {
      throw new Error('Avenue: invalid booking id.');
    }
    await writer.add(LISTS.requests, toCancelItem(this.facilityId, requestId, bookingId, message));
  }

  /** Active checklist questions for this facility, in order. */
  public async listChecklistQuestions(): Promise<IChecklistQuestion[]> {
    const rows: Row[] = await this._items(LISTS.questions, 'Id,FacilityId,Kind,Question,SortOrder', ' and Active eq 1');
    return rows.map(r => {
      const kind: string | undefined = text(r, 'Kind');
      const question: string | undefined = text(r, 'Question');
      return typeof r.Id === 'number' && CHECKIN_KINDS.indexOf(kind as CheckInKind) >= 0 && question
        ? { id: r.Id, kind: kind as CheckInKind, text: question, order: typeof r.SortOrder === 'number' ? r.SortOrder : 0 }
        : undefined;
    }).filter(defined).sort((a, b) => a.order - b.order || a.id - b.id);
  }

  /** The member's own checklist submissions. */
  public async listMyCheckIns(): Promise<IMyCheckIn[]> {
    const rows: Row[] = await this._items(LISTS.checkInSubmissions, 'FacilityId,SubmissionId,BookingId,Kind,Outcome,PersonName,Created', '')
      .catch(() => this._items(LISTS.checkInSubmissions, 'FacilityId,SubmissionId,BookingId,Kind,Outcome,Created', ''));
    return rows.map(r => {
      const submissionId: string | undefined = text(r, 'SubmissionId');
      const bookingId: string | undefined = text(r, 'BookingId');
      const kind: string | undefined = text(r, 'Kind');
      return submissionId && bookingId && CHECKIN_KINDS.indexOf(kind as CheckInKind) >= 0
        ? { submissionId, bookingId, kind: kind as CheckInKind, outcome: text(r, 'Outcome'), personName: text(r, 'PersonName'), createdUtc: instant(r, 'Created') }
        : undefined;
    }).filter(defined);
  }

  public async submitCheckIn(input: ICheckInInput, questions: IChecklistQuestion[], submissionId: string): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (input.facilityId !== this.facilityId) {
      throw new Error('Avenue: checklist is for a different facility.');
    }
    const errors: string[] = validateCheckIn(input, questions);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
    await writer.add(LISTS.checkInSubmissions, toCheckInItem(input, questions, submissionId));
  }

  /** The member's own document submissions and what happened to each. */
  public async listMyDocuments(): Promise<IMyDocumentSubmission[]> {
    const rows: Row[] = await this._items(LISTS.documentSubmissions, 'FacilityId,SubmissionId,DocType,IssueDate,ExpiryDate,Outcome', '');
    const submissions: IMyDocumentSubmission[] = rows.map(r => {
      const submissionId: string | undefined = text(r, 'SubmissionId');
      const docType: string | undefined = text(r, 'DocType');
      const issueDate: string | undefined = ymd(text(r, 'IssueDate'));
      const expiryDate: string | undefined = ymd(text(r, 'ExpiryDate'));
      return submissionId && docType && DOC_TYPES.indexOf(docType as DocType) >= 0 && issueDate && expiryDate
        ? { submissionId, docType: docType as DocType, issueDate, expiryDate, outcome: text(r, 'Outcome') }
        : undefined;
    }).filter(defined);
    // [PROPOSED] AvenueMyDocuments: verified records incl. staff uploads. Missing list or any error = submissions only, as before.
    const records: IMyDocumentSubmission[] = this._memberEmail
      ? await this._items(LISTS.myDocuments, 'Id,FacilityId,DocType,IssueDate,ExpiryDate,Status,Verified,FileUrl,MemberId', ` and MemberId eq '${this._memberEmail}'`)
        .then(rs => rs.map(toMirrorDocument).filter(defined)).catch((): IMyDocumentSubmission[] => [])
      : [];
    return mergeDocuments(records, submissions).sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));
  }

  /**
   * Sends a document: creates the submission marked "Uploading" (the flow ignores it), attaches the file, then clears
   * the mark so the flow processes it with the file present.
   */
  public async submitDocument(input: IDocumentInput, file: Blob & { name: string }, submissionId: string): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (input.facilityId !== this.facilityId) {
      throw new Error('Avenue: document is for a different facility.');
    }
    const errors: string[] = validateDocument(input);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
    const id: number = await writer.add(LISTS.documentSubmissions, toDocumentItem(input, submissionId));
    await writer.attach(LISTS.documentSubmissions, id, safeFileName(file.name), file);
    await writer.update(LISTS.documentSubmissions, id, { Outcome: null });
  }

  /** Document types Flavors requires of every member (active rows of AvenueRequiredDocTypes). Empty when none are configured. */
  public async listRequiredDocTypes(): Promise<DocType[]> {
    const rows: Row[] = await this._items(LISTS.requiredDocTypes, 'FacilityId,DocType,Active', ' and Active eq 1');
    const out: DocType[] = [];
    rows.forEach(r => { const t: string | undefined = text(r, 'DocType'); if (t && DOC_TYPES.indexOf(t as DocType) >= 0 && out.indexOf(t as DocType) < 0) { out.push(t as DocType); } });
    return out;
  }

  /** The member's own compliance flags, newest first, with staff's echoed outcome. */
  public async listMyFlags(): Promise<IMyFlag[]> {
    const rows: Row[] = await this._items(LISTS.complianceFlags, 'Id,FacilityId,SubmissionId,DocType,Reason,Note,Outcome', '');
    return rows.map(r => {
      const submissionId: string | undefined = text(r, 'SubmissionId');
      const docType: string | undefined = text(r, 'DocType');
      const reason: string | undefined = text(r, 'Reason');
      return submissionId && docType && DOC_TYPES.indexOf(docType as DocType) >= 0 && reason && FLAG_REASONS.indexOf(reason as FlagReason) >= 0
        ? { id: typeof r.Id === 'number' ? r.Id : 0, submissionId, docType: docType as DocType, reason: reason as FlagReason, note: text(r, 'Note'), outcome: text(r, 'Outcome') }
        : undefined;
    }).filter(defined).sort((a, b) => b.id - a.id).map(({ id: _id, ...f }) => f);
  }

  /** Raises a compliance flag for staff. Identity is the item author; nothing here decides anything. */
  public async submitFlag(input: IFlagInput, submissionId: string): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (input.facilityId !== this.facilityId) { throw new Error('Avenue: flag is for a different facility.'); }
    const errors: string[] = validateFlag(input);
    if (errors.length > 0) { throw new Error(errors.join(' ')); }
    await writer.add(LISTS.complianceFlags, toFlagItem(input, submissionId));
  }

  /** The member's own messages to Flavors (any thread), with the echoed Outcome and staff Reply. An unreadable list is an empty one. */
  public async listMySupportMessages(): Promise<IMySupportMessage[]> {
    const select: string = 'Id,FacilityId,MessageId,ThreadId,Category,Subject,Body,Outcome,Reply,Created';
    // Attachments come with the item ($expand=AttachmentFiles); if that read fails, the messages still show without them.
    const rows: Row[] = await this._items(LISTS.supportMessages, `${select},AttachmentFiles`, '', 'AttachmentFiles')
      .catch(() => this._items(LISTS.supportMessages, select, ''));
    return rows.map(r => {
      const messageId: string | undefined = text(r, 'MessageId'), threadId: string | undefined = text(r, 'ThreadId') || text(r, 'MessageId'), category: string | undefined = text(r, 'Category'), subject: string | undefined = text(r, 'Subject');
      const attachments: { name: string; url: string }[] = attachmentFiles(r);
      // Any non-empty category is kept: categories are staff-managed, and a retired one must not hide a conversation.
      return typeof r.Id === 'number' && messageId && threadId && subject && category
        ? { id: r.Id, messageId, threadId, category, subject, body: text(r, 'Body') || '', outcome: text(r, 'Outcome'), reply: text(r, 'Reply'), ...(text(r, 'Created') ? { created: text(r, 'Created') as string } : {}), ...(attachments.length ? { attachments } : {}) }
        : undefined;
    }).filter(defined);
  }

  /** [PROPOSED] Active "About" choices from AvenueSupportCategories in SortOrder; the built-in list when it is missing, empty or unreadable. */
  public async listSupportCategories(): Promise<string[]> {
    const rows: Row[] = await this._items(LISTS.supportCategories, 'FacilityId,Title,SortOrder,Active', ' and Active eq 1').catch((): Row[] => []);
    const out: string[] = [];
    rows.slice().sort((a, b) => (count(a, 'SortOrder', -1e6, 1e6) ?? 0) - (count(b, 'SortOrder', -1e6, 1e6) ?? 0))
      .forEach(r => { const t: string | undefined = text(r, 'Title'); if (t && t.length <= 60 && out.indexOf(t) < 0) { out.push(t); } });
    return out.length > 0 ? out : SUPPORT_CATEGORIES.slice();
  }

  /** Sends one message. `threadId` is the thread being answered, or undefined to start a new one (the thread id is then the message id). */
  /**
   * With files: the same three steps as a document (item marked "Uploading" → attach each → clear the mark), so the flow
   * processes the message only once every file is on it. `categories`: the choices offered (default the built-in list).
   */
  public async submitSupportMessage(input: ISupportInput, messageId: string, threadId?: string, files: Array<Blob & { name: string }> = [], categories?: string[]): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (input.facilityId !== this.facilityId) { throw new Error('Avenue: message is for a different facility.'); }
    if (!REF_ID.test(messageId) || (threadId !== undefined && !REF_ID.test(threadId))) { throw new Error('Avenue: invalid message id.'); }
    const errors: string[] = validateSupport(input, categories).concat(validateAttachments(files));
    if (errors.length > 0) { throw new Error(errors.join(' ')); }
    if (files.length === 0) {
      await writer.add(LISTS.supportMessages, toSupportItem(input, messageId, threadId));
      return;
    }
    const id: number = await writer.add(LISTS.supportMessages, { ...toSupportItem(input, messageId, threadId), Outcome: 'Uploading' });
    const used: string[] = [];
    for (const f of files) {
      // Two files with the same safe name would collide on the item: number the repeats.
      const base: string = safeFileName(f.name);
      let name: string = base;
      for (let n: number = 2; used.indexOf(name.toLowerCase()) >= 0; n++) { name = base.replace(/(\.[^.]*)?$/, `-${n}$1`); }
      used.push(name.toLowerCase());
      await writer.attach(LISTS.supportMessages, id, name, f);
    }
    await writer.update(LISTS.supportMessages, id, { Outcome: null });
  }

  /** The member's own event requests, newest first. */
  public async listMyEventRequests(): Promise<IMyEventRequest[]> {
    const rows: Row[] = await this._items(LISTS.eventRequests, 'Id,FacilityId,RequestId,Package,EventDate,Guests,Notes,Outcome,Reply', '');
    return rows.map(r => {
      const requestId: string | undefined = text(r, 'RequestId'), pkg: string | undefined = text(r, 'Package'), eventDate: string | undefined = ymd(text(r, 'EventDate'));
      return typeof r.Id === 'number' && requestId && eventDate && EVENT_PACKAGES.indexOf(pkg as EventPackage) >= 0
        ? { id: r.Id, requestId, pkg: pkg as EventPackage, eventDate, guests: typeof r.Guests === 'number' ? r.Guests : 0, notes: text(r, 'Notes'), outcome: text(r, 'Outcome'), reply: text(r, 'Reply') }
        : undefined;
    }).filter(defined).sort((a, b) => b.id - a.id);
  }

  public async submitEventRequest(input: IEventInput, requestId: string, todayYmd: string): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (input.facilityId !== this.facilityId) { throw new Error('Avenue: request is for a different facility.'); }
    if (!REF_ID.test(requestId)) { throw new Error('Avenue: invalid request id.'); }
    const errors: string[] = validateEvent(input, todayYmd);
    if (errors.length > 0) { throw new Error(errors.join(' ')); }
    await writer.add(LISTS.eventRequests, toEventItem(input, requestId));
  }

  /** The member's own storage requests, newest first. */
  public async listMyStorageRequests(): Promise<IMyStorageRequest[]> {
    const rows: Row[] = await this._items(LISTS.storageRequests, 'Id,FacilityId,RequestId,Item,Quantity,Notes,Outcome,Reply', '');
    return rows.map(r => {
      const requestId: string | undefined = text(r, 'RequestId'), item: string | undefined = text(r, 'Item');
      return typeof r.Id === 'number' && requestId && STORAGE_ITEMS.indexOf(item as StorageItem) >= 0
        ? { id: r.Id, requestId, item: item as StorageItem, quantity: typeof r.Quantity === 'number' ? r.Quantity : 1, notes: text(r, 'Notes'), outcome: text(r, 'Outcome'), reply: text(r, 'Reply') }
        : undefined;
    }).filter(defined).sort((a, b) => b.id - a.id);
  }

  public async submitStorageRequest(input: IStorageInput, requestId: string): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (input.facilityId !== this.facilityId) { throw new Error('Avenue: request is for a different facility.'); }
    if (!REF_ID.test(requestId)) { throw new Error('Avenue: invalid request id.'); }
    const errors: string[] = validateStorage(input);
    if (errors.length > 0) { throw new Error(errors.join(' ')); }
    await writer.add(LISTS.storageRequests, toStorageItem(input, requestId));
  }

  /** The member's own team roster, including people made inactive (so a name can be brought back). */
  public async listMyTeam(): Promise<ITeamMember[]> {
    const rows: Row[] = await this._items(LISTS.teamMembers, 'Id,FacilityId,TeamMemberId,PersonName,Role,Active', '');
    return rows.map(r => {
      const teamMemberId: string | undefined = text(r, 'TeamMemberId'), personName: string | undefined = text(r, 'PersonName');
      return typeof r.Id === 'number' && teamMemberId && personName
        ? { id: r.Id, teamMemberId, personName, role: text(r, 'Role') === 'Lead' ? 'Lead' : 'Member', active: flag(r, 'Active') !== false } as ITeamMember
        : undefined;
    }).filter(defined);
  }

  public async addTeamMember(name: string, role: 'Lead' | 'Member', teamMemberId: string, existing: ITeamMember[]): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    if (!REF_ID.test(teamMemberId)) { throw new Error('Avenue: invalid id.'); }
    const errors: string[] = validateTeamName(name, existing);
    if (errors.length > 0) { throw new Error(errors.join(' ')); }
    await writer.add(LISTS.teamMembers, toTeamItem(this.facilityId, name, role, teamMemberId));
  }

  /** "Removing" a person turns them off; the row stays so history is not lost. Only the member's own rows can be changed (item permissions). */
  public async setTeamMemberActive(id: number, active: boolean): Promise<void> {
    await this._requireWriter().update(LISTS.teamMembers, id, { Active: active });
  }

  /** Published, unexpired notices: pinned first, then newest. */
  public async listNotices(nowMs: number = Date.now()): Promise<INotice[]> {
    // PublishAt may not exist on the live list yet: fall back to the old select rather than lose every notice.
    const rows: Row[] = await this._items(LISTS.notices, 'Id,FacilityId,Title,Body,PublishedAt,Category,Pinned,ExpiresAt,Audience,PublishAt', ' and Active eq 1')
      .catch(() => this._items(LISTS.notices, 'Id,FacilityId,Title,Body,PublishedAt,Category,Pinned,ExpiresAt,Audience', ' and Active eq 1'));
    return sortNotices(rows.map(r => toNotice(r, nowMs)).filter(defined));
  }

  /** [PROPOSED] Ids of notices the member has read on any device (own items). Rejects when the list does not exist yet. */
  public async listMyNoticeReads(): Promise<number[]> {
    const rows: Row[] = await this._items(LISTS.noticeReads, 'FacilityId,NoticeId', '');
    return rows.map(r => r.NoticeId).filter((n): n is number => typeof n === 'number');
  }

  /** [PROPOSED] Records notices as read, one own item per notice. Display convenience only; nothing trusts it. */
  public async markNoticesRead(ids: number[]): Promise<void> {
    const writer: IIntakeWriter = this._requireWriter();
    for (const id of ids.filter(n => Number.isInteger(n) && n > 0)) {
      await writer.add(LISTS.noticeReads, { Title: `Notice ${id}`, FacilityId: this.facilityId, NoticeId: id });
    }
  }

  private _requireWriter(): IIntakeWriter {
    if (!this._writer) {
      throw new Error('Avenue: requests cannot be sent from this page.');
    }
    return this._writer;
  }

  /** Confirmed bookings overlapping [fromUtc, toUtc). All pages are followed; never silently truncated. */
  public async listCalendar(fromUtc: string, toUtc: string): Promise<ICalendarEntry[]> {
    const from: string = new Date(fromUtc).toISOString();
    const to: string = new Date(toUtc).toISOString();
    const rows: Row[] = await this._items(
      LISTS.calendar,
      'FacilityId,BookingId,ResourceId,Space,EquipmentIds,MemberDisplayName,StartUtc,EndUtc',
      ` and StartUtc lt datetime'${to}' and EndUtc gt datetime'${from}'`
    );
    return rows.map(r => toCalendarEntry(r, this.facilityId)).filter(defined);
  }

  private async _items(list: string, select: string, extraFilter: string, expand?: string): Promise<Row[]> {
    const own: string = this._authorId !== undefined && OWN_ITEMS.indexOf(list) >= 0 ? ` and AuthorId eq ${this._authorId}` : '';
    const filter: string = encodeURIComponent(`FacilityId eq '${this.facilityId}'${extraFilter}${own}`);
    let url: string | undefined =
      `${this._webUrl}/_api/web/lists/getbytitle('${list}')/items?$select=${select}${expand ? `&$expand=${expand}` : ''}&$filter=${filter}&$top=${PAGE_SIZE}`;
    const rows: Row[] = [];
    for (let page: number = 0; url; page++) {
      if (page >= MAX_PAGES) {
        throw new Error(`Avenue: ${list} query exceeded ${MAX_PAGES} pages; refusing to show a partial result.`);
      }
      const body: Row = ((await this._fetchJson(url)) || {}) as Row;
      if (!Array.isArray(body.value)) {
        throw new Error(`Avenue: unexpected response reading ${list}.`);
      }
      rows.push(...(body.value as Row[]));
      const next: unknown = body['@odata.nextLink'] || body['odata.nextLink'];
      url = typeof next === 'string' ? next : undefined;
    }
    return rows;
  }
}

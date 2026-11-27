// Compliance checklist, category by category. The seven document types, the warning days (30/15/10) and "required for every
// business" come from the client's sheet (tab "Compliance Documents"). Reviewer is the Flavors owner or whoever she assigns.
// [PROPOSED] the three category names and the plain-language questions are ours; Flavors can reword them.

import { DOC_TYPES, FLAG_REASONS, type DocType, type FlagReason, type IMyDocumentSubmission, type IMyFlag } from './contracts';
import { dateState, newestPerType, type DateState } from './home';

export interface IComplianceItem {
  type: DocType;
  question: string;
  /** What to attach, in plain words (limits from the sheet where it gave them). */
  help: string;
}
export interface ICategory {
  key: string;
  title: string;
  blurb: string;
  items: IComplianceItem[];
}

export const CATEGORIES: ICategory[] = [
  {
    key: 'permits', title: 'Permits and licences', blurb: 'Permits and licences you need to trade',
    items: [
      { type: 'County food permit', question: 'Do you have a Prince George\'s County Food Service Facility Permit?', help: 'The current permit. Enter its expiry date.' },
      { type: 'MD good standing', question: 'Is your business in good standing with the State of Maryland?', help: 'Your SDAT good-standing certificate. The annual report is due every April 15.' }
    ]
  },
  {
    key: 'insurance', title: 'Insurance', blurb: 'Insurance Flavors requires',
    items: [
      { type: 'Liability insurance', question: 'Do you have general liability insurance?', help: 'Certificate of insurance (COI). Flavors Culinary Hub | Hyattsville and Appetites By RJ, LLC must be listed as additional insured. Limits: $2,000,000 each occurrence, personal and advertising injury, general aggregate and products/completed operations; $300,000 fire damage; $10,000 medical payments.' },
      { type: 'Workers comp or waiver', question: 'Do you have workers\' compensation insurance, or a waiver?', help: 'The workers\' comp certificate, or the Maryland exclusion waiver.' }
    ]
  },
  {
    key: 'food-safety', title: 'Food safety', blurb: 'Certified people on site',
    items: [
      { type: 'Food safety manager', question: 'Does your food safety manager hold a certification (e.g. ServSafe)?', help: 'The certificate. One certified manager must be on site at all times.' },
      { type: 'Food manager card', question: 'Do you have a Food Manager\'s Card?', help: 'The card, with its expiry date.' },
      { type: 'Food handler card', question: 'Does each team member hold a Food Handler or Food Manager card?', help: 'Send one card at a time. Flavors recommends every team member holds one.' }
    ]
  }
];

/** Days before expiry that reminders go out (client sheet). */
export const WARN_DAYS: number[] = [30, 15, 10];

export type ItemState = 'missing' | DateState;

export function itemState(type: DocType, docs: IMyDocumentSubmission[], todayYmd: string): ItemState {
  const d: IMyDocumentSubmission | undefined = newestPerType(docs).get(type);
  return d ? dateState(d.expiryDate, todayYmd) : 'missing';
}

export interface ICategoryProgress { key: string; done: number; total: number; needs: number }

/** Per category: how many documents are on file and current; `needs` = missing, expiring or expired. */
export function categoryProgress(docs: IMyDocumentSubmission[], todayYmd: string): ICategoryProgress[] {
  return CATEGORIES.map(c => {
    const st: ItemState[] = c.items.map(i => itemState(i.type, docs, todayYmd));
    return { key: c.key, total: st.length, done: st.filter(x => x === 'current').length, needs: st.filter(x => x !== 'current').length };
  });
}

/** Steps (one question each) the wizard walks through, in category order. */
export function wizardSteps(): { cat: ICategory; item: IComplianceItem }[] {
  const out: { cat: ICategory; item: IComplianceItem }[] = [];
  CATEGORIES.forEach(cat => cat.items.forEach(item => out.push({ cat, item })));
  return out;
}

// ---- Escalation: a member flags a document; staff decide; a hold blocks new bookings (enforced by the booking-request flow). ----

export interface IFlagInput { facilityId: string; docType: DocType | undefined; reason: FlagReason | undefined; note: string }

export function validateFlag(i: IFlagInput): string[] {
  const e: string[] = [];
  if (!i.docType || DOC_TYPES.indexOf(i.docType) < 0) { e.push('Choose the document.'); }
  if (!i.reason || FLAG_REASONS.indexOf(i.reason) < 0) { e.push('Choose what is not right.'); }
  if (i.note.length > 1000) { e.push('Keep the note under 1,000 characters.'); }
  if ((i.reason === 'Other' || i.reason === 'I need help deciding') && i.note.trim().length < 5) { e.push('Add a short note so staff know what to look at.'); }
  return e;
}

export function toFlagItem(i: IFlagInput, submissionId: string): Record<string, unknown> {
  return { Title: i.docType, FacilityId: i.facilityId, SubmissionId: submissionId, DocType: i.docType, Reason: i.reason, Note: i.note.trim() };
}

export type FlagState = 'open' | 'cleared' | 'info' | 'hold' | 'released';

/** Staff echo the decision into Outcome with these prefixes (see the staff Compliance screen). Empty = still waiting. */
export function flagState(outcome: string | undefined): { state: FlagState; text: string } {
  const o: string = (outcome || '').trim();
  if (!o) { return { state: 'open', text: 'Waiting for Flavors to review.' }; }
  if (o.indexOf('Cleared') === 0) { return { state: 'cleared', text: o }; }
  if (o.indexOf('More information') === 0) { return { state: 'info', text: o }; }
  if (o.indexOf('Booking hold') === 0) { return { state: 'hold', text: o }; }
  if (o.indexOf('Hold released') === 0) { return { state: 'released', text: o }; }
  return { state: 'open', text: o };
}

/** Does the member have a booking hold? The newest flag per document decides; a released or cleared one does not. */
export function hasHold(flags: IMyFlag[]): boolean {
  const seen: Record<string, boolean> = {};
  let hold: boolean = false;
  flags.forEach(f => { if (!seen[f.docType]) { seen[f.docType] = true; if (flagState(f.outcome).state === 'hold') { hold = true; } } });
  return hold;
}

// ---- Onboarding: what a new member still has to do before they are fully set up (ONB). Advisory only: whether staff must
// approve first is an open client question (ONB-06 / Q-05), so nothing here blocks booking. ----

export interface IOnboardingStep { key: 'membership' | 'plan' | 'documents'; label: string; done: boolean; detail: string }
export interface IOnboarding { steps: IOnboardingStep[]; complete: boolean; missing: DocType[]; sent: number; required: number }

function ordinalDay(n: number | undefined): string {
  if (n === undefined) { return ''; }
  const t: number = n % 100;
  return `${n}${t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
}

export function onboarding(membership: { status?: string; planName?: string; collectionDay?: number } | undefined, docs: IMyDocumentSubmission[], required: DocType[], todayYmd: string): IOnboarding {
  const missing: DocType[] = required.filter(t => itemState(t, docs, todayYmd) === 'missing' || itemState(t, docs, todayYmd) === 'expired');
  const sent: number = required.length - missing.length;
  const active: boolean = !!membership && membership.status === 'Active';
  const planned: boolean = !!membership && !!membership.planName && membership.collectionDay !== undefined;
  const steps: IOnboardingStep[] = [
    { key: 'membership', label: 'Membership active', done: active, detail: active ? 'Your membership is active.' : 'Flavors activates your membership once you are set up.' },
    { key: 'plan', label: 'Plan and payment day', done: planned, detail: planned ? `${membership && membership.planName}, payment day: the ${ordinalDay(membership && membership.collectionDay)} of each month.` : 'Flavors sets your plan and payment day (1st to 15th).' },
    { key: 'documents', label: 'Compliance documents', done: required.length > 0 && missing.length === 0, detail: required.length === 0 ? 'Flavors has not set the required documents yet.' : missing.length === 0 ? 'Everything required is on file.' : `${sent} of ${required.length} sent. Each one is listed below with its status.` }
  ];
  return { steps, complete: steps.every(x => x.done), missing, sent, required: required.length };
}

// ---- Required documents list (R12). ----

/** [PROPOSED] fallback: the sheet's seven types (CATEGORIES) while AvenueRequiredDocTypes is empty (Q-11 unanswered). */
export function requiredOrSheet(required: DocType[]): DocType[] {
  return required.length > 0 ? required : wizardSteps().map(x => x.item.type);
}

export type RequiredState = 'current' | 'waiting' | 'expiring' | 'expired' | 'missing';

export interface IRequiredRow {
  type: DocType;
  /** Plain-words help from CATEGORIES, when the type is one of the seven. */
  help?: string;
  state: RequiredState;
  doc?: IMyDocumentSubmission;
  /** Days to expiry (negative once expired). */
  daysLeft?: number;
  /** The sheet's warning step reached: 30, 15 or 10 days. */
  warn?: number;
  /** Flavors did not accept the newest upload. */
  rejected?: boolean;
}

const DAY: number = 24 * 60 * 60 * 1000;

/**
 * Status of each required type from the newest document of that type. A valid document is "current"; it is "waiting" only
 * when the member-visible record (AvenueMyDocuments) explicitly says Flavors has not verified it yet, so without that list the
 * page behaves as before. A rejected one counts as missing.
 */
export function requiredRows(types: DocType[], docs: IMyDocumentSubmission[], todayYmd: string): IRequiredRow[] {
  const newest = newestPerType(docs);
  const help: Record<string, string> = {};
  wizardSteps().forEach(x => { help[x.item.type] = x.item.help; });
  return types.map(type => {
    const doc: IMyDocumentSubmission | undefined = newest.get(type);
    if (!doc) { return { type, help: help[type], state: 'missing' as RequiredState }; }
    const rejected: boolean = (doc.outcome || '').indexOf('Not accepted') === 0;
    const daysLeft: number = Math.round((Date.parse(`${doc.expiryDate}T12:00:00Z`) - Date.parse(`${todayYmd}T12:00:00Z`)) / DAY);
    const warn: number | undefined = WARN_DAYS.slice().sort((a, b) => a - b).filter(d => daysLeft >= 0 && daysLeft <= d)[0];
    const date: DateState = dateState(doc.expiryDate, todayYmd);
    const state: RequiredState = rejected ? 'missing' : date === 'expired' ? 'expired' : date === 'expiring' ? 'expiring' : doc.verified === false ? 'waiting' : 'current';
    return { type, help: help[type], state, doc, daysLeft, warn, rejected };
  });
}

export function requiredSummary(rows: IRequiredRow[]): Record<RequiredState, number> {
  const out: Record<RequiredState, number> = { current: 0, waiting: 0, expiring: 0, expired: 0, missing: 0 };
  rows.forEach(r => { out[r.state] += 1; });
  return out;
}

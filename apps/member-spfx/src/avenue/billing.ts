// Pure billing helpers for the member portal. Invoices are mirrored from Stripe (test mode) into AvenueInvoices by the
// host bridge; each row is shared only with its member (docs/MODULES_PLAN.md §11). Nothing here charges anyone.

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface IInvoiceLine {
  description: string;
  amountCents: number;
}

export interface IInvoice {
  invoiceId: string;
  periodStart: string; // "yyyy-mm-dd"
  periodEnd: string;   // "yyyy-mm-dd"
  currency: 'usd';
  amountDueCents: number;
  amountPaidCents: number;
  status: InvoiceStatus;
  dueDate: string;     // "yyyy-mm-dd"
  isEstimate: boolean;
  lines: IInvoiceLine[];
  /** Stripe invoice number, when finalised. */
  number?: string;
  kind?: 'Membership' | 'Overage' | 'Event' | 'Other';
  /** Stripe-hosted pay page and PDF; opened only after safeLink. */
  hostedUrl?: string;
  pdfUrl?: string;
}

/** Pilot preview: no one pays yet (STR-06, client decision pending). Join and Billing keep their screens but never ask for a Stripe page.
 * Set to false once the client approves the demonstrated Stripe test-mode flow. */
export const MOCK_PAYMENTS: boolean = true;

/** Stripe still runs in test mode (STR-06). One short notice per payments screen; set to false at live go-live. */
export const PAYMENTS_TEST_MODE: boolean = true;
export const TEST_MODE_NOTE: string = 'Test mode: no money is charged';

/** Stripe pages the portal may open, by purpose. Anything else is never followed (a link comes from a list a flow writes). */
export const STRIPE_HOSTS: Record<'checkout' | 'pay' | 'receipt' | 'portal', string[]> = {
  checkout: ['checkout.stripe.com'],
  pay: ['invoice.stripe.com'],
  receipt: ['pay.stripe.com', 'invoice.stripe.com'],
  portal: ['billing.stripe.com']
};

/** The URL if it is https on one of `hosts` exactly, otherwise undefined. */
export function safeLink(url: string | undefined, hosts: string[]): string | undefined {
  if (!url) { return undefined; }
  try {
    const u: URL = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && hosts.indexOf(u.hostname.toLowerCase()) >= 0 ? u.toString() : undefined;
  } catch { return undefined; }
}

/** A failed or unpaid subscription pauses new bookings (BKG-14; flow refuses, this only explains). */
export function isOverdue(paymentStatus: string | undefined): boolean {
  return paymentStatus === 'PastDue' || paymentStatus === 'Unpaid';
}

const MONTHS: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a cent amount into USD string (e.g. "$12.34", "-$1.00").
 * Only "usd" is supported; non-integers or other currencies throw.
 */
export function formatCents(cents: number, currency: string = 'usd'): string {
  if (currency !== 'usd') {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  if (!Number.isInteger(cents)) {
    throw new Error(`Cents must be an integer, got: ${cents}`);
  }
  const isNeg: boolean = cents < 0;
  const abs: number = Math.abs(cents);
  const dollars: number = Math.floor(abs / 100);
  const remainder: number = abs % 100;
  const formatted: string = `$${dollars.toLocaleString('en-US')}.${remainder < 10 ? '0' : ''}${remainder}`;
  return isNeg ? `-${formatted}` : formatted;
}

/** Prices shown as offers (plans, event packages, storage): "$1,200", or "$12.50" when there are cents. Invoices keep formatCents. */
export function formatPrice(cents: number): string {
  const full: string = formatCents(cents);
  return cents % 100 === 0 ? full.slice(0, -3) : full;
}

/**
 * Human-readable status label.
 */
export function statusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft': return 'Being prepared';
    case 'open': return 'Due';
    case 'paid': return 'Paid';
    case 'void': return 'Cancelled';
    case 'uncollectible': return 'Unpaid';
    default: return status;
  }
}

export interface IInvoiceRow {
  invoiceId: string;
  title: string;
  amountText: string;
  statusLabel: string;
  dueText: string;
  isEstimate: boolean;
  estimateNote: string;
}

/**
 * Converts an invoice to presentation row data.
 */
export function toInvoiceRow(inv: IInvoice): IInvoiceRow {
  const [y, m] = inv.periodStart.split('-');
  const mIdx: number = parseInt(m, 10) - 1;
  const month: string = `${MONTHS[mIdx] || m} ${y}`;
  const title: string = inv.kind === 'Overage' ? `Extra hours · ${month}` : inv.kind === 'Event' ? `Private event · ${month}` : month;
  const amountText: string = formatCents(inv.amountDueCents, inv.currency);
  const label: string = statusLabel(inv.status);
  let dueText: string = '';
  if (inv.dueDate) {
    const [dy, dm, dd] = inv.dueDate.split('-');
    const dIdx: number = parseInt(dm, 10) - 1;
    dueText = `${parseInt(dd, 10)} ${MONTHS[dIdx] || dm} ${dy}`;
  }
  const estimateNote: string = inv.isEstimate ? 'Estimate. The final amount is on your invoice.' : '';
  return {
    invoiceId: inv.invoiceId,
    title,
    amountText,
    statusLabel: label,
    dueText,
    isEstimate: inv.isEstimate,
    estimateNote
  };
}

/**
 * Computes open balance due: sum over "open" invoices of max(0, amountDueCents - amountPaidCents).
 */
export function balanceDueCents(invoices: IInvoice[]): number {
  return invoices
    .filter(inv => inv.status === 'open')
    .reduce((sum, inv) => sum + Math.max(0, inv.amountDueCents - inv.amountPaidCents), 0);
}

/**
 * Sorts invoices newest period first (stable).
 */
export function sortInvoices(invoices: IInvoice[]): IInvoice[] {
  return invoices.slice().sort((a, b) => {
    if (a.periodStart > b.periodStart) return -1;
    if (a.periodStart < b.periodStart) return 1;
    return 0;
  });
}

// DEMO INVOICES: 6 invented invoices, mixed statuses, one estimate (labelled DEMO).
export const DEMO_INVOICES: IInvoice[] = [
  {
    invoiceId: 'inv-demo-001',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    currency: 'usd',
    amountDueCents: 18500,
    amountPaidCents: 0,
    status: 'open',
    dueDate: '2026-12-01',
    isEstimate: false,
    lines: [
      { description: 'Monthly membership (10 hours included)', amountCents: 15000 },
      { description: 'Overage: 2.5 hours at facility rate', amountCents: 3500 }
    ]
  },
  {
    invoiceId: 'inv-demo-002',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    currency: 'usd',
    amountDueCents: 15000,
    amountPaidCents: 15000,
    status: 'paid',
    dueDate: '2026-11-01',
    isEstimate: false,
    lines: [
      { description: 'Monthly membership (10 hours included)', amountCents: 15000 }
    ]
  },
  {
    invoiceId: 'inv-demo-003',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    currency: 'usd',
    amountDueCents: 19200,
    amountPaidCents: 19200,
    status: 'paid',
    dueDate: '2026-10-01',
    isEstimate: false,
    lines: [
      { description: 'Monthly membership (10 hours included)', amountCents: 15000 },
      { description: 'Overage: 3.0 hours at facility rate', amountCents: 4200 }
    ]
  },
  {
    invoiceId: 'inv-demo-004',
    periodStart: '2026-12-01',
    periodEnd: '2026-12-31',
    currency: 'usd',
    amountDueCents: 15000,
    amountPaidCents: 0,
    status: 'draft',
    dueDate: '2027-01-01',
    isEstimate: true,
    lines: [
      { description: 'Upcoming monthly membership estimate', amountCents: 15000 }
    ]
  },
  {
    invoiceId: 'inv-demo-005',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    currency: 'usd',
    amountDueCents: 15000,
    amountPaidCents: 0,
    status: 'void',
    dueDate: '2026-09-01',
    isEstimate: false,
    lines: [
      { description: 'Cancelled trial invoice', amountCents: 15000 }
    ]
  },
  {
    invoiceId: 'inv-demo-006',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    currency: 'usd',
    amountDueCents: 5000,
    amountPaidCents: 0,
    status: 'uncollectible',
    dueDate: '2026-08-01',
    isEstimate: false,
    lines: [
      { description: 'Storage locker surcharge', amountCents: 5000 }
    ]
  }
];

export type InvoiceChip = 'Paid' | 'Open' | 'Past due' | 'Void';

/** The four member-facing invoice states. An open invoice past its due date (or one Stripe marked uncollectible) is Past due; a draft is still Open. */
export function invoiceChip(inv: IInvoice, todayYmd: string): InvoiceChip {
  if (inv.status === 'paid') { return 'Paid'; }
  if (inv.status === 'void') { return 'Void'; }
  if (inv.status === 'uncollectible' || (inv.status === 'open' && !!inv.dueDate && inv.dueDate < todayYmd)) { return 'Past due'; }
  return 'Open';
}

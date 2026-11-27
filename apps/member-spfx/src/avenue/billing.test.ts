import {
  formatCents,
  formatPrice,
  statusLabel,
  toInvoiceRow,
  balanceDueCents,
  sortInvoices,
  DEMO_INVOICES,
  IInvoice,
  STRIPE_HOSTS,
  isOverdue,
  safeLink
} from './billing';

describe('billing helpers', () => {
  describe('formatCents', () => {
    it('formats positive amounts correctly in USD', () => {
      expect(formatCents(0)).toBe('$0.00');
      expect(formatCents(1)).toBe('$0.01');
      expect(formatCents(99)).toBe('$0.99');
      expect(formatCents(100)).toBe('$1.00');
      expect(formatCents(123456)).toBe('$1,234.56');
    });

    it('formats negative amounts correctly', () => {
      expect(formatCents(-100)).toBe('-$1.00');
      expect(formatCents(-1)).toBe('-$0.01');
      expect(formatCents(-123456)).toBe('-$1,234.56');
    });

    it('formatPrice drops .00 on whole dollars and keeps cents otherwise', () => {
      expect(formatPrice(120000)).toBe('$1,200');
      expect(formatPrice(1250)).toBe('$12.50');
      expect(formatPrice(0)).toBe('$0');
    });

    it('throws on non-integer values', () => {
      expect(() => formatCents(12.34)).toThrow(/integer/);
      expect(() => formatCents(NaN)).toThrow(/integer/);
      expect(() => formatCents(Infinity)).toThrow(/integer/);
    });

    it('throws on non-usd currency', () => {
      expect(() => formatCents(100, 'eur')).toThrow(/Unsupported currency/);
      expect(() => formatCents(100, 'gbp')).toThrow(/Unsupported currency/);
    });
  });

  describe('statusLabel', () => {
    it('returns exact human-readable label for each invoice status', () => {
      expect(statusLabel('draft')).toBe('Being prepared');
      expect(statusLabel('open')).toBe('Due');
      expect(statusLabel('paid')).toBe('Paid');
      expect(statusLabel('void')).toBe('Cancelled');
      expect(statusLabel('uncollectible')).toBe('Unpaid');
    });
  });

  describe('toInvoiceRow', () => {
    it('formats invoice row with title and due text', () => {
      const inv: IInvoice = {
        invoiceId: 'inv-test-1',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        currency: 'usd',
        amountDueCents: 18500,
        amountPaidCents: 0,
        status: 'open',
        dueDate: '2026-12-01',
        isEstimate: false,
        lines: []
      };
      const row = toInvoiceRow(inv);
      expect(row.invoiceId).toBe('inv-test-1');
      expect(row.title).toBe('Nov 2026');
      expect(row.amountText).toBe('$185.00');
      expect(row.statusLabel).toBe('Due');
      expect(row.dueText).toBe('1 Dec 2026');
      expect(row.isEstimate).toBe(false);
      expect(row.estimateNote).toBe('');
    });

    it('includes exact estimate note when isEstimate is true', () => {
      const inv: IInvoice = {
        invoiceId: 'inv-test-est',
        periodStart: '2026-12-01',
        periodEnd: '2026-12-31',
        currency: 'usd',
        amountDueCents: 15000,
        amountPaidCents: 0,
        status: 'draft',
        dueDate: '2027-01-01',
        isEstimate: true,
        lines: []
      };
      const row = toInvoiceRow(inv);
      expect(row.isEstimate).toBe(true);
      expect(row.estimateNote).toBe('Estimate. The final amount is on your invoice.');
    });
  });

  describe('balanceDueCents', () => {
    it('sums balance only over open invoices', () => {
      const invs: IInvoice[] = [
        {
          invoiceId: '1',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          currency: 'usd',
          amountDueCents: 10000,
          amountPaidCents: 2000,
          status: 'open',
          dueDate: '2026-12-01',
          isEstimate: false,
          lines: []
        },
        {
          invoiceId: '2',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          currency: 'usd',
          amountDueCents: 5000,
          amountPaidCents: 5000,
          status: 'paid',
          dueDate: '2026-11-01',
          isEstimate: false,
          lines: []
        },
        {
          invoiceId: '3',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          currency: 'usd',
          amountDueCents: 3000,
          amountPaidCents: 0,
          status: 'open',
          dueDate: '2026-10-01',
          isEstimate: false,
          lines: []
        },
        {
          invoiceId: '4',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          currency: 'usd',
          amountDueCents: 4000,
          amountPaidCents: 0,
          status: 'void',
          dueDate: '2026-09-01',
          isEstimate: false,
          lines: []
        }
      ];
      // (10000 - 2000) + (3000 - 0) = 8000 + 3000 = 11000
      expect(balanceDueCents(invs)).toBe(11000);
    });

    it('treats overpaid invoices as zero balance contribution', () => {
      const invs: IInvoice[] = [
        {
          invoiceId: '1',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          currency: 'usd',
          amountDueCents: 5000,
          amountPaidCents: 8000, // overpaid
          status: 'open',
          dueDate: '2026-12-01',
          isEstimate: false,
          lines: []
        }
      ];
      expect(balanceDueCents(invs)).toBe(0);
    });

    it('returns zero when no invoices are open', () => {
      const invs: IInvoice[] = [
        {
          invoiceId: '1',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          currency: 'usd',
          amountDueCents: 5000,
          amountPaidCents: 5000,
          status: 'paid',
          dueDate: '2026-11-01',
          isEstimate: false,
          lines: []
        }
      ];
      expect(balanceDueCents(invs)).toBe(0);
      expect(balanceDueCents([])).toBe(0);
    });
  });

  describe('sortInvoices', () => {
    it('sorts newest period first and preserves stable order on ties', () => {
      const invs: IInvoice[] = [
        {
          invoiceId: 'a',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          currency: 'usd',
          amountDueCents: 1000,
          amountPaidCents: 0,
          status: 'paid',
          dueDate: '2026-10-01',
          isEstimate: false,
          lines: []
        },
        {
          invoiceId: 'b',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          currency: 'usd',
          amountDueCents: 2000,
          amountPaidCents: 0,
          status: 'open',
          dueDate: '2026-12-01',
          isEstimate: false,
          lines: []
        },
        {
          invoiceId: 'c1',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          currency: 'usd',
          amountDueCents: 3000,
          amountPaidCents: 0,
          status: 'paid',
          dueDate: '2026-11-01',
          isEstimate: false,
          lines: []
        },
        {
          invoiceId: 'c2',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          currency: 'usd',
          amountDueCents: 4000,
          amountPaidCents: 0,
          status: 'paid',
          dueDate: '2026-11-01',
          isEstimate: false,
          lines: []
        }
      ];
      const sorted = sortInvoices(invs);
      expect(sorted.map(i => i.invoiceId)).toEqual(['b', 'c1', 'c2', 'a']);
    });
  });

  describe('safeLink', () => {
    it('keeps only https links on the exact allowed host', () => {
      expect(safeLink('https://checkout.stripe.com/c/pay/cs_test_1', STRIPE_HOSTS.checkout)).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
      expect(safeLink('http://checkout.stripe.com/x', STRIPE_HOSTS.checkout)).toBeUndefined();
      expect(safeLink('https://checkout.stripe.com.evil.com/x', STRIPE_HOSTS.checkout)).toBeUndefined();
      expect(safeLink('https://evil.com/?https://checkout.stripe.com', STRIPE_HOSTS.checkout)).toBeUndefined();
      expect(safeLink('https://user:pw@checkout.stripe.com/x', STRIPE_HOSTS.checkout)).toBeUndefined();
      expect(safeLink(['javascript', 'alert(1)'].join(':'), STRIPE_HOSTS.pay)).toBeUndefined();
      expect(safeLink(undefined, STRIPE_HOSTS.pay)).toBeUndefined();
      expect(safeLink('https://pay.stripe.com/invoice/x/pdf', STRIPE_HOSTS.receipt)).toBeDefined();
      expect(safeLink('https://pay.stripe.com/invoice/x/pdf', STRIPE_HOSTS.pay)).toBeUndefined();
    });
  });

  describe('isOverdue and kinds', () => {
    it('treats PastDue and Unpaid as overdue only', () => {
      expect(isOverdue('PastDue')).toBe(true);
      expect(isOverdue('Unpaid')).toBe(true);
      expect(isOverdue('Current')).toBe(false);
      expect(isOverdue('OwnerOverride')).toBe(false);
      expect(isOverdue(undefined)).toBe(false);
    });
    it('titles overage and event invoices', () => {
      expect(toInvoiceRow({ ...DEMO_INVOICES[0], kind: 'Overage' }).title).toBe('Extra hours · Nov 2026');
      expect(toInvoiceRow({ ...DEMO_INVOICES[0], kind: 'Event' }).title).toBe('Private event · Nov 2026');
      expect(toInvoiceRow(DEMO_INVOICES[0]).title).toBe('Nov 2026');
    });
    it('demo balance counts only open invoices', () => {
      expect(balanceDueCents(DEMO_INVOICES)).toBe(18500);
    });
  });
});

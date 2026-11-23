// Atomic Stripe webhook handling for Avenue Phase 1
// Uses atomic store operations (putIfAbsent and compareAndSet) to eliminate race conditions.
import { verifySignature } from './webhook.mjs';

const HANDLED = new Set(['invoice.paid', 'invoice.payment_failed']);
const MAX_CAS_RETRIES = 3;

/**
 * Creates an in-memory atomic store implementing putIfAbsent, compareAndSet, get, and has.
 * Each operation is fully synchronous inside its async wrapper.
 */
export function createMemoryAtomicStore() {
  const m = new Map();

  return {
    m,
    async has(id) {
      return m.has(id);
    },
    async get(id) {
      const val = m.get(id);
      return val ? { ...val } : undefined;
    },
    async put(record) {
      if (!record || !record.id) throw new Error('record.id is required');
      m.set(record.id, { ...record });
    },
    async putIfAbsent(record) {
      if (!record || !record.id) throw new Error('record.id is required');
      if (m.has(record.id)) {
        return false;
      }
      const version = record.version ?? 1;
      m.set(record.id, { ...record, version });
      return true;
    },
    async compareAndSet(id, expectedVersion, newRecord) {
      if (!id) throw new Error('id is required');
      const current = m.get(id);
      const currentVersion = current ? (current.version ?? 0) : 0;
      const expected = expectedVersion ?? 0;
      if (currentVersion !== expected) {
        return false;
      }
      const nextVersion = currentVersion + 1;
      m.set(id, { ...newRecord, id, version: nextVersion });
      return true;
    }
  };
}

/**
 * Handles Stripe webhook events atomically.
 *
 * Rules:
 * - Duplicate event detection is decided ONLY by putIfAbsent (never has-then-put).
 * - Invoice state record "invoice:<id>" changes only via compareAndSet.
 * - Paid is final.
 * - An event whose event.created is older than the stored one is "stale".
 * - A compareAndSet conflict is retried at most 3 times, then throws.
 */
export async function handleWebhookAtomic({
  rawBody,
  signatureHeader,
  secret,
  nowSec,
  allowedAccounts,
  store
}) {
  verifySignature(rawBody, signatureHeader, secret, nowSec);

  const event = JSON.parse(rawBody);
  if (!event?.id || typeof event.type !== 'string') {
    throw new Error('event: malformed');
  }
  if (!event.account || !allowedAccounts.includes(event.account)) {
    throw new Error('event: unknown connected account');
  }

  // If this event type is not handled, putIfAbsent decides whether it is ignored or duplicate
  if (!HANDLED.has(event.type)) {
    const ignoredRecord = {
      id: event.id,
      type: event.type,
      account: event.account,
      outcome: 'ignored'
    };
    const written = await store.putIfAbsent(ignoredRecord);
    if (!written) {
      return { status: 'duplicate', id: event.id };
    }
    return { status: 'ignored', id: event.id };
  }

  const inv = event.data?.object;
  if (!inv?.id) {
    throw new Error('event: missing invoice');
  }

  // Handling handled invoice events:
  // 1. putIfAbsent claims the event id with outcome "pending".
  const eventRecord = {
    id: event.id,
    type: event.type,
    account: event.account,
    outcome: 'pending'
  };

  const isNew = await store.putIfAbsent(eventRecord);
  if (!isNew) {
    // 2. Read existing record; only processed, ignored, stale are duplicate.
    // If pending (earlier attempt did not finish), continue processing.
    const existing = await store.get(event.id);
    if (existing && (existing.outcome === 'processed' || existing.outcome === 'ignored' || existing.outcome === 'stale')) {
      return { status: 'duplicate', id: event.id };
    }
  }

  const invoiceKey = `invoice:${inv.id}`;
  const paid = event.type === 'invoice.paid';
  const created = Number(event.created) || 0;

  let retries = 0;
  while (true) {
    const prior = await store.get(invoiceKey);
    const priorVersion = prior ? (prior.version ?? 0) : 0;

    // 4. Idempotency rule: if the stored invoice state's lastEventId equals this event's id,
    // this event was already applied; return duplicate and do NOT write again.
    if (prior && prior.lastEventId === event.id) {
      return { status: 'duplicate', id: event.id };
    }

    if (prior && (prior.paid || created < prior.created)) {
      // Event is stale: invoice state record does not change
      const staleRecord = {
        id: event.id,
        type: event.type,
        account: event.account,
        outcome: 'stale',
        invoiceId: inv.id
      };
      if (store.put) {
        await store.put(staleRecord);
      }
      return { status: 'stale', id: event.id, invoiceId: inv.id };
    }

    const newInvoiceState = {
      id: invoiceKey,
      paid,
      created,
      lastEventId: event.id
    };

    const casSuccess = await store.compareAndSet(invoiceKey, priorVersion, newInvoiceState);
    if (casSuccess) {
      const processedRecord = {
        id: event.id,
        type: event.type,
        account: event.account,
        outcome: 'processed',
        invoiceId: inv.id,
        paid,
        amountCents: paid ? inv.amount_paid : inv.amount_due
      };
      if (store.put) {
        await store.put(processedRecord);
      }
      return { status: 'processed', ...processedRecord };
    }

    retries++;
    if (retries > MAX_CAS_RETRIES) {
      throw new Error(`compareAndSet conflict: retry limit exceeded for ${invoiceKey}`);
    }
  }
}

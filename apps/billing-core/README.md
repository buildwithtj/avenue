# billing-core

Host-independent Stripe webhook verification and idempotent event handling. Run `npm test` (Node 22, no dependencies).

It does **not** call Stripe, read secrets or choose a host. The secure server and secret store are still open (Q-01), so nothing here is deployed or connected to a Stripe account.

- `verifySignature` checks the `Stripe-Signature` header (v1, 5-minute window, constant-time compare).
- `handleWebhook` verifies first, then rejects events whose connected account is not on the facility's allow-list, ignores duplicates by event id, records unhandled types as ignored, and handles `invoice.paid` and `invoice.payment_failed`.
- The host supplies the raw body, the secret (from its own secret store), the clock, the allow-list and a `store`.

Out-of-order delivery: the store also keeps one state record per invoice (`invoice:<id>`). Paid is final, and an event older than the last applied one is recorded as `stale` and changes nothing (tests cover a late `payment_failed` after `paid`). The store therefore needs `get` as well as `has` and `put`.

Known gap: `has` then `put` is not atomic, and neither is the invoice state read-then-write. The real store must offer put-if-absent (for example a unique key) so two simultaneous deliveries cannot both be applied. What a paid or failed invoice should change in Avenue (balance, overdue block) depends on Q-06 and Q-07 and is not implemented.

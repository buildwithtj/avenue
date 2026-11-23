import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventRefundOutcome } from './eventRefund.mjs';

test('valid notice days return expected outcomes', () => {
  // 0 to 6 days -> policy-undefined (Q-08)
  assert.deepEqual(eventRefundOutcome(0), { status: 'policy-undefined', question: 'Q-08' });
  assert.deepEqual(eventRefundOutcome(6), { status: 'policy-undefined', question: 'Q-08' });

  // Exactly 7 days -> forfeit-deposit-and-payments
  assert.deepEqual(eventRefundOutcome(7), { status: 'forfeit-deposit-and-payments' });

  // 8 to 14 days -> policy-undefined (Q-08)
  assert.deepEqual(eventRefundOutcome(8), { status: 'policy-undefined', question: 'Q-08' });
  assert.deepEqual(eventRefundOutcome(14), { status: 'policy-undefined', question: 'Q-08' });

  // 15+ days -> full-refund
  assert.deepEqual(eventRefundOutcome(15), { status: 'full-refund' });
  assert.deepEqual(eventRefundOutcome(16), { status: 'full-refund' });
  assert.deepEqual(eventRefundOutcome(100), { status: 'full-refund' });
});

test('invalid notice days throw', () => {
  assert.throws(() => eventRefundOutcome(-1), /noticeDays/);
  assert.throws(() => eventRefundOutcome(7.5), /noticeDays/);
  assert.throws(() => eventRefundOutcome('7'), /noticeDays/);
  assert.throws(() => eventRefundOutcome(NaN), /noticeDays/);
  assert.throws(() => eventRefundOutcome(null), /noticeDays/);
  assert.throws(() => eventRefundOutcome(undefined), /noticeDays/);
  assert.throws(() => eventRefundOutcome(Infinity), /noticeDays/);
});

test('hardening M9: output status is always one of the three allowed values for valid input (500 cases)', () => {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(44332211);
  const allowedStatuses = new Set([
    'full-refund',
    'forfeit-deposit-and-payments',
    'policy-undefined'
  ]);

  for (let i = 0; i < 500; i++) {
    const days = Math.floor(rng() * 100); // 0 to 99
    const res = eventRefundOutcome(days);

    assert(
      allowedStatuses.has(res.status),
      `Status "${res.status}" for days=${days} is not one of the allowed statuses`
    );

    if (days >= 15) {
      assert.equal(res.status, 'full-refund');
    } else if (days === 7) {
      assert.equal(res.status, 'forfeit-deposit-and-payments');
    } else {
      assert.equal(res.status, 'policy-undefined');
      assert.equal(res.question, 'Q-08');
    }
  }
});

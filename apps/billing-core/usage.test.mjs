import { test } from "node:test";
import assert from "node:assert/strict";
import { summariseUsage } from "./usage.mjs";

test("credit-back netting", () => {
  const entries = [
    { entryId: "e1", memberId: "m1", bookingId: "b1", period: "2026-03", hours: 8, reason: "Used" },
    { entryId: "e2", memberId: "m1", bookingId: "b2", period: "2026-03", hours: -3, reason: "Credit back" }
  ];
  const plans = { m1: { monthlyHours: 10 } };
  const res = summariseUsage(entries, plans);
  assert.equal(res.length, 1);
  assert.equal(res[0].memberId, "m1");
  assert.equal(res[0].period, "2026-03");
  assert.equal(res[0].netUsed, 5);
  assert.equal(res[0].netUsedHours, 5);
  assert.equal(res[0].overageHours, 0);
});

test("no rollover across periods", () => {
  const entries = [
    { entryId: "e1", memberId: "m1", bookingId: "b1", period: "2026-03", hours: 5, reason: "Used" },
    { entryId: "e2", memberId: "m1", bookingId: "b2", period: "2026-04", hours: 12, reason: "Used" }
  ];
  const plans = { m1: { monthlyHours: 10 } };
  const res = summariseUsage(entries, plans);
  assert.equal(res.length, 2);
  // Period 2026-03 has 5 net hours, allowance 10 -> overage 0
  assert.equal(res[0].period, "2026-03");
  assert.equal(res[0].netUsed, 5);
  assert.equal(res[0].overageHours, 0);
  // Period 2026-04 has 12 net hours, allowance 10 -> overage 2 (unused 5h from March do not roll over)
  assert.equal(res[1].period, "2026-04");
  assert.equal(res[1].netUsed, 12);
  assert.equal(res[1].overageHours, 2);
});

test("plan-unknown when member has no plan or non-finite monthlyHours", () => {
  const entries = [
    { entryId: "e1", memberId: "m1", bookingId: "b1", period: "2026-03", hours: 8, reason: "Used" },
    { entryId: "e2", memberId: "m2", bookingId: "b2", period: "2026-03", hours: 6, reason: "Used" }
  ];
  const plans = {
    m1: { monthlyHours: undefined }
    // m2 is missing
  };
  const res = summariseUsage(entries, plans);
  assert.equal(res.length, 2);
  assert.equal(res[0].memberId, "m1");
  assert.equal(res[0].status, "plan-unknown");
  assert.equal("overageHours" in res[0], false);
  assert.equal(res[1].memberId, "m2");
  assert.equal(res[1].status, "plan-unknown");
  assert.equal("overageHours" in res[1], false);
});

test("exactly at allowance gives zero overage", () => {
  const entries = [
    { entryId: "e1", memberId: "m1", bookingId: "b1", period: "2026-05", hours: 10, reason: "Used" }
  ];
  const plans = { m1: { monthlyHours: 10 } };
  const res = summariseUsage(entries, plans);
  assert.equal(res.length, 1);
  assert.equal(res[0].netUsed, 10);
  assert.equal(res[0].overageHours, 0);
});

test("duplicate entryId throws", () => {
  const entries = [
    { entryId: "dup-1", memberId: "m1", bookingId: "b1", period: "2026-05", hours: 2, reason: "Used" },
    { entryId: "dup-1", memberId: "m1", bookingId: "b2", period: "2026-05", hours: 3, reason: "Used" }
  ];
  assert.throws(() => summariseUsage(entries, {}), /Duplicate entryId/);
});

test("bad period format throws", () => {
  const badPeriods = ["2026-5", "2026/05", "May 2026", "2026-05-01", "", null];
  for (const period of badPeriods) {
    const entries = [
      { entryId: "e1", memberId: "m1", bookingId: "b1", period, hours: 2, reason: "Used" }
    ];
    assert.throws(() => summariseUsage(entries, {}), /Invalid period/);
  }
});

test("non-finite hours throws", () => {
  const badHours = [NaN, Infinity, -Infinity, "5", null, undefined];
  for (const hours of badHours) {
    const entries = [
      { entryId: "e1", memberId: "m1", bookingId: "b1", period: "2026-05", hours, reason: "Used" }
    ];
    assert.throws(() => summariseUsage(entries, {}), /Invalid hours/);
  }
});

test("empty input returns empty array", () => {
  const res = summariseUsage([], {});
  assert.deepEqual(res, []);
});

test("two members sorted deterministically by memberId then period", () => {
  const entries = [
    { entryId: "e1", memberId: "member-B", bookingId: "b1", period: "2026-06", hours: 4, reason: "Used" },
    { entryId: "e2", memberId: "member-A", bookingId: "b2", period: "2026-06", hours: 2, reason: "Used" },
    { entryId: "e3", memberId: "member-B", bookingId: "b3", period: "2026-05", hours: 3, reason: "Used" },
    { entryId: "e4", memberId: "member-A", bookingId: "b4", period: "2026-05", hours: 5, reason: "Used" }
  ];
  const plans = {
    "member-A": { monthlyHours: 10 },
    "member-B": { monthlyHours: 5 }
  };
  const res = summariseUsage(entries, plans);
  assert.equal(res.length, 4);
  assert.equal(res[0].memberId, "member-A");
  assert.equal(res[0].period, "2026-05");
  assert.equal(res[1].memberId, "member-A");
  assert.equal(res[1].period, "2026-06");
  assert.equal(res[2].memberId, "member-B");
  assert.equal(res[2].period, "2026-05");
  assert.equal(res[3].memberId, "member-B");
  assert.equal(res[3].period, "2026-06");
});

test("hardening M1: seeded randomized test (500 cases) asserts overage >= 0 and netUsed equals sum", () => {
  // Deterministic Mulberry32 generator
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(123456789);

  for (let iteration = 0; iteration < 500; iteration++) {
    const numEntries = Math.floor(rng() * 10) + 1;
    const entries = [];
    const members = ["m-1", "m-2", "m-3"];
    const periods = ["2026-01", "2026-02", "2026-03"];
    const expectedSums = new Map();

    for (let i = 0; i < numEntries; i++) {
      const memberId = members[Math.floor(rng() * members.length)];
      const period = periods[Math.floor(rng() * periods.length)];
      // Random hours from -10 to +20, unrounded or rounded
      const hours = Number(((rng() * 30) - 10).toFixed(2));
      const entryId = `iter-${iteration}-entry-${i}`;
      entries.push({
        entryId,
        memberId,
        bookingId: `b-${i}`,
        period,
        hours,
        reason: hours < 0 ? "Credit back" : "Used"
      });

      const key = `${memberId}\0${period}`;
      expectedSums.set(key, (expectedSums.get(key) || 0) + hours);
    }

    const plans = {
      "m-1": { monthlyHours: Math.floor(rng() * 20) },
      "m-2": { monthlyHours: Math.floor(rng() * 20) },
      "m-3": { monthlyHours: rng() > 0.5 ? Math.floor(rng() * 20) : undefined }
    };

    const res = summariseUsage(entries, plans);

    for (const item of res) {
      const key = `${item.memberId}\0${item.period}`;
      const expected = expectedSums.get(key);
      // Floating point tolerance check for sum
      assert(Math.abs(item.netUsed - expected) < 1e-9, `netUsed ${item.netUsed} != expected ${expected}`);

      if (item.status === "plan-unknown") {
        assert.equal("overageHours" in item, false);
      } else {
        assert(item.overageHours >= 0, `overageHours ${item.overageHours} must not be negative`);
        const plan = plans[item.memberId];
        const expectedOverage = Math.max(0, item.netUsed - plan.monthlyHours);
        assert(Math.abs(item.overageHours - expectedOverage) < 1e-9);
      }
    }
  }
});

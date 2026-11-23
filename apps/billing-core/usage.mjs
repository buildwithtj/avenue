// Usage and overage hours calculation for Avenue Phase 1
// Pure function: no external state, no clock access, no side effects.
// Note on financial & billing rules:
// As per docs/DECISIONS_AND_OPEN_QUESTIONS.md rows Q-04 and Q-06, money, rates,
// rounding, proration, tax, and cut-off logic are currently OPEN decisions.
// Therefore, this module computes and returns unrounded plain numbers only.

/**
 * Summarise usage entries per member and per period ("yyyy-mm").
 *
 * @param {Array<Object>} entries
 * @param {Object} [plansByMember]
 * @returns {Array<Object>} Deterministically sorted by memberId, then period.
 */
export function summariseUsage(entries, plansByMember = {}) {
  if (!Array.isArray(entries)) {
    throw new TypeError("entries must be an array");
  }

  const seenEntryIds = new Set();
  const periodRegex = /^\d{4}-\d{2}$/;

  // Map key: `${memberId}\0${period}` -> { memberId, period, netUsed, entriesCount }
  const groups = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      throw new TypeError("entry must be an object");
    }

    const { entryId, memberId, period, hours } = entry;

    if (entryId === undefined || entryId === null || entryId === "") {
      throw new Error("entryId is required");
    }
    const entryIdStr = String(entryId);
    if (seenEntryIds.has(entryIdStr)) {
      throw new Error(`Duplicate entryId: ${entryIdStr}`);
    }
    seenEntryIds.add(entryIdStr);

    if (typeof memberId !== "string" || memberId.trim() === "") {
      throw new Error(`Invalid memberId: ${memberId}`);
    }

    if (typeof period !== "string" || !periodRegex.test(period)) {
      throw new Error(`Invalid period: ${period}`);
    }

    if (typeof hours !== "number" || !Number.isFinite(hours)) {
      throw new Error(`Invalid hours (must be finite number): ${hours}`);
    }

    const groupKey = `${memberId}\0${period}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        memberId,
        period,
        netUsed: 0
      };
      groups.set(groupKey, group);
    }

    // netUsed = sum of hours (hours may be negative for credit back)
    group.netUsed += hours;
  }

  const results = [];

  for (const group of groups.values()) {
    const { memberId, period, netUsed } = group;
    const plan = plansByMember ? plansByMember[memberId] : undefined;
    const monthlyHours = plan ? plan.monthlyHours : undefined;

    // Output object containing both netUsed and netUsedHours for clarity
    const item = {
      memberId,
      period,
      netUsed,
      netUsedHours: netUsed
    };

    if (typeof monthlyHours === "number" && Number.isFinite(monthlyHours)) {
      // Every period stands alone (no rollover)
      item.overageHours = Math.max(0, netUsed - monthlyHours);
    } else {
      item.status = "plan-unknown";
    }

    results.push(item);
  }

  // Deterministic sorting: sorted by memberId, then period
  results.sort((a, b) => {
    if (a.memberId < b.memberId) return -1;
    if (a.memberId > b.memberId) return 1;
    if (a.period < b.period) return -1;
    if (a.period > b.period) return 1;
    return 0;
  });

  return results;
}

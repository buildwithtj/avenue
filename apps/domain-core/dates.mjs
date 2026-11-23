// Date and time utilities for Avenue Phase 1 (Facility Eastern time and collection day)
// Pure functions: no Intl, no toLocaleString, no machine clock or timezone reading.
// DST rule: Daylight time (offset -4h) from the second Sunday of March 07:00 UTC
// up to but not including the first Sunday of November 06:00 UTC; otherwise Standard time (offset -5h).

/**
 * Converts a UTC ISO timestamp to Eastern time parts.
 *
 * @param {string} utcIso - ISO 8601 UTC timestamp string
 * @returns {{year: number, month: number, day: number, hour: number, minute: number, offsetHours: number}}
 */
export function toEasternParts(utcIso) {
  if (typeof utcIso !== 'string' || utcIso.trim() === '') {
    throw new Error('Unparsable timestamp: timestamp must be a non-empty string');
  }

  const timeMs = Date.parse(utcIso);
  if (Number.isNaN(timeMs)) {
    throw new Error(`Unparsable timestamp: ${utcIso}`);
  }

  const utcDate = new Date(timeMs);
  const utcYear = utcDate.getUTCFullYear();

  // Compute second Sunday of March 07:00 UTC for this year
  // In Date.UTC month is 0-indexed: March is 2
  const march1Day = new Date(Date.UTC(utcYear, 2, 1)).getUTCDay();
  const firstSundayMarch = 1 + ((7 - march1Day) % 7);
  const secondSundayMarch = firstSundayMarch + 7;
  const dstStartMs = Date.UTC(utcYear, 2, secondSundayMarch, 7, 0, 0, 0);

  // Compute first Sunday of November 06:00 UTC for this year
  // November is month 10
  const nov1Day = new Date(Date.UTC(utcYear, 10, 1)).getUTCDay();
  const firstSundayNov = 1 + ((7 - nov1Day) % 7);
  const dstEndMs = Date.UTC(utcYear, 10, firstSundayNov, 6, 0, 0, 0);

  // Daylight time (-4) from second Sunday of March 07:00 UTC up to (not including) first Sunday of Nov 06:00 UTC
  const isDst = timeMs >= dstStartMs && timeMs < dstEndMs;
  const offsetHours = isDst ? -4 : -5;

  const easternMs = timeMs + offsetHours * 60 * 60 * 1000;
  const easternDate = new Date(easternMs);

  return {
    year: easternDate.getUTCFullYear(),
    month: easternDate.getUTCMonth() + 1, // 1 to 12
    day: easternDate.getUTCDate(),
    hour: easternDate.getUTCHours(),
    minute: easternDate.getUTCMinutes(),
    offsetHours
  };
}

/**
 * Returns the facility month as "yyyy-mm" in Eastern time.
 *
 * @param {string} utcIso
 * @returns {string} "yyyy-mm"
 */
export function facilityMonth(utcIso) {
  const parts = toEasternParts(utcIso);
  const mm = String(parts.month).padStart(2, '0');
  return `${parts.year}-${mm}`;
}

function daysInMonth(y, m) {
  if (m === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return isLeap ? 29 : 28;
  }
  if (m === 4 || m === 6 || m === 9 || m === 11) {
    return 30;
  }
  return 31;
}

/**
 * Computes the next collection date for a member given today's date and chosen collection day.
 *
 * @param {string} todayYmd - "yyyy-mm-dd"
 * @param {number} collectionDay - Whole number from 1 to 15
 * @returns {string} "yyyy-mm-dd"
 */
export function nextCollectionDate(todayYmd, collectionDay) {
  if (
    typeof collectionDay !== 'number' ||
    !Number.isInteger(collectionDay) ||
    collectionDay < 1 ||
    collectionDay > 15
  ) {
    throw new Error(
      `collectionDay must be a whole number from 1 to 15, received: ${JSON.stringify(collectionDay)}`
    );
  }

  if (typeof todayYmd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) {
    throw new Error(`Invalid todayYmd: ${todayYmd}`);
  }

  const [yStr, mStr, dStr] = todayYmd.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new Error(`Invalid todayYmd: ${todayYmd}`);
  }

  let targetYear = y;
  let targetMonth = m;

  if (d <= collectionDay) {
    // Falls on or after today in the current month
    targetYear = y;
    targetMonth = m;
  } else {
    // Next month (December rolls over to January next year)
    if (m === 12) {
      targetYear = y + 1;
      targetMonth = 1;
    } else {
      targetYear = y;
      targetMonth = m + 1;
    }
  }

  const mm = String(targetMonth).padStart(2, '0');
  const dd = String(collectionDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

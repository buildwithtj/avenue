import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEasternParts, facilityMonth, nextCollectionDate } from './dates.mjs';

test('facilityMonth hand-checked expectations against DST rules', () => {
  assert.equal(facilityMonth('2026-03-08T06:59:00Z'), '2026-03');
  assert.equal(facilityMonth('2026-04-01T03:59:00Z'), '2026-03');
  assert.equal(facilityMonth('2026-04-01T04:00:00Z'), '2026-04');
  assert.equal(facilityMonth('2026-11-01T03:59:00Z'), '2026-10');
  assert.equal(facilityMonth('2026-11-01T05:30:00Z'), '2026-11');
  assert.equal(facilityMonth('2026-11-01T06:00:00Z'), '2026-11');
  assert.equal(facilityMonth('2026-12-01T04:59:00Z'), '2026-11');
  assert.equal(facilityMonth('2026-12-01T05:00:00Z'), '2026-12');
  assert.equal(facilityMonth('2027-01-01T04:59:00Z'), '2026-12');
});

test('toEasternParts returns correct parts and offsetHours', () => {
  // DST active
  const dstParts = toEasternParts('2026-06-15T18:30:00Z');
  assert.equal(dstParts.year, 2026);
  assert.equal(dstParts.month, 6);
  assert.equal(dstParts.day, 15);
  assert.equal(dstParts.hour, 14); // 18 - 4
  assert.equal(dstParts.minute, 30);
  assert.equal(dstParts.offsetHours, -4);

  // Standard time
  const stdParts = toEasternParts('2026-01-15T18:30:00Z');
  assert.equal(stdParts.year, 2026);
  assert.equal(stdParts.month, 1);
  assert.equal(stdParts.day, 15);
  assert.equal(stdParts.hour, 13); // 18 - 5
  assert.equal(stdParts.minute, 30);
  assert.equal(stdParts.offsetHours, -5);
});

test('unparsable timestamps throw', () => {
  assert.throws(() => toEasternParts('not-a-date'), /Unparsable timestamp/);
  assert.throws(() => toEasternParts(''), /Unparsable timestamp/);
  assert.throws(() => toEasternParts(null), /Unparsable timestamp/);
  assert.throws(() => facilityMonth('garbage'), /Unparsable timestamp/);
});

test('collectionDay validation: 1 and 15 valid, 0, 16, 7.5, "8" throw', () => {
  assert.equal(nextCollectionDate('2026-05-01', 1), '2026-05-01');
  assert.equal(nextCollectionDate('2026-05-01', 15), '2026-05-15');

  assert.throws(() => nextCollectionDate('2026-05-01', 0), /collectionDay/);
  assert.throws(() => nextCollectionDate('2026-05-01', 16), /collectionDay/);
  assert.throws(() => nextCollectionDate('2026-05-01', 7.5), /collectionDay/);
  assert.throws(() => nextCollectionDate('2026-05-01', '8'), /collectionDay/);
  assert.throws(() => nextCollectionDate('2026-05-01', NaN), /collectionDay/);
  assert.throws(() => nextCollectionDate('2026-05-01', null), /collectionDay/);
});

test('collectionDay logic: day equal to today stays in this month; later day moves to next month', () => {
  // Today is day 5, collection day 5 -> stays in this month
  assert.equal(nextCollectionDate('2026-05-05', 5), '2026-05-05');

  // Today is day 4, collection day 5 -> stays in this month
  assert.equal(nextCollectionDate('2026-05-04', 5), '2026-05-05');

  // Today is day 6, collection day 5 -> moves to June
  assert.equal(nextCollectionDate('2026-05-06', 5), '2026-06-05');
});

test('December rollover advances year to January', () => {
  // Today is Dec 20, collection day 10 -> Jan 10 next year
  assert.equal(nextCollectionDate('2026-12-20', 10), '2027-01-10');

  // Today is Dec 5, collection day 10 -> Dec 10 same year
  assert.equal(nextCollectionDate('2026-12-05', 10), '2026-12-10');
});

test('nextCollectionDate rejects impossible calendar dates in todayYmd', () => {
  assert.throws(() => nextCollectionDate('2026-13-01', 5), /Invalid todayYmd/);
  assert.throws(() => nextCollectionDate('2026-02-30', 5), /Invalid todayYmd/);
  assert.throws(() => nextCollectionDate('2026-00-10', 5), /Invalid todayYmd/);
  assert.throws(() => nextCollectionDate('2026-04-31', 5), /Invalid todayYmd/);
  assert.throws(() => nextCollectionDate('2026-02-29', 5), /Invalid todayYmd/);

  // 2028 is a leap year: Feb 29 is valid
  assert.equal(nextCollectionDate('2028-02-29', 5), '2028-03-05');
});

test('hardening M8: nextCollectionDate is never earlier than today and never more than one month ahead (500 cases)', () => {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(99887766);

  for (let i = 0; i < 500; i++) {
    const year = 2026 + Math.floor(rng() * 5); // 2026 to 2030
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28); // 1 to 28 safe days in any month
    const todayYmd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const collectionDay = 1 + Math.floor(rng() * 15); // 1 to 15

    const nextDate = nextCollectionDate(todayYmd, collectionDay);

    // 1. Never earlier than today
    assert(
      nextDate >= todayYmd,
      `nextDate (${nextDate}) is earlier than today (${todayYmd})`
    );

    // 2. Never more than one month ahead
    const [ny, nm, nd] = nextDate.split('-').map(Number);
    const monthsDiff = (ny - year) * 12 + (nm - month);
    assert(
      monthsDiff === 0 || monthsDiff === 1,
      `nextDate (${nextDate}) is ${monthsDiff} months ahead of today (${todayYmd})`
    );
    assert.equal(nd, collectionDay);
  }
});

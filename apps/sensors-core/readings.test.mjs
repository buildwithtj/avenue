import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyReading, readingKey, newReadings } from './readings.mjs';

const CONFIG = {
  minF: 33,
  maxF: 40,
  staleAfterMinutes: 30
};
const NOW = '2026-11-13T12:00:00.000Z';

test('values exactly at min and max are normal', () => {
  const atMin = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:50:00.000Z',
    value: 33,
    unit: 'F'
  };
  assert.equal(classifyReading(atMin, CONFIG, NOW), 'normal');

  const atMax = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:50:00.000Z',
    value: 40,
    unit: 'F'
  };
  assert.equal(classifyReading(atMax, CONFIG, NOW), 'normal');

  const belowMin = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:50:00.000Z',
    value: 32.9,
    unit: 'F'
  };
  assert.equal(classifyReading(belowMin, CONFIG, NOW), 'out-of-range');

  const aboveMax = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:50:00.000Z',
    value: 40.1,
    unit: 'F'
  };
  assert.equal(classifyReading(aboveMax, CONFIG, NOW), 'out-of-range');
});

test('handles Celsius and Fahrenheit conversion', () => {
  // 35 F config: 0 C = 32 F (out of range, < 33)
  const zeroC = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:50:00.000Z',
    value: 0,
    unit: 'C'
  };
  assert.equal(classifyReading(zeroC, CONFIG, NOW), 'out-of-range');

  // 2 C = 35.6 F (within [33, 40]) -> normal
  const twoC = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:50:00.000Z',
    value: 2,
    unit: 'C'
  };
  assert.equal(classifyReading(twoC, CONFIG, NOW), 'normal');

  // 5 C = 41 F (> 40) -> out-of-range
  const fiveC = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:50:00.000Z',
    value: 5,
    unit: 'C'
  };
  assert.equal(classifyReading(fiveC, CONFIG, NOW), 'out-of-range');
});

test('stale boundary check', () => {
  // Exactly 30 minutes old (11:30:00 vs 12:00:00) -> age is exactly 30 mins, NOT older than 30 mins -> normal
  const exactlyBoundary = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:30:00.000Z',
    value: 35,
    unit: 'F'
  };
  assert.equal(classifyReading(exactlyBoundary, CONFIG, NOW), 'normal');

  // 30 minutes and 1 millisecond old -> older than 30 mins -> stale
  const justStale = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:29:59.999Z',
    value: 35,
    unit: 'F'
  };
  assert.equal(classifyReading(justStale, CONFIG, NOW), 'stale');

  // Out-of-range reading that is also stale must return stale (stale beats out-of-range)
  const outOfRangeStale = {
    sensorId: 's1',
    timestamp: '2026-11-13T11:00:00.000Z',
    value: 99,
    unit: 'F'
  };
  assert.equal(classifyReading(outOfRangeStale, CONFIG, NOW), 'stale');
});

test('future timestamp check', () => {
  // 4 minutes in the future -> allowed, normal
  const fourMinFuture = {
    sensorId: 's1',
    timestamp: '2026-11-13T12:04:00.000Z',
    value: 35,
    unit: 'F'
  };
  assert.equal(classifyReading(fourMinFuture, CONFIG, NOW), 'normal');

  // 5 minutes in the future (boundary) -> allowed, normal
  const fiveMinFuture = {
    sensorId: 's1',
    timestamp: '2026-11-13T12:05:00.000Z',
    value: 35,
    unit: 'F'
  };
  assert.equal(classifyReading(fiveMinFuture, CONFIG, NOW), 'normal');

  // 5 minutes and 1 ms in the future -> invalid
  const overFiveMinFuture = {
    sensorId: 's1',
    timestamp: '2026-11-13T12:05:00.001Z',
    value: 35,
    unit: 'F'
  };
  assert.equal(classifyReading(overFiveMinFuture, CONFIG, NOW), 'invalid');
});

test('invalid readings: bad unit, non-numeric value, unparsable timestamp', () => {
  assert.equal(
    classifyReading({ sensorId: 's1', timestamp: NOW, value: 35, unit: 'K' }, CONFIG, NOW),
    'invalid'
  );
  assert.equal(
    classifyReading({ sensorId: 's1', timestamp: NOW, value: '35', unit: 'F' }, CONFIG, NOW),
    'invalid'
  );
  assert.equal(
    classifyReading({ sensorId: 's1', timestamp: NOW, value: NaN, unit: 'F' }, CONFIG, NOW),
    'invalid'
  );
  assert.equal(
    classifyReading({ sensorId: 's1', timestamp: 'not-a-date', value: 35, unit: 'F' }, CONFIG, NOW),
    'invalid'
  );
  assert.equal(classifyReading(null, CONFIG, NOW), 'invalid');
});

test('missing or non-finite config values throw', () => {
  assert.throws(() => classifyReading({ sensorId: 's1' }, null, NOW), /config is required/);
  assert.throws(
    () => classifyReading({ sensorId: 's1' }, { maxF: 40, staleAfterMinutes: 30 }, NOW),
    /config.minF is required/
  );
  assert.throws(
    () => classifyReading({ sensorId: 's1' }, { minF: 33, staleAfterMinutes: 30 }, NOW),
    /config.maxF is required/
  );
  assert.throws(
    () => classifyReading({ sensorId: 's1' }, { minF: 33, maxF: 40 }, NOW),
    /config.staleAfterMinutes is required/
  );
  assert.throws(
    () => classifyReading({ sensorId: 's1' }, { minF: NaN, maxF: 40, staleAfterMinutes: 30 }, NOW),
    /config.minF is required and must be a finite number/
  );
});

test('readingKey generates sensorId|timestamp', () => {
  const r = { sensorId: 'sen-42', timestamp: '2026-11-13T12:00:00Z' };
  assert.equal(readingKey(r), 'sen-42|2026-11-13T12:00:00Z');
});

test('newReadings filters existing, deduplicates in batch, and sorts deterministically', () => {
  const existing = new Set(['s1|2026-11-13T10:00:00Z']);
  const incoming = [
    { sensorId: 's1', timestamp: '2026-11-13T10:00:00Z', value: 35 }, // already exists
    { sensorId: 's2', timestamp: '2026-11-13T10:05:00Z', value: 36 },
    { sensorId: 's1', timestamp: '2026-11-13T10:05:00Z', value: 37 },
    { sensorId: 's2', timestamp: '2026-11-13T10:05:00Z', value: 36 } // duplicate within batch
  ];

  const result = newReadings(existing, incoming);
  assert.equal(result.length, 2);
  // Sorted by timestamp then sensorId:
  assert.equal(result[0].sensorId, 's1');
  assert.equal(result[0].timestamp, '2026-11-13T10:05:00Z');
  assert.equal(result[1].sensorId, 's2');
  assert.equal(result[1].timestamp, '2026-11-13T10:05:00Z');
});

test('newReadings on empty batch returns empty array', () => {
  assert.deepEqual(newReadings([], []), []);
  assert.deepEqual(newReadings(null, null), []);
});

test('hardening M3: a reading is never "normal" or "out-of-range" if its age exceeds staleAfterMinutes (500 cases)', () => {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(5551212);
  const nowMs = Date.parse(NOW);

  for (let i = 0; i < 500; i++) {
    const staleAfterMinutes = Math.floor(rng() * 120) + 1; // 1 to 120 mins
    const config = {
      minF: 32,
      maxF: 45,
      staleAfterMinutes
    };

    // Generate an age strictly greater than staleAfterMinutes
    // From (staleAfterMinutes + 0.1) to (staleAfterMinutes + 1000) minutes
    const extraMinutes = rng() * 1000 + 0.1;
    const totalAgeMinutes = staleAfterMinutes + extraMinutes;
    const readingTimeMs = nowMs - totalAgeMinutes * 60 * 1000;
    const timestamp = new Date(readingTimeMs).toISOString();

    const reading = {
      sensorId: `sensor-${i}`,
      timestamp,
      value: rng() * 100, // random value
      unit: rng() > 0.5 ? 'F' : 'C'
    };

    const outcome = classifyReading(reading, config, NOW);
    assert(
      outcome !== 'normal' && outcome !== 'out-of-range',
      `Age ${totalAgeMinutes} min exceeds staleAfterMinutes ${staleAfterMinutes} min, but returned ${outcome}`
    );
    assert.equal(outcome, 'stale');
  }
});

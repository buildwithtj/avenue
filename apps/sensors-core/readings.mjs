// Sensor reading classification and ingestion helpers for Swift Sensors
// Pure functions: no API calls, no network, no clock reading.
// Note on Swift Sensors API and thresholds:
// As per docs/REQUIREMENTS.md SEN-01..04 and docs/DECISIONS_AND_OPEN_QUESTIONS.md row Q-12,
// the Swift Sensors API shape, unit thresholds, cadence, freshness limit, and retention
// are currently OPEN decisions. Config values are therefore strictly REQUIRED with no defaults.

/**
 * Classifies a sensor reading against facility thresholds and freshness configuration.
 *
 * @param {Object} reading - {sensorId, timestamp (ISO), value, unit ("F"|"C")}
 * @param {Object} config - {minF, maxF, staleAfterMinutes}
 * @param {string} nowIso - Current UTC ISO timestamp
 * @returns {"normal" | "out-of-range" | "stale" | "invalid"}
 */
export function classifyReading(reading, config, nowIso) {
  if (!config || typeof config !== "object") {
    throw new Error("config is required");
  }

  const { minF, maxF, staleAfterMinutes } = config;

  if (typeof minF !== "number" || !Number.isFinite(minF)) {
    throw new Error("config.minF is required and must be a finite number");
  }
  if (typeof maxF !== "number" || !Number.isFinite(maxF)) {
    throw new Error("config.maxF is required and must be a finite number");
  }
  if (typeof staleAfterMinutes !== "number" || !Number.isFinite(staleAfterMinutes)) {
    throw new Error("config.staleAfterMinutes is required and must be a finite number");
  }

  if (typeof nowIso !== "string") {
    throw new Error("nowIso must be an ISO string");
  }
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    throw new Error("nowIso must be a valid parsable ISO date string");
  }

  if (!reading || typeof reading !== "object") {
    return "invalid";
  }

  const { timestamp, value, unit } = reading;

  if (typeof timestamp !== "string") {
    return "invalid";
  }
  const readingMs = Date.parse(timestamp);
  if (Number.isNaN(readingMs)) {
    return "invalid";
  }

  // Future timestamp check: more than 5 minutes in the future => invalid
  const fiveMinutesMs = 5 * 60 * 1000;
  if (readingMs - nowMs > fiveMinutesMs) {
    return "invalid";
  }

  // Value check: must be a numeric finite value
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "invalid";
  }

  // Unit check: "F" or "C"
  if (unit !== "F" && unit !== "C") {
    return "invalid";
  }

  // Stale check: older than staleAfterMinutes => stale
  // Stale beats normal and out-of-range (a stale reading is never shown as current)
  const ageMs = nowMs - readingMs;
  const staleThresholdMs = staleAfterMinutes * 60 * 1000;
  if (ageMs > staleThresholdMs) {
    return "stale";
  }

  // Convert C to F before comparing
  let valF = value;
  if (unit === "C") {
    valF = (value * 9) / 5 + 32;
  }

  // Compare against minF and maxF
  if (valF >= minF && valF <= maxF) {
    return "normal";
  }

  return "out-of-range";
}

/**
 * Generates an idempotent deduplication key for a reading.
 *
 * @param {Object} reading - {sensorId, timestamp}
 * @returns {string} `${sensorId}|${timestamp}`
 */
export function readingKey(reading) {
  if (!reading || typeof reading !== "object") {
    throw new Error("reading is required");
  }
  return `${reading.sensorId}|${reading.timestamp}`;
}

/**
 * Filters incoming readings against existing keys, deduplicates within the batch,
 * and sorts deterministically by timestamp, then sensorId.
 *
 * @param {Set<string>|Array<string>} existingKeys
 * @param {Array<Object>} incoming
 * @returns {Array<Object>}
 */
export function newReadings(existingKeys, incoming) {
  if (!Array.isArray(incoming)) {
    return [];
  }

  const keySet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys || []);
  const seenInBatch = new Set();
  const result = [];

  for (const reading of incoming) {
    if (!reading || typeof reading !== "object") continue;
    const key = readingKey(reading);
    if (keySet.has(key) || seenInBatch.has(key)) {
      continue;
    }
    seenInBatch.add(key);
    result.push(reading);
  }

  result.sort((a, b) => {
    const tsA = String(a.timestamp);
    const tsB = String(b.timestamp);
    if (tsA < tsB) return -1;
    if (tsA > tsB) return 1;
    const idA = String(a.sensorId);
    const idB = String(b.sensorId);
    if (idA < idB) return -1;
    if (idA > idB) return 1;
    return 0;
  });

  return result;
}

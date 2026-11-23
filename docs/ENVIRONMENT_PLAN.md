# Environment module (temperature sensors): plan

Status: **plan only, not built** (21 Nov 2026). It is the next module after onboarding and payments. "Environment / temperature / sensors API" means the **Swift Sensors** API that Flavors already uses (SEN-01..04). Everything here is `[PROPOSED]` unless it cites a confirmed requirement. The open questions are in section 8.

## 1. What is confirmed
- SEN-01: show the latest fridge and freezer temperature for each unit, Normal or Out of range. A stale reading is never shown as current.
- SEN-02: keep a history of readings as a compliance record. How long to keep it is open (Q-14).
- SEN-03: **Swift Sensors stays the real-time alarm.** Avenue does not copy its alerts. Avenue shows status and keeps the record only.
- SEN-04: the client's e-mail gives a limit of 100,000 API calls a month. Only Flavors has sensors.
- Client sheet, "Temperature Sensors" tab: 9 sensors, all model SS3-102.

| Swift id | Unit (sheet name) | Type | Room | Safe range °F |
|---|---|---|---|---|
| A00L4N | Complimentary Refrigerator 1 | Reach-in fridge | Sink Room | 36–40 |
| A00JY1 | Complimentary Refrigerator 1 (**same name twice**) | Reach-in fridge | Sink Room | 36–40 |
| A00JJL | Double Door Refrigerator #1 | Reach-in fridge | Storage Room | 36–40 |
| A00JN6 | Double Door Refrigerator #2 | Reach-in fridge | Storage Room | 36–40 |
| A00JP7 | Half Door Refrigerator Unit | Reach-in fridge | Storage Room | 36–40 |
| A00JPK | Double Door Freezer #1 | Freezer | Storage Room | −8–0 |
| A00JQ4 | Double Door Freezer #2 | Freezer | Storage Room | −8–0 |
| A00JRF | Half Door Freezer Unit | Freezer | Storage Room | −8–0 |
| (9th row) | to confirm: the sheet lists 9 sensors, 8 rows are readable here | | | |

## 2. Research
| Topic | Finding | Source |
|---|---|---|
| Swift Sensors API (**verified 23 Nov 2026** against the public docs) | Base `https://api.swiftsensors.net/api/client/v1`. Every call has header `X-API-Key`. Sign in with `POST /sign-in` `{email, password, language: null}` → `{access_token, expires_in 86400, token_type, refresh_token, account_id}`. Every other call also has `Authorization: {token_type} {access_token}` and lives under `/accounts/{account_id}/` (a 403 means the token expired). `GET /accounts/{id}/treemap` returns every node of the account tree; sensor nodes are `s_<number>` with `profileName, unitId, value, precision, time (epoch seconds), thresholdStatus, parent` (device nodes `d_` carry `name, hwId, batteryLevel`, collectors `c_`). `POST /accounts/{id}/time-series/sensor` `{timeUnitDesignation: "seconds", startTime, endTime, influxFn: null, ids: [numeric sensor ids], type: "samples"}` returns `timeSeriesData: [{id, samples: [[time, value]]}]` (one unknown id makes the whole call a 404). Unit ids: 1 Fahrenheit, 2 Celsius, 3 Kelvin; other ids are other properties and are ignored. | [Swift API docs](https://my.swiftsensors.net/api-docs), [R-13](RESEARCH_LOG.md) |
| Swift errors | Wrong login is HTTP 400 `{error: 1123}`; 1122 = locked out after too many failed logins; 1176 / 1169 = two-factor problems (a user with **API Access**, set by an account administrator, is exempt from two-factor, so the integration login should have it). API-key errors: 9997 mismatch, 9998 quota exceeded, 9999 invalid key. The host stops signing in for an hour after any failed sign-in, so a wrong password cannot lock the user out. | same |
| **Still unverified** (check with `swiftdiscover.mjs` on the first real run) | (a) Whether the treemap `value` is in the unit named by `unitId` (the display unit) or in the stored unit; the docs call it the stored type. `SWIFT_VALUE_UNIT=F` or `C` overrides. (b) Where the code printed on the sheet (`SS3-102 (A00L4N)` → `A00L4N`) appears in the tree: the host looks for it as a whole word in the sensor's or its device's name, description or hwId (hwId also with the separators removed), and only if none matches, in the collector's name or hwId; with several matches the newest reading wins. Units not found are listed in `/api/health` as `sensorsNotFound`, not treated as an error. | — |
| Quota | Not published. The 100,000 a month figure is from the client and must be checked in Swift's private documentation. | R-13, L-27 |
| Food safety | FDA Food Code cold holding is 41 °F or below. Freezers are kept at 0 °F or below (guidance, not code text). Readings of 40–41 °F are a sign the unit needs maintenance. The sheet's ranges (36–40, −8–0) are inside these limits. How long logs must be kept is set by the local health authority (UNKNOWN). | [FDA Food Code](https://fda.gov/media/164194/download), [Concord NH log](https://www.concordnh.gov/DocumentCenter/View/19445/Temp-Log), [Logan Health guide](https://www.loganhealthohio.gov/s/FoodTemperatureGuide.pdf) |
| How other products do it | Monitoring products (Swift, SensorPush, ThingsBoard) show the current value per unit with a colour state and a "last seen" time. A history chart shows a min/max band. Excursions are logged with start, end, peak and a corrective-action note, and inspectors get a daily log export. | [SensorPush API](https://www.sensorpush.com/api-information), [ThingsBoard REST](https://thingsboard.io/docs/pe/reference/rest-api) |

## 3. Architecture
The same rule as payments: **the AWS host is the only place the Swift credentials live.** It writes to SharePoint through the existing bridge flow "Avenue - Host inbound" (MODULES_PLAN §11.2), so no new Microsoft permission is needed.

```
Swift Sensors API ──(every 10 min, 1 treemap call)──▶ AWS host
                                                      │ raw readings → SQLite (90 days)
                                                      │ classify (apps/sensors-core)
                                                      ▼
                       bridge flow ──▶ SharePoint: latest (9 rows), hourly summary, excursions
                                                      ▼
                       Staff app Environment screen · Dashboard counter · Power BI (B Street)
```

**Why not write every reading to SharePoint:** 9 sensors every 10 minutes is about 473,000 rows a year. That is too many for list views and Power Apps delegation. SharePoint gets instead:
- the latest reading per unit (9 rows, updated in place);
- one **hourly summary** per unit (min, max, average, count): about 79,000 rows a year, which is fine with indexes;
- every **excursion**, as its own record.

The raw readings stay on the host for 90 days. The full history can always be fetched again from Swift.

## 4. Data [PROPOSED]
| List | Access | Fields |
|---|---|---|
| `AvenueSensors` | private (staff) | FacilityId, SensorId (Swift id, unique), Model, UnitName, UnitType (Fridge / Freezer), Room, MinF, MaxF, EquipmentId (link to `AvenueEquipment` for the reach-in fridges), Active |
| `AvenueSensorLatest` | private | SensorId (unique), ReadAt, ValueF, State (Normal / OutOfRange / Stale / Offline), Battery, Signal (if the treemap gives them), UpdatedAt |
| `AvenueSensorHourly` | private | Key `<SensorId>-<yyyy-mm-ddThh>` (unique), SensorId (indexed), HourUtc (indexed), MinF, MaxF, AvgF, Count, OutOfRangeCount |
| `AvenueTempExcursions` | private | ExcursionId, SensorId, StartedAt, EndedAt, PeakF, Minutes, State (Open / Closed / Acknowledged), AcknowledgedBy, AcknowledgedAt, CorrectiveAction (Note) |

The `AvenueSensors` rows are loaded from the sheet by a browser script, the same way as plans and equipment. Thresholds live in this list, so the owner can change them in the staff app without a code change.

## 5. Host work (`apps/integration-host` + `apps/sensors-core`)
1. `swiftClient.mjs`: sign in (API key + e-mail + password from the server's environment file; see section 2 for the verified API). Cache the token for 23 hours. On a 403, sign in again once. After **any failed sign-in (4xx) stop signing in for 60 minutes** so a wrong password cannot lock the user out. On a 429 or 5xx, back off and retry once, then give up until the next run. Errors show only the status and Swift's numeric error code (for example `swift: sign-in returned 400 (error 1123)`), never the key, the login, the token or a response body. `swiftdiscover.mjs` prints the real tree and the code mapping for the first run.
2. `sensorJob.mjs`, run in-process every 10 minutes behind a lock:
   1. Make one treemap call.
   2. Map each configured unit code (e.g. `A00L4N`) onto a temperature sensor of the tree as described in section 2, **by code, never by display name**, because two units share a name.
   3. Convert to °F by the unit (°C and Kelvin are converted; `SWIFT_VALUE_UNIT` overrides).
   4. Classify with `sensors-core` (thresholds read from `AvenueSensors` and cached for 1 hour).
   5. Store the raw rows in SQLite, skipping duplicates by sensor and time.
   6. Update `AvenueSensorLatest`.
   7. Once an hour, upsert the previous hour's summary rows.
   8. Run the excursion state machine (below).
3. **Excursion rule [PROPOSED]:** an excursion opens after **2 readings in a row** (about 20 minutes) outside the range. This avoids door-open blips. It closes after 2 readings in a row back inside the range. Its peak and length are recorded. A sensor with no reading for 30 minutes is **Stale**, and after 2 hours it is **Offline**. These are status only, never alarms (SEN-03).
4. **Backfill:** when the host restarts after a gap, one time-series call fetches up to 24 hours for all sensors, so the hourly record has no holes.
5. **Health:** `/api/health` adds `lastSensorSyncAt`, `sensorsReporting` and `callsThisMonth`. The job stops itself when it reaches 80% of the monthly budget.
6. **Call budget:** a 10-minute cadence uses about 4,464 treemap calls a month, plus about 31 sign-ins and a few backfills. That is under 5% of the 100,000 limit.

## 6. Staff UI (Power Apps, Screen14 "Sensors" becomes "Environment")
- **Unit tiles** grouped by room (Sink Room, Storage Room). Each tile shows:
  - the unit name and a large temperature;
  - a horizontal range bar with a marker for where the reading sits between min and max;
  - a state pill: green Normal, red Out of range, grey Stale or Offline;
  - "Updated 4 min ago".
- **Tile motion:** tiles fade in with a short stagger. A tile that changes to Out of range pulses its border once (no repeating animation).
- **Unit detail:** tap a tile to see a 24-hour chart (hourly min/max band with an average line, safe range shaded), a 7-day view, and that unit's excursions.
- **Excursions tab:** a list of open and recent excursions. Staff press **Acknowledge** and add a corrective-action note, for example "Door left open, product checked at 39 °F". This builds the inspection record.
- **Daily log:** pick a date, see each unit's min and max per hour in a table, then **Export CSV** for the health inspector.
- **Settings:** the owner can edit each unit's name, range and active flag (`AvenueSensors`).
- **Dashboard counter:** "2 units out of range · 1 stale" opens the Environment screen.
- **Members:** no access in Phase 1 (privacy and scope). Later, a storage renter could see their own unit (Q-25).
- **B Street:** Power BI reads `AvenueSensorHourly` and `AvenueTempExcursions` (RPT-03).

## 7. Edge cases to test
- Two units with the same name.
- A °C reading.
- A missing or malformed reading.
- A reading timestamp in the future.
- A token that expires mid-run, then a 401 retry.
- A 429 response.
- A Swift outage, then backfill.
- A host restart in the middle of the hourly summary (the upsert must be idempotent).
- A sensor removed from Swift.
- Thresholds edited while an excursion is open.
- An excursion that spans midnight.
- Daylight saving time: all times are stored in UTC and shown in the facility's time zone.
- The quota cut-off at 80%.
- Stale beats Normal: a stale reading never shows as current.

## 8. Questions for the client
- **Q-E1** Two sensors are both named "Complimentary Refrigerator 1" (A00L4N, A00JY1). What should each be called? Also confirm the 9th sensor's id and name.
- **Q-E2** How long to keep the record. [PROPOSED] hourly summaries and excursions for 2 years, raw readings 90 days on the host. Does the county require longer? (ties to Q-14)
- **Q-E3** How often to read. [PROPOSED] every 10 minutes.
- **Q-E4** Excursion rule. [PROPOSED] 2 readings in a row out of range. Who acknowledges excursions: the owner only, or staff too?
- **Q-E5** Should members who use or rent a fridge see its temperature?
- **Q-E6** The Swift API key that was exposed in the 6 Nov e-mail must be **reissued**. Who holds the Swift user for API sign-in? Please send Swift's private API documentation and quota terms.

## 9. Build steps and estimate (after Q-E1 and Q-E6)
| # | Work | Estimate |
|---|---|---|
| 1 | Lists and the sensor load script from the sheet; bridge flow allows the new lists | 0.5 d |
| 2 | `swiftClient.mjs` and `sensorJob.mjs` (classify, raw store, latest, hourly, excursions, backfill, budget) with tests using recorded fake responses | 1.5 d |
| 3 | Staff Environment screen (tiles, detail chart, excursions, daily log export, settings) and the dashboard counter | 1.5 d |
| 4 | Live run against the real sensors for 24 hours; check the hourly rows and one forced excursion (threshold lowered temporarily on one unit, then restored) | 0.5 d |
| 5 | Docs, Power BI dataset fields for B Street | 0.5 d |

Prerequisites: the reissued Swift key, the Swift sign-in, and the private API documentation, all placed in `/etc/avenue/host.env` by the developer (never sent in chat). The bridge flows from the payments build must be live first.

## 12. Findings from the first real Swift run (23 Nov 2026)
- **Q-E7** Swift's last reading for every unit is 22 Jun 2026 about 13:40 UTC (collectors SG3-1010 (4N9Q) and (2G6E); batteries 34-100%). Are the collectors powered and online? Until they report, all 8 units show Offline.
- Readings arrive in Celsius although Swift labels them Fahrenheit (`SWIFT_VALUE_UNIT=C`). Reading the old values with the sheet's names: A00JPK 'Double Door Freezer #1' 38 F and A00JQ4 'Double Door Freezer #2' 35.8 F look like fridge temperatures; A00JP7 'Half Door Refrigerator Unit' 73.1 F and A00L4N 'Complimentary Refrigerator 1 (Sink Room)' 72.8 F look like room temperature (probe outside the unit?). Confirm which probe sits in which unit before the ranges are trusted.

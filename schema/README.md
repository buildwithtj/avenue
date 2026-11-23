# Proposed shared calendar read model

This is a contract for a test spike, not a provisioned or approved production schema. The SPFx reader expects these lists in the current SharePoint web, with these internal field names. Validate field types, REST queries, indexes, list thresholds, grants and lifecycle in a test tenant before deployment. `Title` is the built-in text field. Values below are examples of field types to validate, not provisioning instructions.

> **Model change, 2026-11-11.** The 11 Nov client call replaced stations with **equipment**, and bookings now start as **pending** until management approves them ([call notes](../docs/meetings/2026-11-11-client-call.md)). The tables below are the starter's original contract (resources, calendar of confirmed bookings). They stay valid for the read path. The extended contract below is the proposed design for day 2 and is not provisioned or approved.

## Proposed v2 lists (day 2, not provisioned)

| List | Key fields | Notes |
|---|---|---|
| AvenueEquipment | FacilityId, EquipmentId, Title, Kind (equipment / prep table), Active | The bookable catalog. Equipment list awaited from the client (Q-04). |
| AvenueDiningTables | FacilityId, TableId, Seats, Active | Dining room tables and chair counts awaited (Q-04, Q-22). |
| AvenueBookings | FacilityId, BookingId, MemberId, StartUtc, EndUtc, Space (kitchen / dining / whole facility), EquipmentIds, PeopleCount, Status (Pending / Approved / Declined / Cancelled / No-show credited), OverlapNote, RequestedAt, DecidedBy, DecidedAt | Private to the member and staff. Written through a trusted path, never directly by members. |
| AvenueCalendar | as the starter contract, plus Space | Shared projection of **approved** bookings only. |
| AvenueHoursLedger | FacilityId, MemberId, BookingId, Period (month), Hours (+/−), Reason (used / credit back / overage), ChargeKey | Append-only. Overage lines feed the next invoice. |
| AvenuePlans | FacilityId, PlanId, Title, MonthlyHours, ExtraHourRate, Active | Values awaited (Q-04). Base plan 10 hours, no rollover. |

Machine-readable definitions are in `lists.v2.json`; `node schema/check.mjs` validates them offline and `schema/provision.mjs` creates them on a test site (see [DAY2_RUNBOOK.md](../docs/DAY2_RUNBOOK.md)). Not yet run against a tenant.

Equipment never counts against hours; only time in the facility does.

## Starter read contract

| List | Fields expected by reader | Intended data |
|---|---|---|
| AvenueFacilities | FacilityId (text), Title (text), TimeZone (text, IANA zone) | Exactly one row per facility. |
| AvenueResources | FacilityId, ResourceId, Title, Kind (text); Active (yes/no) | Active shared booking catalog. |
| AvenueCalendar | FacilityId, BookingId, ResourceId, EquipmentIds, MemberDisplayName (text); StartUtc, EndUtc (date/time) | Shared projection of confirmed bookings. EquipmentIds is semicolon-separated; times are UTC instants. |

The code does not filter by booking status: a trusted process must publish only appropriate confirmed entries, and remove or update them when their state changes. That process does not yet exist. Do not enter balances, contact details, compliance, wellness, or other private information into these lists. SharePoint permissions on the site, lists and items are the actual security boundary; a facility filter or client-side field selection cannot protect list data from direct requests. Do not grant members access to a list containing another facility's restricted information. The member-access model and safe publishing process remain unverified.

Use synthetic records in a dedicated test site. Before any real use, prove access with a test guest and unrelated identity, including direct REST and item URLs; verify staff write rights and that members cannot modify authoritative state. Review indexing and query behavior with realistic volume. Do not create production lists or infer booking availability from this read-only projection.

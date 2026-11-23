# Data and access

Owner of: entities, relationships, permissions, invariants, unresolved schema/security decisions. **Field-level truth is `schema/lists.v2.json`** (37 lists, 367 fields, checked by `node schema/check.mjs`); this file explains it and does not copy it. Requirements: PLT-06..09, PLT-13 in [REQUIREMENTS.md](REQUIREMENTS.md). Provisioning and release steps: [DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md).

## 1. As built on the live site (read back 13 Nov 2026)

SharePoint has no column-level security and no multi-item transactions, so each protection is a **list or item permission**, and each authoritative write goes through a flow running as the service account. Inheritance is broken on every list; site owners and `automations@` keep Full Control so the site stays administrable.

| Access class | Lists | Avenue Members | Flavors Staff | Flavors Owner |
|---|---|---|---|---|
| catalog | Facilities, Equipment, DiningTables, Plans, ChecklistQuestions, Notices, RequiredDocTypes | Read | Contribute | Contribute |
| calendar | Calendar (only the PLT-08 fields) | Read | Read | Read |
| private | Members, Bookings, HoursLedger, MemberDocuments, CheckIns, DocumentFiles (library), MyMembership, NoticeDrafts | none | Contribute | Contribute |
| ownerWrite | ComplianceOverrides | none | Read | Contribute |
| private (cases and holds) | ComplianceCases | none | Contribute | Contribute |
| intake (own items only: read and edit your own) | BookingRequests, DocumentSubmissions, CheckInSubmissions, ComplianceFlags, HostRequests | Contribute | Contribute | Contribute |
| private (payments and joining, [PROPOSED] 21 Nov, not yet on the live site) | Applicants, Invoices | none (Invoices: each row shared read with its own member by the bridge flow, like MyMembership) | Contribute | Contribute |
| private (environment, [PROPOSED] 23 Nov, not yet on the live site) | Sensors, SensorLatest, SensorHourly, TempExcursions | none | Contribute | Contribute |
| intake (own items only; [PROPOSED] 23 Nov, built in the schema only, not on the live site, no flow exists yet) | SupportMessages, EventRequests, StorageRequests, TeamMembers | Contribute | Contribute | Contribute |
| private (support, events, storage cases; [PROPOSED] 23 Nov, not on the live site) | SupportCases, EventCases, StorageCases | none | Contribute | Contribute |
| ownerWrite ([PROPOSED] 23 Nov, not on the live site) | StaffCapabilities | none | Read | Contribute |

Owner was reduced from Edit to Contribute on 13 Nov so the owner cannot delete columns or lists the flows rely on (audit gap, SOP-10). **"Owner-only override" is enforced by list permission on `AvenueComplianceOverrides` and not yet tested with an owner or staff account.**

## 2. Invariants (must hold; test them)

1. A member never writes authoritative state. Members write only to intake lists; flows write `AvenueBookings`, ledgers, check-ins and documents.
2. Member identity comes from the intake item's **author**, never from a submitted field. Only a staff/owner/site-owner author may set `OnBehalfOf`.
3. `AvenueMyMembership` rows are readable only by their member through item-level sharing; deactivation deletes the row (fail closed).
4. Notices readable by members live only in `AvenueNotices`; drafts and withdrawn notices sit in staff-only `AvenueNoticeDrafts`.
5. `Outcome` on intake items is display-only; no flow reads it back.
6. A booking is blocked by an **unrenewed** expired document (`SupersededBy` empty), an inactive membership, an unknown equipment id, or an overlapping approved private event. Only an active owner override lifts the document block.
7. Check-in `AllPassed` is computed in the flow from `Answers` against active questions ([PROPOSED] rule: all Yes = pass).
8. Hours ledger rows are append-only with unique `EntryId` and `ChargeKey`; the month (`Period`) is the **facility (Eastern)** month.
9. `AvenueApplicants` and `AvenueInvoices` are written only by the integration host through the flow "Avenue - Host inbound"; staff change only applicant Stage/decision fields. `AvenueHostRequests` items are forwarded by "Avenue - Host requests" with the item author and a staff-group check; the host refuses staff-only kinds (AccountLink, EventInvoice, CancelSubscription) when the author is not staff. `Outcome` and `Link` are display only.
10. Never delete members; deactivate. Never bulk-delete test data; recycle explicit ids.
11. The four sensor lists (`AvenueSensors`, `AvenueSensorLatest`, `AvenueSensorHourly`, `AvenueTempExcursions`) are written by the integration host through four narrow flows (`SP_BRIDGE_SENSORS`, `_SENSOR_LATEST`, `_SENSOR_HOURLY`, `_EXCURSIONS`); staff edit `AvenueSensors` ranges and acknowledge excursions. Members have no access. Swift credentials exist only in the host environment. Readings are status only, never an alarm (SEN-03).
12. [PROPOSED, not built live] Support, events and storage follow the compliance-flag pattern: members write only `AvenueSupportMessages`, `AvenueEventRequests`, `AvenueStorageRequests` (own items; `Outcome` and `Reply` display only, never read back). Six specified flows (`flows/expressions.md`, "Specified, not built") copy each item to its private case list (`AvenueSupportCases`, `AvenueEventCases`, `AvenueStorageCases`) and echo the staff decision. The `MessageId`/`RequestId` columns on intake lists are **not unique** (SharePoint refuses unique fields on own-items-only lists, so the flow de-duplicates by `CaseId`, which is unique on the private list). `AvenueTeamMembers` is a member's own roster for the wellness check; it is a convenience, never an access list. Event approval creates money only through the existing staff-only host request `EventInvoice`; storage and support create nothing in Stripe.
13. [PROPOSED, not built live] `AvenueStaffCapabilities` (owner writes, staff read) records what each staff e-mail may do. The staff app hides controls from it; **that is not enforcement**. Enforcement needs a flow or list-permission check per capability, which is not built (Q-15).

## 3. Unresolved schema and security decisions

| Topic | State |
|---|---|
| Member key | `MemberId` is the author e-mail. Guests may appear as `name_domain#ext#@tenant`; whether that equals the stored e-mail is **untested**. Switch to the Entra object id is [PROPOSED] (C-06). |
| Team member (worker) identity | No model (Q-10). Do not treat every worker as the business owner. |
| Guest access to intake and private-item sharing | Unverified (L-22); needs an admin and test guests. |
| Retention, deletion, recovery | Open (Q-14). |
| Required document types, override duration | Open (Q-11); `AvenueRequiredDocTypes` is empty on purpose. |
| Member-visible financial mirrors | Not designed beyond the logical model below; depends on Stripe (Q-01, Q-02). |
| Scale | Lookups use indexed columns; the daily document check reads the whole list (5,000 cap). |

## 4. Logical model [PROPOSED]

Original proposal, kept as the design reference for parts not yet built (Stripe references, usage ledger, sensors, audit):

| Logical entity | Main references / state | Access boundary |
|---|---|---|
| Facility/configuration | FacilityId, timezone, operating hours, settings | HQ + permitted facility admins; safe public subset for booking. |
| Business membership | MemberId, FacilityId, plan, payment/onboarding/eligibility states | Own business + permitted facility/HQ roles. |
| Identity/role assignments | Entra subject, MemberId or FacilityId, role, capabilities | Trusted administrators; not self-editable. |
| Team identity | WorkerId, business owner link, permissions | Model unresolved; separate worker identity from membership ownership. |
| Plans/resources | Included hours, overage rates, station/equipment capacities | Owner config; readable safe booking catalog. |
| Bookings/reservations | BookingId, resource IDs, UTC start/end, state/version | Own booking actions; limited shared calendar projection. |
| Availability/commit control | Resource/time claims and idempotency/version keys | Trusted authoritative mutation service; strategy to be proven. |
| Checklist definition/submission | Definition version, booking/person, answers, failures | Private scoped access; wellness restricted to approved recipients. |
| Compliance document metadata/files | MemberId, type, review status, expiry, version | Private library with explicit grants and audited review. |
| Client Stripe connection | FacilityId, connected account ID, readiness | Trusted integration/admin; no client secrets/bank details. |
| Member billing references | Stripe customer/subscription IDs + account scope | Private integration state; IDs must include connected-account context. |
| Usage/adjustment ledger | Booking/source ID, units, rate, policy version, invoice linkage | Append/audit controlled; user cannot edit paid/charge status. |
| Invoice/payment mirrors | Stripe IDs, status, amounts, dates, history links | Own member + permitted financial roles; source is Stripe. |
| Webhook/reminder processing | Event/job ID, version, attempts, dedup state, errors | Service-only/operational support; avoid sensitive payload dumps. |
| Sensor/unit mapping and readings | Source sensor ID, facility unit, timestamp, value, unit | Facility-scoped; retention and indexes required. |
| Notices/delivery audience | Publication state, audience, delivery status | Staff authoring; authorized recipients only. |
| Support/audit/override | Actor, target, reason, original/new state, timestamps | Appropriate facility/HQ scope; sensitive audit restricted. |

Use stable internal IDs; do not use display names as authorization. Email columns may help lookup/delegation but should not be the only identity boundary. Never add QuickBooks customer/invoice fields as required integration dependencies.

Dates: UTC instants for bookings and events; explicit facility timezone for display/cutoffs. Document expiry is typically a local date and requires an agreed end-of-day interpretation. Currency precision, tax and invoice rounding need an explicit policy.

SharePoint Lists do not provide arbitrary relational transactions or simple field-level authorization. Do not let an editable booking item also allow a member to change its protected confirmed/paid/override fields. Prove the chosen mutation design and guest access in the actual tenant. Plan unique-permission growth, large-list thresholds, indexed queries, delegation, sensor retention and report aggregation before volume increases.

Service-owned flows must validate the caller and requested entity; do not trust a supplied MemberId or expose an anonymous secret-bearing flow URL. Minimum grants, clear connection ownership, secret rotation and separate test/production configuration are required design work. Required retention and recovery targets remain decisions; do not invent regulatory or availability guarantees.

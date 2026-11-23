# Data schema

Generated 18 Nov 2026 from `schema/lists.v2.json` (source of truth; run `node schema/check.mjs` after any change). 20 lists on `https://bstreethq.sharepoint.com/sites/Avenue`. Item-level rules are in [DATA_AND_ACCESS.md](DATA_AND_ACCESS.md).

## Groups and access classes

| Group | Who |
|---|---|
| Avenue Members | Member guest users. Read-only on catalog and calendar; add own requests only; no access to private lists. |
| Avenue Flavors Staff | Flavors staff account. |
| Avenue Flavors Owner | Flavors owner/operator account. |

| Access class | Members | Staff | Owner | Used for |
|---|---|---|---|---|
| catalog | Read | Contribute | Contribute | Reference data members may read |
| calendar | Read | Read | Read | Facility calendar (no names) |
| private | none | Contribute | Contribute | Authoritative records, written by flows; members cannot read |
| intake | Contribute | Contribute | Contribute | Members add their own items; flows validate |
| ownerWrite | none | Read | Contribute | Only the owner may change |

Intake lists are own-items for members (a member sees only items they authored). Identity is always the item author, never a field. Only staff or owner authors may set `OnBehalfOf`.

## Lists

| List | Access | Fields | Purpose |
|---|---|---|---|
| AvenueFacilities | catalog | 14 | Facility name, time zone |
| AvenueEquipment | catalog | 11 | Bookable equipment |
| AvenueDiningTables | catalog | 4 | Dining tables and seats |
| AvenuePlans | catalog | 5 | Membership plans and hours |
| AvenueCalendar | calendar | 8 | Display-only booked slots |
| AvenueMembers | private | 7 | Members, status, plan, collection day |
| AvenueBookings | private | 35 | Authoritative bookings |
| AvenueBookingRequests | intake | 12 | Member intake: request, cancel, extend |
| AvenueHoursLedger | private | 9 | Hours used per booking |
| AvenueMemberDocuments | private | 11 | Registered documents and status |
| AvenueComplianceOverrides | ownerWrite | 4 | Owner overrides for expired documents |
| AvenueDocumentSubmissions | intake | 7 | Member intake: document + file |
| AvenueCheckInSubmissions | intake | 7 | Member intake: checklist answers |
| AvenueCheckIns | private | 12 | Recorded entry/exit checklists |
| AvenueChecklistQuestions | catalog | 5 | Checklist questions |
| AvenueNotices | catalog | 11 | Published notices |
| AvenueDocumentFiles | private | 4 | Private library of uploaded files |
| AvenueMyMembership | private | 6 | Per-member card (item permissions) |
| AvenueNoticeDrafts | private | 12 | Staff notice drafts |
| AvenueRequiredDocTypes | catalog | 3 | Required document types |

## Fields by list

### AvenueFacilities (catalog)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed; unique |
| TimeZone | Text |  |
| EntryGraceMinutes | Number |  |
| ExitGraceMinutes | Number |  |
| StaffAlertEmail | Text |  |
| EarlyEntryMinutes | Number |  |
| CleanupMinutes | Number |  |
| MinBookingMinutes | Number |  |
| MaxBookingMinutes | Number |  |
| BookingStepMinutes | Number |  |
| MaxCompaniesInKitchen | Number |  |
| CheckoutAlertMinutes | Number |  |
| MinPrepTables | Number |  |
| AutoApproveWhenFree | Boolean | default No; [PROPOSED] auto-approval, needs client confirmation (Q-B21) |

### AvenueEquipment (catalog)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| EquipmentId | Text | indexed; unique |
| Kind | Choice | choices: Equipment, Prep table |
| Active | Boolean |  |
| Category | Choice | indexed; choices: Stove, Grill, Oven, Warmer, Pizza oven, Mixer, Prep table, Other |
| Description | Note |  |
| Location | Text |  |
| PhotoUrl | Text |  |
| SortOrder | Number |  |
| BookableByMembers | Boolean |  |
| GroupId | Text |  |

### AvenueDiningTables (catalog)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| TableId | Text | indexed; unique |
| Seats | Number |  |
| Active | Boolean |  |

### AvenuePlans (catalog)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| PlanId | Text | indexed; unique |
| MonthlyHours | Number |  |
| ExtraHourRate | Number |  |
| Active | Boolean |  |

### AvenueCalendar (calendar)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| BookingId | Text | indexed; unique |
| ResourceId | Text |  |
| Space | Choice | choices: Kitchen, Dining, Whole facility |
| EquipmentIds | Text |  |
| MemberDisplayName | Text |  |
| StartUtc | DateTime | indexed |
| EndUtc | DateTime |  |

### AvenueMembers (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| MemberId | Text | indexed; unique |
| BusinessName | Text |  |
| PlanId | Text |  |
| CollectionDay | Number |  |
| Status | Choice | choices: Invited, Paid, Onboarding, Active, Inactive |
| ChangeReason | Note |  |

### AvenueBookings (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| BookingId | Text | indexed; unique |
| MemberId | Text | indexed |
| Space | Choice | choices: Kitchen, Dining, Whole facility |
| EquipmentIds | Text |  |
| PeopleCount | Number |  |
| StartUtc | DateTime | indexed |
| EndUtc | DateTime |  |
| Status | Choice | choices: Pending, Approved, Declined, Cancelled, No-show credited |
| OverlapNote | Note |  |
| RequestedAt | DateTime |  |
| DecidedBy | Text |  |
| DecidedAt | DateTime |  |
| CancelRequestedAt | DateTime |  |
| RemindersSent | Text |  |
| MissedCheckInAt | DateTime |  |
| OutreachAt | DateTime |  |
| OutreachBy | Text |  |
| OutreachNote | Note |  |
| DecisionNotified | Text |  |
| ExitFlaggedAt | DateTime |  |
| ExitOutreachAt | DateTime |  |
| ExitOutreachBy | Text |  |
| ExitOutreachNote | Note |  |
| BookedBy | Text |  |
| ExtensionTo | DateTime |  |
| ExtensionRequestedAt | DateTime |  |
| ExtensionRequestId | Text |  |
| ExtensionConflict | Text |  |
| ExtensionDecision | Text |  |
| ExtendedBy | Text |  |
| ExtendedAt | DateTime |  |
| OverlapNotified | Text |  |
| EndAlertSentAt | DateTime |  |
| ActualEndUtc | DateTime |  |

### AvenueBookingRequests (intake)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| RequestId | Text | indexed |
| Space | Choice | choices: Kitchen, Dining, Whole facility |
| EquipmentIds | Text |  |
| PeopleCount | Number |  |
| StartUtc | DateTime | indexed |
| EndUtc | DateTime |  |
| CancelBookingId | Text |  |
| Outcome | Text |  |
| ExtendBookingId | Text |  |
| OnBehalfOf | Text |  |
| StaffNote | Note |  |

### AvenueHoursLedger (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| EntryId | Text | indexed; unique |
| MemberId | Text | indexed |
| BookingId | Text |  |
| Period | Text | indexed |
| Hours | Number |  |
| Reason | Choice | choices: Used, Credit back, Overage, Adjustment |
| ChargeKey | Text | indexed; unique |
| Note | Note |  |

### AvenueMemberDocuments (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| MemberId | Text | indexed |
| DocType | Choice | choices: Permit, Licence, Insurance, Certification |
| IssueDate | DateTime |  |
| ExpiryDate | DateTime |  |
| DocStatus | Choice | choices: Current, Expiring, Expired |
| SourceSubmissionId | Text |  |
| Verified | Boolean |  |
| SupersededBy | Text |  |
| UploadedBy | Text |  |
| RenewalReminderAt | DateTime |  |

### AvenueComplianceOverrides (ownerWrite)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| MemberId | Text | indexed |
| Reason | Note |  |
| Active | Boolean |  |

### AvenueDocumentSubmissions (intake)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| SubmissionId | Text | indexed |
| DocType | Choice | choices: Permit, Licence, Insurance, Certification |
| IssueDate | DateTime |  |
| ExpiryDate | DateTime |  |
| Outcome | Text |  |
| OnBehalfOf | Text |  |

### AvenueCheckInSubmissions (intake)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| SubmissionId | Text | indexed |
| BookingId | Text | indexed |
| Kind | Choice | choices: Entry, Exit |
| Answers | Note |  |
| AllPassed | Boolean |  |
| Outcome | Text |  |

### AvenueCheckIns (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| BookingId | Text | indexed |
| MemberId | Text | indexed |
| Kind | Choice | choices: Entry, Exit |
| Answers | Note |  |
| AllPassed | Boolean |  |
| SubmittedAt | DateTime |  |
| SubmissionId | Text |  |
| AlertSentAt | DateTime |  |
| ResolvedAt | DateTime |  |
| ResolvedBy | Text |  |
| ResolutionNote | Note |  |

### AvenueChecklistQuestions (catalog)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| Kind | Choice | choices: Entry, Exit |
| Question | Note |  |
| SortOrder | Number |  |
| Active | Boolean |  |

### AvenueNotices (catalog)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| Body | Note |  |
| PublishedAt | DateTime |  |
| Active | Boolean |  |
| NotifiedAt | DateTime |  |
| Category | Choice | choices: General, Maintenance, Schedule, Urgent |
| Pinned | Boolean | default No |
| ExpiresAt | DateTime |  |
| Audience | Text |  |
| AudienceValue | Text |  |
| PublishAt | DateTime |  |

### AvenueDocumentFiles (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| MemberId | Text | indexed |
| DocType | Choice | choices: Permit, Licence, Insurance, Certification |
| SourceSubmissionId | Text |  |

### AvenueMyMembership (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| MemberId | Text | indexed; unique |
| BusinessName | Text |  |
| PlanId | Text |  |
| CollectionDay | Number |  |
| Status | Text |  |

### AvenueNoticeDrafts (private)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| Body | Note |  |
| State | Choice | choices: Draft, Withdrawn |
| PublishedAt | DateTime |  |
| WithdrawnAt | DateTime |  |
| WithdrawnBy | Text |  |
| Category | Choice | choices: General, Maintenance, Schedule, Urgent |
| Pinned | Boolean | default No |
| ExpiresAt | DateTime |  |
| Audience | Text |  |
| AudienceValue | Text |  |
| PublishAt | DateTime |  |

### AvenueRequiredDocTypes (catalog)

| Field | Type | Notes |
|---|---|---|
| FacilityId | Text | indexed |
| DocType | Choice | choices: Permit, Licence, Insurance, Certification |
| Active | Boolean |  |

## Not in the schema yet (proposed, needs Q-06 / Q-12 answers)

- `AvenueInvoices` (private; each member reads only their own), `AvenueSensors` (catalog), `AvenueSensorReadings` (private to staff).

## Server-side state (proposed, outside SharePoint)

- Table Storage `StripeEvents` (event id, outcome) and `InvoiceState` (paid, created, lastEventId, version). Holds no member data beyond Stripe ids.

// Read contracts for the member portal's first slice (stages: apps, catalog, calendar).
// These are the ONLY fields the shared calendar may carry. Balances, documents,
// checklist/wellness answers and contact details must never be added here or to
// the AvenueCalendar list (see schema/README.md).

export interface IFacility {
  facilityId: string;
  title: string;
  /** IANA zone, e.g. supplied by facility configuration. Never defaulted in code. */
  timeZone: string;
  /** Booking length and rules from AvenueFacilities. Undefined when the list value is empty: never defaulted in code. */
  minBookingMinutes?: number;
  maxBookingMinutes?: number;
  bookingStepMinutes?: number;
  maxCompaniesInKitchen?: number;
  checkoutAlertMinutes?: number;
  /** Prep tables every equipment booking must include. Defaults to 2 (agreed 11 Nov 2026) when the list value is empty. */
  minPrepTables?: number;
  /** Check-in alert timing (CHK flows): minutes after start / after end before a missed or overdue checklist is flagged. NOT the client's 30-minute entry and cleaning windows. */
  entryGraceMinutes?: number;
  exitGraceMinutes?: number;
  /** Client, 16 Nov call: members may enter this many minutes BEFORE the start and have this many minutes AFTER the end to clean. Not booked time, not charged. */
  earlyEntryMinutes?: number;
  cleanupMinutes?: number;
  /** [PROPOSED, NOT CONFIRMED BY THE CLIENT: Q-B21] Approve a request automatically when the space is free. Undefined or false means off. */
  autoApproveWhenFree?: boolean;
}

/** Where a booking happens. A whole-facility booking (private event) blocks everything else. */
export type Space = 'Kitchen' | 'Dining' | 'Whole facility';
export const SPACES: Space[] = ['Kitchen', 'Dining', 'Whole facility'];

/** A bookable item. Booking is by equipment, not stations (client call 11 Nov 2026). resourceId is the EquipmentId. */
export interface IResource {
  resourceId: string;
  title: string;
  /** Equipment | Prep table. The real list is awaited from the client (Q-04). */
  kind: string;
  /** Catalogue fields (AvenueEquipment). All optional: a missing column leaves them undefined. */
  category?: EquipmentCategory;
  description?: string;
  location?: string;
  photoUrl?: string;
  sortOrder?: number;
  /** False hides the unit from members. Defaults to true. */
  bookable?: boolean;
  /** Units that belong together, e.g. the upper and lower oven of one double oven. */
  groupId?: string;
}

export type EquipmentCategory = 'Stove' | 'Grill' | 'Oven' | 'Warmer' | 'Pizza oven' | 'Fridge' | 'Mixer' | 'Prep table' | 'Other';
export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = ['Stove', 'Grill', 'Oven', 'Warmer', 'Pizza oven', 'Fridge', 'Mixer', 'Prep table', 'Other'];

export interface IDiningTable {
  tableId: string;
  seats: number;
}

export interface ICalendarEntry {
  bookingId: string;
  /** Legacy single-resource field; empty when a row only has a space. */
  resourceId: string;
  space?: Space;
  equipmentIds: string[];
  memberName: string;
  /** ISO-8601 UTC instants. */
  startUtc: string;
  endUtc: string;
}

/** What a member asks for. The member's identity is NOT part of it: it comes from the signed-in author of the item. */
export interface IBookingRequestInput {
  facilityId: string;
  space: Space;
  equipmentIds: string[];
  /** Required for dining. */
  peopleCount?: number;
  startUtc: string;
  endUtc: string;
}

/** Booking status as Avenue's flows record it (AvenueBookings.Status). */
export type BookingStatus = 'Pending' | 'Approved' | 'Declined' | 'Cancelled' | 'No-show credited';
export const BOOKING_STATUSES: BookingStatus[] = ['Pending', 'Approved', 'Declined', 'Cancelled', 'No-show credited'];

/** One of the signed-in member's own booking requests (item-level security means a member only ever receives their own). */
export interface IMyRequest {
  requestId: string;
  space: Space;
  /** Equipment (the "station") requested; empty for dining or whole-facility. */
  equipmentIds?: string[];
  startUtc: string;
  endUtc: string;
  /** The member has already sent a cancellation for it. */
  cancelSent: boolean;
  /** Status echoed by the flow; display only. Undefined until the flow has processed the request. */
  status?: BookingStatus;
  /** Reason or management note, when there is one. */
  note?: string;
  /** The member asked to cancel under 24 hours and management has not acted yet. */
  cancelRequested: boolean;
  /** Cancelled by staff without returning the hours: still counts as used. */
  hoursKept?: boolean;
  /** Latest extra-time request for this booking, if any. */
  extension?: IMyExtension;
}

/** A request for extra time on one of the member's own bookings (BKG-08). Outcome is echoed by the flows; display only. */
export interface IMyExtension {
  requestId: string;
  bookingId: string;
  /** Requested new end. */
  endUtc: string;
  outcome?: string;
}

/**
 * The signed-in member's own membership, from the member-visible copy kept by Avenue's flow (each row is shared only
 * with that member). Plan details come from the plan catalog. Fields stay undefined until Flavors supplies them.
 */
export interface IMyMembership {
  businessName?: string;
  status?: string;
  planId?: string;
  planName?: string;
  monthlyHours?: number;
  /** Dollars per hour over the plan (plan row ExtraHourRate). */
  extraHourRate?: number;
  /** Day of the month (1–15) the subscription is collected (ONB-02). */
  collectionDay?: number;
  /** Set by the Stripe host from subscription events: Current | PastDue | Unpaid | Cancelled | OwnerOverride. */
  paymentStatus?: string;
  payMethod?: PayMethod;
}

/** How the member pays (Q-M1 default: bank at list price, card at list + 3%). */
export type PayMethod = 'Bank' | 'Card';
export const PAY_METHODS: PayMethod[] = ['Bank', 'Card'];

export type PlanGroup = 'Emerging' | 'Mobile Kitchen' | 'Legacy';

/** A plan from AvenuePlans (prices fall back to the client sheet when the list fields are empty). */
export interface IPlan {
  planId: string;
  name: string;
  group: PlanGroup;
  monthlyHours?: number;
  extraHourRate?: number;
  /** Bank (ACH) price per month. */
  priceCents?: number;
  /** Card price per month (list + 3%, or the same for legacy plans whose price already includes the fee). */
  cardPriceCents?: number;
  /** Shown to new members. Legacy plans never are. */
  openToNew: boolean;
}

/** Requests the member portal may send to the Stripe host through AvenueHostRequests (the flow decides who may send which). */
export type HostRequestKind = 'Join' | 'PaymentPortal';

export interface IMyHostRequest {
  requestId: string;
  kind: string;
  /** Display only, echoed by the flow. A refusal starts with "Refused". */
  outcome?: string;
  /** A Stripe-hosted page, only ever opened after an allow-list check. */
  link?: string;
  createdUtc?: string;
}

/** Wellness: one per team member, answered by the lead (Q-M6 default). */
export type CheckInKind = 'Entry' | 'Exit' | 'Wellness';
export const CHECKIN_KINDS: CheckInKind[] = ['Entry', 'Exit', 'Wellness'];

/** A checklist question configured by Flavors in AvenueChecklistQuestions (the question set itself is Q-10). */
export interface IChecklistQuestion {
  id: number;
  kind: CheckInKind;
  text: string;
  order: number;
}

export interface IMyCheckIn {
  submissionId: string;
  bookingId: string;
  kind: CheckInKind;
  outcome?: string;
  /** Wellness only: whose answers these are. */
  personName?: string;
}

/** Document types named in the scope (permit, licence, insurance, certification). */
export type DocType = 'Permit' | 'Licence' | 'Insurance' | 'Certification'
  | 'County food permit' | 'MD good standing' | 'Liability insurance' | 'Workers comp or waiver' | 'Food safety manager' | 'Food manager card' | 'Food handler card';
/** The first four are the original generic types (kept for existing rows); the rest are the client's seven (sheet "Compliance Documents"). */
export const DOC_TYPES: DocType[] = ['Permit', 'Licence', 'Insurance', 'Certification',
  'County food permit', 'MD good standing', 'Liability insurance', 'Workers comp or waiver', 'Food safety manager', 'Food manager card', 'Food handler card'];

export interface IMyDocumentSubmission {
  submissionId: string;
  docType: DocType;
  /** YYYY-MM-DD */
  issueDate: string;
  expiryDate: string;
  outcome?: string;
}

export interface INotice {
  id: number;
  title: string;
  body: string;
  publishedUtc: string;
  category: NoticeCategory;
  pinned: boolean;
  /** Notices past this instant are not shown. */
  expiresUtc?: string;
  audience?: string;
}

export type NoticeCategory = 'General' | 'Maintenance' | 'Schedule' | 'Urgent';
export const NOTICE_CATEGORIES: NoticeCategory[] = ['General', 'Maintenance', 'Schedule', 'Urgent'];

/**
 * Writes to the member's own-items intake lists as the signed-in user. Implemented over SharePoint REST in the web
 * part and in memory in demo mode. Nothing written here is trusted: a flow re-validates every item.
 */
export interface IIntakeWriter {
  add(list: string, item: Record<string, unknown>): Promise<number>;
  update(list: string, id: number, fields: Record<string, unknown>): Promise<void>;
  attach(list: string, id: number, fileName: string, content: Blob): Promise<void>;
}

/** Why a member flags a compliance document for staff (ESC). Extend by adding a choice to AvenueComplianceFlags.Reason and this list. */
export type FlagReason = 'Name or business differs' | 'Coverage or limits below requirement' | 'Additional insured missing' | 'Document unclear or looks altered' | 'I need help deciding' | 'Other';
export const FLAG_REASONS: FlagReason[] = ['Name or business differs', 'Coverage or limits below requirement', 'Additional insured missing', 'Document unclear or looks altered', 'I need help deciding', 'Other'];

/** The member's own flag and staff's echoed outcome. */
export interface IMyFlag {
  submissionId: string;
  docType: DocType;
  reason: FlagReason;
  note?: string;
  outcome?: string;
}

/** Messages with Flavors (docs/REMAINING_MODULES_CONTRACT.md). One intake item per message; a flow copies it to a staff case and echoes Outcome/Reply. */
export type SupportCategory = 'Booking' | 'Billing' | 'Documents' | 'Equipment' | 'Other';
export const SUPPORT_CATEGORIES: SupportCategory[] = ['Booking', 'Billing', 'Documents', 'Equipment', 'Other'];

export interface IMySupportMessage {
  /** SharePoint item id; the newest message of a thread has the highest. */
  id: number;
  messageId: string;
  /** Equals the messageId of the first message of the conversation. */
  threadId: string;
  category: SupportCategory;
  subject: string;
  body: string;
  outcome?: string;
  reply?: string;
}

/** Private event request (dining room). */
export type EventPackage = 'Simplicity' | 'Opulence' | 'Elevation' | 'Platinum';
export const EVENT_PACKAGES: EventPackage[] = ['Simplicity', 'Opulence', 'Elevation', 'Platinum'];

export interface IMyEventRequest {
  id: number;
  requestId: string;
  pkg: EventPackage;
  /** YYYY-MM-DD. */
  eventDate: string;
  guests: number;
  notes?: string;
  outcome?: string;
  reply?: string;
}

/** Storage rental request (not a booking; staff approve and bill by hand). */
export type StorageItem = 'Half-door fridge' | 'Half-door freezer' | 'Full-door fridge' | 'Full-door freezer' | 'Dry shelf single' | 'Dry shelf double' | 'Daily dry shelf' | 'Daily cold shelf';
export const STORAGE_ITEMS: StorageItem[] = ['Half-door fridge', 'Half-door freezer', 'Full-door fridge', 'Full-door freezer', 'Dry shelf single', 'Dry shelf double', 'Daily dry shelf', 'Daily cold shelf'];

export interface IMyStorageRequest {
  id: number;
  requestId: string;
  item: StorageItem;
  quantity: number;
  notes?: string;
  outcome?: string;
  reply?: string;
}

/** One person on the member's own team roster (prefills the wellness check). */
export interface ITeamMember {
  /** SharePoint item id, used to deactivate. */
  id: number;
  teamMemberId: string;
  personName: string;
  role: 'Lead' | 'Member';
  active: boolean;
}

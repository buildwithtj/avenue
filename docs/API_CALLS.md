# Member portal — every API call (audit, 23 Nov 2026, portal 2.17.0.0)

Read from code; not traced live. File references are under `apps/member-spfx/src/` unless stated.

## How the portal talks to the back end
- Only **SharePoint REST** on `https://bstreethq.sharepoint.com/sites/Avenue`. No call goes to the integration host or Stripe directly.
- Reads: `spHttpClient.get` (`webparts/avenuePortal/AvenuePortalWebPart.ts:77-90`), retries 429/503 twice (honours Retry-After, max 10 s).
- Writes: `spHttpClient.post` (`AvenuePortalWebPart.ts:121-133`); SPHttpClient adds the request digest and uses the SharePoint sign-in cookie. No token, no secret in the browser.
- Who the member is: **the item's author**, set by SharePoint. The portal never sends a member id.
- Read URL: `GET /_api/web/lists/getbytitle('<List>')/items?$select=…&$filter=FacilityId eq 'flavors-hyattsville'[…][ and AuthorId eq <me>]&$top=500` (follows `nextLink`, max 50 pages) — `avenue/readSource.ts:647-666`. "Own items" lists add `AuthorId eq <me>`.
- Write shapes: create `POST …/items` (JSON) · update `POST …/items(<id>)` with `X-HTTP-Method: MERGE`, `IF-MATCH: *` · file `POST …/items(<id>)/AttachmentFiles/add(FileName='…')`.
- The portal only **navigates** (never fetches) to Stripe pages listed in `avenue/billing.ts:35-40` (checkout/invoice/pay/billing.stripe.com).

## 1. Book → "Send request" (end to end)
| Step | What happens | Where |
|---|---|---|
| 1 | Member presses **Send request** | `BookFlow.tsx:172-186` → `submitRequest` `readSource.ts:303-313` |
| 2 | `POST /_api/web/lists/getbytitle('AvenueBookingRequests')/items` with Title, FacilityId, RequestId `req-…`, Space (Kitchen / Dining / Whole facility), EquipmentIds `a;b;c`, StartUtc, EndUtc, PeopleCount (dining) | `avenue/booking.ts:83-97` |
| 3 | Flow **"Booking request to Pending booking"** (runs as automations@): checks staff/member, active membership, overdue payment (PastDue/Unpaid → refuse), compliance hold, equipment ids, expired documents (override), private-event clash → creates **AvenueBookings** `Pending` (or `Declined` with the reason) | `flows/expressions.md:5-23, 204-241` |
| 4 | Flow **"Publish approved booking to calendar"**: on every booking change writes **Outcome** text back to the member's request; when Approved creates **AvenueCalendar** row (removed on any other status) | `flows/expressions.md:25-34` |
| 5 | Flow **"New request alert"**: e-mails staff if `StaffAlertEmail` is set (it is **not set** today) | `:123-126` |
| 6 | Staff approve/decline in the staff app → **AvenueHoursLedger** `<BookingId>-used` row; **decision e-mail** to the member ("Your Flavors booking is …"); **overlap note** e-mail to other members on shared equipment; **reminders** 3/2/1 h before start | `:41-44, 80-95, 128-134, 153-159, 226` |
| 7 | Portal waits for the answer: polls own requests after 3 s, then every 8 s (max 15); My bookings polls every 15 s while anything is pending | `BookFlow.tsx:105-121`, `MyBookings.tsx:48-51` |
No Stripe and no integration host in booking.

## 2. Every other write
| Member action | Request | Fields | What happens next |
|---|---|---|---|
| Cancel / ask to cancel | POST `AvenueBookingRequests` | CancelBookingId, Message (< 24 h) | Cancellation flow: ≥ 24 h → Cancelled + calendar removed + ledger credit + e-mail; < 24 h → CancelRequestedAt for staff |
| Extend | POST `AvenueBookingRequests` | ExtendBookingId, new EndUtc | Extension request flow → staff decide → EndUtc moves, calendar + ledger `-ext-` row, e-mail |
| Check-in / exit checklist | POST `AvenueCheckInSubmissions` | BookingId, Kind, Answers (JSON), AllPassed | Check-in flow → **AvenueCheckIns**, Outcome; failed → alert e-mail |
| Wellness (per person) | POST `AvenueCheckInSubmissions` | Kind Wellness, PersonName | same flow (Wellness handling UNKNOWN) |
| Upload document | 3 calls: POST item (Outcome "Uploading") → POST `AttachmentFiles/add` → MERGE Outcome empty | DocType, IssueDate, ExpiryDate | Document flow → **AvenueDocumentFiles** + **AvenueMemberDocuments**, older one superseded |
| Report a compliance problem | POST `AvenueComplianceFlags` | DocType, Reason, Note | Flag flow → **AvenueComplianceCases**; staff decision echoed |
| Support message / reply | POST `AvenueSupportMessages` | MessageId, Category, Subject, Body, ThreadId (reply only) | Support flow → **AvenueSupportCases** + Outcome; staff reply echoed to every message in the thread |
| Event request | POST `AvenueEventRequests` | Package, EventDate, Guests, Notes | Event flow → **AvenueEventCases** (quote); staff approval → **AvenueHostRequests** `EventInvoice` → host → **Stripe test** invoice → **AvenueInvoices** |
| Storage request | POST `AvenueStorageRequests` | Item, Quantity, Notes | Storage flow → **AvenueStorageCases**; billed by hand |
| Team add / remove | POST / MERGE `AvenueTeamMembers` | PersonName, Role, Active | none (roster only) |
| Manage payment method | POST `AvenueHostRequests` Kind PaymentPortal, polls 2 s × 30 | — | **Switched off** (`MOCK_PAYMENTS = true`, `avenue/billing.ts:32`) |
| Join | POST `AvenueHostRequests` Kind Join, polls 2 s × 30 | plan, business, contact, phone, team size, collection day, pay method | **Switched off** (mock sets browser storage only). Intended: Host requests flow → host `/api/bridge/request` → Stripe Checkout → **AvenueApplicants** |
| Mark notice read | **no call** | — | browser storage only (per device) |

## 3. Reads (when and how often)
| When | Lists read |
|---|---|
| Portal opens | AvenueFacilities, AvenueEquipment (Active), AvenueDiningTables (Active), AvenueNotices (Active), AvenueMyMembership + AvenuePlans |
| Every 60 s and on window focus | AvenueNotices; alerts: own requests, own document submissions, own compliance flags |
| Home | requests, documents, flags, AvenueRequiredDocTypes, membership + plan, AvenueInvoices (mine), AvenueCalendar (today). **Re-runs every 60 s** because the notice poll changes its inputs |
| Book | AvenueCalendar (3 days), membership, requests |
| Schedule | AvenueCalendar (1, 7 or 42 days) |
| My bookings | own requests (every 15 s while pending) |
| Check in | requests, AvenueChecklistQuestions, own check-in submissions, own team |
| Documents | flags, required types, membership, own document submissions (**not** AvenueMemberDocuments) |
| Billing | AvenueInvoices (mine), requests, membership |
| Membership | membership, facility, requests |
| Support / Events / Storage / Team | own intake list (Events also the calendar) |
| Profile drawer (each open) | 7 reads |

## 4. Integration host endpoints (reached only through flows)
`GET /api/health` · `POST /api/stripe/webhook` (Stripe test events → AvenueInvoices, applicants, members) · `POST /api/bridge/request` (from the "Host requests" flow, header key) · `GET|POST /join`, `GET /join/done` (public join, `JOIN_PUBLIC=1`). Host → SharePoint goes through narrow per-list Power Automate flows (applicants, members, invoices, ledger, grant, sensors).

## Known inefficiencies (fix in the redesign)
- Requests read 3× and membership 2–3× on first load; Home refetches ~8 lists every minute.
- Hours shown come from requests, not AvenueHoursLedger.

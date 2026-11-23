# Day 3 evidence: intake flow (2026-11-11)

Flow: **Avenue - Booking request to Pending booking** (Power Automate, default environment "B Street HQ", owner automations@poweredbyavenue.com, connection created that day with the owner's consent).
Id: eef19366-dddc-44fe-9492-abb6cf8471c9. Built in the designer; not exported as a solution yet.

## Steps
1. Trigger: SharePoint *When an item is created*, site `/sites/Avenue`, list `AvenueBookingRequests`.
2. *Get items* on `AvenueBookings`, filter `BookingId eq '<RequestId>'` (duplicate check).
3. Condition: `length(Get items value) = 0`.
4. If yes, *Create item* in `AvenueBookings`: Title, FacilityId, BookingId = RequestId, MemberId = item Author's email (not supplied by the member), Space, EquipmentIds, PeopleCount (empty when not dining), StartUtc, EndUtc, Status = Pending, RequestedAt = utcNow(). If no, nothing.

## Verified (live, same day)
- A request added by REST produced one `Pending` booking within about 40 s with the fields above and MemberId taken from the author.
- A second request with the same RequestId produced no second booking (2 requests, 1 booking, checked twice).
- Test rows were moved to the site recycle bin.

## Not verified / known gaps
- Tested only as the owner account, not as a guest member: whether a guest's Author email matches a member record (guests may appear as `name_domain#ext#@tenant`) is untested. MemberId is stored as that email string.
- No notification to management yet (Day 4). No overlap note written by the flow.
- A failure in the flow (for example the connection expiring) leaves the request with no booking and no alert; no run-failure notification is set up.
- Flow ownership sits with one account; handover to a service account is open (L-20 licensing still applies).
- The request item stays readable by its author only; the flow does not delete or mark processed requests.

# Day 2 evidence — provisioning on the real site

Date: 2026-11-11. Done by the developer's instruction ("create the original one, no test site"), as `automations@poweredbyavenue.com` through the SharePoint REST API from a signed-in Chrome page. No credentials were entered or stored.

## Created

| Item | Result |
|---|---|
| Site | https://bstreethq.sharepoint.com/sites/Avenue — team site without a Microsoft 365 group (template STS#3), owner automations@. Site ID 1e6456e7-e30c-46b5-9bb9-4052f270fac3 |
| Groups | Avenue Members, Avenue Flavors Staff, Avenue Flavors Owner (created by us); the site's default Owners/Members/Visitors groups were left unchanged. Two groups were renamed after creation to avoid confusion with the site's default "Avenue Owners". |
| Lists | AvenueFacilities, AvenueEquipment, AvenueDiningTables, AvenuePlans, AvenueCalendar, AvenueMembers, AvenueBookings, AvenueHoursLedger (50 fields), plus AvenueBookingRequests (7 fields) |
| Permissions | Inheritance broken on every list. Catalog: Members Read, Staff Contribute, Flavors Owner Edit. Calendar: all three Read. Private (Members, Bookings, Hours): Staff Contribute and Flavors Owner Edit only; **Members have no access**. Site Owners and the creating account keep Full Control so the site stays administrable. |
| Intake list | AvenueBookingRequests: Members Contribute; item-level security on (users read and edit only their own items). |

## Verified by reading back from the site

- All lists and all expected fields exist (counts match `schema/lists.v2.json`).
- Role assignments read back per list match the table above; the three private lists have no Members entry.
- `BookingId` is indexed and enforces unique values.

## Found while doing it

- SharePoint refuses unique fields on a list where users see only their own items. `RequestId` on the intake list is indexed but not unique; the processing flow must de-duplicate.
- Creating a site as a non-admin works in this tenant (self-service creation is on).

## Not done — needs an admin role, set aside as instructed

- Enable a site collection app catalog or use the tenant catalog, and deploy the web part.
- Organisation and site sharing for guests; invite guest, staff and owner test accounts.
- Therefore **privacy tests P1–P9 in DAY2_RUNBOOK.md have not been run.** Nothing about guest access is verified.
- The site, lists and permissions can be deleted by the site owner if they need to be redone.

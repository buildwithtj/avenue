# Power BI for B Street (setup guide, not yet built)

**Status 20 Nov 2026 (updated): data access done, report not built.** developer@poweredbyavenue.com (the Power BI Pro seat) was signed in and given Read on the Avenue site and on AvenueBookings, AvenueCalendar, AvenueHoursLedger, AvenueEquipment, AvenuePlans, AvenueMembers, AvenueFacilities and AvenueDiningTables (SharePoint, read-only). Power BI service connected to the site and listed the lists, but the in-browser route created an EMPTY semantic model "Avenue Booking Data" in developer@'s My workspace and says opening it "isn't currently available for Pro workspaces in your region", so the report must be built in Power BI Desktop (steps below), then published. Browser-only routes checked on 20 Nov and unavailable: (1) Power BI service Get data > SharePoint Online list makes an empty semantic model (Pro workspace, region); (2) the SharePoint list menu (Integrate) no longer offers Power BI (only Flows, Quick steps, Approvals, Rules, Power Apps). Power BI Desktop is Windows-only: use a Windows PC or Windows virtual machine. Earlier note:  The signed-in admin account has no Power BI licence (opening Power BI redirects to "Microsoft Fabric free - Sign up"), and no Power BI credentials are in the project (never store any). The plan allows one Power BI Pro seat for B Street only; members never see Power BI (RPT-03, RPT-05, EXC-04). Measure definitions are still Q-16. The staff console already shows the day-to-day numbers natively (Dashboard KPIs, hours by member, equipment hours, next 7 days, requests by status).

## When the Pro seat holder is known
1. Power BI Desktop, Get data > SharePoint Online List, site `https://bstreethq.sharepoint.com/sites/Avenue`, sign in as the seat holder (the sign-in is theirs; nothing is saved in the repo).
2. Load: AvenueBookings, AvenueCalendar, AvenueHoursLedger, AvenueEquipment, AvenuePlans, AvenueMembers, AvenueFacilities, AvenueDiningTables.
3. Relationships (many to one): AvenueBookings[MemberId] > AvenueMembers[MemberId]; AvenueMembers[PlanId] > AvenuePlans[PlanId]; AvenueHoursLedger[BookingId] > AvenueBookings[BookingId]; a Date table on AvenueBookings[StartUtc] (convert to Eastern).
4. Publish to a workspace owned by B Street; schedule refresh (the SharePoint connector uses the seat holder's credentials).

## Proposed measures [PROPOSED, confirm in Q-16]
```
Approved bookings = CALCULATE(COUNTROWS(AvenueBookings), AvenueBookings[Status] = "Approved")
Booked hours      = SUMX(FILTER(AvenueBookings, AvenueBookings[Status] = "Approved"), DATEDIFF(AvenueBookings[StartUtc], AvenueBookings[EndUtc], MINUTE) / 60)
Hours used        = CALCULATE(SUM(AvenueHoursLedger[Hours]), AvenueHoursLedger[Reason] IN {"Used", "Credit back"})
Plan hours        = SUMX(VALUES(AvenueMembers[MemberId]), RELATED(AvenuePlans[MonthlyHours]))
Utilisation %     = DIVIDE([Hours used], [Plan hours])
Decline rate      = DIVIDE(CALCULATE(COUNTROWS(AvenueBookings), AvenueBookings[Status] = "Declined"), COUNTROWS(AvenueBookings))
Cancel rate       = DIVIDE(CALCULATE(COUNTROWS(AvenueBookings), AvenueBookings[Status] = "Cancelled"), COUNTROWS(AvenueBookings))
Overage hours     = SUMX(VALUES(AvenueMembers[MemberId]), MAX(0, [Hours used] - RELATED(AvenuePlans[MonthlyHours])))
Overage $         = SUMX(VALUES(AvenueMembers[MemberId]), [Overage hours] * RELATED(AvenuePlans[ExtraHourRate]))
```
Suggested pages: Overview (KPI cards, bookings by week), Utilisation (equipment hours, heat map by weekday and hour), Members (hours vs plan, overage), Approvals (waiting time, decline and cancel rates). Revenue and plan prices are not in these lists (no price column); they need the billing source (Stripe, test mode until STR-06).

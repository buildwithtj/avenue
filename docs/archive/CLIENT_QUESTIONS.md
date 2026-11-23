# Questions for the client

Prepared 2026-11-11 from [DECISIONS_AND_OPEN_QUESTIONS.md](../DECISIONS_AND_OPEN_QUESTIONS.md). Each question carries its Q-ID so answers can be recorded against it. Technical items for the developer to propose (Q-01 server, Q-03 double-booking method) are not included; they will be sent as proposals.

## Part A — For Flavors (facility operations)

**Plans and prices (Q-04)**
1. What membership plans do you offer? For each plan: its name, monthly price, and how many kitchen hours are included each month.
2. What is the extra-hour rate for each plan once the included hours are used up?
3. What do you charge for equipment and for storage, and are these per hour, per day or per month?
4. Are extra hours charged in full hours, half hours or another unit, and how do you round?

**Kitchen catalog (Q-04)**
5. Please list every bookable station, table, piece of equipment, storage space and event space.
6. How many members can use each one at the same time?
7. What are the kitchen's opening hours for booking, by day of the week?
8. Do you need a gap between bookings (for cleaning or changeover)? If so, how long?
9. Which time zone should bookings and billing use?

**Shared calendar (Q-19)**
10. On the shared calendar, should other members see the business name, the person's name, or both?

**Billing cycle (Q-06)**
11. A member pays on the day they choose (1st–15th). Which period does that payment cover: the calendar month, or from that payment day to the next one?
12. When do a member's included hours reset: on the 1st of the month, or on their payment day?
13. You asked for extra usage to be added to that month's invoice. For a member who pays on the 8th, where should usage from the 9th to the 31st go: the next invoice, a separate invoice, or another rule?
14. When someone joins partway through a month, what do they pay on the day they join: a full month, a part month, or something else?
15. Please send two worked examples, one for a member paying on the 1st and one paying on the 15th, showing what each invoice contains.
16. Does sales tax apply to memberships or extra usage?
17. When a member changes plan, when does the new plan start, and is the price adjusted for the part month?

**Overdue balances (Q-07)**
18. When a payment fails, how many days should pass before the balance counts as overdue and booking is blocked?
19. Should Stripe retry a failed card automatically? If so, how many times and over how many days?
20. Once an overdue balance is paid, should booking unblock immediately?

**Cancellations and no-shows (Q-08, Q-09)**
21. For dining or event bookings, what happens when someone cancels with 8 to 14 days' notice?
22. And with less than 7 days' notice?
23. Is exactly 15 days' notice a full refund, and is exactly 7 days a forfeit? What happens at 14 days?
24. What is the event security deposit amount, and when is it paid?
25. When does a booking count as a no-show: how long after the start time with no check-in?
26. Are members charged for the hours they booked or for the hours they actually used?

**Check-in and check-out (Q-10)**
27. Please send the exact entry checklist questions, including the wellness items, and say which answers count as a fail.
28. Please send the exact exit checklist questions.
29. Does every team member check out individually, or does one person check out for the booking?
30. If a team member fails the entry checklist, may the session continue?
31. Team members: does each one need their own sign-in, or does the business owner check them in?
32. How long after the start time should we wait before treating a missed check-in as overdue?
33. How long after the end time should we wait before treating a missed check-out as overdue?
34. Who at Flavors should receive escalations for missed check-ins and check-outs?
35. If a booking is made less than 3 hours before it starts, should the member still get the reminders that are still due?
36. Who at Flavors may read members' wellness answers, and how long should those answers be kept?

**Compliance documents (Q-11)**
37. Which documents must every member keep on file? Please list the exact document types.
38. Should someone at Flavors review each upload before it counts as valid? If so, who, and what do they check?
39. How many days before expiry should members be warned? The original scope suggested 30 days.
40. A document expiring on a date: does it stop working at the start or the end of that day?
41. When the owner overrides a block, how long should the override last, and does it cover all bookings or only specific ones?
42. When a document expires, should a member's existing future bookings stay, be cancelled, or be reviewed by staff?

**Temperatures (Q-12)**
43. Please list each sensor and the fridge or freezer it belongs to.
44. What is the safe minimum and maximum temperature for each unit?
45. How long should temperature history be kept?

**Staff account (Q-15)**
46. Which actions should the owner be able to switch on or off for the staff account?

## Part B — For B Street HQ

**Confirming the record (Q-00)**
47. Please confirm that the attached summary of your decisions (CLIENT_DECISIONS.md) matches what you sent, and give the dates of the emails if you have them.

**New members (Q-05, Q-17, Q-20, Q-21)**
48. After a new member pays, must Flavors approve them before they can book?
49. If a paid applicant is not approved, should they be refunded?
50. How should a prospective member reach the plan and payment page before they have an Avenue sign-in? For example, a public link, an invitation from Flavors, or something else.
51. The original scope said onboarding is desktop only. Should it now work on phones as well?
52. For the existing members you will onboard for January billing: how will you collect each member's plan, payment day and card details?

**Stripe responsibilities (Q-02)**
53. Please confirm that Flavors, not B Street, should pay Stripe fees and carry refunds, disputes and any negative balance.
54. Who may issue a refund to a member: the Flavors owner, the staff account, B Street, or several of these?
55. Will B Street take any fee on member payments through Stripe? If not, no member money will pass through B Street.
56. Please give us read access to the B Street Stripe platform settings so we can check them before the test demonstration.
57. In which country are B Street's and Flavors' Stripe accounts registered?

**Leaving and record keeping (Q-14)**
58. When a member leaves, what happens to their future bookings?
59. When a member leaves, should their Stripe subscription be cancelled immediately or at the end of the period?
60. How long must you keep compliance documents, checklist answers, invoices and temperature history after a member leaves?

**Notices and support (Q-13)**
61. Should notices be published as SharePoint News posts or kept as a list inside Avenue?
62. Apart from "all members", which audiences do you need for notices?
63. How should Flavors send support requests to B Street: a form inside Avenue, email, or an existing help-desk tool?

**Reports (Q-16)**
64. Which numbers matter most on the Flavors dashboard and in the B Street reports?
65. How should utilisation be calculated, for example booked hours divided by open hours?
66. Should reports count booked hours or hours actually used?
67. Who besides the one B Street Power BI licence holder needs to see the B Street reports?

**Licences and timeline (Q-15, Q-18)**
68. Which Microsoft licences will the Flavors owner and staff accounts use in production?
69. Which year are the requested training week of 27 December and the 1 January launch?
70. Is that launch date fixed, given that Stripe billing was added after the original eight-week estimate?

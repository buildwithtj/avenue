# Client master-data sheet: booking module log (read 19 Nov 2026)

Source: Google Sheet "Avenue Phase 1 – Information Needed from B Street & Flavors" (owner tech@dkd.co.in, last modified 19 Nov 2026 04:17 UTC), read-only, all 13 tabs read end to end through an .xlsx export. Nothing in the sheet was edited. This is client-supplied data: it outranks earlier assumptions for the facts it states ([SOURCES.md](SOURCES.md)). Quoted values are the client's words; "UNCLEAR" marks a point that needs an answer before it goes live (questions at the end). Nothing below has been applied to the live site yet.

## 1. Booking Rules tab
| Setting | Client value | Note |
|---|---|---|
| Opening hours | 24 hours/day, members may access 24/7 | |
| Booking time step | "Minimum 1 hour (60 min), no maximum" | step itself not stated: UNCLEAR (Q1) |
| Minimum booking length | 1 hour, no max | |
| Gap between bookings | 1 hour between bookings. Members get a 30 min grace before start and 30 min after end to do the Entry and Exit checklist. Cleaning must be inside their booked time | UNCLEAR (Q2) |
| Max companies in the kitchen at once | Depends on equipment booked. Typically two. A member using only prep tables leaves equipment free for another member. Equipment must be blocked once booked, by quantity, so there are no double bookings ("very important"). Client is open to advice | see Q3 |
| Min prep tables per company | 2 | agreed 11 Nov |
| Every booking needs approval | Yes | agreed 11 Nov |
| Member self-cancel | up to 24 h before start; under 24 h by message to management | agreed 11 Nov |
| Hours returned on cancel / no-show | Yes; management may withhold if abused | agreed 11 Nov |
| Plan hours reset | Monthly, no rollover. A newly joined member gets rollover for the first 2 months only | |
| Hours reset on | 1st of the month | cell note asked "1st, or payment day?"; client wrote 1st |
| Extra hours billed | Invoiced at booking, due with next monthly payment | agreed 11 Nov |
| Payment day | 1st–15th chosen at onboarding, approved by Flavors. Most due on the 1st, paying by the 5th is accepted. $99 late fee after the due date. Some current members are due between the 1st and 20th | billing, not booking (Q9) |
| Stripe fees paid by | Member | agreed 11 Nov |
| Document expiry warnings | 30, 15 and 10 days. Client wants members with expired documents blocked from new kitchen bookings | Q7 |
| Check-in grace | 10 minutes after start | |

## 2. Plans & Rates tab (hours and extra-hour rate drive booking)
Current 2026–2027 plans (open to new members):
| Plan | Price $/mo | Hours | Extra $/h | Members today | Note |
|---|---|---|---|---|---|
| Emerging-10 | 800 | 10 | 75 | 1 | 3% added to electronic payments, member pays $824 |
| Emerging-20 | 1400 | 20 | 65 | 1 | this member pays $1,100 + 3% = $1,133 (older offered rate) |
| Emerging-40 | 2400 | 40 | 55 | 0 | |
| Emerging-80 | 4000 | 80 | 45 | 0 | |
| Mobile Kitchen-10 | 600 | 10 | 55 | 0 | |
| Mobile Kitchen-20 | 1100 | 20 | 50 | 0 | |
| Mobile Kitchen-40 | 1600 | 40 | 35 | 0 | |
| Mobile Kitchen-80 | 2400 | 80 | 25 | 0 | |

Legacy plans (closed to new members; price already includes the card fee, Stripe deducts it):
| Plan | Price $/mo | Hours | Extra $/h | Members |
|---|---|---|---|---|
| Legacy-Launch | 424 | 5 | 35 | 5 |
| Legacy: Emerging-10A | 742 | 10 | 35 | 2 |
| Legacy: Emerging-10B | 515 | 10 | 35 | 2 |
| Legacy: Emerging-10C | 530 | 10 | 35 | 3 |
| Legacy: Emerging-10D | 721 | 10 | 35 | 1 |
| Legacy: Emerging-10E | 550 | 10 | 35 | 1 |
| Legacy-Mobile Kitchen-10A | 550 | 10 | 35 | 2 |
| Legacy-Mobile Kitchen-10B | 636 | 10 | 35 | 1 |
| Legacy-Mobile Kitchen-10C | 530 | 10 | 35 | 1 |
| Legacy-Mobile Kitchen-10D | 515 | 10 | 35 | 3 |

Total current members: "24, including new owner". Counts above add to 23 (+1 owner). Other charges: joining/setup fee n/a, equipment surcharge n/a, event deposit $500.
The sheet's Emerging-10A–E price/count pairs sit in one merged cell (A-742, B-515, C-530, D-721, E-550; A-2, B-2, C-3, D-1, E-1); the mapping above reads them in order.

## 3. Spaces tab (kitchen, equipment, dining)
- Kitchen: qty 1, booked with plan hours, several members at once "if equipment doesn't clash".
- Prep table: qty 6 ("About 6; confirm exact count" is the sheet's own pre-filled note, the client did not change it), included in hours, minimum 2 per company, a lone company may use all.
- Dining room: qty 1, booked with plan hours. Capacity "50 seats with current tables and chairs, no extra charge for the current set-up"; other tables, chairs or decor are an event request quoted by the owner. Cell note says "About 60 seats; confirm" (pre-filled, not changed). A member may book a single table with chairs for a client tasting using plan hours. A private event means renting the full facility at the member rate.
- Dining table: capacity 10 (the meaning is unclear). Dining chair: seating for up to 50; extra seating by request to the location admin for a fee.
- Cold-storage shelf row is an example row.
Equipment rows (all qty 1, capacity 1, booked with plan hours; several members at once = no):
1 Gas Stove w/Under Oven #1; 2 Gas Stove w/Under Oven #2; 3 Flat Top Gas Grill #1; 4 Flat Top Gas Grill #2; 5 Open Equipment Table Under Hood for Fryer (members bring their own fryer); 6 Electric Pizza Oven 1 (Upper), 7 Electric Pizza Oven 2 (Middle), 8 Electric Pizza Oven 3 (Lower): "Keep these but leave them unavailable for now" (removed from under the hood to leave space for members' fryers; no qty or "Yes" given); 9 Convection Oven (Upper); 10 Convection Oven (Lower); 11 Reach-In Double Door Refrigerator #1 and 12 #2: complimentary, "no long-term storage, use during booking only", "1 full fridge for each member, each booking, this is why we restricted to 2 companies at a time", no overnight storage, inside the kitchen; 13 Electric Warming Holding Cabinet #1; 14 #2; 15 Baker's Rack #1; 16 Baker's Rack #2.
Equipment tab: only two example rows plus "See Spaces for all equipment and rates".
Requested feature in a note: "an alert that lets a member know when they are reminded about their upcoming booking" (booking reminder).

## 4. Dining & Event Pricing tab
Rows for dining tables, whole dining room and member / outside private event are blank except notes. The data is in one cell pair (row 8):
- Non-member private event, dining room only, food not included, $500 refundable deposit, extra hours $200/h: Simplicity 4 h $1,100; Opulence 6 h $1,500; Elevation 8 h $1,900; Platinum 12 h $2,600.
- Member private event, dining room only, $500 refundable deposit, extra hours $100/h: Simplicity 4 h $950; Opulence 6 h $1,200; Elevation 8 h $1,400; Platinum 12 h $1,850.
- Rates are for hours only; add-ons would be dry, cold or freezer storage.
- Balance due 30 days before the event, immediately if booked less than 30 days before. "Lose security deposit if cancelled less than 30 days before." Refund columns 8–14 days and under 7 days show 0. Notes: "Blocks kitchen + dining room".

## 5. Other tabs (read, outside the booking module; recorded for later)
- Member Roster: the table is empty; row 4 says "Current Members .xlsx, please use this link", a link that is not exported with the sheet. The member list is not available to me.
- Team Members / Staff & Logins: B Street HQ, Samia Bingham (super-admin, admin@poweredbyavenue.com, "can do everything if needed"; not day-to-day); Flavors Culinary Hub, Paula Sharp, owner, approves bookings and reviews documents, day-to-day, logins hyattsville@flavorsculinaryhub.com and manage@appetitesbyrj.com; Appetites By RJ "ABRJ Operations Support" info@appetitesbyrj.com (admin support). Flavors staff and B Street staff rows reserved for a 2027 hire.
- Compliance Documents: 7 types (county food-service permit, MD good-standing licence, general-liability COI with fixed limits and additional-insured wording, workers' comp or waiver, food safety manager certificate, food manager's card, food handler or manager card per team member); warnings 30/15/10 days; reviewer = Flavors owner and anyone she assigns.
- Member Documents: only Keith's Plates (the newest member, "under new ownership"; Paula takes over in December and will audit all members' files). Expiry dates (Excel serials converted): county permit 2027-09-30, MD good standing 2027-04-15, liability COI 2027-11-14, workers' comp 2027-11-15, food safety manager certificate and manager's card (Keith Ellard) 2028-02-07; team-member cards awaiting an update.
- Checklists: Entry 5, Exit 4, Wellness 3 numbered rows with no questions; "see email attachments for all checklists" (not in the sheet).
- Temperature Sensors: 9 real Swift sensors (reach-in fridges 36–40°F, freezers −8–0°F) in the Sink Room and Storage Room; two sensors share the name "Complimentary Refrigerator 1".
- Storage rental (Plans tab): half-door fridge/freezer $250 per door, full $400 per door or $700 per unit, dry storage $250 / $135 shelf (single unit) and $450 / $235 (double unit), daily dry $50 and cold $75 per shelf. Not booking.

## 6. How this differs from what is live today
- Equipment catalogue is partial (no refrigerators, no baker's racks, no open fryer table; pizza ovens 2 and 3 missing; pizza oven 1 is bookable). The sheet lists 16 pieces plus 6 prep tables.
- Plans: only a `demo-plan-std` sample (10 hours, no rate). The sheet has 8 current and 10 legacy plans.
- Facility rules (24-hour opening, 60-minute minimum, 1-hour gap, 2 prep tables, 10-minute check-in grace) need checking against what the portal and flows hold.

## 7. Questions for the client or the developer (all open)
Q1 Booking step: whole hours only (1h, 2h, 3h…), or 1 hour minimum then 30-minute steps?
Q2 The "1 hour between bookings": does the system block a full hour after every booking (30 min after the previous end + 30 min before the next start, both inside which the Entry/Exit checklists run), or are the 30+30 minutes only a window to start/finish checklists?
Q3 Max two companies at once: should the system enforce it by equipment quantity (each booking takes 1 complimentary fridge, 2 fridges = 2 companies) and by blocking each approved booking's equipment (Q-B1)? Proposal: yes, block on approval, one fridge per booking auto-assigned, extra equipment blocked by quantity.
Q4 Fridges #1/#2: are they bookable pieces shown on the equipment list, or assigned automatically with every booking?
Q5 Pizza ovens 1–3: add them but inactive (not bookable), as the client says. Same for any other items? Holding cabinets #1/#2 and baker's racks #1/#2 have no Type in the sheet: treat as bookable equipment (category Warmer and Rack)?
Q6 Dining room seats: 50 (client text) or 60 (sheet note)? Dining table "10": 10 tables, or 10 seats per table? How many chairs per table, and can a member book a single table (and how is a table's seat count set)?
Q7 Block new bookings for members with an expired document: enforce it now? Only Keith's Plates has documents recorded, so every other member would be blocked at once. The Documents module is not in this release.
Q8 Private event: the notes say "dining room only" and "does not include food", but the rows say "whole facility, blocks kitchen + dining room". Does a private event block the kitchen as well? Should the portal offer the 4/6/8/12-hour packages (Simplicity, Opulence, Elevation, Platinum) instead of free hours? Is the $100 member rate per extra hour added to the event invoice? Can non-members (outside guests) book through Avenue at all, or only staff on their behalf (Stripe stays in test mode)?
Q9 Refund rule: text says deposit lost if cancelled under 30 days, columns say 15+/8–14/under 7 days = 0. Confirm: more than 30 days, full refund of deposit; under 30 days, deposit lost, balance not refunded (0)?
Q10 Hours reset on the 1st for everyone, including members who pay on another day? Two-month rollover for new members: which hours roll over, and starting when?
Q11 Plan names: legacy "Emerging-10A–E" and "Mobile Kitchen-10A–D" appear twice (price/count pairs). Please confirm each price and count; the member list file is needed to assign members to plans.
Q12 The "Current Members .xlsx" link was not in the shared sheet: please share it (or its rows) to load real members; until then no real members are loaded.
Q13 Booking reminder (alert before a booking starts): add it to this delivery? Which lead times?
Q14 Member Documents dates were Excel serial numbers that I converted (section 5). Confirm them before documents are used.

## 8. Answers received 19 Nov 2026 (from the developer, per the sheet)
Q1 whole and half hours, minimum 1 hour (live). Q2 1 hour gap (built, UI level). Q3 bookings block equipment by quantity (already the model). Q4 fridges assigned automatically, one per booking (built). Q6 dining room 50 seats, 10 tables x 5 seats (live). Still open: Q5 partly (pizza ovens inactive done), Q7 expired documents (the flows already decline members with an expired document; only one member has documents), Q8 private-event details, Q9 refunds, Q10 rollover, Q11 plan mapping, Q12 member list, Q13 reminders.

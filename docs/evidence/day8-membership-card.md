# Day 8 evidence: "My membership" card and collection day (2026-11-12)

Built:
- **List `AvenueMyMembership`:** a member-visible copy (business name, plan, collection day, status), with the same permission set as the private lists; members get no list-level access. Schema: 18 lists, 136 fields.
- **Flow "Avenue - Membership card"** (26b5a5bf-7b3d-4903-8225-d1063fbb8f4f), concurrency 1, triggered by changes to `AvenueMembers`:
  - otherwise → create or update the member's card row, then grant Read on that row to that member only;
  - status Inactive → delete the row (fail closed).
  - Built by a browser agent; independent review found no mismatches.
- **Portal Home, "My membership":**
  - business name, plan, status;
  - hours used against the plan allowance (with the over-allowance note);
  - "collected on the Nth".
  - It reads only the signed-in member's own row, refuses malformed e-mails, and fails closed on ambiguous results. 47 unit tests pass.
- **Staff app, Members:** collection day (whole number 1–15) on add and edit, shown in the list.

Verified live with automations@ as the member, 17:22–17:28 UTC:

| Step | Result |
|---|---|
| Member added (plan, day 5, Active) | Card row created; the row has unique permissions and the member was granted Read on it explicitly; no member group has access |
| Plan and day changed (day 12) | Card updated |
| Member set Inactive | Card row deleted (recycle bin, 17:28:20) |

Cleanup: test member rows removed; the card list is empty.

Notes:
- Removing a member row outright while its change is still queued briefly put the trigger in an error state. Members should always be deactivated, never deleted (the staff app only deactivates).
- Not tested with a real guest account (needs admin). Grant access depends on the member's account existing in the tenant. If it doesn't, the grant fails and the member simply sees no card (fail closed); the next change to the member retries.
- Plan name and allowance appear once Flavors' plans are loaded into `AvenuePlans`.

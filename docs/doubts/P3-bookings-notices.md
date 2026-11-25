# P3 doubts: My bookings strip and Notices (23 Nov 2026)

1. **Recent tab and pinned notices.** Recent is strictly "published in the last 7 days", so an older pinned notice shows only under All. Should pinned notices always appear in Recent? (Not invented; ask Flavors.)
2. **Default tab.** Notices open on Recent when it has anything, otherwise on All, so the page never opens empty. `[PROPOSED]`; confirm.
3. **AvenueNoticeReads is `[PROPOSED]`, not on the live site.** Added to `schema/lists.v2.json` (intake, itemLevel, FacilityId + NoticeId indexed; 38 lists now). Until it is created, the portal stays on browser storage: the first read fails once per page load and no writes are tried. Needs client sign-off before provisioning (adds an item per notice read per member; retention of these rows is UNKNOWN, Q-R1 territory).
4. **PublishAt select.** `listNotices` now selects `PublishAt`; if that column is missing on the live `AvenueNotices` list, it retries with the old select (two requests per poll until the column exists). Column presence on the live list: UNKNOWN.
5. **R10 default expiry (publish + 24 h)** was not implemented: it is Q-R1 and a staff/flow change, not a portal one. The portal only shows "Expires in N h" when ExpiresAt is within 48 h.
6. **Audience (A6/Q-R6)** still ignored, as planned.
7. **Bell "Earlier"**: five notices at most (unread first, then most recent read). Alerts (booking decisions) are unchanged and not counted in the five.
8. **Strip "No-show credited"** days are coloured as Approved (it was an approved booking). Mixed day = teal with an amber bar. Overnight carry-over day shows "cont." instead of a time.
9. **Past strip**: 31 days ending today; it opens scrolled to the most recent booked day (no "Next" tag in Past).
10. **Tests not run through heft.** I ran Jest by compiling with `tsc` into the scratchpad and running Jest with the rig's identity SCSS mock (my account, this Mac). The lead's `npm run build` is the real check. `temp/sass-ts/.../Site.module.scss.d.ts` was hand-extended with the 10 new class names so `tsc --noEmit` passes; the build regenerates it.
11. Failing suites seen during my run that are **not mine**: BookFlow (reduced motion, P2), SupportView and newModules support category filter (whoever owns Support), plus tsc errors in readSource `listMyDocuments` (unreachable code) and SupportView/BillingView, all mid-edit by other builders.

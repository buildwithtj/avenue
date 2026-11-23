# Release plan: module-by-module client access

> **Audience (clarified 14 Nov):** the developer builds everything at their own pace and shows it, module by module, to **B Street HQ**, who commissioned and own Avenue. Only the developer decides what is released (`release/release.json`); nobody at B Street or Flavors can switch modules on or off. Where this document says "the client" it means B Street HQ; Flavors staff and members see only what B Street later approves for go-live.


**[PROPOSED] Not yet agreed with the client.** Written 14 Nov 2026. Goal: the client uses finished modules themselves (member portal and staff app) while the remaining modules are still being built. Nothing here changes or removes existing work.

## 1. Approach (revised 14 Nov: build everything, ship only what you choose)
No on/off buttons or settings inside the apps. Like a Next.js app: all modules are built in the repository, and **you decide at build and deploy time what goes out**. A module that is not in the release is not in the package the client receives, so nothing is hidden, it is simply absent.

One file, `release/release.json` **(built 14 Nov)**, lists the modules included in the next release, for example `{"release":"wave-1","modules":["booking","calendar"]}`. Only the developer edits it.

| App | What the release file controls | Shipped by |
|---|---|---|
| Member portal (SPFx) | The build reads the file and compiles in only the listed modules (navigation, routes, screens). Output: a separate `.sppkg` per release | Developer uploads that `.sppkg` to the app catalog |
| Staff app (Power Apps) | `gen.py` reads the file and generates only the listed screens and navigation; `check.py` validates that set | Developer pastes the generated screens into Studio and publishes |
| Flows and lists | Not gated: they are already live and the client cannot see them without a screen | n/a |

Three separate steps you control, as with git: **build** (everything, always, tests run on all modules), **release** (choose modules in the file, produce the package), **deploy** (you upload or publish it). Nothing reaches the client until you run the deploy step yourself. Rollback is deploying the previous package.

## 2. Prerequisites (admin and access; not coding)
1. **App catalog** and deployment of `apps/member-spfx/sharepoint/solution/member-spfx.sppkg` (steps: [ADMIN_DEPLOY_STEPS.md](ADMIN_DEPLOY_STEPS.md)). Needs a SharePoint or Global administrator.
2. **Client sign-ins:** accounts or guest (B2B) access for the client's people, added to the right Avenue groups. Needs a tenant admin. UNKNOWN: whether guest sharing is allowed.
3. **Staff app sharing and licences:** share Avenue Staff Console with the client's staff; licence coverage UNKNOWN.
4. **Clean data:** remove `demo-` and `gaptest-` rows and test requests/bookings/check-ins before the client's first sign-in ([TEST_CHECKLIST.md](TEST_CHECKLIST.md), cleanup by explicit id).
5. **Privacy test with two member accounts** passes (one member cannot open another's records, including by direct link). Not yet run: needs a second sign-in.
6. **Failure alerts** and a monitored staff alert e-mail, so a failed flow is noticed (today it is not).

Until 1-2 are done, the only way to show a module is a live screen-share from the developer's laptop ([section 6](#6-until-access-exists)).

## 3. Release waves (two modules at a time)
| Wave | Modules | Member side | Staff side | Needs that is not code | Real or demo |
|---|---|---|---|---|---|
| 1 | Booking, Calendar | Home, Bookings, booking form, Calendar | Dashboard, Requests, Approved, Book | Equipment list, facility hours, plans (client) | Real |
| 2 | Documents, Compliance | Documents | Compliance (override is owner-only), Members | Required document types (Q-11) | Real |
| 3 | Check-in, Notices | Check-in, Notices | Check-ins, Checklist, Notices | Checklist questions (Q-10) | Real |
| 4 | Hours and billing view | Billing, Membership | Settings, Setup, Reports | Plans and rates (Q-04) | Hours real; invoices not available until payments exist |
| 5 | Payments, Sensors, Applicants, Permissions, Support | none yet | Screens 12-18 | Stripe (Q-01/02/06), Swift (Q-12), approval rule (Q-05), capabilities (Q-15), support route (Q-13) | **Demo only** until connected; stay off for the client until then or are clearly labelled DEMO |

Reports (Q-16) show booked hours, not attended hours; say so on release.

## 4. Steps for each wave
1. **Before:** run that wave's tests in [TEST_CHECKLIST.md](TEST_CHECKLIST.md) and the unit suites (`CLAUDE.md` commands); check flow run history shows no failures for the wave's flows; confirm clean data.
2. **Release:** set the wave's modules in `release/release.json`, build the member package and generate the staff screens, then deploy them yourself.
3. **Walk the client through** it (30 minutes): what is real, what is sample, what is not built. Record anything not agreed as a question in [DECISIONS_AND_OPEN_QUESTIONS.md](DECISIONS_AND_OPEN_QUESTIONS.md).
4. **After:** record in STATUS and CHANGELOG what was opened, when, and to whom; keep a short issue list from the client.
5. **Acceptance:** the client accepts the wave in writing (e-mail is enough); a call decision is not final until confirmed in writing (SOURCES.md).

## 5. Rollback and rules
- **Rollback:** deploy the previous package (keep each release's `.sppkg` and generated screens). Data and flows are untouched. Removing the web part from the page unpublishes the whole portal.
- **Always:** Stripe stays in test mode until the client approves the demonstrated flow (STR-06); no real charges, payouts or refunds. No live Stripe screen is switched on for the client before that approval.
- **Emails:** no new flow that e-mails members is saved or switched on without the developer's approval.
- **Real data:** member and facility data are loaded only once the client supplies it (equipment, plans, members), replacing seed rows.

## 6. Until access exists
Use a live guided screen-share, wave by wave, with short recorded clips as backup:
1. `cd apps/member-spfx && PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH" npm start` (do not run `npm run build` at the same time).
2. Open the portal page with the debug URL ([ADMIN_DEPLOY_STEPS.md](ADMIN_DEPLOY_STEPS.md), "Interim"), click "Load debug scripts", use the browser's phone view for the member side, and the staff app in a second window.
3. For clean sample data use the web part's "Use demo data" switch (labelled invented records).
This is a demonstration, not client access.

## 7. Build list for this plan
| Item | Owner | Status |
|---|---|---|
| `release/release.json` and build support: member build includes only listed modules; `gen.py` generates only listed screens | Developer | **done 14 Nov** (see section 8) |
| Demo script per wave ([DEMO_SCRIPTS.md](DEMO_SCRIPTS.md)) | Developer | drafted 14 Nov |
| Recorded clips for waves 1-3 | Developer | not started |
| App catalog, deployment, client sign-ins, sharing | Tenant admin | blocked |
| Second member sign-in for the privacy test | Tenant admin / developer | blocked |
| Failure alerts and staff alert e-mail | Developer (e-mail address from client) | not started |

## 8. How to cut a release (built)
Modules: `booking`, `calendar`, `documents`, `checkin`, `notices`, `billing`, `payments`, `sensors`, `applicants`, `permissions`, `support`. Home is always in. Missing file means everything.
1. Edit `release/release.json`, for example `{"release":"wave-1","modules":["booking","calendar"]}`.
2. Member: `cd apps/member-spfx && npm run build` (writes `src/avenue/release.generated.ts` first; stop `npm start` before building). Keep the `.sppkg` under the release name, then upload it yourself.
3. Staff: `cd apps/staff-powerapps && python3 gen.py && python3 check.py`; only the listed screens exist, navigation and More tiles are trimmed, and links to unlisted screens become no-ops. Paste into Studio and publish yourself.
Verified 14 Nov: staff wave-1 = 4 screens, check OK; all modules = identical to before (522 controls, 18 files); member build passes with 3 new tests.
Limits: the member portal omits unlisted screens from navigation and routing but their code is still in the bundle (not tree-shaken); Home hides sections for unlisted modules. Existing Studio screens already pasted (Screen1-2) are not removed by the generator; delete them in Studio by hand if a release must not show them.

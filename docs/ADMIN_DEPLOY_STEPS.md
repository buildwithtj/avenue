# Admin steps: deploy the member portal and test it on a phone

Do these when you have a **SharePoint administrator** (or Global Administrator) account. Written 14 Nov 2026. Nothing here needs a password in a file or in chat.

Why this is needed: the tenant has no app catalog (checked 14 Nov: tenant `CorporateCatalogUrl` empty, none on `/sites/Avenue`), and `automations@poweredbyavenue.com` is refused at the SharePoint admin center. The package is already built.

## 0. Before you start
- Package: `apps/member-spfx/sharepoint/solution/member-spfx.sppkg` (solution name "Avenue member portal", web part "Avenue member portal").
- If you changed code, rebuild first (Node 22): `cd apps/member-spfx && PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH" npm run build`. Expect 87 tests passing.
- Target site: `https://bstreethq.sharepoint.com/sites/Avenue`. Facility ID to enter: `flavors-hyattsville`.

## 1. Create an app catalog (once)
Pick ONE.

**A. Site-collection app catalog (recommended: affects only the Avenue site)**
1. Sign in at `https://bstreethq-admin.sharepoint.com` as the SharePoint administrator.
2. Open **More features → Apps → Open**. (If the admin center offers site-collection app catalogs, add `https://bstreethq.sharepoint.com/sites/Avenue`.)
3. If your admin center has no UI for it, use SharePoint Online PowerShell:
   `Connect-SPOService -Url https://bstreethq-admin.sharepoint.com`
   `Add-SPOSiteCollectionAppCatalog -Site https://bstreethq.sharepoint.com/sites/Avenue`
4. Verify: `https://bstreethq.sharepoint.com/sites/Avenue/AppCatalog` opens and lists "Apps for SharePoint".

**B. Tenant app catalog (all sites)**
1. Admin center → **More features → Apps → Open → Create a new app catalog site**.
2. Give it a URL such as `/sites/appcatalog`, set the administrator, wait for it to finish.

## 2. Upload and deploy the package
1. Open the catalog's **Apps for SharePoint** library.
2. Upload `member-spfx.sppkg`.
3. In the dialog, choose **Deploy**. (The solution skips feature deployment, so tenant-wide availability is not needed with option A.)
4. Verify: the app shows **Deployed: Yes** and **Valid app package: Yes**, and no "API access" request is pending (this solution requests none).

## 3. Add the app to the Avenue site (skip for tenant-wide deployment)
1. `https://bstreethq.sharepoint.com/sites/Avenue` → **Site contents → New → App**.
2. Add **Avenue member portal** and wait until it shows as installed.

## 4. Put the portal on a page
1. Site → **New → Page** (Blank), name it **Member portal** (use a full-width section if offered).
2. **+** → search **Avenue member portal** → add it.
3. In the web part's property pane: **Facility ID** = `flavors-hyattsville`; leave **Use demo data** OFF (demo data is only for demonstrations).
4. **Publish** the page. Copy its URL (for example `https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal.aspx`).
5. Optional: add it to the site navigation.

## 5. Who can open it
- A member must be a user of the site (the page only shows their own requests; SharePoint enforces that, not the page).
- Seeded sample members (`demo.*@example.invalid`) cannot sign in. Use your own work account as the tester, and make bookings in the portal as that account.
- External members need guest (B2B) access: not set up (admin task, separate).

## 6. Test on the phone
1. On the phone, open the page URL in the browser, or in the **SharePoint** mobile app (Sites → Avenue → the page). Sign in with your work account.
2. Check, in order: the Home screen loads; bottom bar shows Home / Bookings / Documents / Billing; **Book kitchen time** opens the booking form; submit a request.
3. On the laptop, open the staff app (Requests / Approved / Dashboard). Within about a minute the same booking appears (the flow polls every 15-60 s).
4. Full list: `docs/TEST_CHECKLIST.md`.

## 7. If something fails
| Symptom | Likely cause | What to do |
|---|---|---|
| Web part not in the picker | App not added to the site, or not deployed | Repeat step 2-3; check "Deployed: Yes" |
| "This page is not set up yet" | Facility ID empty | Edit the web part, enter `flavors-hyattsville` |
| "Avenue could not load the facility" | No access to the lists, or wrong facility ID | Check the signed-in user is a site member; check the ID |
| Booking stays "being checked" | Flow polling | Wait a minute, refresh; check the flow run history |
| Old design still shows | Browser cache | Hard refresh; re-upload the .sppkg (replace) after a rebuild |

## 8. Remove or roll back
- Remove the web part from the page, or unpublish the page.
- Site contents → the app → **Remove**. Delete the package from the catalog only if no other site uses it.
- Seed data (`demo-` rows): `schema/seed.browser.js` → `seedCleanup()`. Do this before real data.

## 9. After it works
Record in `docs/STATUS.md` the page URL, the catalog used, and the date; add a line to `docs/CHANGELOG.md`.

## Interim: preview from the laptop (no admin needed; created 14 Nov)
A published page `SitePages/Member-portal.aspx` on the Avenue site already holds the web part (facility `flavors-hyattsville`, demo data off). It only renders while the dev server runs, because the package is not installed:
1. `cd apps/member-spfx && PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH" npm start` (leave it running; do not run `npm run build` at the same time, it wipes the dev server's bundle).
2. Open `https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&loadSPFX=true&debug=true&noredir=true` and click **Load debug scripts** (SharePoint always asks once).
After the app catalog exists and the package is deployed (steps above), the same page works at its plain URL with no dev server.

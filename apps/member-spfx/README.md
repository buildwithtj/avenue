# Avenue member portal starter

A read-only SPFx web part displays a facility catalog and shared calendar. It has synthetic demo data and an unverified SharePoint REST reader. It does not create reservations, provision lists, enforce booking eligibility, or connect to payments. The calendar is a display projection, not an availability or authorization boundary. See [the proposed read model](../../schema/README.md) and [security requirements](../../docs/DATA_AND_ACCESS.md).

## Local build

The existing scaffold pins SPFx 1.24.1 and React 18.3.1. Microsoft's [compatibility reference](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility) lists Node 22 (22.14+), 24 and 26, TypeScript through 5.8, and React 18.3.1 for SPFx 1.24. Checked 2026-11-10. Install a supported Node version, then from this folder run:

```sh
npm ci
npm run build
```

The build runs lint, unit tests and packages the solution under `sharepoint/solution/`. `npm start` starts the local SPFx development server; a modern page on a test site and tenant access are needed to exercise the web part (the online workbench retires 2026-12-01; set `initialPage` in `config/serve.json` and `SPFX_SERVE_TENANT_DOMAIN`, then run `npx heft trust-dev-cert` once). No global Heft install is required. Demo mode is selected in the web part property pane; it uses synthetic data. With demo mode off, set a facility ID and the reader uses the current site's lists. Never put secrets in web part properties.

## Test deployment and rollback

Only use a dedicated test site and test app catalog after the tenant owner verifies deployment rights and the proposed list permissions. Install the generated package through the site's appropriate app catalog, add the web part to a test modern page, and turn on demo mode. For a later live-data test, provision the reviewed test-only read model and use synthetic data; validate the positive and negative access cases in the schema document. This has not been performed. A successful package build does not establish deployment or security readiness.

To roll back a test, remove the web part from the page and remove or revert the test package through the applicable app catalog. Handle any separately created test lists according to the site owner's instructions. No production deployment or production data migration is covered by this starter.

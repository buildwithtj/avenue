// Azure Functions v4 wiring. `app` is `import { app } from '@azure/functions'`, passed in so this repo needs no dependency.
// `deps` is built by the host's entry file from Key Vault secrets and real clients (Table Storage, SharePoint via Graph, Stripe, Swift Sensors).
import { stripeWebhook, myInvoices, health, sensorSync, reconcile } from './handlers.mjs';

const toResponse = (r) => ({ status: r.status, jsonBody: r.body });

export function register(app, deps) {
  app.http('stripeWebhook', { methods: ['POST'], authLevel: 'anonymous', route: 'stripe/webhook', // anonymous: Stripe signs the body instead
    handler: async (req) => toResponse(await stripeWebhook({ rawBody: await req.text(), headers: Object.fromEntries(req.headers) }, deps)) });
  app.http('myInvoices', { methods: ['GET'], authLevel: 'anonymous', route: 'billing/my-invoices', // the Entra token is checked in the handler
    handler: async (req) => toResponse(await myInvoices({ headers: Object.fromEntries(req.headers), query: {} }, deps)) });
  app.http('health', { methods: ['GET'], authLevel: 'anonymous', route: 'health', handler: async () => toResponse(await health(deps)) });
  app.timer('sensorSync', { schedule: deps.sensorSchedule, handler: async () => { await sensorSync(deps); } });   // schedule from Q-12
  app.timer('reconcile', { schedule: '0 0 6 * * *', handler: async () => { await reconcile(deps); } });
}

# Project brief

Owner of: purpose, actors, Phase 1 boundary, verified stack. Details live in [REQUIREMENTS.md](REQUIREMENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [STATUS.md](STATUS.md).

## What Avenue is

A facility operations and membership platform **owned and operated by B Street HQ** (PLT-01). Phase 1 is a **single-facility pilot** at **Flavors Culinary Hub Hyattsville**, a shared commercial kitchen (PLT-02). Modules: bookings, check-in/out and alerts, compliance documents, Stripe billing, temperature monitoring, communication, member onboarding, reporting, administration. One developer builds it.

## Actors

| Actor | Role |
|---|---|
| B Street HQ | Platform owner and super-admin; owns the Microsoft tenant and licences; may assign support representatives. |
| Flavors owner / operator | Configures facility data, plans and staff permissions; **only role that may override booking blocks** (expired document, overdue balance). Cannot change platform behaviour. |
| Flavors staff | One restricted account with operator-selected capabilities; approves bookings, handles conflicts. |
| Member | A kitchen **business** (not a licence seat). Sees only its own documents, invoices, checklists and bookings plus the shared calendar. |
| Team member / worker | Works under a member business. Identity model unresolved (Q-10). |
| Doubleklick Designs ("DKD") | Agency that wrote the original scope; holds the Stripe Connect platform invite and is to provision servers (call 11 Nov). Contract structure UNKNOWN. |

## Phase 1 boundary

In: the nine modules as amended by the client's emails and the 11 Nov call (see [REQUIREMENTS.md](REQUIREMENTS.md)). Out (FUT-01..04, EXC-01..04): standalone multi-client platform, school rollout, AI features, native mobile app, additional paid staff accounts, duplicate real-time temperature alerts, physical door control, member Power Apps/Power Pages/Power BI, replacement database. **QuickBooks is superseded by Stripe (PLT-10) and must not return.** Requested dates (training week of 27 December, launch 1 January, year unconfirmed) are requests, not commitments (REL-01, Q-18).

## Stack (sources: PLT-03, STR-01, S-04, S-05)

| Layer | Choice | Status |
|---|---|---|
| Member UI | SharePoint modern pages, SPFx 1.24.1 React/TypeScript web part | Confirmed by continuation (E1). Built; **not deployed**. |
| Staff UI | Power Apps Canvas "Avenue Staff Console" | Confirmed. Built, saved, **not published**. Q-24 asks whether staff licences or an SPFx console are preferred. |
| Data | SharePoint Lists; private documents in restricted libraries | Confirmed. Provisioned on the live site (20 lists). |
| Identity | Microsoft Entra B2B guest access | Confirmed. **Not verified**: no guest account has been tested. |
| Automation | Power Automate (service account `automations@`) | Confirmed. 18 flows listed in My flows on 13 Nov; licence coverage of every pattern unverified (L-20). |
| Payments | Stripe Connect, facility-owned connected accounts, direct charges, Stripe Billing | Confirmed. Account model and fees open (Q-02). Nothing configured. |
| Secure integration host | Needed for Stripe signatures and secrets. A separate Node.js/Azure service was **proposed, not confirmed**; call 11 Nov says DKD provisions servers. | [PROPOSED] Q-01 🔴 BLOCKER for Stripe code. |
| Sensors | Swift Sensors API | Confirmed. Nothing built (Q-12). |
| Reporting | Power BI for B Street (one Pro seat); native dashboard in the staff app for Flavors | Confirmed / preference (RPT-02). Embedded Power BI is **not** assumed to remove licensing. |
| Email | Microsoft 365 Outlook connection "Avenue mail (automations)" | In use for generic notices and reminders. |

## Environment facts to keep in mind

- Everything runs on the real site `https://bstreethq.sharepoint.com/sites/Avenue` in the default Power Platform environment. There is **no separate test environment**; tests use `gaptest-` style ids and explicit cleanup ([DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md)).
- Supplied subscriptions and logins prove nothing about permissions, guest sharing, app catalog rights or licence coverage ([SOURCES.md](SOURCES.md)).
- An "Avenue Sandbox" is described to the developer as a practice resource but appears in no repository source (UNKNOWN); anything done there is practice, not evidence of production readiness. Stripe work is **test mode only** until the client approves the demonstrated flow (STR-06).

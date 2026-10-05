# Vortex One

Real-estate operations platform: **CRM, simulated power dialer, campaigns, property & owner intelligence, workflow automation and modular AI agents** on one organization-scoped record graph.

> Status: the CRM/dialer/workflow stack is implemented and covered by tests. The dialer is **simulated** (no telephony provider is wired up), the agents are **rule-based**, and email/SMS sending does not exist. See [What is real](#what-is-real-vs-simulated).

## Quick start (local)

Requirements: Node 20+, PostgreSQL 14+ (plain Postgres is enough; PostGIS is only needed for the GIS Cloud sync).

```bash
npm install
createdb vortex_dev
export DATABASE_URL=postgres://postgres@127.0.0.1:5432/vortex_dev
npm run db:migrate:local        # applies the app-level supabase/migrations
npm run dev                     # Express + Vite on http://localhost:3000
```

Open http://localhost:3000 and click **Try the live demo** (an isolated, seeded sandbox), or create an account.

| Script | What it does |
|---|---|
| `npm run dev` | API + Vite dev server (port 3000) |
| `npm run build` | Production frontend build into `public/` |
| `npm start` | Serve the API and the built frontend (`tsx server.ts`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests + PostgreSQL integration tests (needs `TEST_DATABASE_URL`; integration tests are skipped without it) |
| `npm run test:unit` | Unit tests only (no database) |
| `npm run db:migrate:local` | Apply app migrations to a local/CI database |

Tests: `TEST_DATABASE_URL=postgres://… npm test` (create the database and run `DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate:local` first). Never point it at production.

## Architecture

```
React 19 + Vite + Tailwind (src/)         role-based nav, CRM UI in src/features/crm
        │  fetch /api/*  (HttpOnly cookie session)
Express 5 (server.ts)                      security headers, rate limits, auth, OAuth, 3Min webhook, Gemini chat
        │  requireAuth  →  /api router (src/server/*)
Service layer (src/server/*)               permission check → tenant-scoped SQL → activity log → event
        │                                  workflows subscribe to events; agents call the same services
PostgreSQL (Supabase in production)        migrations in supabase/migrations
```

Details, data ownership, the permission matrix and the API list are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Multi-tenancy:** every row carries `organization_id`; every query filters on the caller's organization; IDs supplied in request bodies are verified to belong to that organization. Authorization is enforced server-side per route (`src/server/core.ts` → `ROLE_PERMISSIONS`); the UI only mirrors it.

## Features

- **CRM**: contacts, leads (pipeline stages, scoring), tasks, notes, tags, assignment, archive/restore, search, filter, sort, pagination, relationship views (property ↔ owner ↔ contact ↔ lead ↔ campaign ↔ calls ↔ tasks), one activity log.
- **Property & owner intelligence**: properties (APN, characteristics, coordinates, valuation, signals), owners with derived portfolio values, import by APN, transparent rule-based lead scoring.
- **Dialer & campaigns**: campaign lifecycle (draft → active ⇄ paused → completed, archive), queue-based power dialing, call state machine (dialing → ringing → connected → completed | failed | no answer | busy | canceled), outcomes, notes, follow-up tasks, Do Not Call enforcement, metrics derived from call records.
- **Workflows**: trigger → conditions → actions with persisted runs (queued/running/completed/failed) and per-step results.
- **AI agents**: registry with name, purpose, permissions, typed input/output, run history. Four rule-based agents ship; see ARCHITECTURE.md to add model-backed ones.
- **Demo mode**: per-visitor isolated organization with realistic fictional data, reset, 24h expiry.
- **Integrations**: 3Min webhook receiver, GIS Cloud sync (via Supabase Edge Function), Gemini chat assistant.

## What is real vs. simulated

| Capability | State |
|---|---|
| Auth (email/password, Google, Microsoft), sessions, RBAC, tenant isolation | Real |
| CRM, properties, owners, campaigns, tasks, workflows, agents, activity, dashboard | Real (PostgreSQL) |
| Phone calls | **Simulated.** `TELEPHONY_PROVIDER` other than `simulated` is not implemented; calls are labeled simulated everywhere and never touch a network |
| Email / SMS | **Not implemented** (workflow notifications are in-app only) |
| AI agents | Rule-based; no external model is called |
| Gemini assistant (`/api/gemini/chat`) | Real when `GEMINI_API_KEY` is set; blocked in demo mode |
| GIS Cloud sync | Real only with the Supabase Edge Function deployed and its secrets set; blocked in demo mode |
| Password reset / email verification | **Not implemented** (needs an email provider) |
| Tenant & technician portals | Legacy, Firestore-backed UI from before the Postgres migration; **not verified** (see docs/REPOSITORY_CLEANUP.md) |

## Configuration

Copy `.env.example`. Required in production: `DATABASE_URL`, `APP_URL`, `AUTH_SESSION_PEPPER`/`SOCIAL_AUTH_PEPPER` (OAuth state signing). Optional: `GEMINI_API_KEY`, OAuth client ids/secrets, 3Min secrets, GIS Cloud settings, `DEMO_MODE_ENABLED` (default `true`), `TRUST_PROXY_HOPS`. Secrets are server-side only; nothing but `firebase-applet-config.json` (public web config used by the legacy portals) ships to the browser.

## Database

The app verifies required tables at startup and never runs DDL at runtime. **Apply `supabase/migrations/*` before deploying** (the newest, `20261006000000_crm_dialer_workflows.sql`, is idempotent and adds the CRM tables; the startup check fails loudly if it is missing). `db/migrations/*` are an older schema generation kept for reference — do not apply them to production.

## Deployment

Firebase Hosting (static `public/`) + Firebase Function `api` (`functions/`) in front of Supabase PostgreSQL — see `docs/FIREBASE_DEPLOYMENT.md`. `server.ts` also runs standalone (`npm run build && npm start`).

## Security notes

HttpOnly SameSite=Lax session cookie (`__Host-` prefixed in production), scrypt password hashing, in-memory rate limits (per instance), JSON-only bodies with a 1 MB cap, security headers, zod validation on every CRM route, parameterized SQL, demo orgs cannot reach paid/external routes. Known gaps are listed in docs/ARCHITECTURE.md → *Known limitations*.

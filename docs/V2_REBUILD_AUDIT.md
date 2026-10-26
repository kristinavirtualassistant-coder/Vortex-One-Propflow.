# Vortex One V2: controlled rebuild audit and plan

| | |
|---|---|
| Date | 2026-10-26 |
| Audited commit | `4e169e9` (`main`, same tree as branch `ccr-e3e5cec7-hc27so`) |
| Mode | Audit and plan only. No code, database, environment, DNS or deployment changes were made. |
| Scope limits | No database access (production or pre-production). GitHub API access was blocked in this session (see D1). Vercel access was read-only and partial (see D3). No secrets were read or printed. |

Status labels used throughout:

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed by reading code/config or by a command run in this audit, with the evidence named |
| **PARTIAL** | Implemented, but with a documented gap, or only part of the claim could be confirmed |
| **BROKEN** | Code exists and is shown not to work as intended |
| **MISSING** | No implementation exists |
| **UNVERIFIED** | Could not be checked from available read-only sources |

---

## 1. Executive summary

**Do not rewrite. Harden and extend.** The repository is not a prototype that needs replacing: it is a working TypeScript modular monolith (React 19 + Vite, Express 5, PostgreSQL) with a clear service layer, server-side RBAC, organization scoping on every query, zod validation, 42 PostgreSQL integration tests, CI, and an honest README that labels what is simulated. The production platform on Vercel is serving the current `main` commit.

What exists and works (code + tests): auth (email/password, Google), organizations and members, CRM (contacts, leads, tasks, notes, activity, search), properties and owners with per-field provenance, campaigns, a **simulated** power dialer with Do Not Call enforcement, workflows, four **rule-based** agents, an isolated demo mode, and a weekly California public-record ingestion pipeline.

What does not exist: real telephony, email/SMS, password reset/email verification/MFA, billing/subscriptions, property management (units, leases, rent, work orders as first-class entities), vendor/owner portals, a marketplace, file storage, error monitoring, and a documented backup/restore procedure.

The five things that matter most before any V2 feature work:

1. **Tenant isolation is enforced only in application code.** Database RLS policies admit the backend role with `USING (true)`, so one missing `organization_id` predicate is a cross-tenant leak. (S1, High)
2. **The CI test database is not the production schema.** `scripts/apply-migrations.sh` applies 7 of the 10 canonical migrations; the RLS, GIS sync and PostGIS spatial migrations are never tested. Which migrations production actually has is unverified. (B2, High)
3. **Two Supabase project refs appear in the repo** (`supabase/config.toml`/`.mcp.json` vs `.env.example`). Which is production and which is pre-production is not established. (B3, High)
4. **Several integration routes skip the permission check** (GIS Cloud sync, 3Min status/test): any authenticated member, including `tenant`/`technician`, can call them. (S3, Medium)
5. **No backups, restore drill, error monitoring or alerting are documented or configured in the repo.** (B6, E5)

**Recommended V2 approach:** keep the single app and database; introduce module boundaries inside `src/` gradually; ship Phase 0 (foundation hardening, ~3–4 engineer-weeks) before adding Property Management or real telephony.

---

## 2. Verified technology stack and repository structure

### 2.1 Stack (VERIFIED: `package.json`, `website/package.json`, `requirements.txt`, workflows)

| Layer | Technology | Evidence |
|---|---|---|
| Platform frontend | React 19, Vite 8, Tailwind 4, react-router 7, Recharts, lucide | `package.json`, `src/main.tsx` |
| Platform API | Express 5, zod 4, express-rate-limit, `pg`; Drizzle used only for a schema description | `server.ts`, `src/server/*`, `src/db/*` |
| Runtime on Vercel | `api/index.ts` serverless wrapper around `createApp()`; static `public/` | `vercel.json`, `api/index.ts` |
| Database | PostgreSQL (Supabase in production per docs), PostGIS for spatial/ingest | `supabase/migrations/*` |
| Edge function | Supabase Edge Function `gis-cloud-sync` (Deno) | `supabase/functions/gis-cloud-sync/index.ts` |
| Ingestion | Python 3.12 (`ingest/*`), staging PostGIS in GitHub Actions, publishes to Supabase | `.github/workflows/ca-ingest.yml` |
| AI | `@google/genai` (Gemini), server-side only | `server.ts:19` |
| Marketing site | Separate Vite/React app in `website/`, Vercel function `website/api/waitlist.ts` (Airtable) | `website/*` |
| TypeScript | Root `~7.0.2` with `strict: false`; website `~5.9` | `package.json`, `tsconfig.json` |
| Node | CI Node 20, Vercel project Node 24.x, this container Node 22 | `ci.yml`, Vercel API |

### 2.2 Repository layout

```
api/index.ts                 Vercel function entry → server.ts createApp()
server.ts                    Express app: headers, rate limits, auth, OAuth, 3Min webhook, GIS, Gemini (1009 lines)
src/server/*                 Domain services + routes (core, contacts, leads, properties, campaigns, dialer, dnc,
                             tasks, workflows, agents, demo, org, portal, dashboard, scoring)
src/features/crm/*           CRM UI (active product surface)
src/pages, src/components    Shell + legacy portals (tenant/technician), maintenance dashboard
src/db/index.ts, schema.ts   pg pool, transactions, startup schema check; Drizzle schema (documentation)
supabase/migrations/*        Canonical app migrations (10)
db/migrations/*              Older schema generation (4) — documented "do not apply"
sql/*, ingest/*              CA public-record ingestion (staging SQL + Python)
website/                     Marketing site (separate build/deploy)
tests/*, tests_py/*          Node test runner (unit + PostgreSQL integration), Python unittest
docs/*                       Architecture, deployment, integration matrix, cleanup history
```

### 2.3 Git state (VERIFIED: `git status`, `git log`, `git branch -a`, `git remote -v`)

| Item | Finding |
|---|---|
| History | 190 commits, 2026-10-01 → 2026-10-21; PR-based flow, last merged PR #70/#69 |
| Branches (local clone) | `main`, `ccr-e3e5cec7-hc27so`; remote has the same two refs in this clone. Other remote branches: UNVERIFIED (shallow/limited fetch; GitHub API blocked) |
| Working tree | Only `package-lock.json` modified, by the session's `npm install` hook (+26 lines). Not committed. |
| Stashes / tags | None |
| Recovery options | Full history on `origin/main`; every production deployment on Vercel is tied to a commit SHA (instant rollback is possible from the Vercel dashboard) |
| Remote name | `kristinavirtualassistant-coder/Vortex-One-Propflow.` — **the repository name ends with a period** (see D1) |

---

## 3. Feature inventory and implementation status

"Tested" means covered by `tests/api.test.ts` (runs in CI against PostgreSQL). Integration tests were **not run in this audit** (no PostGIS locally; see §14).

| Module | Capability | Status | Evidence |
|---|---|---|---|
| Core | Email/password signup, login, logout, password change | **VERIFIED** (code + tests) | `server.ts:543–760`, `tests/api.test.ts` "authentication" |
| Core | Google OAuth | **PARTIAL** — code present; production config UNVERIFIED | `server.ts:443–541` |
| Core | Microsoft OAuth | **BROKEN by design** — emails treated unverified and rejected | `server.ts:121–129`, `docs/INTEGRATION_MATRIX.md` |
| Core | Organizations, members, roles, RBAC | **VERIFIED** | `src/server/core.ts` `ROLE_PERMISSIONS`, `src/server/org.ts`, tests "authorization (RBAC) and tenant isolation" |
| Core | Password reset, email verification, MFA | **MISSING** | README "What is real" |
| Core | Same-origin (CSRF) guard, security headers | **VERIFIED** | `src/middleware/sameOrigin.ts`, `tests/sameOrigin.test.ts`, `vercel.json` headers |
| PropFlow CRM | Contacts, leads/pipeline, tasks, notes, tags, archive, search, activity log | **VERIFIED** | `src/server/{contacts,leads,tasks}.ts`, tests "CRM, properties, owners" |
| PropFlow CRM | Custom fields / customizable pipelines | **MISSING** (stages are fixed) | `src/server/leads.ts` |
| PropFlow CRM | Workflows (trigger → conditions → actions, runs) | **VERIFIED**; no scheduler, no retries, non-transactional | `src/server/workflows.ts`, docs/ARCHITECTURE.md |
| Owner Intelligence | Properties, owners, import by APN, rule-based scoring | **VERIFIED** | `src/server/properties.ts`, `scoring.ts` |
| Owner Intelligence | Per-field provenance + confidence-aware enrich endpoint | **VERIFIED** (code); migration in production UNVERIFIED | `20261021000000_property_field_provenance.sql`, `properties.ts:305` |
| Owner Intelligence | CA public-record ingestion (LA subset, SF roll, FHSZ hazards), freshness checks | **PARTIAL** — pipeline + guard tests VERIFIED; scheduled runs and published data UNVERIFIED | `ingest/*`, `ca-ingest.yml`, `source-freshness.yml`, `tests_py` (19 pass) |
| Owner Intelligence | Link from ingested `core.parcels` to app `properties` | **MISSING/UNVERIFIED** — separate schemas; no join path found in app routes | `ca_ingest_core.sql` vs `src/server/properties.ts` |
| Owner Intelligence | Skip tracing / paid data providers | **MISSING** | — |
| Property Management | Units, tenants, leases, rent ledger, work orders as first-class entities | **MISSING** | No tables in `supabase/migrations` |
| Property Management | Legacy tenant/technician portals (maintenance, upkeep, utilities, vendors, lease docs) | **PARTIAL / UNVERIFIED** — generic JSON `portal_records` store; payment history and community board are empty shells | `src/server/portal.ts`, `PaymentHistoryChart.tsx`, `CommunityBoard.tsx` |
| Vortex Phone | Power dialer, call state machine, outcomes, DNC gate | **PARTIAL** — fully implemented against a **simulated** provider only | `src/server/dialer.ts:4–69`, `dnc.ts` |
| Vortex Phone | Real calls, voicemail, recording, transcription | **MISSING** | `TELEPHONY_PROVIDER` other than `simulated` is ignored |
| Communications | Email / SMS | **MISSING** | README |
| AI Agents | Agent registry, run history, permission checks; 4 rule-based agents | **VERIFIED** (no model calls) | `src/server/agents.ts` |
| AI Agents | Gemini chat + maintenance analysis | **PARTIAL** — real when `GEMINI_API_KEY` set; production config UNVERIFIED | `server.ts:862–950` |
| Portals | Owner / vendor portals | **MISSING** | — |
| Integrations | 3Min webhook receiver (HMAC, replay window, idempotency) | **PARTIAL** — receiver VERIFIED; org trust gap (S2) | `server.ts:294`, `src/integrations/three-min.ts` |
| Integrations | GIS Cloud sync via Supabase Edge Function | **UNVERIFIED** end-to-end | `server.ts:777–860`, `supabase/functions/gis-cloud-sync` |
| Integrations | File storage | **MISSING** — routes return 501 | `server.ts:764–775` |
| Commercial | Signup | **VERIFIED** (free, self-serve) | — |
| Commercial | Subscriptions, entitlements, metering, billing | **MISSING** | — |
| Demo | Isolated, seeded, 24h demo orgs; blocked from paid/external routes | **VERIFIED** | `src/server/demo.ts`, tests "demo mode" |
| Website | Marketing site, legal pages, Airtable waitlist | **VERIFIED** (code); deployment UNVERIFIED (D3) | `website/*` |

---

## 4. Database and migration inventory

### 4.1 Migration sets (VERIFIED by reading every file)

| Set | Files | Role | Applied by |
|---|---|---|---|
| `supabase/migrations/` | 10 | Canonical app schema | Production: manual / Supabase (UNVERIFIED). CI/local: `scripts/apply-migrations.sh` (7 of 10) |
| `db/migrations/` | 4 | Older schema generation (`property_owner_links`, `property_sources`, `property_leads`, `saved_property_searches`) | Nothing. README: "do not apply to production" |
| `sql/` | 5 | Ingestion staging schema (`core.*`, `raw.*`) | `ca-ingest.yml` against a throwaway PostGIS; duplicates `20261006010000_ca_ingest_core.sql` |

### 4.2 Canonical tables

| Schema | Tables | Notes |
|---|---|---|
| `public` (core) | `organizations`, `users`, `auth_sessions` | `users_email_lower_unique_idx`: one email globally (a person cannot belong to two orgs) |
| `public` (CRM) | `properties`, `property_owners`, `leads`, `contacts`, `tasks`, `notes`, `activities`, `campaigns`, `campaign_contacts`, `calls`, `workflows`, `workflow_runs`, `agent_runs` | All CRM tables: `organization_id NOT NULL REFERENCES organizations ON DELETE CASCADE`, org-leading indexes |
| `public` (integrations) | `integration_events`, `gis_cloud_sync`, `portal_records` | `portal_records.organization_id` has **no FK** |
| `core` / `raw` (ingest) | `core.sources`, `core.parcels`, `core.signals`, `core.ingest_runs`, `raw.records`, `raw.hazard_zones(_sub)` | Not organization-scoped (public-record reference data). No RLS |

### 4.3 Findings

| # | Sev | Status | Finding | Evidence |
|---|---|---|---|---|
| B1 | High | **PARTIAL** | Tenant isolation lives only in application SQL. RLS policies are `FOR ALL TO vortex_app USING (true)`; they keep `anon`/`authenticated` out but do not separate tenants. | `20261005000000_vortex_app_rls.sql`, `crm_dialer_workflows.sql:279–282` |
| B2 | High | **VERIFIED** | CI/local schema differs from the canonical set: `apply-migrations.sh` skips `20261005000000_vortex_app_rls`, `20261005000100_gis_cloud_sync`, `20261005000200_postgis_property_spatial`. RLS and the GIS sync table are never exercised by tests. | `scripts/apply-migrations.sh` |
| B3 | High | **UNVERIFIED** | Two Supabase project refs in the repo: `supabase/config.toml` + `.mcp.json` use one (`qnmc…`), `.env.example` `SUPABASE_URL` uses another (`pkap…`). Production vs pre-production roles cannot be established without DB/Supabase access. | those files |
| B4 | High | **UNVERIFIED** | Which canonical migrations are applied in production. There is no migration ledger in the repo and the app only checks that 16 tables exist (`verifyCanonicalSchema`), not columns added later (e.g. `field_provenance`). | `src/db/index.ts:184–224` |
| B5 | Medium | **VERIFIED** | `portal_records` has RLS enabled with **no** `vortex_app` policy. If production connects as `vortex_app` (`NOBYPASSRLS`), every portal request returns nothing/fails; if it connects as `postgres`, RLS is bypassed entirely. Either way the intended model is not met. | `20261007000000_portal_records.sql`, `docs/db/vortex_app_role.sql` |
| B6 | High | **MISSING** | No documented backup schedule, retention, PITR status or restore drill. | `docs/*` (absent) |
| B7 | Medium | **VERIFIED** | `properties_org_apn_uq` is skipped with a `NOTICE` if duplicates exist, so uniqueness of `(organization_id, apn)` is not guaranteed in production. | `crm_dialer_workflows.sql:34–38` |
| B8 | Medium | **VERIFIED** | No down/rollback migrations; migrations are forward-only and mostly idempotent (`IF NOT EXISTS`). | all migration files |
| B9 | Low | **VERIFIED** | `src/db/schema.ts` (Drizzle) is descriptive only; `drizzle.config.ts` points at `./drizzle`, which does not exist. Two sources of schema truth can drift. | `drizzle.config.ts`, repo tree |
| B10 | Low | **VERIFIED** | `leads.owner_id` keeps a legacy meaning (creating user) next to `property_owner_id` — easy to misuse. | docs/ARCHITECTURE.md |
| B11 | Info | **VERIFIED** | Ingested `core.parcels` and the app's `properties` are separate models with no linking key used by the API — two "property" records. | `ca_ingest_core.sql`, `properties.ts` |

---

## 5. Security and reliability findings (ranked)

| # | Sev | Status | Finding | Evidence |
|---|---|---|---|---|
| S1 | High | **PARTIAL** | App-only tenant isolation (= B1). Mitigations present: `Where(orgId)` helper, `assertRef`/`assertUserInOrg` IDOR checks, cross-tenant tests. Missing: DB-enforced backstop. | `src/server/core.ts:146–200` |
| S2 | High | **VERIFIED** (documented gap) | 3Min webhook takes `organization_id` from the payload; one shared secret lets any holder write events into any organization. | `server.ts:294–352`, ARCHITECTURE "Known limitations" |
| S3 | Medium | **VERIFIED** | Routes behind `requireAuth` with **no permission check**: `GET /api/integrations/3min/status`, `POST /api/integrations/3min/test`, `GET /api/integrations/gis-cloud/maps`, `GET /api/integrations/gis-cloud/status`, `POST /api/integrations/gis-cloud/properties/:id/sync`. A `tenant` or `technician` member can trigger outbound GIS writes for the org's properties. | `server.ts:251, 266, 356, 777, 782` |
| S4 | Medium | **VERIFIED** | Rate limits are in-memory per serverless instance (login, signup, Gemini, demo, waitlist). | `server.ts:186–240`, `website/api/waitlist.ts` |
| S5 | Medium | **MISSING** | No password reset, email verification or MFA; sessions roll for 30 days on every request. | `src/middleware/auth.ts:83, 133–139` |
| S6 | Medium | **UNVERIFIED** | Audit logging for security events (login success/failure, role change, member disable, session revoke) — CRM activity log exists; auth-event logging not found in `server.ts`. | `grep logActivity server.ts` (none) |
| S7 | Medium | **VERIFIED** | `strict: false` TypeScript; `(req.user as any)` casts in core paths. | `tsconfig.json`, `core.ts:52` |
| S8 | Medium | **UNVERIFIED** | Vercel preview deployments (every branch, including Dependabot) may share production environment variables / database. The API showed previews are built; env scoping not inspected. | Vercel deployment list |
| S9 | Low | **VERIFIED** | GIS sync forwards the user's session cookie to the Edge Function, which runs with `verify_jwt = false`. | `server.ts:828`, `supabase/config.toml` |
| S10 | Low | **VERIFIED** | Signup stores free-text profile fields (income, employment, pets…) without length/format validation beyond the 1 MB body cap; this is sensitive tenant-screening data with no retention policy. | `server.ts:556–580` |
| S11 | Low | **UNVERIFIED** | `core`/`raw` ingest schemas have no RLS; safe only if they are not exposed through Supabase's Data API. | `ca_ingest_core.sql` |
| S12 | Info | **VERIFIED** (good) | scrypt hashing, hashed session tokens, `__Host-` HttpOnly SameSite=Lax cookie, HSTS, CSP frame-ancestors, zod on CRM routes, parameterized SQL, 1 MB JSON cap, no stack traces in responses, TLS verification on by default. | `src/security/password.ts`, `auth.ts`, `server.ts:175–185`, `db/index.ts` |

**Test coverage for security boundaries (VERIFIED by reading `tests/api.test.ts`):** cross-tenant reads/writes, RBAC per role, demo blocking, API hygiene, portal ownership, DNC — present. Not covered: the S3 integration routes, RLS behaviour, OAuth callback, rate-limit behaviour, webhook org spoofing.

**Reliability:** workflows run in-request and are not transactional or retried; there is no job queue or scheduler; ingestion runs only in GitHub Actions (300-minute job).

---

## 6. Deployment configuration findings

| # | Sev | Status | Finding | Evidence |
|---|---|---|---|---|
| D1 | Medium | **VERIFIED** | The GitHub repository is named `Vortex-One-Propflow.` (trailing period), not `Vortex-One-Propflow`. It works with git and Vercel, but breaks tooling that normalizes names (this session's GitHub API access was denied because of it). Renaming is a decision for you; GitHub redirects old URLs, but Vercel's Git link and Actions secrets must be re-checked after. | `git remote -v`; Vercel deployment meta `githubRepo: "Vortex-One-Propflow."` |
| D2 | — | **VERIFIED** | Platform: Vercel project `vortex1-unified` has production domain `vortex1-unified.vercel.app` (verified); latest production deployment is READY at `main` `4e169e9` (= audited commit). Root `vercel.json`: build `npm run build`, output `public`, `/api/*` → `api/index`. Password/SSO protection disabled (needed for the 3Min webhook). | Vercel API `list_project_domains`, `list_deployments` |
| D3 | Medium | **PARTIAL** | Website: Vercel project `vortexone` exists in the same team and builds from root directory `website` (VERIFIED: Vercel GitHub-bot metadata on PR #72; its preview build for this branch reached Ready). Project details returned 404 and deployments 403 to this session, so the production domain `vortexone.vercel.app` and its production deployment remain UNVERIFIED. | Vercel API errors; Vercel bot comment on PR #72 |
| D4 | Low | **VERIFIED** | Node mismatch: CI Node 20, Vercel Node 24.x. | `ci.yml`, Vercel project |
| D5 | Low | **VERIFIED** | Stale config: `.env.example` `APP_URL` is a Firebase `web.app` URL; `.firebaserc` remains after Firebase removal; `website/README.md` says "No forms and no backend" but `website/api/waitlist.ts` exists. | those files |
| D6 | Medium | **UNVERIFIED** | Production environment variables (DATABASE_URL pooler, `DATABASE_SSL_CA`, `DATABASE_POOL_MAX`, OAuth, `GEMINI_API_KEY`) — not inspected, by design. | — |
| E5 | Medium | **MISSING** | Monitoring: only `/api/health`, `/api/ready` and console logs. No error tracking, uptime alerting, or log drain. | repo, `server.ts:372–440` |
| E6 | Low | **VERIFIED** | Frontend bundle > 500 kB with ineffective dynamic imports (GeminiChatbot, MyAccount, CustomerSupport). | `vite build` output |

---

## 7. Preserve / repair / refactor / rebuild / retire

| Decision | Items |
|---|---|
| **Preserve** | Service layer + `route(permission, …)` pattern; RBAC matrix; `Where`/`assertRef` tenant helpers; CRM, campaigns, dialer state machine + DNC gate; workflows engine; agent registry; demo mode; per-field provenance; ingestion pipeline + freshness guards; CI; security middleware; `website/` |
| **Repair** | S3 permission gaps; B5 `portal_records` policy/FK; B2 test migration list; S2 webhook org binding; Microsoft OAuth (use ID-token `email` + `xms_edov`, or drop it); D5 stale config/docs |
| **Refactor** | Split `server.ts` (auth, OAuth, integrations, AI) into `src/server/*` modules; enable TypeScript strict per module; replace in-memory limiter with a Postgres-backed one; move workflow execution to a job table |
| **Rebuild** | Tenant/technician portals → real Property Management entities (units, leases, work orders) instead of the JSON `portal_records` store |
| **Retire** | `db/migrations/*` (archive after confirming none applied in production); `.firebaserc`; empty `PaymentHistoryChart`/`CommunityBoard` shells; `drizzle.config.ts` (or make Drizzle the real schema source — pick one) |

---

## 8. Proposed V2 architecture

### 8.1 Recommendation: modular monolith in the existing repo, boundaries first, moves later

The candidate `apps/ + packages/ + workers/` layout is a reasonable **end state**, but moving files now buys nothing: there is one team, one deployable API, one database, and the code already has domain modules. A monorepo split adds workspace tooling, build orchestration and Vercel root changes with real deployment risk (D2/D3).

**Target layout, reached incrementally (no big-bang move):**

```
website/                       (already separate — keep)
api/index.ts                   (Vercel entry — keep)
server.ts                      → thin: middleware + mount modules
src/server/
  core/        auth, sessions, orgs, members, rbac, audit, rate-limit
  crm/         contacts, leads, tasks, notes, activity, workflows   (PropFlow)
  properties/  properties, owners, provenance, scoring, enrich       (Owner Intelligence)
  pm/          units, leases, tenants, work-orders, ledger           (new, Phase 4)
  comms/       dialer, telephony providers, dnc, messaging           (Phase 5)
  agents/      registry, runners
  integrations/ 3min, gis-cloud, ingest bridge
  billing/     plans, entitlements, usage                            (Phase 8)
  jobs/        job table + runner (Vercel Cron → /api/jobs/tick)
src/features/<module>/         UI per module
supabase/migrations/           single canonical migration ledger
ingest/ + sql/                 stays in GitHub Actions (it is already the "worker")
```

Rules: a module may call another module only through its exported service functions; every service takes `Ctx`; every table carries `organization_id`; reference data (`core.parcels`) is global and read-only to tenants.

### 8.2 Key decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Rewrite vs extend | Extend | Working, tested, deployed code |
| Monorepo | Defer | No second deployable API yet |
| Tenant isolation | Keep app checks **and** add DB backstop: per-request `SET LOCAL app.org_id` + RLS `USING (organization_id = current_setting('app.org_id'))` on tenant tables | Defense in depth; one missed predicate no longer leaks |
| Background work | Postgres `jobs` table + Vercel Cron tick; no Redis/queue service | Free tier, no new infra |
| Telephony | Provider interface already exists; add Twilio (or Telnyx, cheaper) behind it with signed status webhooks | Minimal change |
| Email | Resend or Postmark free tier for password reset / verification | Required for S5 |
| Billing | Stripe Billing + entitlements table, Phase 8 | Avoid early paid service |
| Monitoring | Sentry free tier + Vercel log drain or Better Stack free uptime | Cheapest meaningful coverage |
| Ingested parcels ↔ properties | Link `properties.parcel_id → core.parcels`; enrich via existing provenance endpoint | One record per real property, provenance preserved |

---

## 9. Data migration and rollback strategy

1. **Establish the truth first (no writes):** read-only `pg_dump --schema-only` of each Supabase project; record `supabase_migrations.schema_migrations` (or equivalent); diff against `supabase/migrations`. Output: a table of which migration is applied where.
2. **Backups before anything:** confirm Supabase plan backups/PITR; take a manual logical dump; **restore it into a scratch project and run `/api/ready` + the integration suite against it** (restore drill).
3. **Pre-production first:** designate one Supabase project as staging, point Vercel Preview env at it only, never at production.
4. **Expand → migrate → contract:** additive migrations only (new columns nullable, new tables), backfill in batches, switch reads, then drop old columns in a later release.
5. **Each migration ships with:** idempotent forward SQL, a written reverse SQL (in the PR), a CI run on a schema built from *all* migrations, and a staging apply before production.
6. **Rollback:** application — Vercel "Instant Rollback" to the previous deployment; schema — forward fix or the reverse SQL; data — PITR/dump restore (only after the drill has proven it works).

---

## 10. Recommended MVP scope

**MVP = hardened PropFlow CRM + Owner Intelligence for California, simulated dialer clearly labeled.** This is what already works and is closest to sellable.

In: Phase 0 hardening; password reset + email verification; parcels ↔ properties linkage with provenance; saved searches/lists from ingested data; CSV import/export; audit log; monitoring; staging environment.

Out of MVP (later phases): real telephony, SMS/email campaigns, property management, portals, marketplace, billing (manual invoicing for pilot customers is fine).

---

## 11. Prioritized implementation backlog

| ID | Item | Depends on | Acceptance criteria | Est. |
|---|---|---|---|---|
| P0-1 | Production/staging DB inventory (read-only) | your authorization + DB access | Doc lists both Supabase projects' role, applied migrations, row counts per table (no row data) | 1–2 d |
| P0-2 | Backup + restore drill | P0-1 | Dump restored to scratch DB; `/api/ready` = ready; integration tests green on it; runbook in `docs/operations/` | 2 d |
| P0-3 | CI applies **all** canonical migrations (incl. `vortex_app` role stub, RLS, GIS, PostGIS) | — | CI schema = canonical set; tests pass | 1 d |
| P0-4 | Fix S3: add `route(permission)` to 3Min/GIS routes | — | Tenant/technician get 403; tests added | 0.5 d |
| P0-5 | Fix B5: `portal_records` FK + `vortex_app` policy | P0-1, P0-3 | Portal tests pass with app connected as `vortex_app` | 0.5 d |
| P0-6 | Separate Preview env from production DB | P0-1 | Vercel Preview uses staging `DATABASE_URL`; documented | 0.5 d |
| P0-7 | Monitoring: Sentry (API + web) + uptime check on `/api/ready` | — | Test error appears in Sentry; alert fires on forced 503 | 1 d |
| P0-8 | Doc/config cleanup (D5, B9, retire `db/migrations`) | P0-1 | No stale URLs; one schema source documented | 0.5 d |
| P1-1 | DB tenant backstop (RLS by `app.org_id`) | P0-3, P0-5 | Cross-tenant test that bypasses app predicate is blocked by DB | 3–5 d |
| P1-2 | Postgres-backed rate limiter | P0-3 | Limits hold across two app instances in test | 1 d |
| P1-3 | Email provider + password reset + verification | P0-7 | Reset flow e2e; tokens hashed, single-use, 1h TTL | 3 d |
| P1-4 | Security audit log (auth + member events) | — | Login/fail/role change/disable rows written and readable by admins | 1–2 d |
| P1-5 | 3Min webhook org binding (per-org secret or allow-list) | — | Spoofed `organization_id` rejected; test | 1 d |
| P1-6 | Split `server.ts`, enable strict TS in `src/server/core` | — | No behaviour change; typecheck strict for core | 2–3 d |
| P2-1 | Custom fields + configurable pipeline stages | P1-6 | Per-org stages; existing leads migrated; tests | 1–2 w |
| P2-2 | Jobs table + cron runner; workflows async with retry | P1-6 | Failed action retried with backoff; run history intact | 1 w |
| P3-1 | Link `core.parcels` → `properties`; enrich from parcels with provenance | P0-1 | Import by APN fills fields with `source=ca_ingest`, confidence, retrievedAt | 1–2 w |
| P3-2 | Coverage expansion + saved searches/lists | P3-1 | Freshness check green per source | ongoing |
| P4 | Property Management entities replacing `portal_records` | P1-1 | Units/leases/work orders with RLS; legacy data migrated | 4–6 w |
| P5 | Real telephony provider + signed status webhooks, recording consent | P1-1, P2-2 | Real call in staging; DNC enforced; demo still simulated | 3–4 w |
| P6 | Model-backed agents with approvals and cost caps | P2-2 | Agent actions go through services; human approval step; per-org spend limit | 3–4 w |
| P7 | Owner/tenant/vendor portals, integrations | P4 | Portal users see only their own records (tests) | 4–6 w |
| P8 | Stripe billing, entitlements, metering; pilot + cutover | P0-2 | Plan gates enforced server-side; webhook idempotent | 3–4 w |

---

## 12. Effort and major uncertainties

| Phase | Estimate (1 senior engineer) | Confidence |
|---|---|---|
| Phase 0 | 1.5–2 weeks | Medium (depends on P0-1 findings) |
| Phase 1 | 2–3 weeks | Medium |
| Phase 2–3 (MVP complete) | 4–6 weeks | Low–medium |
| Phases 4–8 | 4–6 months | Low |

Major uncertainties: which database is production and what it contains (B3/B4); whether production connects as `vortex_app` or `postgres` (B5); real data volume from ingestion; telephony compliance work (TCPA, call-recording consent by state); website deployment state (D3).

---

## 13. Risks, blockers and unresolved questions

**Blockers for Phase 0**
1. Read-only database access (or a schema-only dump from you) for both Supabase projects.
2. Confirmation of which Supabase project is production.
3. Vercel access to the `vortexone` project (or its settings screenshot) to verify D3.

**Questions for you**
1. Should the GitHub repo be renamed to drop the trailing period (D1)?
2. Is Microsoft sign-in required, or can it be removed?
3. Do any real customers/users exist in production today? (Determines migration care level.)
4. Target first market: California only, or multi-state from MVP?
5. Preferred telephony provider and budget ceiling for paid APIs?

**Risks**
- Applying the missing canonical migrations to production without the P0-1 inventory could fail mid-way (B7 duplicates, missing `vortex_app` role).
- Preview deployments touching production data (S8) until P0-6 is done.

---

## 14. Verification steps for each important finding

| Finding | How to verify |
|---|---|
| B1/S1 | `grep -n "USING (true)" supabase/migrations/*.sql` |
| B2 | Compare `ls supabase/migrations` with the list in `scripts/apply-migrations.sh` |
| B3 | `grep -rn "project_ref\|project_id\|SUPABASE_URL" supabase/config.toml .mcp.json .env.example` |
| B4 | In Supabase SQL editor (read-only): `select version from supabase_migrations.schema_migrations order by 1;` and `select column_name from information_schema.columns where table_name='properties' and column_name='field_provenance';` |
| B5 | `grep -n POLICY supabase/migrations/20261007000000_portal_records.sql` (none); in DB: `select current_user;` from the app's connection role |
| B6 | Supabase dashboard → Database → Backups (plan, PITR) |
| B7 | `select organization_id, apn, count(*) from properties group by 1,2 having count(*)>1;` |
| S2 | Read `server.ts:322–340`: `event.organizationId` from body is inserted unchecked |
| S3 | `grep -n "requireAuth" server.ts` and check lines 251, 266, 356, 777, 782 have no permission check; as a `tenant` session: `POST /api/integrations/gis-cloud/properties/<id>/sync` returns non-403 |
| S4 | `grep -n "rateLimit(" server.ts` — no `store` option |
| S6 | `grep -n "logActivity" server.ts` returns nothing |
| S8 | Vercel → Project → Settings → Environment Variables: check `DATABASE_URL` scope (Production vs Preview) |
| D1 | `git remote -v` |
| D2 | Vercel → `vortex1-unified` → Deployments: production = `4e169e9` |
| D3 | Root directory `website` is confirmed by the Vercel bot comment on PR #72. Still check Vercel → `vortexone` → Settings → General: Output = `dist`; Domains: `vortexone.vercel.app`; production deployment = current `main` |
| E6 | `npm run build` warnings |

### Commands actually executed in this audit

| Command | Result |
|---|---|
| `git status`, `git branch -a`, `git log`, `git remote -v`, `git stash list`, `git tag` | See §2.3 |
| `npm run typecheck` | Pass (exit 0) |
| `npm test` (no `TEST_DATABASE_URL`) | 14 pass, 0 fail, 1 skipped suite (all PostgreSQL integration tests skipped) |
| `python3 -m unittest discover -s tests_py` | 19 tests, OK |
| `./node_modules/.bin/vite build --outDir <scratchpad>` | Success, chunk-size warnings (E6). Output written outside the repo |
| Vercel API (read-only): list projects, get project, list domains, list deployments | `vortex1-unified` readable; `vortexone` 404/403 |
| GitHub API: list branches / PRs | Denied (D1) |

Integration tests were **not** run: PostgreSQL 16 is installed in the container but PostGIS is not, and `20261006010000_ca_ingest_core.sql` requires it. CI runs them on `postgis/postgis:16-3.4`; the latest CI result on `main` could not be read (GitHub API blocked).

---

## 15. Safest next step

**P0-1 + P0-3 together:** (a) obtain a read-only schema inventory of both Supabase projects and confirm which is production, and (b) make CI build its test database from all ten canonical migrations. Both are zero-risk to production data and they unblock every other item. P0-4 (permission checks on five integration routes) is the smallest code fix with a direct security benefit and can follow immediately after approval.

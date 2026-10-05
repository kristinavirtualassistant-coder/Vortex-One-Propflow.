# Repository Cleanup and Engineering Audit

## Scope

Audit baseline: commit `bad7ad20a3cf57c6e65434564966f9ae66c8f570`.

This cleanup branch removes verified obsolete repository artifacts without changing the authentication or PostgreSQL architecture.

## Completed on this branch

- Removed the duplicate Bun lockfile.
- Removed legacy Firebase configuration and Firestore rules.
- Removed the filesystem-backed `src/db/localDb.ts` implementation.
- Removed the duplicate `src/db/drizzle.config.ts`.
- Removed one-off patch scripts that are not referenced by package scripts or CI.
- Removed the obsolete root database entrypoint/schema.
- Removed the obsolete root-level React component copies; the active application is rooted at `src/main.tsx`.
- Added `app_data.json` to `.gitignore`.
- Removed the hard-coded fallback for `SOCIAL_AUTH_PEPPER`; social OAuth password hashing now requires the configured secret.

## Deliberately not changed

- `db/migrations/*`: migration history contains two schema generations and requires reconciliation rather than blind deletion.
- `db/migrations/*`: migration history contains two schema generations and requires reconciliation rather than blind deletion.
- The remaining four moderate npm audit findings in the `drizzle-kit` → `@esbuild-kit` development-only dependency chain; npm's automatic fix would downgrade `drizzle-kit` to 0.18.1, so this is deferred rather than forced.
- `src/lib/dataClient.ts` and `src/lib/storageClient.ts`: current components still depend on their compatibility API.
- Authentication architecture and PostgreSQL schema architecture.
- Active/open branches and pull requests.

## Remaining engineering work

1. Reconcile PostgreSQL migration history with `src/db/schema.ts` before any production migration is applied.
2. Review the remaining Drizzle Kit development dependency vulnerability chain and upgrade when a non-breaking patched path is available.
3. Review unreferenced API routes against external consumers and define the role/permission matrix before adding backend RBAC enforcement.
4. Add a real automated test command and CI test stage.
5. Synchronize README deployment and package-manager documentation.
6. Review stale branches and close/archive them only after confirming no required commits remain.


## Latest validation

- `npm ci` passes in GitHub Actions.
- `npm run typecheck` passes in GitHub Actions.
- `npm run build` passes in GitHub Actions.
- The previous high-severity `nanoid` audit finding and the `qs` findings were patched through lockfile-backed npm overrides.
- Four moderate development-only findings remain in the `drizzle-kit` → `@esbuild-kit` chain; automatic remediation would require a breaking Drizzle Kit downgrade and was not applied.
- No production deployment or database migration was performed.


## Phase 3 — API/security remediation

Applied evidence-based fixes without changing the database or authentication architecture:

- Registration and OAuth role inputs are now constrained to the roles exposed by the registration flow: `landlord`, `property_manager`, `technician`, and `tenant`. Invalid or privileged values such as `admin` fall back to `property_manager`.
- Property-lead persistence no longer references the nonexistent `users.owner_id` column. Lead ownership is explicitly stored against the authenticated user within the current organization.
- Property imports now update the existing property identified by the organization/APN lookup, rather than attempting an update using a caller-supplied replacement ID.
- API route review found no user-controlled outbound URL fetch/SSRF sink in the current server routes. OAuth token/profile calls use fixed provider endpoints.
- Generic data and storage routes remain authenticated and intentionally non-mutating/non-storage-backed; canonical tenant isolation is enforced on the implemented property APIs through `organization_id` predicates.

### Validation state after Phase 3

- Previous CI validation: npm ci, typecheck, and production build passed on the cleanup branch before the Phase 3 server commits.
- Latest Phase 3 commit: CI has not yet produced a new run; do not treat the earlier green run as validation of these newest changes.
- Production deployment and database migration remain intentionally untouched.

## Deployment architecture — 2026-09-30

- Vercel deployment configuration and repository references are intentionally not part of the active deployment architecture.
- Firebase Hosting and Firebase Functions are the repository deployment path.
- Supabase PostgreSQL remains the production application database.
- Deployment credentials must remain in GitHub/Firebase secret storage and must not be committed to the repository.


## Audit and build-out — 2026-10-05

Starting point: Express + PostgreSQL backend with only 6 tables (organizations, users, auth_sessions, properties, property_owners, leads), property search/import, auth, a Gemini chat proxy and integration receivers. The CRM, dialer, campaigns, workflows, agents and demo screens were either missing or placeholders with hard-coded data, and most portals read a different database (Firestore) directly from the browser.

Findings and what was done:

| Severity | Finding | Action |
|---|---|---|
| P0 | No server-side RBAC (any authenticated user could use every API) | Permission matrix enforced per route (`src/server/core.ts`) |
| P0 | Partial-update bug class: PATCH bodies parsed with schema defaults would silently reset unsent fields (e.g. `doNotCall`, `stage`) | `presentOnly()` on every PATCH + regression test |
| P1 | Browser talked to Firestore with no Firebase auth (portals, search, notifications, settings): data competing with PostgreSQL and failing at runtime | CRM roles no longer load it; search, notifications and account page moved to the API; legacy portals lazy-loaded; boot-time Firestore connection probe removed |
| P1 | Placeholder/fake screens (CRM, Prospecting, Messages, Financials, Leasing, Billing, Vendor Bidding, Invoicing, landing-page pricing tiers) | Removed (nothing real behind them) |
| P1 | Property search UI used columns that do not exist (bedrooms, vacancy, pre-foreclosure) and ignored filters | Replaced by the Properties module over real columns |
| P2 | `/api/auth/me` returned snake_case fields the client did not read; profile PATCH accepted unvalidated values | Normalized, zod-validated |
| P2 | Static "Live / Service UI ready / All systems operational" claims | Replaced by a real `/api/ready` check |
| P2 | GIS status always `configured: true`; `/api/metrics` returned `[]`; unused `/api/data/*` | Honest flag; dead routes removed |
| P3 | 36 unreachable source files (legacy portals/widgets with no route, duplicate settings page) and unused deps (`clsx`, `tailwind-merge`) | Removed after an import-graph reachability check from `src/main.tsx` |

Removed files were verified unreachable from the application entry points; git history retains them.

Still open (not addressed here): see "Known limitations" in `docs/ARCHITECTURE.md`; the legacy tenant/technician portals still depend on Firestore and were not re-verified; `db/migrations/*` remains an unreconciled older schema generation.

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
- Vercel's GitHub status continues to report a platform build-rate limit; this is not a repository build failure.
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
- Latest commit status currently reports Vercel as pending.
- Production deployment and database migration remain intentionally untouched.


## Auth incident findings — 2026-09-29

Production auth failures were traced to two verified deployment/database mismatches:

- Vercel runtime logs showed signup attempts connecting to **127.0.0.1:5432/5433**. A Vercel production function cannot reach the developer's local PostgreSQL instance. The production `DATABASE_URL` must point to the Supabase PostgreSQL database.
- The live Supabase `public.users` table initially contained only the canonical auth columns, while the application expected additional profile/OAuth columns. The database was updated additively with the fields already used by the server and frontend: `uid`, onboarding profile fields, `auth_provider`, `auth_provider_subject`, and `avatar_url`.
- A case-insensitive unique index was added for user email addresses.
- A SQL transaction test verified that the production schema can insert a representative organization, user, and auth session using the application's current column set; the test transaction was rolled back.
- The application now returns a clear configuration error when Vercel receives a loopback `DATABASE_URL`, and duplicate signup attempts return HTTP 409 instead of a generic server error.

### Current blocker for real sign-in/sign-up

The code and live database schema are now aligned, but real authentication cannot succeed until the Vercel production `DATABASE_URL` is corrected from the observed loopback target to the Supabase PostgreSQL connection string for project `vortex-one-production`. No database password or secret is stored in the repository or exposed in this document.

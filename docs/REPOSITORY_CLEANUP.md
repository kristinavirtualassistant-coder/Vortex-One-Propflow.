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

- `package-lock.json`: it is inconsistent with the current `package.json`, but a valid regenerated lockfile requires running npm against the current dependency graph. It must be regenerated before merging this branch.
- `db/migrations/*`: migration history contains two schema generations and requires reconciliation rather than blind deletion.
- `src/lib/dataClient.ts` and `src/lib/storageClient.ts`: current components still depend on their compatibility API.
- Authentication architecture and PostgreSQL schema architecture.
- Active/open branches and pull requests.

## Remaining engineering work

1. Regenerate `package-lock.json` from the current `package.json`.
2. Run `npm ci`, typecheck, and production build from a clean checkout.
3. Remove only dependencies proven unused after the regenerated lockfile is validated.
4. Reconcile PostgreSQL migration history with `src/db/schema.ts`.
5. Review unreferenced API routes against external consumers.
6. Add a real automated test command and CI test stage.
7. Synchronize README deployment and package-manager documentation.
8. Review stale branches and close/archive them only after confirming no required commits remain.

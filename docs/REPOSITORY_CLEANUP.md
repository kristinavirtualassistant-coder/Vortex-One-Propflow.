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

1. Reconcile PostgreSQL migration history with `src/db/schema.ts`.
2. Review the remaining Drizzle Kit development dependency vulnerability chain and upgrade when a non-breaking patched path is available.
3. Review unreferenced API routes against external consumers.
4. Add a real automated test command and CI test stage.
5. Synchronize README deployment and package-manager documentation.
6. Review stale branches and close/archive them only after confirming no required commits remain.

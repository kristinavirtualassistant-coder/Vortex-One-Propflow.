# Firestore security plan

Status: **proposal for review, no code changes yet.**
Covers audit findings Critical #1 (open Firestore rules) and Critical #2 (split between two databases).
Scope note: this plan is written so that nothing in it starts the Firestore-to-Postgres migration until you decide to.

## 1. What is true today

Verified in the repository on `main`:

| Fact | Where |
|---|---|
| Every collection allows `read: if true`: anyone on the internet can read all of it. | `firestore.rules` |
| Create and update are checked only for document shape, never for who is asking. `isSignedIn()` is defined but never used. | `firestore.rules` |
| Ten collections allow delete with no sign-in. | `firestore.rules` |
| The web config, including the API key, ships to every browser. That is normal for Firebase, but it means anyone can talk to Firestore directly. | `firebase-applet-config.json` |
| `firebase.json` has no `firestore` section, so this repo does **not** deploy `firestore.rules`. The rules that are live come from somewhere else (console or an old deploy). | `firebase.json` |
| The database is a named one, not `(default)`: `ai-studio-propflow-...`. | `firebase-applet-config.json` |
| App login is the Postgres session. The browser never has a Firebase user. The only Firebase Auth call is a Google popup for the Drive picker. | `src/lib/googlePicker.ts` |
| 24 files read and write Firestore directly from the browser: maintenance, leases, vendors, documents, utilities, finance, activity, user settings. | `src/lib/dataClient.ts` and its callers |
| No Firestore document carries an organization field. Writes use `userId: user?.uid \|\| 'anonymous'`. | e.g. `src/components/MaintenanceRequest.tsx` |
| `firebase-admin` is in the root `package.json` but is not imported anywhere, and it is not in `functions/package.json`. | package files |

Not verified (I cannot see these):
- What the **live** Firestore rules are for the named database. They may be more open or less open than the file.
- Whether the Firestore data is real production data, and how much.
- Which of the 12 collections already have a Postgres table. The three schemas in the repo disagree (audit #10), so this needs mapping before any migration.

Consequence of the facts above: **any rule that requires a signed-in user blocks every one of those 24 files today**, because the browser has no Firebase user. There is no rule change that is both safe and useful without a code change.

## 2. Step zero (you, no code, do this first whichever option you pick)

1. Firebase console, project `vortex-one-propflow`, named database `ai-studio-propflow-...`: read the live rules and note them down.
2. Check what is in the database: collection names, document counts, whether it is real tenant/landlord data or test data.
3. Export a backup before anything changes (`gcloud firestore export` for that database).
4. Check the Firestore usage and request graphs for traffic that is not from your own app.

If step 2 shows the data is test-only, the plan collapses to option A below and the rest is optional.

## 3. Options

### A. Deny all
`allow read, write: if false;`, deployed to the named database.
- Closes the exposure at once.
- All 24 Firestore-backed files fail until their data moves behind the API (option C).
- Right choice if the data is not real, or if a short outage of those screens is acceptable.

### B. Sign-in bridge (stopgap)
After the normal Postgres login, the server mints a Firebase custom token carrying the user id plus `org` and `role` claims. The browser calls `signInWithCustomToken`. Rules then require `request.auth != null`.
- Keeps the 24 files working for logged-in users and closes public access.
- Does **not** isolate organizations: any logged-in user could still read every organization's Firestore data, because documents have no organization field. It is a floor, not a fix.
- Needs: a new server endpoint, a client sign-in step, `firebase-admin` added to `functions/package.json`, an IAM grant so the function's service account can sign tokens (typically "Service Account Token Creator"), and a rules deploy to the named database (a `firestore` entry in `firebase.json` for that database id, to be checked against current firebase-tools docs before the PR).
- Throwaway work if you go straight to option C.

### C. Move the screens to `/api` (the real fix)
Replace direct Firestore access with endpoints that check organization and role on the server, backed by Postgres. When the last screen is moved, set rules to deny-all and remove the bridge.
- Fixes both Critical items: one database, access checked on the server.
- This is the migration you asked me to hold. It depends on the Postgres schema being reconciled first (audit #10, #7), because the target tables must exist and match.
- Largest effort; delivered as one PR per area so each can be reviewed and rolled back alone.

## 4. Recommended sequence

1. **Step zero** (you).
2. **Decide by data**:
   - Test data only: option A now, then option C at your pace.
   - Real data: option B as a stopgap only if option C will take weeks; otherwise go straight to C and accept the exposure window, with step-zero backup in hand.
3. **Phase C0, mapping** (no behavior change): list the 12 collections, their fields, which already have Postgres tables, and which screens use each. Output is a table, not code.
4. **Phase C1, schema**: reconcile the Postgres schema in `supabase/migrations` only (audit #10), and remove runtime DDL (audit #7). This is prerequisite work, and it is the part that needs your sign-off on how the schema is managed.
5. **Phase C2, area by area**: for each area (suggested order: activity logs and finance analytics, then vendors and leases, then maintenance requests, then documents and uploads, then user settings), add `/api` endpoints with organization and role checks, switch the screens, backfill data with an organization id (documents written by `'anonymous'` cannot be mapped to an organization and need a decision), verify, then move on.
6. **Phase C3, close**: deny-all rules, remove `dataClient.ts` Firestore access and the bridge if one was built.

## 5. Rollout and rollback

- Every phase is its own PR with typecheck and build run, and the rules file is the last thing to change in each phase.
- Before any rules deploy: backup exists, and the previous live rules are saved in this repo or the PR so they can be restored.
- A rules deploy is reversible by redeploying the saved rules. A data backfill is only reversible from the backup, so it comes last in each area and runs on a copy first.
- Because the deploy workflow currently fails at its credentials step, rules would be deployed by hand with `firebase deploy --only firestore:rules` unless that is fixed first.

## 6. Decisions needed from you

1. Is the Firestore data real? (Step zero.)
2. Are you lifting the hold on the migration (option C)? If yes, who owns the schema decision in phase C1?
3. If real data and a long migration: do you want the stopgap bridge (option B)?
4. How is production actually deployed today? The Firebase workflow fails, so rules and functions may be deployed some other way.

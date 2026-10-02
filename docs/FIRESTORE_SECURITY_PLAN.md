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
| App login is the Postgres session, not Firebase. The only Firebase Auth call is `signInWithPopup` (Google) in the Drive picker, and nothing ever signs out. So most browsers have no Firebase user, but anyone who completes the Drive-picker popup is left signed in to Firebase with their own Google account. | `src/lib/googlePicker.ts`, used by `src/components/DocumentManager.tsx` |
| 24 files read and write Firestore directly from the browser: maintenance, leases, vendors, documents, utilities, finance, activity, user settings. | `src/lib/dataClient.ts` and its callers |
| The browser write path I read does not add an organization field; writes use `userId: user?.uid \|\| 'anonymous'`. What fields the existing documents actually contain is **not verified**. | e.g. `src/components/MaintenanceRequest.tsx` |
| `firebase-admin` is in the root `package.json` but is not imported anywhere, and it is not in `functions/package.json`. | package files |

Not verified (I cannot see these):
- What the **live** Firestore rules are for the named database. They may be more open or less open than the file.
- Whether the Firestore data is real production data, and how much.
- Which of the 12 collections already have a Postgres table. The three schemas in the repo disagree (audit #10), so this needs mapping before any migration.

Consequences of the facts above:
- A rule that requires a Firebase sign-in blocks the 24 files for every user who has not signed in to Firebase, which is most users, because app login is not Firebase. There is no rule change that is both safe and useful without a code change.
- A rule that only checks `request.auth != null` is **not a real gate**: the Drive picker proves that Google sign-in works on this Firebase project, so anyone can sign in with their own Google account using the public web config and pass that check. Any rule that replaces the open ones must require something only this app's server can grant, such as a custom claim (for example `request.auth.token.org`), not just a signed-in user.

## 1a. Hosting constraint: the Firebase project is on the free Spark plan

The repo owner is on the Spark (no-cost) plan. Deploying Cloud Functions requires the Blaze (pay-as-you-go) plan; on Spark the deploy fails with "Your project must be on the Blaze (pay-as-you-go) plan to complete this command" (confirmed from public sources, not from the Firebase console). Functions secrets (Secret Manager) are, as far as I know, also Blaze-only; I have not confirmed that.

What this means here:
- The whole Express backend (login, sessions, properties, Gemini, webhooks) is packaged as the Cloud Function `api` (`functions/index.ts`) and reached through the Hosting rewrite `/api/**`. **That function cannot be deployed on Spark.** The `Deploy Hosting and Functions` workflow also asks for `--only hosting,functions`, so it would fail on the plan even once its credentials step is fixed.
- `docs/FIREBASE_DEPLOYMENT.md` says Vercel deployment was removed and Firebase Functions is the intended API runtime, and `docs/INTEGRATION_MATRIX.md` says the former Vercel API entrypoint was removed. Together with the Spark limit, this suggests **the API may not be running anywhere right now**, and only static Hosting (or a Vercel preview) is serving the frontend. This is an inference; the owner should confirm it.
- Spark is fine for: Hosting, Firestore (within the free quota) and deploying Firestore rules. So **option A below works on Spark as is.**
- Options B and C both need a server that is running, so each needs a decision on where the backend runs first.

Free or cheap places to run the Express API instead, for the owner to choose between: Vercel (free serverless functions; the project already exists), Render or Railway (free or low-cost tiers), Cloudflare Workers (needs the Express code adapted), or Supabase Edge Functions (already used for `gis-cloud-sync`, also needs adapting). Upgrading the Firebase project to Blaze is the smallest code change (Blaze has a monthly free tier for Functions, but needs a billing account and a budget alert). I have not priced or tested any of these.

## 2. Step zero (you, no code, do this first whichever option you pick)

1. Firebase console, project `vortex-one-propflow`, named database `ai-studio-propflow-...`: read the live rules and note them down.
2. Check what is in the database: collection names, document counts, whether it is real tenant/landlord data or test data, and whether existing documents contain a populated organization field.
3. Take a backup before anything changes. Managed export (`gcloud firestore export gs://<bucket> --database=<named-database-id>`; confirm the flags with `gcloud firestore export --help`) needs billing (Blaze) and a Cloud Storage bucket, and without `--database` it targets `(default)`, not your named database. On Spark you have two routes: enable Blaze temporarily just for the export, or take a JSON dump of the 12 collections with a read-only script using the Admin SDK and a service account (reads count against the free daily quota). I can write that script if you want it.
4. Check the Firestore usage and request graphs for traffic that is not from your own app.
5. Find out where the live site's `/api` actually runs today (open the live site, check whether login works, and check the network tab for `/api/*` responses). On Spark it cannot be a Firebase Function.

If step 2 shows the data is test-only, the plan collapses to option A below and the rest is optional.

## 3. Options

### A. Deny all
`allow read, write: if false;`, deployed to the named database.
- Closes the exposure at once.
- All 24 Firestore-backed files fail until their data moves behind the API (option C).
- Right choice if the data is not real, or if a short outage of those screens is acceptable.

### B. Sign-in bridge (stopgap)
After the normal Postgres login, the server mints a Firebase custom token carrying the user id plus `org` and `role` claims. The browser calls `signInWithCustomToken`. Rules then require the server-minted claim (for example `request.auth.token.org != null`), **not** just `request.auth != null`, because any Google account can already obtain a plain Firebase sign-in (see section 1).
- Keeps the 24 files working for logged-in users and closes public access.
- Does **not** isolate organizations on its own: a claim check proves the caller is a user of this app, not which organization's data they may read, so any logged-in user could still read every organization's Firestore documents unless the documents carry an organization field the rules can compare (not verified, see step zero). It is a floor, not a fix.
- Needs a running backend (see 1a), plus: a new server endpoint, a client sign-in step, `firebase-admin` added to `functions/package.json`, an IAM grant so the function's service account can sign tokens (typically "Service Account Token Creator"), and a rules deploy to the named database (a `firestore` entry in `firebase.json` for that database id, to be checked against current firebase-tools docs before the PR).
- Throwaway work if you go straight to option C.

### C. Move the screens to `/api` (the real fix)
Replace direct Firestore access with endpoints that check organization and role on the server, backed by Postgres. When the last screen is moved, set rules to deny-all and remove the bridge.
- Fixes both Critical items: one database, access checked on the server.
- This is the migration you asked me to hold. It depends on the Postgres schema being reconciled first (audit #10, #7), because the target tables must exist and match.
- Largest effort; delivered as one PR per area so each can be reviewed and rolled back alone.
- Needs a backend host first (see 1a). On Spark that means either moving to Blaze or choosing another host.

## 4. Recommended sequence

1. **Step zero** (you).
2. **Decide by data**:
   - Test data only: option A now, then option C at your pace.
   - Real data: option B as a stopgap only if option C will take weeks; otherwise go straight to C and accept the exposure window, with step-zero backup in hand.
3. **Phase C0, mapping** (no behavior change): list the 12 collections, their fields, which already have Postgres tables, and which screens use each. Output is a table, not code.
4. **Phase C1, schema**: reconcile the Postgres schema in `supabase/migrations` only (audit #10), and remove runtime DDL (audit #7). This is prerequisite work, and it is the part that needs your sign-off on how the schema is managed.
5. **Phase C2, area by area** (suggested order: activity logs and finance analytics, then vendors and leases, then maintenance requests, then documents and uploads, then user settings). For each area, in this order:
   1. Add the `/api` endpoints with organization and role checks, not yet used by any screen.
   2. Copy that area's Firestore documents into Postgres with an organization id. Documents written by `'anonymous'` cannot be mapped to an organization and need a decision.
   3. Reconcile: compare counts and spot-check records between Firestore and Postgres.
   4. Handle writes that happen during the copy. Simplest for a small app: a short maintenance window for that area, with that collection's Firestore rules set to read-only while steps 2 to 3 are re-run for any new documents. The alternative is dual-writing (screens write to both) until cutover, which is more code.
   5. Switch the screens to `/api`, then verify before moving to the next area. Firestore data is not modified until the last area is done, so any area can be switched back.
6. **Phase C3, close**: deny-all rules, remove `dataClient.ts` Firestore access and the bridge if one was built.

## 5. Rollout and rollback

- Every phase is its own PR with typecheck and build run, and the rules file is the last thing to change in each phase.
- Before any rules deploy: backup exists, and the previous live rules are saved in this repo or the PR so they can be restored.
- A rules deploy is reversible by redeploying the saved rules. The copy into Postgres (phase C2, step 2) does not change Firestore, so it is reversible by deleting the copied rows, and Firestore remains the source of truth until a screen is switched. Switching a screen is reversible while Firestore is still intact. The step-zero backup protects against anything that does modify Firestore, such as the final deny-all rules or a decision to delete old data.
- Because the deploy workflow currently fails at its credentials step, rules would be deployed by hand with `firebase deploy --only firestore:rules` unless that is fixed first.

## 6. Decisions needed from you

1. Is the Firestore data real? (Step zero.)
2. Are you lifting the hold on the migration (option C)? If yes, who owns the schema decision in phase C1?
3. If real data and a long migration: do you want the stopgap bridge (option B)?
4. Where does the backend run today, and where should it run? On Spark it cannot run as a Firebase Function: move to Blaze, or choose another host (see 1a).

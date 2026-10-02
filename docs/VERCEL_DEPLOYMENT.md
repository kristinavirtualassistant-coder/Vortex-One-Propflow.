# Vortex One PropFlow: Vercel deployment

Why this exists: the Firebase project is on the free Spark plan, and Cloud Functions cannot be deployed on Spark. The Express API therefore runs on Vercel as a serverless function, and Vercel also serves the built frontend. See `docs/FIRESTORE_SECURITY_PLAN.md` section 1a for the background.

## How it works

- `vercel.json` builds the web app with `npm run build` (output in `public/`), routes `/api/*` to the function in `api/index.ts`, and sends every other path to `/index.html` (single-page app).
- `api/index.ts` creates the Express app from `server.ts` (`createApp()`) once per function instance and hands each request to it.
- Vercel deploys every push to `main` to production automatically, and builds a preview for every branch and pull request.

## Environment variables (Vercel project settings, Environment Variables)

Set these for the Production environment. Do not commit values; do not paste them into issues or chat.

Needed for email and password login and signup:

| Name | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. On serverless, use the Supabase connection pooler URL, not the direct one. |
| `DATABASE_SSL_CA` | The Supabase root CA certificate (PEM). Required because the server verifies the database certificate by default. If it is missing, every database call fails with a certificate error and login returns "Authentication service unavailable". |

Needed for specific features:

| Name | Feature |
|---|---|
| `GEMINI_API_KEY` | AI chat and maintenance analysis |
| `APP_URL` | Social sign-in redirect addresses (the site's public https address, no trailing slash) |
| `SOCIAL_AUTH_PEPPER` | Social sign-in (account password hashing, state signing) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft sign-in (currently rejected, see audit finding #4 follow-up) |
| `THREEMIN_WEBHOOK_SECRET`, `THREEMIN_WEBHOOK_TOKEN` | 3Min webhook |
| `GIS_CLOUD_MAP_ID`, `GIS_CLOUD_LAYER_ID`, `GIS_CLOUD_ACCESS_TOKEN`, `SUPABASE_URL` | GIS Cloud sync |

Optional tuning:

| Name | Default | Notes |
|---|---|---|
| `DATABASE_POOL_MAX` | 10 | Per function instance. On serverless many instances run at once, so set this low (for example 2 or 3) to stay inside the database's connection limit. |
| `TRUST_PROXY_HOPS` | 1 | Number of trusted proxies in front of the app, used for client IPs in rate limiting. Vercel puts the client address in `X-Forwarded-For`; check real addresses after deploying. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | unset | Set to `false` only as an emergency opt-out of certificate verification. |

## Verify after deploying

1. Open `https://<your-site>/api/health`. JSON with `"status":"ok"` means the function is deployed and running (it does not touch the database). The app's web page, or a 404, means the function is not deployed.
2. Open `https://<your-site>/api/ready`. `"status":"ready"` means the database connection works. `"status":"not_ready"` (HTTP 503) means the function runs but cannot use the database, usually a wrong `DATABASE_URL` or a missing `DATABASE_SSL_CA`.
3. Try logging in. In the browser developer tools, Network tab, check the status of `/api/auth/login`.
4. If something fails, Vercel project, Logs shows the function output. Request bodies are not logged for rejected requests.

## Known limits on this setup

- Rate-limit counters live in memory per function instance, so on serverless they reset on cold starts and are not shared across instances. They slow abuse but do not cap it exactly. A shared store would fix that.
- Long AI responses may run into the free plan's function time limit. This has not been tested here.

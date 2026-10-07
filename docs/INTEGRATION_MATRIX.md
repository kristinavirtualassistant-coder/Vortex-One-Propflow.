# Vortex One PropFlow — Integration Matrix

## Core application contracts

| Capability | UI surface | Backend contract | Data source | Current state |
|---|---|---|---|---|
| Auth | Landing page, sign in / sign up / OAuth | `/api/auth/*` | PostgreSQL | Live. Microsoft OAuth cannot complete (its profile endpoint does not assert `email_verified`, and unverified emails are rejected) |
| CRM (contacts, leads, tasks, notes, activity, search) | Contacts, Leads, Tasks, global search | `/api/contacts`, `/api/leads`, `/api/tasks`, `/api/notes`, `/api/activity`, `/api/search` | PostgreSQL | Live (tested) |
| Property & owner intelligence | Properties, Owners | `/api/properties*`, `/api/owners*` | PostgreSQL | Live (tested). No external public-record provider is connected; data is user-entered, imported, or fictional demo data |
| Campaigns | Campaigns | `/api/campaigns*` | PostgreSQL | Live (tested) |
| Dialer | Dialer | `/api/calls*`, `/api/dialer/status` | PostgreSQL | **Simulated.** No telephony provider is integrated |
| Workflows | Workflows | `/api/workflows*`, `/api/workflow-runs` | PostgreSQL | Live (tested). Notifications are in-app only; no email/SMS action exists |
| AI agents | AI Agents | `/api/agents*`, `/api/agent-runs` | PostgreSQL | Live, rule-based (no model calls) |
| Demo / sandbox | "Try the live demo", Team → Reset | `/api/demo/*` | PostgreSQL (isolated org) | Live (tested) |
| AI assistant | AI Assistant | `/api/gemini/chat` | Gemini server SDK | Live when `GEMINI_API_KEY` is configured; blocked in demo |
| Maintenance AI | Legacy technician/tenant portals | `/api/maintenance/analyze` | Gemini server SDK | Live when `GEMINI_API_KEY` is configured; blocked in demo |
| 3Min events | Integration Center / webhook | `POST /api/integrations/3min/webhook` | PostgreSQL integration_events | Receiver implemented and signature-verified; end-to-end external delivery not verified in this audit |
| GIS Cloud | GIS & Mapping | `/api/integrations/gis-cloud/*` | Supabase Edge Function | Requires `SUPABASE_URL` + deployed function + secrets; not verified in this audit |
| Readiness | Footer status | `/api/health`, `/api/ready` | Service + PostgreSQL | Live |
| Files | (none in CRM UI) | `/api/storage*` returns 501 | Supabase Storage | Not connected |
| Email, SMS, voice | (none) | (none) | (none) | Not implemented |
| Tenant / technician portals | Legacy portals | Browser → `/api/portal/*` (`src/lib/dataClient.ts`) | PostgreSQL `portal_records` | Legacy UI now served from PostgreSQL; unverified |

## Integration truth rules

- A UI badge may say **Connected** only after a server-side health check, authenticated handshake, or verified webhook path.
- Local boolean toggles are not integrations.
- A service requiring credentials must show **Setup required** until required server-side environment variables are present.
- Production webhook delivery must target the public API endpoint of the production deployment (see `docs/VERCEL_DEPLOYMENT.md`).
- External service credentials never belong in frontend code.

## 3Min API

The 3Min sandbox endpoint was verified on 2026-09-30 by a successful POST to the configured `vortex-propflow-events` endpoint. The returned record reached 3Min successfully.

The configured owner webhook previously attempted delivery to the PropFlow Vercel hostname and received HTTP 401 `Protected deployment`. Disable Vercel deployment protection for the webhook path (or use a public production domain) so deliveries are not rejected.

Expected production receiver:

`POST /api/integrations/3min/webhook`

Required server-side secret:

`THREEMIN_WEBHOOK_SECRET`

Receiver behavior:
- verifies HMAC SHA-256 v1 signatures
- enforces a 5-minute replay window
- rejects payloads over 256 KB
- requires `organization_id`
- deduplicates with `idempotency_key`

## Verification

The API contract is derived from the current `server.ts` implementation. Keep this document synchronized whenever routes or integration behavior changes.


## GIS Cloud

PropFlow now treats GIS Cloud as a first-class spatial integration.

- UI route: `/dashboard/gis`
- Server route: `GET /api/integrations/gis-cloud/maps`
- Required server credential: `GIS_CLOUD_ACCESS_TOKEN`
- Optional API base URL: `GIS_CLOUD_API_BASE_URL` (defaults to `https://api.giscloud.com`)
- The UI lists live GIS Cloud maps and opens each map using its editor URL.
- GIS Cloud supports maps, layers, feature queries/edits, spatial SQL, files/imports, tables, MDC forms, bookmarks and basemaps; deeper write operations should be added behind explicit server-side authorization and audit logging.

### Verified GIS Cloud account context
The connected GIS Cloud account currently exposes 22 maps, including the existing **Vortex One Property Intelligence** map (ID 3302957) plus MDC/sample maps.

## Deployment

See `docs/VERCEL_DEPLOYMENT.md`. The Express API runs as a Vercel serverless function (`api/index.ts`) in front of Supabase PostgreSQL. Runtime secrets live in the hosting provider's secret manager; do not commit secret values.

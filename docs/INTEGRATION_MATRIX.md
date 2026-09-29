# Vortex One PropFlow — Integration Matrix

## Core application contracts

| Capability | UI surface | Backend contract | Data source | Current state |
|---|---|---|---|---|
| Auth | Sign in / sign up / OAuth | `/api/auth/*` | PostgreSQL | Live in code; deployment config must be correct |
| Property intelligence | Property Search / Leads | `/api/properties/search`, `/api/properties/:id`, `/api/property-leads`, `/api/properties/import` | PostgreSQL | Live |
| AI assistant | AI Assistant | `/api/gemini/chat` | Gemini server SDK | Live when `GEMINI_API_KEY` is configured |
| Maintenance AI | Maintenance | `/api/maintenance/analyze` | Gemini server SDK | Live when `GEMINI_API_KEY` is configured |
| 3Min events | Integration Center / webhook | `POST /api/integrations/3min/webhook` | PostgreSQL integration_events | Receiver implemented; external delivery currently blocked by Vercel protection |
| Readiness | Integration Center / status bar | `/api/health`, `/api/ready` | Service + PostgreSQL | Live |
| Financial metrics | Financials | `/api/metrics` | PostgreSQL | Requires real aggregate implementation; no fabricated values |
| Files | Document Center | Supabase Storage contract / current server returns 501 | Supabase Storage | Explicitly not connected until canonical storage route is configured |
| Generic legacy collections | Compatibility layer | `/api/data/:collection` | Canonical PostgreSQL only | Intentionally limited; no fake writes |

## Integration truth rules

- A UI badge may say **Connected** only after a server-side health check, authenticated handshake, or verified webhook path.
- Local boolean toggles are not integrations.
- A service requiring credentials must show **Setup required** until required server-side environment variables are present.
- Production webhook delivery must not target a Vercel deployment protected by Vercel authentication.
- External service credentials never belong in frontend code.

## 3Min API

The 3Min sandbox endpoint was verified on 2026-09-30 by a successful POST to the configured `vortex-propflow-events` endpoint. The returned record reached 3Min successfully.

The configured owner webhook then attempted delivery to the PropFlow Vercel hostname and received HTTP 401 `Protected deployment`. This is an external deployment configuration issue, not a 3Min request-processing failure.

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

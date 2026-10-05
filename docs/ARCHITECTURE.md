# Architecture

## Layers

```
Frontend (src/)  →  /api (Express)  →  requireAuth  →  route(permission)  →  service SQL  →  PostgreSQL
                                                              │                     │
                                                              └── logActivity ──────┤
                                                              └── emit(event) → workflow engine → same services
```

| Layer | Files |
|---|---|
| Frontend shell, routing | `src/App.tsx`, `src/pages/Dashboard.tsx`, `src/components/Sidebar.tsx` |
| CRM UI | `src/features/crm/*` (API client `api.ts`, UI kit `ui.tsx`, pages) |
| Express app, auth, OAuth, webhooks, Gemini | `server.ts`, `src/middleware/auth.ts` |
| Domain services + routes | `src/server/*` (`core.ts` = context, RBAC, helpers; one module per domain) |
| DB access | `src/db/index.ts` (pool, transactions, startup schema check), `src/db/schema.ts` (Drizzle schema, documentation of the tables) |
| Migrations | `supabase/migrations/*` (canonical) |

## Data ownership

One source of truth per entity, all in PostgreSQL, all with `organization_id`:

| Entity | Table | Notes |
|---|---|---|
| Organization | `organizations` | `is_demo`, `demo_expires_at` for sandboxes |
| User / session | `users`, `auth_sessions` | `role` ∈ admin, property_manager, sales, landlord, technician, tenant |
| Property | `properties` | unique `(organization_id, apn)`; `owner_id` → `property_owners` |
| Owner | `property_owners` | portfolio counts/values are **derived** from `properties` (stored columns are ignored) |
| Contact | `contacts` | `property_owner_id` links a person to an owner record; `do_not_call` is authoritative |
| Lead | `leads` | `primary_property_id`, `contact_id`, `property_owner_id`, `assigned_user_id`; `owner_id` keeps its legacy meaning (creating user) |
| Task / Note | `tasks`, `notes` | explicit nullable foreign keys to contact/lead/property/campaign/call |
| Activity | `activities` | append-only; every related id is stored so an event appears on the contact, lead, property, owner and campaign |
| Campaign | `campaigns`, `campaign_contacts` | membership holds attempts/status; metrics are queries over `calls` + membership |
| Call | `calls` | `provider`, `is_simulated`, state machine below |
| Workflow | `workflows`, `workflow_runs` | runs store trigger payload, per-step results, error |
| Agent run | `agent_runs` | input/output/error per run |

The same lead shown on the dashboard, in a property, an owner, a campaign member list, call history and the activity feed is the same `leads` row; no module keeps its own copy.

## Authentication & authorization

* Email/password (`/api/auth/signup|login|logout|me|password`), Google and Microsoft OAuth. Sessions are random 256-bit tokens stored hashed (`auth_sessions`), delivered in an HttpOnly cookie, rolling 30-day expiry.
* Signup can only mint `landlord`, `property_manager`, `technician`, `tenant` (never `admin`/`sales`); each signup creates its own organization. More users are added by a manager via `POST /api/org/members`.
* **Permissions** (`ROLE_PERMISSIONS` in `src/server/core.ts`):

| Role | Permissions |
|---|---|
| admin, property_manager | all: crm:read/write/delete, campaigns:manage, dialer:use, workflows:manage/run, agents:run, members:read/manage, demo:reset |
| sales | crm:read/write, campaigns:manage, dialer:use, workflows:run, agents:run, members:read |
| landlord | crm:read, members:read |
| technician, tenant | none (legacy portals only) |

Only an `admin` can create or change `admin` members. Disabling a member deletes their sessions.
* Every route is `route(permission, handler)`: permission → ready DB → handler. Every query includes `organization_id`. Request bodies that reference other records go through `assertRef` / `assertUserInOrg` (400 for another organization's ids).
* Automation never exceeds a human: workflows and agents run with the **triggering user's role**, call the same services, and agents additionally require their declared permissions.

## API (all under `/api`, authenticated unless noted)

| Area | Endpoints |
|---|---|
| Public | `GET /health`, `GET /ready`, `POST /auth/signup`, `POST /auth/login`, `GET /auth/{google,microsoft}/{start,callback}`, `POST /demo/session`, `POST /integrations/3min/webhook` (HMAC/token) |
| Account | `GET/PATCH /auth/me`, `POST /auth/logout`, `POST /auth/password`, `GET /org`, `GET/POST /org/members`, `PATCH /org/members/:id` |
| Contacts | `GET/POST /contacts`, `GET/PATCH /contacts/:id`, `POST /contacts/:id/archive` |
| Leads | `GET/POST /leads`, `GET /leads/pipeline`, `GET/PATCH /leads/:id`, `POST /leads/:id/archive`, `POST /property-leads` (legacy) |
| Properties | `GET/POST /properties`, `POST /properties/import`, `GET/PATCH /properties/:id`, `POST /properties/:id/{archive,lead}` |
| Owners | `GET/POST /owners`, `GET/PATCH /owners/:id`, `POST /owners/:id/archive` |
| Work | `GET/POST /tasks`, `PATCH/DELETE /tasks/:id`, `POST /notes`, `GET /activity`, `GET /search?q=` |
| Campaigns | `GET/POST /campaigns`, `GET/PATCH /campaigns/:id`, `POST /campaigns/:id/status` (`activate|pause|resume|complete|archive|restore`), `POST/DELETE /campaigns/:id/contacts[/:contactId]`, `POST /campaigns/:id/next` |
| Dialer | `GET /dialer/status`, `GET/POST /calls`, `GET /calls/:id`, `POST /calls/:id/{advance,cancel,complete}` |
| Workflows | `GET /workflows/meta`, `GET/POST /workflows`, `GET/PATCH/DELETE /workflows/:id`, `POST /workflows/:id/run`, `GET /workflow-runs` |
| Agents | `GET /agents`, `POST /agents/:key/run`, `GET /agent-runs` |
| Dashboard | `GET /dashboard` |
| Demo | `POST /demo/reset` (demo orgs only) |
| Integrations / AI | `/integrations/3min/*`, `/integrations/gis-cloud/*`, `POST /gemini/chat`, `POST /maintenance/analyze` (blocked in demo) |

List endpoints accept `q`, filters, `sort`/`dir` (whitelisted columns), `limit` (≤200) and `offset`, and return `{ items, total, limit, offset }`. Errors are JSON `{ error, code?, issues? }`; validation failures are 400 with per-field `issues`.

## Dialer

`src/server/dialer.ts`. A call row is created `dialing` and moves only along the state machine:

```
dialing → ringing → connected → completed (needs an outcome)
   │         ├──→ no_answer | busy | failed
   └──→ canceled (from dialing/ringing)
```

* A **provider** implements `TelephonyProvider { name, simulated, start() }`. Only `simulatedProvider` exists. `getTelephony()` always returns it (and says so in `/dialer/status`), so no code path can reach a phone network. To add Twilio/etc.: implement the interface server-side, read credentials from env, select it in `getTelephony` for non-demo orgs only, and receive status through a signed webhook that calls the same transition functions. Never expose provider credentials to the client.
* The simulator is deterministic from the last digit of the number (0–5 answered, 6–7 no answer, 8 busy, 9 failed). The client steps the call with `POST /calls/:id/advance`; the server validates every transition.
* Guards: Do Not Call, archived or phone-less contacts cannot be dialed; one live call per contact; campaign must be `active` and the contact a member; calls abandoned for 10 minutes are failed so they stop blocking.
* Completing a call atomically: stores outcome/notes/duration, updates campaign attempts/status (3 attempts then `exhausted`), moves the lead forward (never backward), applies Do Not Call, creates the follow-up task (automatic for `callback`), writes activity, then emits `call.completed`.

## Workflows

`src/server/workflows.ts`. Triggers: `lead.created`, `lead.stage_changed`, `contact.created`, `property.identified`, `call.completed`, `task.completed`, `manual`. Conditions are AND-ed `{field, op, value}` over the trigger payload (`lead.leadScore gte 70`). Actions: `create_task`, `update_lead`, `assign_user` (incl. `round_robin`), `add_tag`, `add_to_campaign`, `create_activity`, `create_lead` (property → owner contact → lead, deduplicated), `send_notification` (in-app only), `invoke_agent`. Text params support `{{lead.title}}` templates.

Execution: run row `queued → running → completed|failed`, steps recorded, stops at the first failing action (earlier actions are real and are **not** rolled back), a skipped run (conditions not met) is recorded with `conditions_met=false`. Events raised by automation do not trigger further workflows (no loops). To add an action: extend `actionSchema`, `ACTION_CATALOG` and `executeAction`.

## AI agents

`src/server/agents.ts`. `AgentDefinition { key, name, description, purpose, mode, permissions, input (zod), run(ctx, input, db) }`. `runAgent` checks the caller's permissions, validates input, stores the run, runs with `ctx.kind='agent'` through the normal services, and logs activity. Shipped (all `rule_based`, no external model): `lead_qualification`, `follow_up`, `property_intelligence`, `call_assistant`. A model-backed agent plugs into `run`; it must keep using the service layer so authorization cannot be bypassed.

## Demo mode

`src/server/demo.ts`. `POST /api/demo/session` (rate-limited 10/h/IP, disable with `DEMO_MODE_ENABLED=false`) creates an organization with `is_demo=true`, an `admin` user without a password, two sales users, and seeds fictional properties/owners/contacts/leads/campaigns/calls/tasks/workflows (phones `555-01xx`, `example.com` emails, provenance `demo_seed`). The session expires with the org (24h); expired demo orgs are purged on the next demo start; `POST /api/demo/reset` wipes and reseeds. Demo orgs are blocked (`403 demo_blocked`) from Gemini, GIS Cloud, the 3Min test, member creation and password change.

## Known limitations

* Rate limits are in-memory (per server instance), not shared across Cloud Function instances.
* The GIS Cloud sync forwards the user's session cookie to the Supabase Edge Function; a signed service-to-service token would be safer.
* The 3Min webhook trusts `organization_id` in a payload authenticated by one shared secret (any holder of the secret can write events into any organization).
* TypeScript runs with `strict: false` (existing setting); new code is typed but `noImplicitAny`/`strictNullChecks` are off.
* No password reset, email verification, or MFA. Social sign-in marks Microsoft emails unverified and blocks them.
* Workflow actions are sequential and not transactional; there is no scheduler (time-based triggers) and no retry queue.
* The built frontend bundle is still large (Recharts + legacy portals); the legacy portals are lazy-loaded.

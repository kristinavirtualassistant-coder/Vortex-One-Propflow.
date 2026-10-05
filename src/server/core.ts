import crypto from 'node:crypto';
import type pg from 'pg';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { createPool, ensureDatabaseReady, withTransaction } from '../db/index.js';
import type { AuthRequest } from '../middleware/auth.js';

/** Anything that can run a query: the pool, or a transaction client. */
export type Db = Pick<pg.Pool, 'query'>;

export type ActorKind = 'user' | 'workflow' | 'agent' | 'system';

/**
 * Who is acting. Every service call takes one. `role` is the *human's* role even when a
 * workflow or agent is acting on their behalf, so automation can never exceed the
 * permissions of the user that triggered it.
 */
export interface Ctx {
  orgId: string;
  userId: string | null;
  role: string;
  kind: ActorKind;
  isDemo: boolean;
  /** Workflow nesting depth; events raised by automation never re-trigger workflows. */
  depth: number;
  workflowRunId?: string;
  agentKey?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
export const notFound = (what: string) => new HttpError(404, `${what} not found`, 'not_found');
export const badRequest = (message: string) => new HttpError(400, message, 'bad_request');
export const forbidden = (message = 'You do not have permission to do that') => new HttpError(403, message, 'forbidden');
export const conflict = (message: string) => new HttpError(409, message, 'conflict');

export const newId = () => crypto.randomUUID();

/** Runs fn in a transaction on a dedicated client (see withTransaction in src/db). */
export const withTx = <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => withTransaction(fn);
export const getDb = (): pg.Pool => createPool();

export const ctxFromRequest = (req: AuthRequest): Ctx => ({
  orgId: req.user!.organizationId,
  userId: req.user!.id,
  role: req.user!.role,
  kind: 'user',
  isDemo: Boolean((req.user as any).isDemo),
  depth: 0,
});

// --------------------------------------------------------------------------------------
// RBAC. Enforced server-side on every route; the UI only mirrors it.
// --------------------------------------------------------------------------------------
export type Permission =
  | 'crm:read' | 'crm:write' | 'crm:delete'
  | 'campaigns:manage' | 'dialer:use'
  | 'workflows:manage' | 'workflows:run'
  | 'agents:run'
  | 'members:read' | 'members:manage'
  | 'demo:reset';

const ALL: Permission[] = [
  'crm:read', 'crm:write', 'crm:delete', 'campaigns:manage', 'dialer:use',
  'workflows:manage', 'workflows:run', 'agents:run', 'members:read', 'members:manage', 'demo:reset',
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ALL,
  property_manager: ALL,
  sales: ['crm:read', 'crm:write', 'campaigns:manage', 'dialer:use', 'workflows:run', 'agents:run', 'members:read'],
  landlord: ['crm:read', 'members:read'],
  technician: [],
  tenant: [],
};

export const permissionsFor = (role: string): Permission[] => ROLE_PERMISSIONS[role] ?? [];
export const can = (role: string, permission: Permission) => permissionsFor(role).includes(permission);
export const assertCan = (ctx: Pick<Ctx, 'role'>, permission: Permission) => {
  if (!can(ctx.role, permission)) throw forbidden();
};

// --------------------------------------------------------------------------------------
// Express glue
// --------------------------------------------------------------------------------------
type Handler = (req: AuthRequest, res: Response, ctx: Ctx) => Promise<unknown> | unknown;

/** Wraps a handler: permission check, ready DB, ctx construction, uniform error mapping. */
export const route = (permission: Permission | null, handler: Handler) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const ctx = ctxFromRequest(authReq);
      if (permission) assertCan(ctx, permission);
      await ensureDatabaseReady();
      const result = await handler(authReq, res, ctx);
      if (!res.headersSent && result !== undefined) res.json(result);
    } catch (error) {
      if (!(error instanceof HttpError) && typeof (error as any)?.status === 'number' && (error as any).status < 500) {
        error = new HttpError((error as any).status, (error as Error).message);
      }
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'validation_failed',
          issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      if ((error as any)?.code === '22P02') return res.status(400).json({ error: 'Invalid value', code: 'bad_request' });
      console.error(`Unhandled error on ${req.method} ${req.path}:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

// --------------------------------------------------------------------------------------
// Row helpers
// --------------------------------------------------------------------------------------
const NUMERIC_KEYS = new Set([
  'value', 'estimatedValue', 'assessedTaxValue', 'estimatedEquity', 'mortgageBalance', 'lastSalePrice',
  'bedrooms', 'bathrooms', 'latitude', 'longitude', 'totalPortfolioValue', 'totalPortfolioEquity',
]);

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

/** snake_case row -> camelCase object; pg returns numeric as string so known money/size fields are coerced. */
export const camel = <T = any>(row: Record<string, any> | undefined | null): T | null => {
  if (!row) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = toCamel(k);
    out[key] = NUMERIC_KEYS.has(key) && v !== null && v !== undefined ? Number(v) : v;
  }
  return out as T;
};
export const camelRows = <T = any>(rows: Record<string, any>[]): T[] => rows.map((r) => camel<T>(r)!);

/** Builds `WHERE a AND b` with positional parameters. */
export class Where {
  params: unknown[] = [];
  clauses: string[] = [];
  constructor(orgId: string, column = 'organization_id') {
    this.add(`${column} = ?`, orgId);
  }
  /** `?` placeholders are rewritten to $n in order. */
  add(clause: string, ...values: unknown[]) {
    let sql = clause;
    for (const v of values) {
      this.params.push(v);
      sql = sql.replace('?', `$${this.params.length}`);
    }
    this.clauses.push(sql);
    return this;
  }
  get sql() { return this.clauses.join(' AND '); }
}

/**
 * PATCH bodies are parsed with the create schema made partial, which still fills schema defaults
 * (e.g. doNotCall=false, stage='identified'). Keep only keys the client actually sent, so a partial
 * update can never silently reset other fields.
 */
export const presentOnly = <T extends object>(parsed: T, raw: unknown): Partial<T> => {
  const sent = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => k in sent && sent[k] !== undefined)) as Partial<T>;
};

export const pageParams = (query: Record<string, any>, max = 200) => ({
  limit: Math.min(Math.max(Number(query.limit) || 50, 1), max),
  offset: Math.max(Number(query.offset) || 0, 0),
});

export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// --------------------------------------------------------------------------------------
// Cross-tenant reference checks (IDOR guard): any id supplied by a client that points at
// another record must belong to the caller's organization.
// --------------------------------------------------------------------------------------
const REF_TABLES = {
  contacts: 'contacts', leads: 'leads', properties: 'properties', owners: 'property_owners',
  campaigns: 'campaigns', tasks: 'tasks', calls: 'calls', workflows: 'workflows',
} as const;
export type RefKind = keyof typeof REF_TABLES;

export const assertRef = async (db: Db, orgId: string, kind: RefKind, id: string | null | undefined, label: string = kind) => {
  if (!id) return null;
  const r = await db.query(`SELECT id FROM ${REF_TABLES[kind]} WHERE id=$1 AND organization_id=$2`, [id, orgId]);
  if (!r.rows.length) throw badRequest(`Unknown ${label.replace(/s$/, '')} reference`);
  return id;
};

export const assertUserInOrg = async (db: Db, orgId: string, userId: string | null | undefined) => {
  if (!userId) return null;
  const r = await db.query('SELECT id FROM users WHERE id=$1 AND organization_id=$2 AND disabled_at IS NULL', [userId, orgId]);
  if (!r.rows.length) throw badRequest('Unknown user reference');
  return userId;
};

// --------------------------------------------------------------------------------------
// Activity log: one row per event; every related entity id is stored so the event is
// visible from the contact, lead, property, owner and campaign it concerns.
// --------------------------------------------------------------------------------------
export interface ActivityRefs {
  contactId?: string | null; leadId?: string | null; propertyId?: string | null;
  ownerId?: string | null; campaignId?: string | null; callId?: string | null; taskId?: string | null;
}

export const logActivity = async (
  db: Db, ctx: Ctx, type: string, summary: string, refs: ActivityRefs = {}, metadata: Record<string, unknown> = {},
) => {
  await db.query(
    `INSERT INTO activities
       (id, organization_id, type, summary, actor_kind, actor_user_id, contact_id, lead_id, property_id,
        property_owner_id, campaign_id, call_id, task_id, workflow_run_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
    [newId(), ctx.orgId, type, summary, ctx.kind, ctx.userId, refs.contactId ?? null, refs.leadId ?? null,
     refs.propertyId ?? null, refs.ownerId ?? null, refs.campaignId ?? null, refs.callId ?? null,
     refs.taskId ?? null, ctx.workflowRunId ?? null, JSON.stringify(metadata)],
  );
};

// --------------------------------------------------------------------------------------
// Event bus. Services emit domain events; the workflow engine subscribes. Keeping this
// indirection avoids a services <-> workflow import cycle.
// --------------------------------------------------------------------------------------
export type EventType =
  | 'lead.created' | 'lead.stage_changed' | 'contact.created' | 'property.identified' | 'call.completed' | 'task.completed';

type EventHandler = (ctx: Ctx, type: EventType, payload: Record<string, any>) => Promise<void>;
let handler: EventHandler | null = null;
export const setEventHandler = (h: EventHandler | null) => { handler = h; };

/** Fire-and-record: automation failures are stored on the workflow run and never break the caller. */
export const emit = async (ctx: Ctx, type: EventType, payload: Record<string, any>) => {
  if (!handler || ctx.depth > 0) return;
  try {
    await handler(ctx, type, payload);
  } catch (error) {
    console.error(`Workflow dispatch failed for ${type}:`, error);
  }
};

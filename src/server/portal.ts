import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { blockInDemo } from './demo.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { can } from './core.js';

export const PORTAL_COLLECTIONS = [
  'maintenance_requests',
  'recurring_upkeep_schedules',
  'utility_bills',
  'vendors',
  'lease_documents',
  'uploaded_documents',
] as const;
type PortalCollection = (typeof PORTAL_COLLECTIONS)[number];

const MAX_LIMIT = 500;
const MAX_BODY_FIELDS = 100;
// Fields the server owns; clients cannot set them.
const RESERVED = new Set(['id', 'createdAt', 'updatedAt', 'organizationId']);
// Only these top-level fields may be used to order or filter, to keep SQL injection-proof and indexable.
const FIELD_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

type Action = 'read' | 'write' | 'delete';

/**
 * Staff roles are gated by the CRM permissions in core.ts. Roles without them (tenant, technician)
 * may only create and work with their own maintenance requests; every other collection is staff-only.
 * Returns null when the action is not allowed, otherwise whether results are limited to the caller's own records.
 */
export const accessFor = (role: string, collection: PortalCollection, action: Action): { ownOnly: boolean } | null => {
  const permission = action === 'read' ? 'crm:read' : action === 'write' ? 'crm:write' : 'crm:delete';
  if (can(role, permission)) return { ownOnly: false };
  if (collection === 'maintenance_requests' && action !== 'delete') return { ownOnly: true };
  return null;
};

const collectionOf = (req: Request): PortalCollection | null => {
  const name = String(req.params.collection);
  return (PORTAL_COLLECTIONS as readonly string[]).includes(name) ? (name as PortalCollection) : null;
};

const cleanBody = (body: unknown): Record<string, unknown> | null => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const entries = Object.entries(body as Record<string, unknown>).filter(([key]) => !RESERVED.has(key));
  if (entries.length > MAX_BODY_FIELDS) return null;
  return Object.fromEntries(entries);
};

const toRecord = (row: any) => ({
  ...row.data,
  id: row.id,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

/**
 * Tenant-scoped CRUD for the legacy portal collections. Every query is bound to the caller's
 * organization; collection names are allow-listed.
 */
export function portalRouter(pool: Pool) {
  const router = Router();
  router.use(requireAuth);

  router.get('/:collection', async (req: Request, res: Response) => {
    const collection = collectionOf(req);
    if (!collection) return res.status(404).json({ error: 'Unknown collection' });
    const user = (req as AuthRequest).user!;
    const orgId = user.organizationId;
    const access = accessFor(user.role, collection, 'read');
    if (!access) return res.status(403).json({ error: 'Forbidden' });

    const params: unknown[] = [orgId, collection];
    const where: string[] = ['organization_id = $1', 'collection = $2'];
    if (access.ownOnly) {
      params.push(user.id);
      where.push(`created_by = $${params.length}`);
    }

    // Equality filters: ?where.field=value
    for (const [key, value] of Object.entries(req.query)) {
      if (!key.startsWith('where.')) continue;
      const field = key.slice('where.'.length);
      if (!FIELD_RE.test(field) || typeof value !== 'string') return res.status(400).json({ error: 'Invalid filter' });
      params.push(field, value);
      where.push(`data ->> $${params.length - 1} = $${params.length}`);
    }

    let orderSql = 'created_at DESC';
    const orderBy = typeof req.query.orderBy === 'string' ? req.query.orderBy : '';
    if (orderBy) {
      const direction = req.query.direction === 'asc' ? 'ASC' : 'DESC';
      if (orderBy === 'createdAt') orderSql = `created_at ${direction}`;
      else if (orderBy === 'updatedAt') orderSql = `updated_at ${direction}`;
      else if (FIELD_RE.test(orderBy)) {
        params.push(orderBy);
        orderSql = `data ->> $${params.length} ${direction} NULLS LAST, created_at DESC`;
      } else return res.status(400).json({ error: 'Invalid orderBy' });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? MAX_LIMIT), 10) || MAX_LIMIT, 1), MAX_LIMIT);
    params.push(limit);

    try {
      const { rows } = await pool.query(
        `SELECT id, data, created_at, updated_at FROM portal_records
          WHERE ${where.join(' AND ')} ORDER BY ${orderSql} LIMIT $${params.length}`,
        params,
      );
      return res.json({ records: rows.map(toRecord) });
    } catch (error) {
      console.error('portal list failed:', error);
      return res.status(500).json({ error: 'Failed to load records' });
    }
  });

  router.get('/:collection/:id', async (req: Request, res: Response) => {
    const collection = collectionOf(req);
    if (!collection) return res.status(404).json({ error: 'Unknown collection' });
    const user = (req as AuthRequest).user!;
    const access = accessFor(user.role, collection, 'read');
    if (!access) return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await pool.query(
        `SELECT id, data, created_at, updated_at FROM portal_records
          WHERE organization_id = $1 AND collection = $2 AND id = $3
            AND ($4::text IS NULL OR created_by = $4)`,
        [user.organizationId, collection, req.params.id, access.ownOnly ? user.id : null],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      return res.json({ record: toRecord(rows[0]) });
    } catch (error) {
      console.error('portal get failed:', error);
      return res.status(500).json({ error: 'Failed to load record' });
    }
  });

  router.post('/:collection', blockInDemo, async (req: Request, res: Response) => {
    const collection = collectionOf(req);
    if (!collection) return res.status(404).json({ error: 'Unknown collection' });
    const data = cleanBody(req.body);
    if (!data) return res.status(400).json({ error: 'Invalid body' });
    const user = (req as AuthRequest).user!;
    if (!accessFor(user.role, collection, 'write')) return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO portal_records (id, organization_id, collection, data, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING id, data, created_at, updated_at`,
        [crypto.randomUUID(), user.organizationId, collection, JSON.stringify(data), user.id],
      );
      return res.status(201).json({ record: toRecord(rows[0]) });
    } catch (error) {
      console.error('portal create failed:', error);
      return res.status(500).json({ error: 'Failed to save record' });
    }
  });

  router.patch('/:collection/:id', blockInDemo, async (req: Request, res: Response) => {
    const collection = collectionOf(req);
    if (!collection) return res.status(404).json({ error: 'Unknown collection' });
    const data = cleanBody(req.body);
    if (!data) return res.status(400).json({ error: 'Invalid body' });
    const user = (req as AuthRequest).user!;
    const access = accessFor(user.role, collection, 'write');
    if (!access) return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await pool.query(
        `UPDATE portal_records
            SET data = data || $4::jsonb, updated_at = CURRENT_TIMESTAMP
          WHERE organization_id = $1 AND collection = $2 AND id = $3
            AND ($5::text IS NULL OR created_by = $5)
          RETURNING id, data, created_at, updated_at`,
        [user.organizationId, collection, req.params.id, JSON.stringify(data), access.ownOnly ? user.id : null],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      return res.json({ record: toRecord(rows[0]) });
    } catch (error) {
      console.error('portal update failed:', error);
      return res.status(500).json({ error: 'Failed to update record' });
    }
  });

  router.delete('/:collection/:id', blockInDemo, async (req: Request, res: Response) => {
    const collection = collectionOf(req);
    if (!collection) return res.status(404).json({ error: 'Unknown collection' });
    const user = (req as AuthRequest).user!;
    if (!accessFor(user.role, collection, 'delete')) return res.status(403).json({ error: 'Forbidden' });
    try {
      const result = await pool.query(
        `DELETE FROM portal_records WHERE organization_id = $1 AND collection = $2 AND id = $3`,
        [user.organizationId, collection, req.params.id],
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
      return res.status(204).end();
    } catch (error) {
      console.error('portal delete failed:', error);
      return res.status(500).json({ error: 'Failed to delete record' });
    }
  });

  return router;
}

import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../security/password.js';
import { createPool } from '../db/index.js';
import {
  HttpError, assertCan, badRequest, camelRows, conflict, forbidden, getDb, newId, notFound, permissionsFor, route,
} from './core.js';

export const orgRouter = Router();

const MEMBER_ROLES = ['admin', 'property_manager', 'sales', 'landlord'] as const;

orgRouter.get('/org', route(null, async (_req, _res, ctx) => {
  const r = await getDb().query('SELECT id, name, slug, is_demo, demo_expires_at FROM organizations WHERE id=$1', [ctx.orgId]);
  if (!r.rows.length) throw notFound('Organization');
  const o = r.rows[0];
  return {
    organization: { id: o.id, name: o.name, slug: o.slug, isDemo: o.is_demo, demoExpiresAt: o.demo_expires_at },
    role: ctx.role, permissions: permissionsFor(ctx.role),
  };
}));

orgRouter.get('/org/members', route('members:read', async (_req, _res, ctx) => {
  const r = await getDb().query(
    `SELECT id, name, email, role, disabled_at, last_login_at, created_at FROM users WHERE organization_id=$1 ORDER BY created_at`, [ctx.orgId]);
  return { items: camelRows(r.rows) };
}));

const memberCreate = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(MEMBER_ROLES),
  password: z.string().min(10).max(200),
});

orgRouter.post('/org/members', route('members:manage', async (req, res, ctx) => {
  if (ctx.isDemo) throw forbidden('Creating real accounts is disabled in demo mode');
  const input = memberCreate.parse(req.body);
  if (input.role === 'admin' && ctx.role !== 'admin') throw forbidden('Only an admin can create another admin');
  const dup = await getDb().query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [input.email]);
  if (dup.rows.length) throw conflict('An account with that email already exists');
  const id = newId();
  const r = await getDb().query(
    `INSERT INTO users (id, organization_id, uid, email, password_hash, name, role) VALUES ($1,$2,$1,$3,$4,$5,$6)
     RETURNING id, name, email, role, created_at`, [id, ctx.orgId, input.email, await hashPassword(input.password), input.name, input.role]);
  res.status(201).json({ member: camelRows(r.rows)[0] });
}));

const memberUpdate = z.object({ role: z.enum(MEMBER_ROLES).optional(), disabled: z.boolean().optional() });

orgRouter.patch('/org/members/:id', route('members:manage', async (req, _res, ctx) => {
  const input = memberUpdate.parse(req.body);
  const id = String(req.params.id);
  if (id === ctx.userId) throw badRequest('You cannot change your own role or disable yourself');
  const db = getDb();
  const target = (await db.query('SELECT id, role FROM users WHERE id=$1 AND organization_id=$2', [id, ctx.orgId])).rows[0];
  if (!target) throw notFound('Member');
  if ((input.role === 'admin' || target.role === 'admin') && ctx.role !== 'admin') throw forbidden('Only an admin can change admin roles');
  const sets: string[] = []; const params: unknown[] = [];
  if (input.role) { params.push(input.role); sets.push(`role=$${params.length}`); }
  if (input.disabled !== undefined) sets.push(input.disabled ? 'disabled_at=now()' : 'disabled_at=NULL');
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  const r = await db.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING id, name, email, role, disabled_at`, params);
  if (input.disabled) await db.query('DELETE FROM auth_sessions WHERE user_id=$1', [id]);
  return { member: camelRows(r.rows)[0] };
}));

export { HttpError, assertCan, createPool };

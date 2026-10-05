import { Router } from 'express';
import { z } from 'zod';
import {
  Where, presentOnly, assertRef, assertUserInOrg, badRequest, camel, camelRows, emit, getDb, likeEscape, logActivity,
  newId, notFound, pageParams, route, type Ctx, type Db,
} from './core.js';

export const CONTACT_TYPES = ['lead', 'contact', 'owner', 'prospect', 'tenant', 'vendor'] as const;

const phone = z.string().trim().max(32).regex(/^[0-9+().\-\s]{7,32}$/, 'Invalid phone number');
const tags = z.array(z.string().trim().min(1).max(40)).max(25);

export const contactCreate = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).default(''),
  email: z.string().trim().toLowerCase().email().max(200).nullish(),
  phone: phone.nullish(),
  company: z.string().trim().max(200).nullish(),
  contactType: z.enum(CONTACT_TYPES).default('prospect'),
  propertyOwnerId: z.string().max(64).nullish(),
  assignedUserId: z.string().max(64).nullish(),
  source: z.string().trim().max(100).nullish(),
  tags: tags.default([]),
  doNotCall: z.boolean().default(false),
});
export const contactUpdate = contactCreate.partial();

export const normalizePhone = (value: string | null | undefined) => (value ? value.replace(/[^0-9+]/g, '') : null);

export const createContact = async (db: Db, ctx: Ctx, input: z.infer<typeof contactCreate>) => {
  await assertRef(db, ctx.orgId, 'owners', input.propertyOwnerId, 'owner');
  await assertUserInOrg(db, ctx.orgId, input.assignedUserId);
  const id = newId();
  const r = await db.query(
    `INSERT INTO contacts
       (id, organization_id, first_name, last_name, email, phone, company, contact_type, property_owner_id,
        assigned_user_id, source, tags, do_not_call)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) RETURNING *`,
    [id, ctx.orgId, input.firstName, input.lastName, input.email ?? null, input.phone ?? null,
     input.company ?? null, input.contactType, input.propertyOwnerId ?? null, input.assignedUserId ?? null,
     input.source ?? null, JSON.stringify(input.tags), input.doNotCall],
  );
  const contact = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'contact.created', `Contact ${contact.firstName} ${contact.lastName}`.trim() + ' created',
    { contactId: id, ownerId: contact.propertyOwnerId });
  await emit(ctx, 'contact.created', { contact });
  return contact;
};

const SORTS: Record<string, string> = {
  name: 'c.first_name', created: 'c.created_at', updated: 'c.updated_at', lastContacted: 'c.last_contacted_at',
};

export const contactsRouter = Router();

contactsRouter.get('/contacts', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'c.organization_id');
  w.add(q.archived === 'true' ? 'c.archived_at IS NOT NULL' : 'c.archived_at IS NULL');
  if (q.q?.trim()) {
    const like = `%${likeEscape(q.q.trim())}%`;
    w.add(`(c.first_name || ' ' || c.last_name ILIKE ? OR c.email ILIKE ? OR c.phone ILIKE ? OR c.company ILIKE ?)`, like, like, like, like);
  }
  if (q.type) w.add('c.contact_type = ?', q.type);
  if (q.assignedUserId) w.add('c.assigned_user_id = ?', q.assignedUserId);
  if (q.tag) w.add('c.tags @> ?::jsonb', JSON.stringify([q.tag]));
  if (q.ownerId) w.add('c.property_owner_id = ?', q.ownerId);
  const order = `${SORTS[q.sort] ?? 'c.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, c.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM contacts c WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT c.*, po.name AS owner_name, u.name AS assigned_user_name,
            (SELECT count(*)::int FROM leads l WHERE l.contact_id=c.id AND l.archived_at IS NULL) AS lead_count
       FROM contacts c
       LEFT JOIN property_owners po ON po.id=c.property_owner_id AND po.organization_id=c.organization_id
       LEFT JOIN users u ON u.id=c.assigned_user_id
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
    w.params,
  );
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

contactsRouter.post('/contacts', route('crm:write', async (req, res, ctx) => {
  const input = contactCreate.parse(req.body);
  const contact = await createContact(getDb(), ctx, input);
  res.status(201).json({ contact });
}));

contactsRouter.get('/contacts/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const c = await db.query(
    `SELECT c.*, po.name AS owner_name, u.name AS assigned_user_name
       FROM contacts c
       LEFT JOIN property_owners po ON po.id=c.property_owner_id AND po.organization_id=c.organization_id
       LEFT JOIN users u ON u.id=c.assigned_user_id
      WHERE c.id=$1 AND c.organization_id=$2`, [id, ctx.orgId]);
  if (!c.rows.length) throw notFound('Contact');
  const [leads, tasks, calls, campaigns, notes, activity, properties] = await Promise.all([
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.contact_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND contact_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND contact_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT cc.status AS membership_status, cc.attempts, cc.last_outcome, ca.id, ca.name, ca.status
                FROM campaign_contacts cc JOIN campaigns ca ON ca.id=cc.campaign_id
               WHERE cc.organization_id=$1 AND cc.contact_id=$2`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.contact_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND contact_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT p.id, p.address, p.city, p.state, p.zip FROM properties p
               WHERE p.organization_id=$1 AND p.owner_id=(SELECT property_owner_id FROM contacts WHERE id=$2)`, [ctx.orgId, id]),
  ]);
  return {
    contact: camel(c.rows[0]), leads: camelRows(leads.rows), tasks: camelRows(tasks.rows), calls: camelRows(calls.rows),
    campaigns: camelRows(campaigns.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows),
    properties: camelRows(properties.rows),
  };
}));

contactsRouter.patch('/contacts/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(contactUpdate.parse(req.body), req.body);
  if (input.propertyOwnerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.propertyOwnerId, 'owner');
  if (input.assignedUserId !== undefined) await assertUserInOrg(db, ctx.orgId, input.assignedUserId);
  const cols: Record<string, string> = {
    firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', company: 'company',
    contactType: 'contact_type', propertyOwnerId: 'property_owner_id', assignedUserId: 'assigned_user_id',
    source: 'source', tags: 'tags', doNotCall: 'do_not_call',
  };
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  const r = await db.query(
    `UPDATE contacts SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Contact');
  const contact = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'contact.updated', `Contact ${contact.firstName} ${contact.lastName}`.trim() + ' updated',
    { contactId: id, ownerId: contact.propertyOwnerId }, { fields: Object.keys(input) });
  return { contact };
}));

contactsRouter.post('/contacts/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE contacts SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Contact');
  await logActivity(getDb(), ctx, restore ? 'contact.restored' : 'contact.archived',
    `Contact ${r.rows[0].first_name} ${restore ? 'restored' : 'archived'}`, { contactId: r.rows[0].id });
  return { contact: camel(r.rows[0]) };
}));

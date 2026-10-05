import { Router } from 'express';
import { z } from 'zod';
import {
  Where, presentOnly, assertRef, assertUserInOrg, badRequest, camel, camelRows, emit, getDb, likeEscape, logActivity,
  newId, notFound, pageParams, route, type Ctx, type Db,
} from './core.js';

export const taskCreate = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullish(),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignedUserId: z.string().max(64).nullish(),
  contactId: z.string().max(64).nullish(),
  leadId: z.string().max(64).nullish(),
  propertyId: z.string().max(64).nullish(),
  campaignId: z.string().max(64).nullish(),
  callId: z.string().max(64).nullish(),
});
export const taskUpdate = taskCreate.partial().extend({ status: z.enum(['open', 'done', 'cancelled']).optional() });

export const createTask = async (db: Db, ctx: Ctx, input: z.infer<typeof taskCreate>) => {
  await assertUserInOrg(db, ctx.orgId, input.assignedUserId);
  await assertRef(db, ctx.orgId, 'contacts', input.contactId, 'contact');
  await assertRef(db, ctx.orgId, 'leads', input.leadId, 'lead');
  await assertRef(db, ctx.orgId, 'properties', input.propertyId, 'property');
  await assertRef(db, ctx.orgId, 'campaigns', input.campaignId, 'campaign');
  await assertRef(db, ctx.orgId, 'calls', input.callId, 'call');
  const id = newId();
  const r = await db.query(
    `INSERT INTO tasks (id, organization_id, title, description, due_at, priority, assigned_user_id, created_by,
                        contact_id, lead_id, property_id, campaign_id, call_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [id, ctx.orgId, input.title, input.description ?? null, input.dueAt ?? null, input.priority,
     input.assignedUserId ?? ctx.userId, ctx.userId, input.contactId ?? null, input.leadId ?? null,
     input.propertyId ?? null, input.campaignId ?? null, input.callId ?? null]);
  const task = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'task.created', `Task "${task.title}" created`,
    { taskId: id, contactId: task.contactId, leadId: task.leadId, propertyId: task.propertyId, campaignId: task.campaignId, callId: task.callId });
  return task;
};

export const noteCreate = z.object({
  body: z.string().trim().min(1).max(10000),
  contactId: z.string().max(64).nullish(),
  leadId: z.string().max(64).nullish(),
  propertyId: z.string().max(64).nullish(),
  ownerId: z.string().max(64).nullish(),
  campaignId: z.string().max(64).nullish(),
  callId: z.string().max(64).nullish(),
}).refine((n) => n.contactId || n.leadId || n.propertyId || n.ownerId || n.campaignId || n.callId, 'A note must be attached to a record');

export const createNote = async (db: Db, ctx: Ctx, input: z.infer<typeof noteCreate>) => {
  await assertRef(db, ctx.orgId, 'contacts', input.contactId, 'contact');
  await assertRef(db, ctx.orgId, 'leads', input.leadId, 'lead');
  await assertRef(db, ctx.orgId, 'properties', input.propertyId, 'property');
  await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  await assertRef(db, ctx.orgId, 'campaigns', input.campaignId, 'campaign');
  await assertRef(db, ctx.orgId, 'calls', input.callId, 'call');
  const id = newId();
  const r = await db.query(
    `INSERT INTO notes (id, organization_id, body, author_id, contact_id, lead_id, property_id, property_owner_id, campaign_id, call_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, ctx.orgId, input.body, ctx.userId, input.contactId ?? null, input.leadId ?? null, input.propertyId ?? null,
     input.ownerId ?? null, input.campaignId ?? null, input.callId ?? null]);
  await logActivity(db, ctx, 'note.added', `Note added: ${input.body.slice(0, 120)}`,
    { contactId: input.contactId, leadId: input.leadId, propertyId: input.propertyId, ownerId: input.ownerId, campaignId: input.campaignId, callId: input.callId });
  return camel<any>(r.rows[0])!;
};

const SORTS: Record<string, string> = { due: 't.due_at', created: 't.created_at', priority: 't.priority' };

export const tasksRouter = Router();

tasksRouter.get('/tasks', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 't.organization_id');
  w.add('t.status = ?', q.status || 'open');
  if (q.status === 'all') { w.clauses.pop(); w.params.pop(); }
  if (q.q?.trim()) w.add('t.title ILIKE ?', `%${likeEscape(q.q.trim())}%`);
  if (q.assignedUserId === 'me') w.add('t.assigned_user_id = ?', ctx.userId);
  else if (q.assignedUserId) w.add('t.assigned_user_id = ?', q.assignedUserId);
  if (q.due === 'overdue') w.add("t.due_at < now() AND t.status='open'");
  if (q.due === 'today') w.add("t.due_at::date = now()::date");
  for (const [param, col] of [['contactId', 'contact_id'], ['leadId', 'lead_id'], ['propertyId', 'property_id'], ['campaignId', 'campaign_id']] as const) {
    if (q[param]) w.add(`t.${col} = ?`, q[param]);
  }
  const order = `${SORTS[q.sort] ?? 't.due_at'} ${q.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, t.created_at DESC`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM tasks t WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT t.*, u.name AS assigned_user_name, c.first_name || ' ' || c.last_name AS contact_name, l.title AS lead_title, p.address AS property_address
       FROM tasks t LEFT JOIN users u ON u.id=t.assigned_user_id
       LEFT JOIN contacts c ON c.id=t.contact_id LEFT JOIN leads l ON l.id=t.lead_id LEFT JOIN properties p ON p.id=t.property_id
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

tasksRouter.post('/tasks', route('crm:write', async (req, res, ctx) => {
  const task = await createTask(getDb(), ctx, taskCreate.parse(req.body));
  res.status(201).json({ task });
}));

tasksRouter.patch('/tasks/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(taskUpdate.parse(req.body), req.body);
  if (input.assignedUserId !== undefined) await assertUserInOrg(db, ctx.orgId, input.assignedUserId);
  const cols: Record<string, string> = {
    title: 'title', description: 'description', dueAt: 'due_at', priority: 'priority', assignedUserId: 'assigned_user_id', status: 'status',
  };
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    if ((input as any)[k] === undefined) continue;
    params.push((input as any)[k]);
    sets.push(`${col}=$${params.length}`);
  }
  if (input.status) sets.push(input.status === 'done' ? 'completed_at=now()' : 'completed_at=NULL');
  if (!sets.length) throw badRequest('No fields to update');
  const before = await db.query('SELECT status FROM tasks WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!before.rows.length) throw notFound('Task');
  params.push(id, ctx.orgId);
  const r = await db.query(`UPDATE tasks SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  const task = camel<any>(r.rows[0])!;
  const refs = { taskId: id, contactId: task.contactId, leadId: task.leadId, propertyId: task.propertyId, campaignId: task.campaignId };
  if (input.status && input.status !== before.rows[0].status) {
    await logActivity(db, ctx, `task.${input.status === 'done' ? 'completed' : input.status}`, `Task "${task.title}" ${input.status === 'done' ? 'completed' : input.status}`, refs);
    if (input.status === 'done') await emit(ctx, 'task.completed', { task });
  } else {
    await logActivity(db, ctx, 'task.updated', `Task "${task.title}" updated`, refs, { fields: Object.keys(input) });
  }
  return { task };
}));

tasksRouter.delete('/tasks/:id', route('crm:delete', async (req, res, ctx) => {
  const r = await getDb().query('DELETE FROM tasks WHERE id=$1 AND organization_id=$2 RETURNING *', [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Task');
  await logActivity(getDb(), ctx, 'task.deleted', `Task "${r.rows[0].title}" deleted`, { contactId: r.rows[0].contact_id, leadId: r.rows[0].lead_id, propertyId: r.rows[0].property_id });
  res.status(204).end();
}));

tasksRouter.post('/notes', route('crm:write', async (req, res, ctx) => {
  const note = await createNote(getDb(), ctx, noteCreate.parse(req.body));
  res.status(201).json({ note });
}));

/** Org-wide activity feed, filterable by any related entity. */
tasksRouter.get('/activity', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'a.organization_id');
  for (const [param, col] of [['contactId', 'contact_id'], ['leadId', 'lead_id'], ['propertyId', 'property_id'], ['ownerId', 'property_owner_id'], ['campaignId', 'campaign_id']] as const) {
    if (q[param]) w.add(`a.${col} = ?`, q[param]);
  }
  if (q.type) w.add('a.type LIKE ?', `${likeEscape(q.type)}%`);
  const { limit, offset } = pageParams(q, 100);
  const rows = await getDb().query(
    `SELECT a.*, u.name AS actor_name FROM activities a LEFT JOIN users u ON u.id=a.actor_user_id
      WHERE ${w.sql} ORDER BY a.created_at DESC, a.id LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), limit, offset };
}));

/** Global search across the main record types (org-scoped, 5 hits per type). */
tasksRouter.get('/search', route('crm:read', async (req, _res, ctx) => {
  const term = String(req.query.q ?? '').trim();
  if (term.length < 2) return { query: term, results: [] };
  const like = `%${likeEscape(term)}%`;
  const db = getDb();
  const [contacts, leads, props, owners, campaigns, tasks] = await Promise.all([
    db.query(`SELECT id, first_name || ' ' || last_name AS label, COALESCE(email, phone, company) AS sub FROM contacts
               WHERE organization_id=$1 AND archived_at IS NULL AND (first_name || ' ' || last_name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR company ILIKE $2) LIMIT 5`, [ctx.orgId, like]),
    db.query(`SELECT id, title AS label, stage AS sub FROM leads WHERE organization_id=$1 AND archived_at IS NULL AND title ILIKE $2 LIMIT 5`, [ctx.orgId, like]),
    db.query(`SELECT id, address AS label, city || ', ' || state AS sub FROM properties WHERE organization_id=$1 AND archived_at IS NULL AND (address ILIKE $2 OR apn ILIKE $2 OR city ILIKE $2 OR zip ILIKE $2) LIMIT 5`, [ctx.orgId, like]),
    db.query(`SELECT id, name AS label, entity_type AS sub FROM property_owners WHERE organization_id=$1 AND archived_at IS NULL AND name ILIKE $2 LIMIT 5`, [ctx.orgId, like]),
    db.query(`SELECT id, name AS label, status AS sub FROM campaigns WHERE organization_id=$1 AND archived_at IS NULL AND name ILIKE $2 LIMIT 5`, [ctx.orgId, like]),
    db.query(`SELECT id, title AS label, status AS sub FROM tasks WHERE organization_id=$1 AND title ILIKE $2 LIMIT 5`, [ctx.orgId, like]),
  ]);
  const tag = (type: string, rows: any[]) => rows.map((r) => ({ type, id: r.id, label: r.label, sub: r.sub }));
  return {
    query: term,
    results: [...tag('contact', contacts.rows), ...tag('lead', leads.rows), ...tag('property', props.rows),
      ...tag('owner', owners.rows), ...tag('campaign', campaigns.rows), ...tag('task', tasks.rows)],
  };
}));

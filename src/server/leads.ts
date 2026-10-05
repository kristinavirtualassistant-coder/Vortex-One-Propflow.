import { Router } from 'express';
import { z } from 'zod';
import {
  Where, presentOnly, assertRef, assertUserInOrg, badRequest, camel, camelRows, conflict, emit, getDb, likeEscape, logActivity,
  newId, notFound, pageParams, route, withTx, type Ctx, type Db,
} from './core.js';
import { classify, scoreProperty } from './scoring.js';

export const LEAD_STAGES = ['identified', 'contacted', 'qualified', 'appointment', 'negotiating', 'won', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
const CLOSED: LeadStage[] = ['won', 'lost'];
const tags = z.array(z.string().trim().min(1).max(40)).max(25);

export const leadCreate = z.object({
  title: z.string().trim().min(1).max(200).nullish(),
  propertyId: z.string().max(64).nullish(),
  contactId: z.string().max(64).nullish(),
  ownerId: z.string().max(64).nullish(),
  assignedUserId: z.string().max(64).nullish(),
  stage: z.enum(LEAD_STAGES).default('identified'),
  source: z.string().trim().max(100).nullish(),
  tags: tags.default([]),
  value: z.coerce.number().min(0).max(1e12).default(0),
  score: z.coerce.number().int().min(0).max(100).nullish(),
  factors: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
  nextRecommendedAction: z.string().trim().max(500).nullish(),
});
export const leadUpdate = leadCreate.omit({ propertyId: true, score: true }).partial()
  .extend({ score: z.coerce.number().int().min(0).max(100).optional() });

/** Loads the lead with its related names (single place so list/detail agree). */
const LEAD_SELECT = `
  SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name, c.phone AS contact_phone,
         p.address AS property_address, p.city AS property_city, p.state AS property_state,
         po.name AS owner_name, u.name AS assigned_user_name
    FROM leads l
    LEFT JOIN contacts c ON c.id=l.contact_id AND c.organization_id=l.organization_id
    LEFT JOIN properties p ON p.id=l.primary_property_id AND p.organization_id=l.organization_id
    LEFT JOIN property_owners po ON po.id=l.property_owner_id AND po.organization_id=l.organization_id
    LEFT JOIN users u ON u.id=l.assigned_user_id`;

export const getLead = async (db: Db, orgId: string, id: string) => {
  const r = await db.query(`${LEAD_SELECT} WHERE l.id=$1 AND l.organization_id=$2`, [id, orgId]);
  return camel<any>(r.rows[0]);
};

export const createLead = async (
  db: Db, ctx: Ctx, input: z.input<typeof leadCreate>, opts: { dedupe?: boolean } = {},
): Promise<{ lead: any; created: boolean }> => {
  await assertRef(db, ctx.orgId, 'properties', input.propertyId, 'property');
  await assertRef(db, ctx.orgId, 'contacts', input.contactId, 'contact');
  await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  await assertUserInOrg(db, ctx.orgId, input.assignedUserId);

  let property: any = null; let owner: any = null;
  if (input.propertyId) {
    property = camel((await db.query('SELECT * FROM properties WHERE id=$1 AND organization_id=$2', [input.propertyId, ctx.orgId])).rows[0]);
  }
  const ownerId = input.ownerId ?? property?.ownerId ?? null;
  if (ownerId) {
    const o = await db.query(
      `SELECT po.*, (SELECT count(*)::int FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id) AS properties_owned_count
         FROM property_owners po WHERE po.id=$1 AND po.organization_id=$2`, [ownerId, ctx.orgId]);
    owner = camel(o.rows[0]);
  }

  if (opts.dedupe && input.propertyId) {
    const existing = await db.query(
      `SELECT id FROM leads WHERE organization_id=$1 AND primary_property_id=$2 AND archived_at IS NULL
          AND stage NOT IN ('won','lost') AND COALESCE(contact_id,'')=COALESCE($3,'') LIMIT 1`,
      [ctx.orgId, input.propertyId, input.contactId ?? null]);
    if (existing.rows.length) return { lead: await getLead(db, ctx.orgId, existing.rows[0].id), created: false };
  }

  const scored = property ? scoreProperty(property, owner) : null;
  const score = Number(input.score ?? scored?.score ?? 0);
  const factors = input.factors ?? scored?.factors ?? [];
  const stage = input.stage ?? 'identified';
  const tagList = input.tags ?? [];
  const leadValue = Number(input.value ?? 0);
  const id = newId();
  const title = input.title ?? (property ? `${property.address}, ${property.city}` : 'New lead');
  await db.query(
    `INSERT INTO leads
       (id, organization_id, owner_id, primary_property_id, lead_score, classification, factors, stage, title, source,
        contact_id, property_owner_id, assigned_user_id, tags, value, next_recommended_action)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)`,
    [id, ctx.orgId, ctx.userId, input.propertyId ?? null, score, classify(score), JSON.stringify(factors), stage,
     title, input.source ?? null, input.contactId ?? null, ownerId, input.assignedUserId ?? null,
     JSON.stringify(tagList), leadValue, input.nextRecommendedAction ?? null]);
  const lead = await getLead(db, ctx.orgId, id);
  await logActivity(db, ctx, 'lead.created', `Lead "${title}" created (score ${score}, ${lead.classification})`,
    { leadId: id, contactId: input.contactId, propertyId: input.propertyId, ownerId });
  await emit(ctx, 'lead.created', { lead, property, owner, contact: lead.contactId ? { id: lead.contactId } : null });
  return { lead, created: true };
};

export const updateLead = async (db: Db, ctx: Ctx, id: string, input: z.infer<typeof leadUpdate>) => {
  const before = await getLead(db, ctx.orgId, id);
  if (!before) throw notFound('Lead');
  await assertRef(db, ctx.orgId, 'contacts', input.contactId, 'contact');
  await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  await assertUserInOrg(db, ctx.orgId, input.assignedUserId);

  const cols: Record<string, string> = {
    title: 'title', contactId: 'contact_id', ownerId: 'property_owner_id', assignedUserId: 'assigned_user_id',
    stage: 'stage', source: 'source', tags: 'tags', value: 'value', score: 'lead_score',
    nextRecommendedAction: 'next_recommended_action', factors: 'factors',
  };
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    if ((input as any)[k] === undefined) continue;
    const json = k === 'tags' || k === 'factors';
    params.push(json ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${json ? '::jsonb' : ''}`);
  }
  if (input.score !== undefined) { params.push(classify(input.score)); sets.push(`classification=$${params.length}`); }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  await db.query(
    `UPDATE leads SET ${sets.join(',')}, updated_at=now(), last_activity_date=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length}`, params);
  const lead = await getLead(db, ctx.orgId, id);
  const refs = { leadId: id, contactId: lead.contactId, propertyId: lead.primaryPropertyId, ownerId: lead.propertyOwnerId };
  if (input.stage && input.stage !== before.stage) {
    await logActivity(db, ctx, 'lead.stage_changed', `Lead "${lead.title}" moved ${before.stage} → ${lead.stage}`, refs,
      { from: before.stage, to: lead.stage });
    await emit(ctx, 'lead.stage_changed', { lead, previousStage: before.stage });
  }
  if (input.assignedUserId !== undefined && input.assignedUserId !== before.assignedUserId) {
    await logActivity(db, ctx, 'lead.assigned', `Lead "${lead.title}" assigned to ${lead.assignedUserName ?? 'nobody'}`, refs);
  }
  if (Object.keys(input).some((k) => !['stage', 'assignedUserId'].includes(k))) {
    await logActivity(db, ctx, 'lead.updated', `Lead "${lead.title}" updated`, refs, { fields: Object.keys(input) });
  }
  return lead;
};

const SORTS: Record<string, string> = { updated: 'l.updated_at', created: 'l.created_at', score: 'l.lead_score', value: 'l.value', title: 'l.title' };

export const leadsRouter = Router();

leadsRouter.get('/leads', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'l.organization_id');
  w.add(q.archived === 'true' ? 'l.archived_at IS NOT NULL' : 'l.archived_at IS NULL');
  if (q.q?.trim()) {
    const like = `%${likeEscape(q.q.trim())}%`;
    w.add(`(l.title ILIKE ? OR c.first_name || ' ' || c.last_name ILIKE ? OR p.address ILIKE ? OR po.name ILIKE ?)`, like, like, like, like);
  }
  if (q.stage) w.add('l.stage = ?', q.stage);
  if (q.classification) w.add('l.classification = ?', q.classification);
  if (q.assignedUserId === 'me') w.add('l.assigned_user_id = ?', ctx.userId);
  else if (q.assignedUserId) w.add('l.assigned_user_id = ?', q.assignedUserId);
  if (q.tag) w.add('l.tags @> ?::jsonb', JSON.stringify([q.tag]));
  if (q.propertyId) w.add('l.primary_property_id = ?', q.propertyId);
  if (q.contactId) w.add('l.contact_id = ?', q.contactId);
  const order = `${SORTS[q.sort] ?? 'l.updated_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, l.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM leads l
    LEFT JOIN contacts c ON c.id=l.contact_id AND c.organization_id=l.organization_id
    LEFT JOIN properties p ON p.id=l.primary_property_id AND p.organization_id=l.organization_id
    LEFT JOIN property_owners po ON po.id=l.property_owner_id AND po.organization_id=l.organization_id
    LEFT JOIN users u ON u.id=l.assigned_user_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name, c.phone AS contact_phone, p.address AS property_address,
            p.city AS property_city, p.state AS property_state, po.name AS owner_name, u.name AS assigned_user_name
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

leadsRouter.post('/leads', route('crm:write', async (req, res, ctx) => {
  const input = leadCreate.parse(req.body);
  const { lead, created } = await createLead(getDb(), ctx, input, { dedupe: false });
  res.status(created ? 201 : 200).json({ lead });
}));

/** Pipeline board: leads grouped by stage with derived totals. */
leadsRouter.get('/leads/pipeline', route('crm:read', async (_req, _res, ctx) => {
  const r = await getDb().query(
    `SELECT stage, count(*)::int AS count, COALESCE(sum(value),0) AS value
       FROM leads WHERE organization_id=$1 AND archived_at IS NULL GROUP BY stage`, [ctx.orgId]);
  const byStage = new Map(r.rows.map((x: any) => [x.stage, x]));
  return { stages: LEAD_STAGES.map((s) => ({ stage: s, count: byStage.get(s)?.count ?? 0, value: Number(byStage.get(s)?.value ?? 0) })) };
}));

leadsRouter.get('/leads/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const lead = await getLead(db, ctx.orgId, id);
  if (!lead) throw notFound('Lead');
  const [property, owner, contact, tasks, calls, notes, activity] = await Promise.all([
    lead.primaryPropertyId ? db.query('SELECT * FROM properties WHERE id=$1 AND organization_id=$2', [lead.primaryPropertyId, ctx.orgId]) : { rows: [] },
    lead.propertyOwnerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [lead.propertyOwnerId, ctx.orgId]) : { rows: [] },
    lead.contactId ? db.query('SELECT * FROM contacts WHERE id=$1 AND organization_id=$2', [lead.contactId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND lead_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM calls WHERE organization_id=$1 AND lead_id=$2 ORDER BY started_at DESC LIMIT 50', [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.lead_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND lead_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  return {
    lead, property: camel(property.rows[0]), owner: camel(owner.rows[0]), contact: camel(contact.rows[0]),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows),
  };
}));

leadsRouter.patch('/leads/:id', route('crm:write', async (req, _res, ctx) => {
  const lead = await updateLead(getDb(), ctx, String(req.params.id), presentOnly(leadUpdate.parse(req.body), req.body));
  return { lead };
}));

leadsRouter.post('/leads/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE leads SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING id`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Lead');
  const lead = await getLead(getDb(), ctx.orgId, r.rows[0].id);
  await logActivity(getDb(), ctx, restore ? 'lead.restored' : 'lead.archived', `Lead "${lead.title}" ${restore ? 'restored' : 'archived'}`,
    { leadId: lead.id, contactId: lead.contactId, propertyId: lead.primaryPropertyId, ownerId: lead.propertyOwnerId });
  return { lead };
}));

/** Legacy endpoint kept for existing callers: score a property into a lead owned by the caller. */
leadsRouter.post('/property-leads', route('crm:write', async (req, res, ctx) => {
  const propertyId = String(req.body?.propertyId || '');
  if (!propertyId) throw badRequest('Valid propertyId is required');
  const score = Math.max(0, Math.min(Number(req.body?.score ?? 0) || 0, 100));
  const reasons = Array.isArray(req.body?.reasons) ? req.body.reasons : [];
  const { lead, created } = await createLead(getDb(), ctx, {
    propertyId, score: req.body?.score === undefined ? undefined : score, factors: req.body?.score === undefined ? undefined : reasons,
    source: 'property_intelligence', stage: 'identified', tags: [], value: 0,
  } as any, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead });
}));

export { CLOSED, withTx, conflict };

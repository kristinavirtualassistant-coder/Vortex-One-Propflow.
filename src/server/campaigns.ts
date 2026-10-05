import { Router } from 'express';
import { z } from 'zod';
import {
  presentOnly, HttpError, Where, assertRef, badRequest, camel, camelRows, getDb, likeEscape, logActivity, newId, notFound,
  pageParams, route, withTx, type Ctx, type Db,
} from './core.js';
import { MAX_ATTEMPTS } from './dialer.js';

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const;
const ACTIONS = ['activate', 'pause', 'resume', 'complete', 'archive', 'restore'] as const;

/** action -> allowed from-statuses and resulting status */
export const CAMPAIGN_TRANSITIONS: Record<(typeof ACTIONS)[number], { from: string[]; to: string }> = {
  activate: { from: ['draft'], to: 'active' },
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  complete: { from: ['active', 'paused'], to: 'completed' },
  archive: { from: ['draft', 'active', 'paused', 'completed'], to: 'archived' },
  restore: { from: ['archived'], to: 'draft' },
};

export const campaignInput = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullish(),
  script: z.string().trim().max(10000).nullish(),
});

/** Every number shown for a campaign is computed from campaign_contacts and calls. */
export const campaignMetrics = async (db: Db, ctx: Ctx, campaignId: string) => {
  const [members, calls, outcomes] = await Promise.all([
    db.query(`SELECT status, count(*)::int AS n FROM campaign_contacts WHERE organization_id=$1 AND campaign_id=$2 GROUP BY status`, [ctx.orgId, campaignId]),
    db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE answered_at IS NOT NULL)::int AS connected,
              count(*) FILTER (WHERE status IN ('dialing','ringing','connected'))::int AS live,
              COALESCE(round(avg(duration_seconds) FILTER (WHERE answered_at IS NOT NULL))::int, 0) AS avg_duration
         FROM calls WHERE organization_id=$1 AND campaign_id=$2`, [ctx.orgId, campaignId]),
    db.query(`SELECT outcome, count(*)::int AS n FROM calls WHERE organization_id=$1 AND campaign_id=$2 AND outcome IS NOT NULL GROUP BY outcome`, [ctx.orgId, campaignId]),
  ]);
  const byStatus: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, do_not_call: 0, exhausted: 0 };
  for (const r of members.rows) byStatus[r.status] = r.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const finished = byStatus.completed + byStatus.do_not_call + byStatus.exhausted;
  const c = calls.rows[0];
  const outcomeCounts: Record<string, number> = {};
  for (const r of outcomes.rows) outcomeCounts[r.outcome] = r.n;
  return {
    contacts: { total, ...byStatus },
    progressPercent: total ? Math.round((finished / total) * 100) : 0,
    calls: { total: c.total, connected: c.connected, live: c.live, avgDurationSeconds: c.avg_duration,
      connectRate: c.total ? Math.round((c.connected / c.total) * 100) : 0 },
    outcomes: outcomeCounts,
    appointments: outcomeCounts.appointment_set ?? 0,
    interested: (outcomeCounts.connected_interested ?? 0) + (outcomeCounts.appointment_set ?? 0),
  };
};

export const campaignsRouter = Router();

campaignsRouter.get('/campaigns', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'ca.organization_id');
  if (q.status) w.add('ca.status = ?', q.status);
  else w.add("ca.status <> 'archived'");
  if (q.q?.trim()) w.add('ca.name ILIKE ?', `%${likeEscape(q.q.trim())}%`);
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM campaigns ca WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT ca.*,
            (SELECT count(*)::int FROM campaign_contacts cc WHERE cc.campaign_id=ca.id) AS contacts_count,
            (SELECT count(*)::int FROM campaign_contacts cc WHERE cc.campaign_id=ca.id AND cc.status IN ('completed','do_not_call','exhausted')) AS finished_count,
            (SELECT count(*)::int FROM calls c WHERE c.campaign_id=ca.id) AS calls_count
       FROM campaigns ca WHERE ${w.sql} ORDER BY ca.created_at DESC LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

campaignsRouter.post('/campaigns', route('campaigns:manage', async (req, res, ctx) => {
  const input = campaignInput.parse(req.body);
  const id = newId();
  const r = await getDb().query(
    `INSERT INTO campaigns (id, organization_id, name, description, script, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, ctx.orgId, input.name, input.description ?? null, input.script ?? null, ctx.userId]);
  await logActivity(getDb(), ctx, 'campaign.created', `Campaign "${input.name}" created`, { campaignId: id });
  res.status(201).json({ campaign: camel(r.rows[0]) });
}));

campaignsRouter.get('/campaigns/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const c = await db.query('SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!c.rows.length) throw notFound('Campaign');
  const [metrics, members, calls, activity] = await Promise.all([
    campaignMetrics(db, ctx, id),
    db.query(
      `SELECT cc.*, ct.first_name || ' ' || ct.last_name AS contact_name, ct.phone, ct.do_not_call
         FROM campaign_contacts cc JOIN contacts ct ON ct.id=cc.contact_id
        WHERE cc.organization_id=$1 AND cc.campaign_id=$2 ORDER BY cc.created_at LIMIT 500`, [ctx.orgId, id]),
    db.query(
      `SELECT c.*, ct.first_name || ' ' || ct.last_name AS contact_name FROM calls c LEFT JOIN contacts ct ON ct.id=c.contact_id
        WHERE c.organization_id=$1 AND c.campaign_id=$2 ORDER BY c.started_at DESC LIMIT 25`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND campaign_id=$2 ORDER BY created_at DESC LIMIT 25', [ctx.orgId, id]),
  ]);
  return { campaign: camel(c.rows[0]), metrics, members: camelRows(members.rows), calls: camelRows(calls.rows), activity: camelRows(activity.rows), maxAttempts: MAX_ATTEMPTS };
}));

campaignsRouter.patch('/campaigns/:id', route('campaigns:manage', async (req, _res, ctx) => {
  const input = presentOnly(campaignInput.partial().parse(req.body), req.body);
  const cols: Record<string, string> = { name: 'name', description: 'description', script: 'script' };
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    if ((input as any)[k] === undefined) continue;
    params.push((input as any)[k]); sets.push(`${col}=$${params.length}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(`UPDATE campaigns SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Campaign');
  await logActivity(getDb(), ctx, 'campaign.updated', `Campaign "${r.rows[0].name}" updated`, { campaignId: r.rows[0].id }, { fields: Object.keys(input) });
  return { campaign: camel(r.rows[0]) };
}));

campaignsRouter.post('/campaigns/:id/status', route('campaigns:manage', async (req, _res, ctx) => {
  const action = z.object({ action: z.enum(ACTIONS) }).parse(req.body).action;
  const db = getDb();
  const id = String(req.params.id);
  const c = (await db.query('SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2', [id, ctx.orgId])).rows[0];
  if (!c) throw notFound('Campaign');
  const rule = CAMPAIGN_TRANSITIONS[action];
  if (!rule.from.includes(c.status)) throw new HttpError(409, `Cannot ${action} a campaign that is ${c.status}`, 'invalid_transition');
  if (action === 'activate') {
    const n = await db.query(`SELECT count(*)::int AS n FROM campaign_contacts WHERE campaign_id=$1 AND organization_id=$2 AND status='pending'`, [id, ctx.orgId]);
    if (!n.rows[0].n) throw new HttpError(422, 'Add at least one callable contact before activating the campaign', 'no_contacts');
  }
  const r = await db.query(
    `UPDATE campaigns SET status=$1::varchar, updated_at=now(),
            started_at=CASE WHEN $1::varchar='active' AND started_at IS NULL THEN now() ELSE started_at END,
            completed_at=CASE WHEN $1::varchar='completed' THEN now() ELSE completed_at END,
            archived_at=CASE WHEN $1::varchar='archived' THEN now() WHEN $1::varchar='draft' THEN NULL ELSE archived_at END
      WHERE id=$2 AND organization_id=$3 RETURNING *`, [rule.to, id, ctx.orgId]);
  await logActivity(db, ctx, `campaign.${rule.to}`, `Campaign "${c.name}" ${action === 'activate' ? 'activated' : rule.to}`, { campaignId: id });
  return { campaign: camel(r.rows[0]) };
}));

const addContactsInput = z.object({
  contactIds: z.array(z.string().max(64)).max(500).default([]),
  leadIds: z.array(z.string().max(64)).max(500).default([]),
}).refine((v) => v.contactIds.length + v.leadIds.length > 0, 'Provide contactIds or leadIds');

campaignsRouter.post('/campaigns/:id/contacts', route('campaigns:manage', async (req, _res, ctx) => {
  const input = addContactsInput.parse(req.body);
  const id = String(req.params.id);
  return withTx(async (db) => {
    const c = (await db.query('SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2 FOR UPDATE', [id, ctx.orgId])).rows[0];
    if (!c) throw notFound('Campaign');
    if (['completed', 'archived'].includes(c.status)) throw new HttpError(409, `Cannot add contacts to a ${c.status} campaign`, 'invalid_state');
    // Resolve leads to their contacts; remember which lead brought each contact in.
    const pairs = new Map<string, string | null>();
    for (const contactId of input.contactIds) pairs.set(contactId, null);
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const leadId of input.leadIds) {
      const l = (await db.query('SELECT id, contact_id FROM leads WHERE id=$1 AND organization_id=$2', [leadId, ctx.orgId])).rows[0];
      if (!l) { skipped.push({ id: leadId, reason: 'Lead not found' }); continue; }
      if (!l.contact_id) { skipped.push({ id: leadId, reason: 'Lead has no contact to call' }); continue; }
      pairs.set(l.contact_id, l.id);
    }
    let added = 0;
    for (const [contactId, leadId] of pairs) {
      const ct = (await db.query('SELECT * FROM contacts WHERE id=$1 AND organization_id=$2', [contactId, ctx.orgId])).rows[0];
      if (!ct) { skipped.push({ id: contactId, reason: 'Contact not found' }); continue; }
      if (ct.archived_at) { skipped.push({ id: contactId, reason: 'Contact is archived' }); continue; }
      if (!ct.phone) { skipped.push({ id: contactId, reason: 'Contact has no phone number' }); continue; }
      if (ct.do_not_call) { skipped.push({ id: contactId, reason: 'Contact is on the Do Not Call list' }); continue; }
      const ins = await db.query(
        `INSERT INTO campaign_contacts (id, organization_id, campaign_id, contact_id, lead_id)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (campaign_id, contact_id) DO NOTHING RETURNING id`,
        [newId(), ctx.orgId, id, contactId, leadId]);
      if (ins.rows.length) added++; else skipped.push({ id: contactId, reason: 'Already in this campaign' });
    }
    if (added) await logActivity(db, ctx, 'campaign.contacts_added', `${added} contact(s) added to "${c.name}"`, { campaignId: id }, { added });
    return { added, skipped };
  });
}));

campaignsRouter.delete('/campaigns/:id/contacts/:contactId', route('campaigns:manage', async (req, _res, ctx) => {
  const db = getDb();
  const live = await db.query(
    `SELECT 1 FROM calls WHERE organization_id=$1 AND campaign_id=$2 AND contact_id=$3 AND status IN ('dialing','ringing','connected')
        AND started_at > now() - interval '10 minutes'`, [ctx.orgId, String(req.params.id), String(req.params.contactId)]);
  if (live.rows.length) throw new HttpError(409, 'A call to this contact is in progress', 'call_in_progress');
  const r = await db.query('DELETE FROM campaign_contacts WHERE organization_id=$1 AND campaign_id=$2 AND contact_id=$3 RETURNING id',
    [ctx.orgId, String(req.params.id), String(req.params.contactId)]);
  if (!r.rows.length) throw notFound('Campaign member');
  await logActivity(db, ctx, 'campaign.contact_removed', 'Contact removed from campaign', { campaignId: String(req.params.id), contactId: String(req.params.contactId) });
  return { removed: true };
}));

/** Power dialer: next callable contact in an active campaign (read-only; dialing marks them in progress). */
campaignsRouter.post('/campaigns/:id/next', route('dialer:use', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const c = (await db.query('SELECT * FROM campaigns WHERE id=$1 AND organization_id=$2', [id, ctx.orgId])).rows[0];
  if (!c) throw notFound('Campaign');
  if (c.status !== 'active') throw new HttpError(422, `Campaign is ${c.status}; activate or resume it to dial`, 'campaign_not_active');
  const r = await db.query(
    `SELECT cc.*, ct.first_name, ct.last_name, ct.phone, ct.email, ct.company
       FROM campaign_contacts cc JOIN contacts ct ON ct.id=cc.contact_id
      WHERE cc.organization_id=$1 AND cc.campaign_id=$2 AND cc.status='pending'
        AND ct.do_not_call=false AND ct.archived_at IS NULL AND ct.phone IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM calls k WHERE k.contact_id=ct.id AND k.status IN ('dialing','ringing','connected') AND k.started_at > now() - interval '10 minutes')
      ORDER BY cc.attempts, cc.created_at LIMIT 1`, [ctx.orgId, id]);
  if (!r.rows.length) return { next: null, message: 'No callable contacts remain in this campaign' };
  const member = camel<any>(r.rows[0])!;
  const lead = member.leadId ? camel((await db.query(
    `SELECT l.*, p.address AS property_address, p.city AS property_city, p.state AS property_state
       FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id WHERE l.id=$1 AND l.organization_id=$2`, [member.leadId, ctx.orgId])).rows[0]) : null;
  return { next: { member, contact: { id: member.contactId, firstName: member.firstName, lastName: member.lastName, phone: member.phone, email: member.email, company: member.company }, lead, script: c.script } };
}));

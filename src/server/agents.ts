/**
 * AI agent architecture. An agent is a named, permissioned capability with typed input/output.
 * Agents act ONLY through the same service layer and permission checks as a human user
 * (they run with the invoking user's role), and every run is stored and logged.
 *
 * Current agents are deterministic and rule-based: they call no external model and invent no
 * data. `run` is the seam where an LLM-backed implementation can be added later; it must keep
 * going through the services here so it cannot bypass authorization.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  HttpError, Where, assertCan, badRequest, camel, camelRows, forbidden, getDb, logActivity, newId, notFound,
  pageParams, permissionsFor, route, type Ctx, type Db, type Permission,
} from './core.js';
import { getLead, updateLead } from './leads.js';
import { createTask } from './tasks.js';
import { scoreProperty } from './scoring.js';
import { getTelephony } from './dialer.js';

export interface AgentDefinition<I = any, O = any> {
  key: string;
  name: string;
  description: string;
  purpose: string;
  mode: 'rule_based';
  permissions: Permission[];
  input: z.ZodType<I>;
  inputHelp: string;
  run(ctx: Ctx, input: I, db: Db): Promise<O>;
}

const leadQualification: AgentDefinition = {
  key: 'lead_qualification',
  name: 'Lead Qualification Agent',
  description: 'Scores a lead from its property and owner records and records the reasons.',
  purpose: 'Prioritise leads using transparent factors (tax status, equity, absentee owner, tenure).',
  mode: 'rule_based',
  permissions: ['crm:write'],
  input: z.object({ leadId: z.string().min(1), apply: z.boolean().default(true) }),
  inputHelp: '{ leadId, apply?: true } — apply=false returns the score without saving it',
  async run(ctx, input, db) {
    const lead = await getLead(db, ctx.orgId, input.leadId);
    if (!lead) throw notFound('Lead');
    if (!lead.primaryPropertyId) {
      return { leadId: lead.id, applied: false, reason: 'Lead has no linked property, so there is nothing to score.' };
    }
    const property = camel((await db.query('SELECT * FROM properties WHERE id=$1 AND organization_id=$2', [lead.primaryPropertyId, ctx.orgId])).rows[0]);
    const owner = lead.propertyOwnerId
      ? camel((await db.query(
        `SELECT po.*, (SELECT count(*)::int FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id) AS properties_owned_count
           FROM property_owners po WHERE po.id=$1 AND po.organization_id=$2`, [lead.propertyOwnerId, ctx.orgId])).rows[0])
      : null;
    const result = scoreProperty(property as any, owner as any);
    if (input.apply) {
      await updateLead(db, ctx, lead.id, {
        score: result.score, factors: result.factors,
        nextRecommendedAction: result.classification === 'hot' ? 'Call within 24 hours' : result.classification === 'warm' ? 'Schedule outreach this week' : 'Add to nurture campaign',
      } as any);
    }
    return { leadId: lead.id, previousScore: lead.leadScore, ...result, applied: input.apply };
  },
};

const followUp: AgentDefinition = {
  key: 'follow_up',
  name: 'Follow-up Agent',
  description: 'Finds open leads with no recent activity and no open task, and creates follow-up tasks.',
  purpose: 'Make sure no active lead goes quiet.',
  mode: 'rule_based',
  permissions: ['crm:write'],
  input: z.object({ staleDays: z.coerce.number().int().min(1).max(365).default(7), limit: z.coerce.number().int().min(1).max(50).default(25) }),
  inputHelp: '{ staleDays?: 7, limit?: 25 }',
  async run(ctx, input, db) {
    const stale = await db.query(
      `SELECT l.id, l.title, l.contact_id, l.primary_property_id, l.assigned_user_id
         FROM leads l
        WHERE l.organization_id=$1 AND l.archived_at IS NULL AND l.stage NOT IN ('won','lost')
          AND l.last_activity_date < now() - ($2 || ' days')::interval
          AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.lead_id=l.id AND t.status='open')
        ORDER BY l.lead_score DESC, l.last_activity_date LIMIT $3`,
      [ctx.orgId, String(input.staleDays), input.limit]);
    const created: Array<{ leadId: string; taskId: string; title: string }> = [];
    for (const l of stale.rows) {
      const task = await createTask(db, ctx, {
        title: `Follow up: ${l.title}`, priority: 'normal', assignedUserId: l.assigned_user_id ?? ctx.userId,
        dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), leadId: l.id, contactId: l.contact_id, propertyId: l.primary_property_id,
        description: `No activity for ${input.staleDays}+ days.`,
      } as any);
      created.push({ leadId: l.id, taskId: task.id, title: task.title });
    }
    return { staleDays: input.staleDays, leadsFound: stale.rows.length, tasksCreated: created };
  },
};

const propertyIntelligence: AgentDefinition = {
  key: 'property_intelligence',
  name: 'Property Intelligence Agent',
  description: 'Summarises a property, its owner relationships and motivation signals from stored records.',
  purpose: 'Give an agent a fast, sourced read on a property before outreach. Reads records only.',
  mode: 'rule_based',
  permissions: ['crm:read'],
  input: z.object({ propertyId: z.string().min(1) }),
  inputHelp: '{ propertyId }',
  async run(ctx, input, db) {
    const p = camel<any>((await db.query('SELECT * FROM properties WHERE id=$1 AND organization_id=$2', [input.propertyId, ctx.orgId])).rows[0]);
    if (!p) throw notFound('Property');
    const owner = p.ownerId ? camel<any>((await db.query(
      `SELECT po.*, (SELECT count(*)::int FROM properties x WHERE x.owner_id=po.id AND x.organization_id=po.organization_id) AS properties_owned_count
         FROM property_owners po WHERE po.id=$1 AND po.organization_id=$2`, [p.ownerId, ctx.orgId])).rows[0]) : null;
    const [contacts, leads, calls] = await Promise.all([
      owner ? db.query('SELECT id FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, owner.id]) : { rows: [] },
      db.query('SELECT id, stage, lead_score FROM leads WHERE organization_id=$1 AND primary_property_id=$2 AND archived_at IS NULL', [ctx.orgId, p.id]),
      db.query('SELECT count(*)::int AS n FROM calls WHERE organization_id=$1 AND property_id=$2', [ctx.orgId, p.id]),
    ]);
    const score = scoreProperty(p, owner);
    const gaps: string[] = [];
    if (!owner) gaps.push('No owner linked');
    else {
      if (!contacts.rows.length) gaps.push('No contact on file for the owner');
      if (!owner.mailingAddress) gaps.push('Owner mailing address missing');
    }
    if (!p.estimatedValue) gaps.push('No valuation on record');
    if (!p.yearBuilt) gaps.push('Year built missing');
    const summary = [
      `${p.address}, ${p.city}, ${p.state} ${p.zip} (APN ${p.apn}) is a ${p.propertyType}${p.squareFeet ? ` of ${p.squareFeet.toLocaleString()} sq ft` : ''}.`,
      p.estimatedValue ? `Estimated value $${p.estimatedValue.toLocaleString()} with $${p.estimatedEquity.toLocaleString()} estimated equity.` : 'No valuation on record.',
      owner ? `Owner: ${owner.name} (${owner.entityType}), ${owner.propertiesOwnedCount} propert${owner.propertiesOwnedCount === 1 ? 'y' : 'ies'} in this workspace.` : 'No owner linked.',
      score.factors.length ? `Signals: ${score.factors.map((f) => f.label).join('; ')}.` : 'No motivation signals in the records.',
    ].join(' ');
    return {
      propertyId: p.id, summary, score: score.score, classification: score.classification, factors: score.factors,
      owner: owner ? { id: owner.id, name: owner.name, entityType: owner.entityType } : null,
      ownerContacts: contacts.rows.length, openLeads: leads.rows.length, calls: calls.rows[0].n,
      dataGaps: gaps, sources: p.provenance ?? {},
    };
  },
};

const callAssistant: AgentDefinition = {
  key: 'call_assistant',
  name: 'Call Assistant Agent',
  description: 'Prepares a call brief for a lead or contact: who, why, talking points and compliance checks.',
  purpose: 'Prepare agents for outbound calls. It does not place calls.',
  mode: 'rule_based',
  permissions: ['dialer:use'],
  input: z.object({ leadId: z.string().optional(), contactId: z.string().optional() }).refine((v) => v.leadId || v.contactId, 'leadId or contactId is required'),
  inputHelp: '{ leadId } or { contactId }',
  async run(ctx, input, db) {
    const lead = input.leadId ? await getLead(db, ctx.orgId, input.leadId) : null;
    if (input.leadId && !lead) throw notFound('Lead');
    const contactId = input.contactId ?? lead?.contactId;
    if (!contactId) return { ready: false, issues: ['This lead has no contact to call'] };
    const c = camel<any>((await db.query('SELECT * FROM contacts WHERE id=$1 AND organization_id=$2', [contactId, ctx.orgId])).rows[0]);
    if (!c) throw notFound('Contact');
    const property = lead?.primaryPropertyId ? camel<any>((await db.query('SELECT * FROM properties WHERE id=$1 AND organization_id=$2', [lead.primaryPropertyId, ctx.orgId])).rows[0]) : null;
    const lastCalls = camelRows<any>((await db.query('SELECT outcome, status, started_at FROM calls WHERE organization_id=$1 AND contact_id=$2 ORDER BY started_at DESC LIMIT 3', [ctx.orgId, contactId])).rows);
    const issues: string[] = [];
    if (c.doNotCall) issues.push('Contact is on the Do Not Call list');
    if (c.archivedAt) issues.push('Contact is archived');
    if (!c.phone) issues.push('Contact has no phone number');
    const talking: string[] = [];
    if (property) {
      talking.push(`Confirm they are the owner of ${property.address}, ${property.city}.`);
      if (property.taxDelinquent) talking.push('Property shows delinquent taxes: ask whether they want options.');
      if (property.isAbsenteeOwner) talking.push('Owner appears to live elsewhere: ask about how the property is being managed.');
      if (property.estimatedEquity > 0) talking.push('Healthy estimated equity: ask about plans for the property.');
    }
    if (!talking.length) talking.push('Introduce yourself, confirm you have the right person, and ask about their needs.');
    return {
      ready: issues.length === 0, issues, telephony: getTelephony(ctx).note,
      contact: { id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone },
      lead: lead ? { id: lead.id, title: lead.title, stage: lead.stage, score: lead.leadScore } : null,
      property: property ? { id: property.id, address: property.address } : null,
      recentCalls: lastCalls, talkingPoints: talking,
      objective: lead ? (lead.stage === 'identified' ? 'Make first contact and qualify interest' : 'Advance the lead to the next stage') : 'Open a conversation',
    };
  },
};

export const AGENTS: AgentDefinition[] = [leadQualification, followUp, propertyIntelligence, callAssistant];
export const getAgent = (key: string) => AGENTS.find((a) => a.key === key);

/**
 * Runs an agent: checks the caller's own permissions first (an agent can never do more than its
 * invoker), stores the run through queued -> running -> completed|failed, and logs activity.
 */
export const runAgent = async (ctx: Ctx, key: string, rawInput: unknown) => {
  const agent = getAgent(key);
  if (!agent) throw notFound('Agent');
  for (const p of agent.permissions) if (!permissionsFor(ctx.role).includes(p)) throw forbidden(`Running ${agent.name} requires the ${p} permission`);
  const input = agent.input.parse(rawInput ?? {});
  const db = getDb();
  const id = newId();
  await db.query(
    `INSERT INTO agent_runs (id, organization_id, agent_key, status, triggered_by, input) VALUES ($1,$2,$3,'queued',$4,$5::jsonb)`,
    [id, ctx.orgId, key, ctx.userId, JSON.stringify(input)]);
  await db.query(`UPDATE agent_runs SET status='running', started_at=now() WHERE id=$1`, [id]);
  const agentCtx: Ctx = { ...ctx, kind: 'agent', agentKey: key };
  try {
    const output = await agent.run(agentCtx, input, db);
    await db.query(`UPDATE agent_runs SET status='completed', output=$2::jsonb, finished_at=now() WHERE id=$1`, [id, JSON.stringify(output)]);
    await logActivity(db, agentCtx, 'agent.run', `${agent.name} completed`, { leadId: (input as any).leadId, propertyId: (input as any).propertyId, contactId: (input as any).contactId }, { agentRunId: id });
    return { runId: id, status: 'completed' as const, output };
  } catch (error: any) {
    const message = error instanceof HttpError || error?.status ? error.message : 'Agent failed';
    if (!(error instanceof HttpError)) console.error('Agent %s failed:', String(key), error);
    await db.query(`UPDATE agent_runs SET status='failed', error=$2, finished_at=now() WHERE id=$1`, [id, message]);
    await logActivity(db, agentCtx, 'agent.failed', `${agent.name} failed: ${message}`, {}, { agentRunId: id });
    return { runId: id, status: 'failed' as const, error: message };
  }
};

export const agentsRouter = Router();

agentsRouter.get('/agents', route('crm:read', async (_req, _res, ctx) => ({
  agents: AGENTS.map((a) => ({
    key: a.key, name: a.name, description: a.description, purpose: a.purpose, mode: a.mode,
    permissions: a.permissions, inputHelp: a.inputHelp, allowed: a.permissions.every((p) => permissionsFor(ctx.role).includes(p)),
    externalModel: false,
  })),
})));

agentsRouter.post('/agents/:key/run', route('agents:run', async (req, _res, ctx) => runAgent(ctx, String(req.params.key), req.body?.input ?? {})));

agentsRouter.get('/agent-runs', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'r.organization_id');
  if (q.agentKey) w.add('r.agent_key = ?', q.agentKey);
  const { limit, offset } = pageParams(q, 100);
  const rows = await getDb().query(
    `SELECT r.*, u.name AS triggered_by_name FROM agent_runs r LEFT JOIN users u ON u.id=r.triggered_by
      WHERE ${w.sql} ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), limit, offset };
}));

export { assertCan, badRequest };

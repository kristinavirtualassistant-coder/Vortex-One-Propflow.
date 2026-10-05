/**
 * Workflow engine:  TRIGGER -> CONDITIONS -> ACTIONS -> RESULT -> ACTIVITY LOG.
 *
 * Domain services emit events (see core.emit). `dispatchEvent` runs every enabled workflow of the
 * organisation that listens to that trigger. Each run is persisted (queued -> running ->
 * completed | failed) with a per-step result. Actions go through the same services as the UI, so
 * validation, tenant checks and activity logging are shared, and actions run with the triggering
 * user's role. Events raised by automation never start further workflows (no loops).
 *
 * Failure semantics: actions run in order and stop at the first failure; earlier actions are NOT
 * rolled back (they are real, logged changes). The run is marked failed with the error.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  presentOnly, HttpError, Where, assertCan, assertRef, badRequest, camel, camelRows, forbidden, getDb, logActivity, newId,
  notFound, pageParams, route, setEventHandler, type Ctx, type Db, type EventType,
} from './core.js';
import { LEAD_STAGES, createLead, getLead, updateLead } from './leads.js';
import { createTask } from './tasks.js';
import { createContact } from './contacts.js';
import { runAgent } from './agents.js';

export const TRIGGERS = ['lead.created', 'lead.stage_changed', 'contact.created', 'property.identified', 'call.completed', 'task.completed', 'manual'] as const;
export type Trigger = (typeof TRIGGERS)[number];

// ------------------------------------------------------------------ conditions (pure)
export const conditionSchema = z.object({
  field: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.]+$/, 'Invalid field path'),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'exists']),
  value: z.unknown().optional(),
});
export type Condition = z.infer<typeof conditionSchema>;

export const getPath = (obj: unknown, path: string): any =>
  path.split('.').reduce<any>((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);

export const evaluateCondition = (c: Condition, payload: unknown): boolean => {
  const actual = getPath(payload, c.field);
  switch (c.op) {
    case 'exists': return actual !== undefined && actual !== null && actual !== '';
    case 'eq': return actual === c.value || String(actual) === String(c.value);
    case 'neq': return !(actual === c.value || String(actual) === String(c.value));
    case 'gt': return Number(actual) > Number(c.value);
    case 'gte': return Number(actual) >= Number(c.value);
    case 'lt': return Number(actual) < Number(c.value);
    case 'lte': return Number(actual) <= Number(c.value);
    case 'contains':
      return Array.isArray(actual) ? actual.includes(c.value) : String(actual ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
    case 'in': return Array.isArray(c.value) && c.value.map(String).includes(String(actual));
    default: return false;
  }
};
/** All conditions must hold (AND). An empty list always passes. */
export const evaluateConditions = (conditions: Condition[], payload: unknown) => conditions.every((c) => evaluateCondition(c, payload));

/** `{{lead.title}}` style interpolation from the trigger payload; unknown paths render as empty. */
export const interpolate = (template: string, payload: unknown) =>
  template.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_m, path) => {
    const v = getPath(payload, path);
    return v === undefined || v === null ? '' : String(v);
  });

// ------------------------------------------------------------------ actions
const priority = z.enum(['low', 'normal', 'high', 'urgent']);
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_task'), params: z.object({
    title: z.string().trim().min(1).max(200), dueInDays: z.coerce.number().min(0).max(365).default(1),
    priority: priority.default('normal'), assignTo: z.string().max(64).default('lead_assignee'),
  }) }),
  z.object({ type: z.literal('update_lead'), params: z.object({
    stage: z.enum(LEAD_STAGES).optional(), addScore: z.coerce.number().int().min(-100).max(100).optional(),
    nextRecommendedAction: z.string().trim().max(500).optional(),
  }).refine((p) => p.stage || p.addScore !== undefined || p.nextRecommendedAction, 'Specify at least one change') }),
  z.object({ type: z.literal('assign_user'), params: z.object({ userId: z.string().max(64) }) }),
  z.object({ type: z.literal('add_tag'), params: z.object({ tag: z.string().trim().min(1).max(40), target: z.enum(['lead', 'contact', 'property']).default('lead') }) }),
  z.object({ type: z.literal('add_to_campaign'), params: z.object({ campaignId: z.string().max(64) }) }),
  z.object({ type: z.literal('create_activity'), params: z.object({ summary: z.string().trim().min(1).max(500) }) }),
  z.object({ type: z.literal('create_lead'), params: z.object({ title: z.string().trim().max(200).optional(), source: z.string().trim().max(100).default('workflow') }) }),
  z.object({ type: z.literal('send_notification'), params: z.object({ message: z.string().trim().min(1).max(500) }) }),
  z.object({ type: z.literal('invoke_agent'), params: z.object({ agentKey: z.string().max(64), input: z.record(z.string(), z.unknown()).default({}) }) }),
]);
export type Action = z.infer<typeof actionSchema>;

export const ACTION_CATALOG = [
  { type: 'create_task', label: 'Create task', params: 'title ({{lead.title}} templates ok), dueInDays, priority, assignTo (lead_assignee | actor | userId)' },
  { type: 'update_lead', label: 'Update lead', params: 'stage, addScore, nextRecommendedAction' },
  { type: 'assign_user', label: 'Assign user', params: 'userId (a user in this organization, or "round_robin")' },
  { type: 'add_tag', label: 'Add tag', params: 'tag, target (lead | contact | property)' },
  { type: 'add_to_campaign', label: 'Add to campaign', params: 'campaignId' },
  { type: 'create_activity', label: 'Log activity', params: 'summary' },
  { type: 'create_lead', label: 'Create lead (property → owner → contact → lead)', params: 'title?, source?' },
  { type: 'send_notification', label: 'Send in-app notification', params: 'message (in-app only; no email/SMS is ever sent)' },
  { type: 'invoke_agent', label: 'Run AI agent', params: 'agentKey, input' },
];

interface RunState { payload: Record<string, any> }

const ids = (p: Record<string, any>) => ({
  leadId: p.lead?.id ?? null,
  contactId: p.contact?.id ?? p.lead?.contactId ?? p.call?.contactId ?? null,
  propertyId: p.property?.id ?? p.lead?.primaryPropertyId ?? p.call?.propertyId ?? null,
  ownerId: p.owner?.id ?? p.property?.ownerId ?? p.lead?.propertyOwnerId ?? null,
});

const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return parts.length === 1 ? { first: parts[0], last: '' } : { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
};

const roundRobinUser = async (db: Db, orgId: string) => {
  const r = await db.query(
    `SELECT u.id FROM users u WHERE u.organization_id=$1 AND u.disabled_at IS NULL AND u.role IN ('admin','property_manager','sales')
      ORDER BY (SELECT count(*) FROM leads l WHERE l.assigned_user_id=u.id AND l.archived_at IS NULL AND l.stage NOT IN ('won','lost')), u.id LIMIT 1`, [orgId]);
  return r.rows[0]?.id ?? null;
};

const refreshLead = async (db: Db, ctx: Ctx, state: RunState) => {
  const leadId = state.payload.lead?.id;
  if (leadId) state.payload.lead = await getLead(db, ctx.orgId, leadId);
};

const executeAction = async (db: Db, ctx: Ctx, action: Action, state: RunState): Promise<Record<string, unknown>> => {
  const p = state.payload;
  const refs = ids(p);
  switch (action.type) {
    case 'create_task': {
      assertCan(ctx, 'crm:write');
      const a = action.params;
      const assigned = a.assignTo === 'lead_assignee' ? (p.lead?.assignedUserId ?? ctx.userId)
        : a.assignTo === 'actor' ? ctx.userId : a.assignTo === 'unassigned' ? null : a.assignTo;
      const task = await createTask(db, ctx, {
        title: interpolate(a.title, p), priority: a.priority, assignedUserId: assigned,
        dueAt: new Date(Date.now() + a.dueInDays * 24 * 3600 * 1000).toISOString(),
        leadId: refs.leadId, contactId: refs.contactId, propertyId: refs.propertyId,
      } as any);
      return { taskId: task.id, title: task.title };
    }
    case 'update_lead': {
      assertCan(ctx, 'crm:write');
      if (!refs.leadId) throw badRequest('No lead in this workflow context');
      const a = action.params;
      const current = await getLead(db, ctx.orgId, refs.leadId);
      if (!current) throw notFound('Lead');
      const lead = await updateLead(db, ctx, refs.leadId, {
        ...(a.stage ? { stage: a.stage } : {}),
        ...(a.addScore !== undefined ? { score: Math.max(0, Math.min(100, current.leadScore + a.addScore)) } : {}),
        ...(a.nextRecommendedAction ? { nextRecommendedAction: a.nextRecommendedAction } : {}),
      } as any);
      p.lead = lead;
      return { leadId: lead.id, stage: lead.stage, score: lead.leadScore };
    }
    case 'assign_user': {
      assertCan(ctx, 'crm:write');
      const userId = action.params.userId === 'round_robin' ? await roundRobinUser(db, ctx.orgId) : action.params.userId;
      if (!userId) throw badRequest('No eligible user to assign');
      if (refs.leadId) { await updateLead(db, ctx, refs.leadId, { assignedUserId: userId } as any); await refreshLead(db, ctx, state); }
      else if (refs.contactId) {
        const ok = await db.query('SELECT 1 FROM users WHERE id=$1 AND organization_id=$2 AND disabled_at IS NULL', [userId, ctx.orgId]);
        if (!ok.rows.length) throw badRequest('Unknown user reference');
        await db.query('UPDATE contacts SET assigned_user_id=$1, updated_at=now() WHERE id=$2 AND organization_id=$3', [userId, refs.contactId, ctx.orgId]);
        await logActivity(db, ctx, 'contact.assigned', 'Contact assigned by workflow', { contactId: refs.contactId });
      } else throw badRequest('Nothing to assign in this workflow context');
      return { assignedUserId: userId };
    }
    case 'add_tag': {
      assertCan(ctx, 'crm:write');
      const { tag, target } = action.params;
      const table = target === 'lead' ? 'leads' : target === 'contact' ? 'contacts' : 'properties';
      const id = target === 'lead' ? refs.leadId : target === 'contact' ? refs.contactId : refs.propertyId;
      if (!id) throw badRequest(`No ${target} in this workflow context`);
      await db.query(
        `UPDATE ${table} SET tags = CASE WHEN tags @> $1::jsonb THEN tags ELSE tags || $1::jsonb END WHERE id=$2 AND organization_id=$3`,
        [JSON.stringify([tag]), id, ctx.orgId]);
      await logActivity(db, ctx, 'tag.added', `Tag "${tag}" added to ${target}`, refs);
      return { target, id, tag };
    }
    case 'add_to_campaign': {
      assertCan(ctx, 'campaigns:manage');
      if (!refs.contactId) throw badRequest('No contact in this workflow context');
      await assertRef(db, ctx.orgId, 'campaigns', action.params.campaignId, 'campaign');
      const camp = (await db.query('SELECT status, name FROM campaigns WHERE id=$1 AND organization_id=$2', [action.params.campaignId, ctx.orgId])).rows[0];
      if (['completed', 'archived'].includes(camp.status)) throw new HttpError(409, `Campaign is ${camp.status}`);
      const ct = (await db.query('SELECT phone, do_not_call, archived_at FROM contacts WHERE id=$1 AND organization_id=$2', [refs.contactId, ctx.orgId])).rows[0];
      if (!ct?.phone || ct.do_not_call || ct.archived_at) return { added: false, reason: 'Contact is not callable (no phone, Do Not Call, or archived)' };
      const ins = await db.query(
        `INSERT INTO campaign_contacts (id, organization_id, campaign_id, contact_id, lead_id) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (campaign_id, contact_id) DO NOTHING RETURNING id`, [newId(), ctx.orgId, action.params.campaignId, refs.contactId, refs.leadId]);
      if (ins.rows.length) await logActivity(db, ctx, 'campaign.contacts_added', `Contact added to "${camp.name}" by workflow`, { ...refs, campaignId: action.params.campaignId });
      return { added: ins.rows.length > 0, campaignId: action.params.campaignId };
    }
    case 'create_activity': {
      await logActivity(db, ctx, 'workflow.activity', interpolate(action.params.summary, p), { ...refs });
      return { logged: true };
    }
    case 'create_lead': {
      assertCan(ctx, 'crm:write');
      if (!refs.propertyId) throw badRequest('create_lead needs a property in the trigger context');
      const prop = camel<any>((await db.query('SELECT * FROM properties WHERE id=$1 AND organization_id=$2', [refs.propertyId, ctx.orgId])).rows[0]);
      if (!prop) throw notFound('Property');
      let contactId: string | null = null;
      let created = { owner: false, contact: false };
      if (prop.ownerId) {
        const owner = camel<any>((await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [prop.ownerId, ctx.orgId])).rows[0]);
        const existing = (await db.query('SELECT id FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL ORDER BY created_at LIMIT 1', [ctx.orgId, prop.ownerId])).rows[0];
        if (existing) contactId = existing.id;
        else if (owner && (owner.phoneNumbers?.length || owner.emailAddresses?.length)) {
          const n = splitName(owner.name);
          const contact = await createContact(db, ctx, {
            firstName: n.first, lastName: n.last, phone: owner.phoneNumbers?.[0] ?? null, email: owner.emailAddresses?.[0] ?? null,
            contactType: 'owner', propertyOwnerId: owner.id, source: 'workflow', tags: [], doNotCall: false,
          } as any);
          contactId = contact.id; created.contact = true;
          p.contact = contact;
        }
        p.owner = owner;
      }
      const { lead, created: leadCreated } = await createLead(db, ctx, {
        title: action.params.title ? interpolate(action.params.title, p) : undefined, propertyId: prop.id, contactId, source: action.params.source,
        stage: 'identified', tags: [], value: 0,
      } as any, { dedupe: true });
      p.lead = lead; p.property = prop;
      return { leadId: lead.id, leadCreated, contactCreated: created.contact, contactId };
    }
    case 'send_notification': {
      // In-app only: stored in the activity feed. No email, SMS or push is ever sent from here.
      await logActivity(db, ctx, 'notification', interpolate(action.params.message, p), refs, { channel: 'in_app' });
      return { channel: 'in_app' };
    }
    case 'invoke_agent': {
      const r = await runAgent({ ...ctx, kind: 'agent', depth: ctx.depth }, action.params.agentKey, { ...refs, ...action.params.input });
      if (r.status === 'failed') throw new Error(`Agent ${action.params.agentKey} failed: ${r.error}`);
      return { agentRunId: r.runId, status: r.status };
    }
  }
};

// ------------------------------------------------------------------ execution
export interface WorkflowRow {
  id: string; name: string; triggerType: Trigger; conditions: Condition[]; actions: Action[]; enabled: boolean;
}

export const executeWorkflow = async (ctx: Ctx, wf: WorkflowRow, trigger: Trigger, payload: Record<string, any>) => {
  const db = getDb();
  const runId = newId();
  await db.query(
    `INSERT INTO workflow_runs (id, organization_id, workflow_id, status, trigger_type, trigger_payload) VALUES ($1,$2,$3,'queued',$4,$5::jsonb)`,
    [runId, ctx.orgId, wf.id, trigger, JSON.stringify(payload)]);
  await db.query(`UPDATE workflow_runs SET status='running', started_at=now() WHERE id=$1`, [runId]);
  const runCtx: Ctx = { ...ctx, kind: 'workflow', depth: ctx.depth + 1, workflowRunId: runId };
  const steps: Array<Record<string, unknown>> = [];
  let status: 'completed' | 'failed' = 'completed';
  let error: string | null = null;
  let conditionsMet = true;
  const state: RunState = { payload: { ...payload } };

  try {
    conditionsMet = evaluateConditions(wf.conditions, state.payload);
    if (conditionsMet) {
      for (const [index, action] of wf.actions.entries()) {
        try {
          const output = await executeAction(db, runCtx, action, state);
          steps.push({ index, type: action.type, status: 'completed', output });
        } catch (e: any) {
          const message = e instanceof HttpError || e?.status || e?.name === 'ZodError' ? String(e.message) : 'Action failed';
          if (!(e instanceof HttpError) && !e?.status) console.error('Workflow %s action %s failed:', String(wf.id), String(action.type), e);
          steps.push({ index, type: action.type, status: 'failed', error: message });
          status = 'failed'; error = `Step ${index + 1} (${action.type}): ${message}`;
          break;
        }
      }
    }
  } catch (e: any) {
    status = 'failed'; error = e?.message ?? 'Workflow failed';
  }

  await db.query(
    `UPDATE workflow_runs SET status=$2, conditions_met=$3, steps=$4::jsonb, error=$5, finished_at=now() WHERE id=$1`,
    [runId, status, conditionsMet, JSON.stringify(steps), error]);
  await db.query('UPDATE workflows SET last_run_at=now() WHERE id=$1 AND organization_id=$2', [wf.id, ctx.orgId]);
  const refs = ids(state.payload);
  await logActivity(db, runCtx, `workflow.${status}`,
    status === 'failed' ? `Workflow "${wf.name}" failed: ${error}` : conditionsMet ? `Workflow "${wf.name}" ran ${steps.length} action(s)` : `Workflow "${wf.name}" skipped (conditions not met)`,
    refs, { workflowId: wf.id, runId });
  return { runId, status, conditionsMet, steps, error };
};

const toWorkflow = (row: any): WorkflowRow => ({
  id: row.id, name: row.name, triggerType: row.trigger_type, enabled: row.enabled,
  conditions: Array.isArray(row.conditions) ? row.conditions : [], actions: Array.isArray(row.actions) ? row.actions : [],
});

export const dispatchEvent = async (ctx: Ctx, type: EventType, payload: Record<string, any>) => {
  const rows = await getDb().query(
    'SELECT * FROM workflows WHERE organization_id=$1 AND trigger_type=$2 AND enabled=true ORDER BY created_at', [ctx.orgId, type]);
  for (const row of rows.rows) await executeWorkflow(ctx, toWorkflow(row), type, payload);
};
setEventHandler(dispatchEvent);

/** Builds a trigger payload from record ids so a workflow can be run manually against real records. */
const buildPayload = async (db: Db, ctx: Ctx, target: { leadId?: string; contactId?: string; propertyId?: string }) => {
  const payload: Record<string, any> = {};
  if (target.leadId) {
    payload.lead = await getLead(db, ctx.orgId, target.leadId);
    if (!payload.lead) throw notFound('Lead');
  }
  const contactId = target.contactId ?? payload.lead?.contactId;
  if (contactId) payload.contact = camel((await db.query('SELECT * FROM contacts WHERE id=$1 AND organization_id=$2', [contactId, ctx.orgId])).rows[0]);
  const propertyId = target.propertyId ?? payload.lead?.primaryPropertyId;
  if (propertyId) payload.property = camel((await db.query('SELECT * FROM properties WHERE id=$1 AND organization_id=$2', [propertyId, ctx.orgId])).rows[0]);
  const ownerId = payload.property?.ownerId ?? payload.lead?.propertyOwnerId;
  if (ownerId) payload.owner = camel((await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId])).rows[0]);
  if (!payload.lead && !payload.contact && !payload.property) throw badRequest('Provide a leadId, contactId or propertyId to run against');
  return payload;
};

// ------------------------------------------------------------------ routes
export const workflowInput = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullish(),
  triggerType: z.enum(TRIGGERS),
  conditions: z.array(conditionSchema).max(20).default([]),
  actions: z.array(actionSchema).min(1, 'Add at least one action').max(20),
  enabled: z.boolean().default(true),
});

export const workflowsRouter = Router();

workflowsRouter.get('/workflows/meta', route('crm:read', async () => ({
  triggers: TRIGGERS, actions: ACTION_CATALOG, operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'exists'],
  payloadFields: {
    'lead.created': ['lead.leadScore', 'lead.classification', 'lead.stage', 'lead.source', 'property.state', 'property.taxDelinquent', 'owner.entityType'],
    'lead.stage_changed': ['lead.stage', 'previousStage', 'lead.leadScore'],
    'contact.created': ['contact.contactType', 'contact.source'],
    'property.identified': ['property.state', 'property.taxDelinquent', 'property.isAbsenteeOwner', 'property.estimatedEquity'],
    'call.completed': ['call.outcome', 'call.status', 'call.durationSeconds', 'lead.stage'],
    'task.completed': ['task.title', 'task.priority'],
    manual: ['lead.stage', 'lead.leadScore', 'property.state'],
  },
})));

workflowsRouter.get('/workflows', route('crm:read', async (_req, _res, ctx) => {
  const rows = await getDb().query(
    `SELECT w.*,
            (SELECT count(*)::int FROM workflow_runs r WHERE r.workflow_id=w.id) AS runs_count,
            (SELECT count(*)::int FROM workflow_runs r WHERE r.workflow_id=w.id AND r.status='failed') AS failed_count
       FROM workflows w WHERE w.organization_id=$1 ORDER BY w.created_at DESC`, [ctx.orgId]);
  return { items: camelRows(rows.rows) };
}));

workflowsRouter.post('/workflows', route('workflows:manage', async (req, res, ctx) => {
  const input = workflowInput.parse(req.body);
  const id = newId();
  const r = await getDb().query(
    `INSERT INTO workflows (id, organization_id, name, description, trigger_type, conditions, actions, enabled, created_by)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9) RETURNING *`,
    [id, ctx.orgId, input.name, input.description ?? null, input.triggerType, JSON.stringify(input.conditions), JSON.stringify(input.actions), input.enabled, ctx.userId]);
  await logActivity(getDb(), ctx, 'workflow.created', `Workflow "${input.name}" created`, {}, { workflowId: id });
  res.status(201).json({ workflow: camel(r.rows[0]) });
}));

workflowsRouter.get('/workflows/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const w = await db.query('SELECT * FROM workflows WHERE id=$1 AND organization_id=$2', [String(req.params.id), ctx.orgId]);
  if (!w.rows.length) throw notFound('Workflow');
  const runs = await db.query('SELECT * FROM workflow_runs WHERE workflow_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 25', [String(req.params.id), ctx.orgId]);
  return { workflow: camel(w.rows[0]), runs: camelRows(runs.rows) };
}));

workflowsRouter.patch('/workflows/:id', route('workflows:manage', async (req, _res, ctx) => {
  const input = presentOnly(workflowInput.partial().parse(req.body), req.body);
  const cols: Record<string, [string, boolean]> = {
    name: ['name', false], description: ['description', false], triggerType: ['trigger_type', false],
    conditions: ['conditions', true], actions: ['actions', true], enabled: ['enabled', false],
  };
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, [col, json]] of Object.entries(cols)) {
    if ((input as any)[k] === undefined) continue;
    params.push(json ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${json ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(`UPDATE workflows SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Workflow');
  await logActivity(getDb(), ctx, 'workflow.updated', `Workflow "${r.rows[0].name}" updated`, {}, { workflowId: r.rows[0].id, fields: Object.keys(input) });
  return { workflow: camel(r.rows[0]) };
}));

workflowsRouter.delete('/workflows/:id', route('workflows:manage', async (req, res, ctx) => {
  const r = await getDb().query('DELETE FROM workflows WHERE id=$1 AND organization_id=$2 RETURNING name', [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Workflow');
  await logActivity(getDb(), ctx, 'workflow.deleted', `Workflow "${r.rows[0].name}" deleted`);
  res.status(204).end();
}));

const runInput = z.object({ leadId: z.string().max(64).optional(), contactId: z.string().max(64).optional(), propertyId: z.string().max(64).optional() });

workflowsRouter.post('/workflows/:id/run', route('workflows:run', async (req, _res, ctx) => {
  const db = getDb();
  const w = await db.query('SELECT * FROM workflows WHERE id=$1 AND organization_id=$2', [String(req.params.id), ctx.orgId]);
  if (!w.rows.length) throw notFound('Workflow');
  const payload = await buildPayload(db, ctx, runInput.parse(req.body ?? {}));
  const result = await executeWorkflow(ctx, toWorkflow(w.rows[0]), 'manual', payload);
  return result;
}));

workflowsRouter.get('/workflow-runs', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'r.organization_id');
  if (q.workflowId) w.add('r.workflow_id = ?', q.workflowId);
  if (q.status) w.add('r.status = ?', q.status);
  const { limit, offset } = pageParams(q, 100);
  const rows = await getDb().query(
    `SELECT r.*, wf.name AS workflow_name FROM workflow_runs r JOIN workflows wf ON wf.id=r.workflow_id
      WHERE ${w.sql} ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), limit, offset };
}));

export { forbidden };

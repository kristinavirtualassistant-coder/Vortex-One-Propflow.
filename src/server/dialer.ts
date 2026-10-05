/**
 * Dialer: call state machine, telephony provider abstraction, and call routes.
 *
 * Only a SIMULATED provider exists today. No code path here talks to a telephone
 * network, so no real call, SMS or charge can occur. Every call row records the
 * provider and `is_simulated`, and the UI labels simulated calls explicitly.
 * A real provider (e.g. Twilio) would implement `TelephonyProvider`, keep its
 * credentials server-side, and be selected in `getTelephony`.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  HttpError, assertRef, badRequest, camel, camelRows, conflict, emit, getDb, logActivity, newId, notFound, route, withTx,
  Where, pageParams, type Ctx, type Db,
} from './core.js';
import { createTask } from './tasks.js';

// ------------------------------------------------------------------ state machine
export const CALL_STATUSES = ['dialing', 'ringing', 'connected', 'completed', 'failed', 'no_answer', 'busy', 'canceled'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];
export const TERMINAL_STATUSES: CallStatus[] = ['completed', 'failed', 'no_answer', 'busy', 'canceled'];

const TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  dialing: ['ringing', 'failed', 'canceled'],
  ringing: ['connected', 'no_answer', 'busy', 'failed', 'canceled'],
  connected: ['completed', 'failed'],
  completed: [], failed: [], no_answer: [], busy: [], canceled: [],
};
export const isTerminal = (s: string) => (TERMINAL_STATUSES as string[]).includes(s);
export const canTransition = (from: string, to: string) => (TRANSITIONS[from as CallStatus] ?? []).includes(to as CallStatus);

export const OUTCOMES = [
  'connected_interested', 'appointment_set', 'callback', 'not_interested', 'voicemail', 'wrong_number', 'do_not_call',
] as const;
export type CallOutcome = (typeof OUTCOMES)[number] | 'no_answer' | 'busy';

export const MAX_ATTEMPTS = 3;
const ABANDON_AFTER_MINUTES = 10;

// ------------------------------------------------------------------ provider abstraction
export interface TelephonyProvider {
  readonly name: string;
  readonly simulated: boolean;
  start(input: { to: string }): Promise<{ providerCallId: string }>;
}

export const simulatedProvider: TelephonyProvider = {
  name: 'simulated',
  simulated: true,
  async start() { return { providerCallId: `sim_${newId()}` }; },
};

/** Deterministic simulated call plan from the last digit of the number: 0-5 answered, 6-7 no answer, 8 busy, 9 fails. */
export const simulatedPlan = (toNumber: string): 'connected' | 'no_answer' | 'busy' | 'failed' => {
  const digit = Number((toNumber.match(/\d(?!.*\d)/) ?? ['0'])[0]);
  return digit <= 5 ? 'connected' : digit <= 7 ? 'no_answer' : digit === 8 ? 'busy' : 'failed';
};

export const getTelephony = (_ctx: Pick<Ctx, 'isDemo'>) => {
  // Demo organisations can never use a real provider. Outside demo, a real provider is not implemented yet.
  const requested = String(process.env.TELEPHONY_PROVIDER || 'simulated').toLowerCase();
  return {
    provider: simulatedProvider,
    mode: 'simulated' as const,
    realProviderRequested: requested !== 'simulated',
    note: requested !== 'simulated'
      ? `TELEPHONY_PROVIDER=${requested} is not implemented; calls remain simulated.`
      : 'Simulated dialer: no real calls are placed.',
  };
};

// ------------------------------------------------------------------ campaign accounting
/** Updates the campaign membership for a finished attempt. */
const recordAttempt = async (db: Db, ctx: Ctx, call: any, outcome: CallOutcome | null) => {
  if (!call.campaignId || !call.contactId) return;
  const m = await db.query(
    'SELECT * FROM campaign_contacts WHERE organization_id=$1 AND campaign_id=$2 AND contact_id=$3',
    [ctx.orgId, call.campaignId, call.contactId]);
  if (!m.rows.length) return;
  const attempts = m.rows[0].attempts + 1;
  let status: string;
  switch (outcome) {
    case 'do_not_call': status = 'do_not_call'; break;
    case 'appointment_set': case 'connected_interested': case 'not_interested': case 'wrong_number': status = 'completed'; break;
    default: status = attempts >= MAX_ATTEMPTS ? 'exhausted' : 'pending';
  }
  await db.query(
    `UPDATE campaign_contacts SET attempts=$1, status=$2, last_outcome=$3, last_called_at=now()
      WHERE id=$4`, [attempts, status, outcome, m.rows[0].id]);
};

const STAGE_RANK: Record<string, number> = { identified: 0, contacted: 1, qualified: 2, appointment: 3, negotiating: 4, won: 5, lost: 5 };

/** Moves the lead forward (never backward) as a result of a call. Returns the stage change, if any. */
const advanceLeadForCall = async (db: Db, ctx: Ctx, call: any, outcome: CallOutcome | null, connected: boolean) => {
  if (!call.leadId) return null;
  const lead = (await db.query('SELECT * FROM leads WHERE id=$1 AND organization_id=$2', [call.leadId, ctx.orgId])).rows[0];
  if (!lead || ['won', 'lost'].includes(lead.stage)) return null;
  let target: string | null = null;
  if (outcome === 'appointment_set') target = 'appointment';
  else if (outcome === 'connected_interested') target = 'qualified';
  else if (connected) target = 'contacted';
  if (!target || STAGE_RANK[target] <= STAGE_RANK[lead.stage]) {
    await db.query('UPDATE leads SET last_activity_date=now(), updated_at=now() WHERE id=$1', [lead.id]);
    return null;
  }
  const updated = await db.query(
    'UPDATE leads SET stage=$1, last_activity_date=now(), updated_at=now() WHERE id=$2 RETURNING *', [target, lead.id]);
  await logActivity(db, ctx, 'lead.stage_changed', `Lead "${lead.title}" moved ${lead.stage} → ${target} after call`,
    { leadId: lead.id, contactId: lead.contact_id, propertyId: lead.primary_property_id, ownerId: lead.property_owner_id, callId: call.id },
    { from: lead.stage, to: target });
  return { lead: camel(updated.rows[0]), previousStage: lead.stage };
};

// ------------------------------------------------------------------ call lifecycle
const callRefs = (call: any) => ({
  contactId: call.contactId, leadId: call.leadId, propertyId: call.propertyId, campaignId: call.campaignId, callId: call.id,
});

const loadCall = async (db: Db, ctx: Ctx, id: string, forUpdate = false) => {
  const r = await db.query(`SELECT * FROM calls WHERE id=$1 AND organization_id=$2${forUpdate ? ' FOR UPDATE' : ''}`, [id, ctx.orgId]);
  if (!r.rows.length) throw notFound('Call');
  return camel<any>(r.rows[0])!;
};

export const startCall = async (ctx: Ctx, input: { contactId: string; campaignId?: string | null; leadId?: string | null; propertyId?: string | null }) => {
  const telephony = getTelephony(ctx);
  const call = await withTx(async (db) => {
    const c = (await db.query('SELECT * FROM contacts WHERE id=$1 AND organization_id=$2 FOR UPDATE', [input.contactId, ctx.orgId])).rows[0];
    if (!c) throw badRequest('Unknown contact reference');
    if (c.archived_at) throw new HttpError(422, 'This contact is archived', 'contact_archived');
    if (c.do_not_call) throw new HttpError(422, 'This contact is on the Do Not Call list', 'do_not_call');
    if (!c.phone) throw new HttpError(422, 'This contact has no phone number', 'no_phone');

    await assertRef(db, ctx.orgId, 'leads', input.leadId, 'lead');
    await assertRef(db, ctx.orgId, 'properties', input.propertyId, 'property');
    let leadId = input.leadId ?? null;
    let propertyId = input.propertyId ?? null;
    if (input.campaignId) {
      const camp = (await db.query('SELECT status FROM campaigns WHERE id=$1 AND organization_id=$2', [input.campaignId, ctx.orgId])).rows[0];
      if (!camp) throw badRequest('Unknown campaign reference');
      if (camp.status !== 'active') throw new HttpError(422, `Campaign is ${camp.status}; activate or resume it before dialing`, 'campaign_not_active');
      const m = (await db.query('SELECT * FROM campaign_contacts WHERE campaign_id=$1 AND contact_id=$2 AND organization_id=$3', [input.campaignId, c.id, ctx.orgId])).rows[0];
      if (!m) throw new HttpError(422, 'Contact is not part of this campaign', 'not_in_campaign');
      leadId = leadId ?? m.lead_id ?? null;
    }
    if (!leadId) {
      const l = (await db.query(
        `SELECT id, primary_property_id FROM leads WHERE organization_id=$1 AND contact_id=$2 AND archived_at IS NULL
          AND stage NOT IN ('won','lost') ORDER BY updated_at DESC LIMIT 1`, [ctx.orgId, c.id])).rows[0];
      leadId = l?.id ?? null;
      propertyId = propertyId ?? l?.primary_property_id ?? null;
    } else if (!propertyId) {
      propertyId = (await db.query('SELECT primary_property_id FROM leads WHERE id=$1 AND organization_id=$2', [leadId, ctx.orgId])).rows[0]?.primary_property_id ?? null;
    }

    const live = await db.query(
      `SELECT id FROM calls WHERE organization_id=$1 AND contact_id=$2 AND status IN ('dialing','ringing','connected')
          AND started_at > now() - interval '${ABANDON_AFTER_MINUTES} minutes' LIMIT 1`, [ctx.orgId, c.id]);
    if (live.rows.length) throw conflict('A call to this contact is already in progress');

    const started = await telephony.provider.start({ to: c.phone });
    const id = newId();
    const r = await db.query(
      `INSERT INTO calls (id, organization_id, contact_id, lead_id, property_id, campaign_id, user_id, to_number, status,
                          provider, is_simulated, provider_call_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'dialing',$9,$10,$11) RETURNING *`,
      [id, ctx.orgId, c.id, leadId, propertyId, input.campaignId ?? null, ctx.userId, c.phone,
       telephony.provider.name, telephony.provider.simulated, started.providerCallId]);
    if (input.campaignId) {
      await db.query(`UPDATE campaign_contacts SET status='in_progress' WHERE campaign_id=$1 AND contact_id=$2 AND organization_id=$3 AND status='pending'`,
        [input.campaignId, c.id, ctx.orgId]);
    }
    const call = camel<any>(r.rows[0])!;
    await logActivity(db, ctx, 'call.started', `${telephony.provider.simulated ? 'Simulated call' : 'Call'} to ${c.first_name} ${c.last_name} started`.replace(/\s+/g, ' '),
      callRefs(call), { simulated: telephony.provider.simulated, provider: telephony.provider.name });
    return call;
  });
  return call;
};

const finalizeTerminal = async (db: Db, ctx: Ctx, call: any, status: CallStatus) => {
  const outcome: CallOutcome | null = status === 'no_answer' ? 'no_answer' : status === 'busy' ? 'busy' : null;
  await db.query(
    `UPDATE calls SET ended_at=now(), duration_seconds=0, outcome=$2, updated_at=now() WHERE id=$1`, [call.id, outcome]);
  await recordAttempt(db, ctx, call, outcome);
  return outcome;
};

/** Advances a simulated call one step (or to an explicit valid next state). */
export const advanceCall = async (ctx: Ctx, id: string, to?: CallStatus) => {
  const events: Array<() => Promise<void>> = [];
  const call = await withTx(async (db) => {
    const call = await loadCall(db, ctx, id, true);
    if (!call.isSimulated) throw new HttpError(422, 'Only simulated calls can be advanced manually', 'not_simulated');
    if (isTerminal(call.status)) throw conflict(`Call is already ${call.status}`);
    let next = to;
    if (!next) next = call.status === 'dialing' ? 'ringing' : call.status === 'ringing' ? simulatedPlan(call.toNumber) : 'completed';
    if (next === 'completed') throw badRequest('Complete a connected call by recording its outcome');
    if (!canTransition(call.status, next)) throw conflict(`Cannot move a call from ${call.status} to ${next}`);

    const answered = next === 'connected';
    await db.query(
      `UPDATE calls SET status=$2, answered_at=${answered ? 'now()' : 'answered_at'}, updated_at=now(),
              failure_reason=${next === 'failed' ? `'Simulated number unreachable'` : 'failure_reason'} WHERE id=$1`, [id, next]);
    const updated = await loadCall(db, ctx, id);
    if (isTerminal(next)) {
      const outcome = await finalizeTerminal(db, ctx, updated, next);
      await logActivity(db, ctx, `call.${next}`, `Call ${next.replace('_', ' ')}`, callRefs(updated));
      events.push(() => emit(ctx, 'call.completed', { call: { ...updated, status: next, outcome }, contact: { id: updated.contactId }, lead: updated.leadId ? { id: updated.leadId } : null }));
    } else if (answered) {
      await db.query('UPDATE contacts SET last_contacted_at=now(), updated_at=now() WHERE id=$1 AND organization_id=$2', [updated.contactId, ctx.orgId]);
      await logActivity(db, ctx, 'call.connected', 'Call connected', callRefs(updated));
    }
    return await loadCall(db, ctx, id);
  });
  for (const e of events) await e();
  return call;
};

export const cancelCall = async (ctx: Ctx, id: string) => {
  return withTx(async (db) => {
    const call = await loadCall(db, ctx, id, true);
    if (!canTransition(call.status, 'canceled')) throw conflict(`Cannot cancel a call that is ${call.status}`);
    await db.query(`UPDATE calls SET status='canceled', ended_at=now(), duration_seconds=0, updated_at=now() WHERE id=$1`, [id]);
    // A canceled attempt does not count against the contact: put them back in the queue.
    if (call.campaignId) {
      await db.query(
        `UPDATE campaign_contacts SET status='pending' WHERE campaign_id=$1 AND contact_id=$2 AND organization_id=$3 AND status='in_progress'`,
        [call.campaignId, call.contactId, ctx.orgId]);
    }
    await logActivity(db, ctx, 'call.canceled', 'Call canceled', callRefs(call));
    return loadCall(db, ctx, id);
  });
};

export const completeCallInput = z.object({
  outcome: z.enum(OUTCOMES),
  notes: z.string().trim().max(10000).optional(),
  durationSeconds: z.coerce.number().int().min(0).max(7200).optional(),
  followUp: z.object({
    title: z.string().trim().min(1).max(200),
    dueAt: z.string().datetime({ offset: true }).nullish(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  }).nullish(),
});

export const completeCall = async (ctx: Ctx, id: string, input: z.infer<typeof completeCallInput>) => {
  const events: Array<() => Promise<void>> = [];
  const result = await withTx(async (db) => {
    const call = await loadCall(db, ctx, id, true);
    if (call.status !== 'connected') throw conflict(`Only a connected call can be completed (this call is ${call.status})`);
    const elapsed = Math.max(0, Math.round((Date.now() - new Date(call.answeredAt ?? call.startedAt).getTime()) / 1000));
    const duration = call.isSimulated && input.durationSeconds !== undefined ? input.durationSeconds : elapsed;
    await db.query(
      `UPDATE calls SET status='completed', outcome=$2, notes=$3, ended_at=now(), duration_seconds=$4, updated_at=now() WHERE id=$1`,
      [id, input.outcome, input.notes ?? null, duration]);
    const done = await loadCall(db, ctx, id);
    const refs = callRefs(done);

    await logActivity(db, ctx, 'call.completed', `Call completed: ${input.outcome.replace(/_/g, ' ')}${done.isSimulated ? ' (simulated)' : ''}`,
      refs, { outcome: input.outcome, durationSeconds: duration, simulated: done.isSimulated });
    if (input.notes) {
      await db.query(
        `INSERT INTO notes (id, organization_id, body, author_id, contact_id, lead_id, property_id, campaign_id, call_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [newId(), ctx.orgId, input.notes, ctx.userId, done.contactId, done.leadId, done.propertyId, done.campaignId, id]);
    }
    await recordAttempt(db, ctx, done, input.outcome);
    if (input.outcome === 'do_not_call') {
      await db.query('UPDATE contacts SET do_not_call=true, updated_at=now() WHERE id=$1 AND organization_id=$2', [done.contactId, ctx.orgId]);
      await db.query(`UPDATE campaign_contacts SET status='do_not_call' WHERE contact_id=$1 AND organization_id=$2 AND status IN ('pending','in_progress')`, [done.contactId, ctx.orgId]);
      await logActivity(db, ctx, 'contact.do_not_call', 'Contact added to Do Not Call list', refs);
    }
    const stageChange = await advanceLeadForCall(db, ctx, done, input.outcome, true);

    // Follow-up: explicit, or automatic for "callback".
    let followUp = null;
    const fu = input.followUp ?? (input.outcome === 'callback'
      ? { title: 'Call back (requested on call)', dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), priority: 'high' as const }
      : null);
    if (fu) {
      followUp = await createTask(db, ctx, {
        title: fu.title, dueAt: fu.dueAt ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString(), priority: fu.priority,
        assignedUserId: ctx.userId, contactId: done.contactId, leadId: done.leadId, propertyId: done.propertyId,
        campaignId: done.campaignId, callId: id,
      } as any);
    }
    const contact = camel((await db.query('SELECT * FROM contacts WHERE id=$1 AND organization_id=$2', [done.contactId, ctx.orgId])).rows[0]);
    const lead = done.leadId ? camel((await db.query('SELECT * FROM leads WHERE id=$1 AND organization_id=$2', [done.leadId, ctx.orgId])).rows[0]) : null;
    events.push(() => emit(ctx, 'call.completed', { call: done, contact, lead }));
    if (stageChange) events.push(() => emit(ctx, 'lead.stage_changed', { lead: stageChange.lead, previousStage: stageChange.previousStage }));
    return { call: await loadCall(db, ctx, id), followUp, leadStageChanged: Boolean(stageChange) };
  });
  for (const e of events) await e();
  return result;
};

/** Calls left non-terminal for too long (browser closed mid-call) are failed so they stop blocking the contact. */
export const reapAbandonedCalls = async (db: Db, ctx: Ctx) => {
  const stale = await db.query(
    `UPDATE calls SET status='failed', failure_reason='Abandoned: no activity for ${ABANDON_AFTER_MINUTES} minutes', ended_at=now(), duration_seconds=0, updated_at=now()
      WHERE organization_id=$1 AND status IN ('dialing','ringing','connected') AND started_at < now() - interval '${ABANDON_AFTER_MINUTES} minutes' RETURNING *`,
    [ctx.orgId]);
  for (const row of stale.rows) {
    const call = camel<any>(row)!;
    await recordAttempt(db, ctx, call, null);
    await logActivity(db, ctx, 'call.failed', 'Call abandoned (no activity)', callRefs(call));
  }
  return stale.rows.length;
};

// ------------------------------------------------------------------ routes
export const dialerRouter = Router();

dialerRouter.get('/dialer/status', route('dialer:use', async (_req, _res, ctx) => {
  const t = getTelephony(ctx);
  return {
    mode: t.mode, provider: t.provider.name, simulated: t.provider.simulated, realCallsEnabled: false,
    note: t.note, outcomes: OUTCOMES, statuses: CALL_STATUSES,
    simulationRules: 'Last digit of the number: 0-5 answered, 6-7 no answer, 8 busy, 9 fails.',
  };
}));

dialerRouter.get('/calls', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const db = getDb();
  await reapAbandonedCalls(db, ctx);
  const w = new Where(ctx.orgId, 'c.organization_id');
  if (q.status) w.add('c.status = ?', q.status);
  if (q.outcome) w.add('c.outcome = ?', q.outcome);
  if (q.campaignId) w.add('c.campaign_id = ?', q.campaignId);
  if (q.contactId) w.add('c.contact_id = ?', q.contactId);
  if (q.leadId) w.add('c.lead_id = ?', q.leadId);
  if (q.userId === 'me') w.add('c.user_id = ?', ctx.userId);
  const { limit, offset } = pageParams(q);
  const total = await db.query(`SELECT count(*)::int AS n FROM calls c WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT c.*, ct.first_name || ' ' || ct.last_name AS contact_name, ca.name AS campaign_name, u.name AS user_name, l.title AS lead_title
       FROM calls c LEFT JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN campaigns ca ON ca.id=c.campaign_id
       LEFT JOIN users u ON u.id=c.user_id LEFT JOIN leads l ON l.id=c.lead_id
      WHERE ${w.sql} ORDER BY c.started_at DESC, c.id LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

dialerRouter.get('/calls/:id', route('crm:read', async (req, _res, ctx) => {
  const r = await getDb().query(
    `SELECT c.*, ct.first_name || ' ' || ct.last_name AS contact_name, ca.name AS campaign_name
       FROM calls c LEFT JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN campaigns ca ON ca.id=c.campaign_id
      WHERE c.id=$1 AND c.organization_id=$2`, [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Call');
  return { call: camel(r.rows[0]) };
}));

const startInput = z.object({
  contactId: z.string().min(1).max(64), campaignId: z.string().max(64).nullish(),
  leadId: z.string().max(64).nullish(), propertyId: z.string().max(64).nullish(),
});

dialerRouter.post('/calls', route('dialer:use', async (req, res, ctx) => {
  const call = await startCall(ctx, startInput.parse(req.body));
  res.status(201).json({ call, simulated: call.isSimulated });
}));

dialerRouter.post('/calls/:id/advance', route('dialer:use', async (req, _res, ctx) => {
  const to = req.body?.to === undefined ? undefined : z.enum(CALL_STATUSES).parse(req.body.to);
  return { call: await advanceCall(ctx, String(req.params.id), to) };
}));

dialerRouter.post('/calls/:id/cancel', route('dialer:use', async (req, _res, ctx) => ({ call: await cancelCall(ctx, String(req.params.id)) })));

dialerRouter.post('/calls/:id/complete', route('dialer:use', async (req, _res, ctx) =>
  completeCall(ctx, String(req.params.id), completeCallInput.parse(req.body))));

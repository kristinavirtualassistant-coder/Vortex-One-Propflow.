import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreProperty, classify } from '../src/server/scoring.ts';
import { evaluateCondition, evaluateConditions, interpolate, actionSchema, conditionSchema } from '../src/server/workflows.ts';
import { canTransition, isTerminal, simulatedPlan, getTelephony, simulatedProvider } from '../src/server/dialer.ts';
import { CAMPAIGN_TRANSITIONS } from '../src/server/campaigns.ts';
import { can, permissionsFor } from '../src/server/core.ts';

test('scoring: factors add up, are capped and classified', () => {
  const none = scoreProperty({});
  assert.equal(none.score, 0);
  assert.equal(none.classification, 'nurture');
  const r = scoreProperty(
    { taxDelinquent: true, isAbsenteeOwner: true, estimatedValue: 400000, estimatedEquity: 300000, mortgageBalance: 100000, lastSaleDate: '2005-01-01', state: 'TX' },
    { mailingState: 'FL', propertiesOwnedCount: 4 },
    new Date('2026-01-01'),
  );
  assert.deepEqual(r.factors.map((f) => f.key).sort(), ['absentee_owner', 'high_equity', 'long_tenure', 'out_of_state_owner', 'portfolio_owner', 'tax_delinquent']);
  assert.equal(r.score, 30 + 15 + 20 + 10 + 10 + 5);
  assert.equal(r.classification, 'hot');
  assert.equal(classify(40), 'warm');
  assert.equal(classify(39), 'nurture');
  assert.ok(scoreProperty({ taxDelinquent: true, isAbsenteeOwner: true, estimatedValue: 1, estimatedEquity: 1, lastSaleDate: '1990-01-01', state: 'TX' }, { mailingState: 'FL', propertiesOwnedCount: 9 }).score <= 100);
});

test('workflow conditions', () => {
  const p = { lead: { leadScore: 80, stage: 'qualified', tags: ['a'] }, call: { outcome: 'callback' } };
  assert.ok(evaluateCondition({ field: 'lead.leadScore', op: 'gte', value: 80 }, p));
  assert.ok(!evaluateCondition({ field: 'lead.leadScore', op: 'gt', value: 80 }, p));
  assert.ok(evaluateCondition({ field: 'lead.stage', op: 'eq', value: 'qualified' }, p));
  assert.ok(evaluateCondition({ field: 'lead.stage', op: 'neq', value: 'won' }, p));
  assert.ok(evaluateCondition({ field: 'call.outcome', op: 'in', value: ['callback', 'voicemail'] }, p));
  assert.ok(evaluateCondition({ field: 'lead.tags', op: 'contains', value: 'a' }, p));
  assert.ok(evaluateCondition({ field: 'lead.stage', op: 'contains', value: 'QUAL' }, p));
  assert.ok(!evaluateCondition({ field: 'property.state', op: 'exists' }, p));
  assert.ok(evaluateConditions([], p));
  assert.ok(!evaluateConditions([{ field: 'lead.leadScore', op: 'lt', value: 10 }, { field: 'lead.stage', op: 'eq', value: 'qualified' }], p));
});

test('workflow templates and schema validation', () => {
  assert.equal(interpolate('Call {{lead.title}} ({{lead.leadScore}}) {{nope.x}}!', { lead: { title: 'Acme', leadScore: 5 } }), 'Call Acme (5) !');
  assert.ok(actionSchema.safeParse({ type: 'create_task', params: { title: 'x' } }).success);
  assert.ok(!actionSchema.safeParse({ type: 'create_task', params: {} }).success);
  assert.ok(!actionSchema.safeParse({ type: 'send_email', params: {} }).success, 'no email action exists');
  assert.ok(!actionSchema.safeParse({ type: 'update_lead', params: {} }).success);
  assert.ok(!conditionSchema.safeParse({ field: 'a; drop table', op: 'eq' }).success);
});

test('call state machine', () => {
  assert.ok(canTransition('dialing', 'ringing'));
  assert.ok(canTransition('ringing', 'connected'));
  assert.ok(canTransition('connected', 'completed'));
  assert.ok(!canTransition('dialing', 'connected'));
  assert.ok(!canTransition('completed', 'ringing'));
  assert.ok(!canTransition('connected', 'canceled'));
  assert.ok(isTerminal('no_answer') && isTerminal('failed') && !isTerminal('connected'));
});

test('simulated plan is deterministic and no real provider exists', () => {
  assert.equal(simulatedPlan('(512) 555-0142'), 'connected');
  assert.equal(simulatedPlan('(512) 555-0146'), 'no_answer');
  assert.equal(simulatedPlan('(512) 555-0148'), 'busy');
  assert.equal(simulatedPlan('(512) 555-0149'), 'failed');
  assert.equal(simulatedProvider.simulated, true);
  process.env.TELEPHONY_PROVIDER = 'twilio';
  const t = getTelephony({ isDemo: false });
  assert.equal(t.provider.simulated, true, 'unimplemented providers must fall back to simulation');
  assert.equal(t.mode, 'simulated');
  delete process.env.TELEPHONY_PROVIDER;
});

test('campaign transitions', () => {
  assert.deepEqual(CAMPAIGN_TRANSITIONS.activate.from, ['draft']);
  assert.ok(!CAMPAIGN_TRANSITIONS.resume.from.includes('active'));
  assert.ok(CAMPAIGN_TRANSITIONS.pause.from.includes('active'));
});

test('rbac matrix', () => {
  assert.ok(can('admin', 'workflows:manage'));
  assert.ok(can('sales', 'dialer:use') && !can('sales', 'workflows:manage') && !can('sales', 'members:manage'));
  assert.ok(can('landlord', 'crm:read') && !can('landlord', 'crm:write'));
  assert.deepEqual(permissionsFor('tenant'), []);
  assert.deepEqual(permissionsFor('unknown-role'), []);
});

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Client, signup, startApi, TEST_DATABASE_URL, type Api } from './helpers.ts';

const skip = !TEST_DATABASE_URL && 'TEST_DATABASE_URL is not set (needs PostgreSQL with supabase/migrations applied)';

let api: Api;
before(async () => { if (!skip) api = await startApi(); });
after(async () => { if (api) await api.close(); setTimeout(() => process.exit(0), 50).unref(); });

const prop = (apn: string, extra: object = {}) => ({
  address: `${apn} Test St`, city: 'Austin', state: 'tx', zip: '78701', county: 'Travis', apn, propertyType: 'Single Family',
  estimatedValue: 400000, estimatedEquity: 300000, mortgageBalance: 100000, taxDelinquent: true, isAbsenteeOwner: true, ...extra,
});

describe('authentication', { skip }, () => {
  test('signup, session, logout, login, bad password, unauthenticated access', async () => {
    const { client, email, user } = await signup(api, 'property_manager', 'auth');
    assert.equal(user.role, 'property_manager');
    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, email);
    assert.ok(me.body.user.permissions.includes('crm:write'));
    assert.equal(me.body.user.isDemo, false);
    assert.equal(me.body.user.passwordHash, undefined);

    assert.equal((await client.post('/api/auth/logout')).status, 204);
    assert.equal((await client.get('/api/auth/me')).status, 401);

    assert.equal((await client.post('/api/auth/login', { email, password: 'wrong-password-1' })).status, 401);
    assert.equal((await client.post('/api/auth/login', { email, password: 'correct-horse-9' })).status, 200);
    assert.equal((await client.get('/api/contacts')).status, 200);

    const anon = new Client(api.base);
    for (const p of ['/api/contacts', '/api/leads', '/api/properties', '/api/dashboard', '/api/workflows', '/api/calls']) {
      assert.equal((await anon.get(p)).status, 401, p);
    }
    assert.equal((await anon.post('/api/demo/reset')).status, 401);
  });

  test('duplicate email, weak password and unknown role handling', async () => {
    const { email } = await signup(api, 'landlord', 'dup');
    const c = new Client(api.base);
    assert.equal((await c.post('/api/auth/signup', { email, password: 'correct-horse-9', name: 'X' })).status, 409);
    assert.equal((await c.post('/api/auth/signup', { email: 'a@example.com', password: 'short', name: 'X' })).status, 400);
    const adminAttempt = await c.post('/api/auth/signup', { email: `adm-${Date.now()}@example.com`, password: 'correct-horse-9', name: 'X', role: 'admin' });
    assert.equal(adminAttempt.status, 201);
    assert.notEqual(adminAttempt.body.user.role, 'admin', 'self-service signup can never mint an admin');
  });

  test('profile update validates input', async () => {
    const { client } = await signup(api, 'property_manager', 'profile');
    assert.equal((await client.patch('/api/auth/me', { phone: '555-0100', occupantsCount: 'abc' })).status, 400);
    assert.equal((await client.patch('/api/auth/me', { role: 'admin' })).status, 400, 'unknown fields rejected');
    const ok = await client.patch('/api/auth/me', { phone: '555-0100', companyName: 'Acme' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.companyName, 'Acme');
  });
});

describe('authorization (RBAC) and tenant isolation', { skip }, () => {
  test('tenants and technicians have no CRM access; landlords are read-only', async () => {
    const tenant = (await signup(api, 'tenant', 'tenant')).client;
    const tech = (await signup(api, 'technician', 'tech')).client;
    const landlord = (await signup(api, 'landlord', 'll')).client;
    for (const c of [tenant, tech]) {
      assert.equal((await c.get('/api/contacts')).status, 403);
      assert.equal((await c.post('/api/contacts', { firstName: 'A' })).status, 403);
      assert.equal((await c.get('/api/dashboard')).status, 403);
    }
    assert.equal((await landlord.get('/api/contacts')).status, 200);
    assert.equal((await landlord.post('/api/contacts', { firstName: 'A' })).status, 403);
    assert.equal((await landlord.post('/api/workflows', {})).status, 403);
    assert.equal((await landlord.post('/api/campaigns', { name: 'x' })).status, 403);
    assert.equal((await landlord.post('/api/calls', { contactId: 'x' })).status, 403);
    assert.equal((await landlord.post('/api/agents/lead_qualification/run', { input: {} })).status, 403);
  });

  test('organizations cannot read or reference each other’s records (IDOR)', async () => {
    const a = (await signup(api, 'property_manager', 'orgA')).client;
    const b = (await signup(api, 'property_manager', 'orgB')).client;
    const contact = (await a.post('/api/contacts', { firstName: 'Alice', phone: '(512) 555-0101' })).body.contact;
    const property = (await a.post('/api/properties', prop('IDOR-1'))).body.property;
    const lead = (await a.post('/api/leads', { propertyId: property.id, contactId: contact.id })).body.lead;

    for (const [path, id] of [['contacts', contact.id], ['properties', property.id], ['leads', lead.id]]) {
      assert.equal((await b.get(`/api/${path}/${id}`)).status, 404, `read ${path}`);
      assert.equal((await b.patch(`/api/${path}/${id}`, { notes: 'x', title: 'x', firstName: 'x' })).status, 404, `patch ${path}`);
    }
    assert.equal((await b.post(`/api/contacts/${contact.id}/archive`)).status, 404);
    // Cross-tenant references in bodies are rejected, not silently linked.
    assert.equal((await b.post('/api/leads', { contactId: contact.id })).status, 400);
    assert.equal((await b.post('/api/leads', { propertyId: property.id })).status, 400);
    assert.equal((await b.post('/api/tasks', { title: 't', leadId: lead.id })).status, 400);
    assert.equal((await b.post('/api/notes', { body: 'n', contactId: contact.id })).status, 400);
    assert.equal((await b.post('/api/calls', { contactId: contact.id })).status, 400);
    assert.equal((await b.get('/api/contacts')).body.total, 0);
    assert.equal((await b.get('/api/search?q=Alice')).body.results.length, 0);
    assert.equal((await b.get('/api/activity')).body.items.length, 0);
  });

  test('members: only managers add users; sales cannot manage workflows', async () => {
    const owner = (await signup(api, 'property_manager', 'mgr')).client;
    const email = `sales-${Date.now()}@example.com`;
    const created = await owner.post('/api/org/members', { name: 'Sam Sales', email, role: 'sales', password: 'long-enough-pw-1' });
    assert.equal(created.status, 201);
    assert.equal((await owner.post('/api/org/members', { name: 'X', email, role: 'sales', password: 'long-enough-pw-1' })).status, 409);
    assert.equal((await owner.post('/api/org/members', { name: 'X', email: 'weak@example.com', role: 'sales', password: 'short' })).status, 400);
    assert.equal((await owner.post('/api/org/members', { name: 'X', email: 'tenant@example.com', role: 'tenant', password: 'long-enough-pw-1' })).status, 400);

    const sales = new Client(api.base);
    assert.equal((await sales.post('/api/auth/login', { email, password: 'long-enough-pw-1' })).status, 200);
    assert.equal((await sales.post('/api/contacts', { firstName: 'Sold' })).status, 201);
    assert.equal((await sales.post('/api/workflows', { name: 'x', triggerType: 'manual', actions: [{ type: 'create_activity', params: { summary: 'x' } }] })).status, 403);
    assert.equal((await sales.get('/api/org/members')).status, 200);
    assert.equal((await sales.post('/api/org/members', { name: 'X', email: 'z@example.com', role: 'sales', password: 'long-enough-pw-1' })).status, 403);
    assert.equal((await sales.post('/api/demo/reset')).status, 403);

    // Disabling a member ends their sessions.
    assert.equal((await owner.patch(`/api/org/members/${created.body.member.id}`, { disabled: true })).status, 200);
    assert.equal((await sales.get('/api/contacts')).status, 401);
  });

  test('assignment targets must belong to the same organization', async () => {
    const a = await signup(api, 'property_manager', 'asgA');
    const b = await signup(api, 'property_manager', 'asgB');
    const r = await a.client.post('/api/contacts', { firstName: 'X', assignedUserId: b.user.id });
    assert.equal(r.status, 400);
    assert.equal((await a.client.post('/api/contacts', { firstName: 'X', assignedUserId: a.user.id })).status, 201);
  });
});

describe('CRM, properties, owners', { skip }, () => {
  test('validation errors are 400 with details', async () => {
    const { client } = await signup(api, 'property_manager', 'val');
    const bad = await client.post('/api/contacts', { firstName: '', phone: 'abc', email: 'nope' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.issues.length >= 2);
    assert.equal((await client.post('/api/properties', { address: 'x' })).status, 400);
    assert.equal((await client.get('/api/contacts/not-a-real-id')).status, 404);
  });

  test('property → owner → contact → lead relationships stay consistent', async () => {
    const { client, user } = await signup(api, 'property_manager', 'crm');
    const owner = (await client.post('/api/owners', { name: 'Olive Owner LLC', entityType: 'llc', mailingState: 'fl', phoneNumbers: ['(305) 555-0172'], emailAddresses: ['o@example.com'] })).body.owner;
    const p1 = (await client.post('/api/properties', prop('CRM-1', { ownerId: owner.id }))).body.property;
    const p2 = (await client.post('/api/properties', prop('CRM-2', { ownerId: owner.id, taxDelinquent: false }))).body.property;
    assert.equal((await client.post('/api/properties', prop('CRM-1'))).status, 409, 'APN is unique per org');

    const contact = (await client.post('/api/contacts', { firstName: 'Olive', lastName: 'Owner', phone: '(305) 555-0172', contactType: 'owner', propertyOwnerId: owner.id, tags: ['vip'] })).body.contact;
    const first = await client.post(`/api/properties/${p1.id}/lead`);
    assert.equal(first.status, 201);
    assert.ok(first.body.lead.leadScore >= 60, `scored from record fields, got ${first.body.lead.leadScore}`);
    assert.equal(first.body.lead.propertyOwnerId, owner.id, 'lead inherits the property owner');
    assert.equal((await client.post(`/api/properties/${p1.id}/lead`)).status, 200, 'second request returns the existing lead');

    const lead = (await client.post('/api/leads', { propertyId: p2.id, contactId: contact.id, assignedUserId: user.id, value: 12000, title: 'Olive — second property' })).body.lead;

    const ownerDetail = (await client.get(`/api/owners/${owner.id}`)).body;
    assert.equal(ownerDetail.owner.propertiesCount, 2);
    assert.equal(ownerDetail.owner.portfolioValue, 800000);
    assert.equal(ownerDetail.properties.length, 2);
    assert.equal(ownerDetail.contacts.length, 1);
    assert.equal(ownerDetail.leads.length, 2);

    const propDetail = (await client.get(`/api/properties/${p2.id}`)).body;
    assert.equal(propDetail.owner.id, owner.id);
    assert.equal(propDetail.leads[0].id, lead.id);
    assert.equal(propDetail.contacts[0].id, contact.id);
    const contactDetail = (await client.get(`/api/contacts/${contact.id}`)).body;
    assert.equal(contactDetail.leads[0].id, lead.id);
    assert.equal(contactDetail.properties.length, 2);
    const leadDetail = (await client.get(`/api/leads/${lead.id}`)).body;
    assert.equal(leadDetail.property.id, p2.id);
    assert.equal(leadDetail.owner.id, owner.id);
    assert.equal(leadDetail.contact.id, contact.id);

    // The same lead appears in the list, the pipeline, the dashboard and the property’s activity.
    assert.ok((await client.get('/api/leads?q=second')).body.items.some((l: any) => l.id === lead.id));
    assert.equal((await client.get('/api/leads/pipeline')).body.stages.find((s: any) => s.stage === 'identified').count, 2);
    const dash = (await client.get('/api/dashboard')).body;
    assert.equal(dash.counts.openLeads, 2);
    assert.equal(dash.counts.properties, 2);
    assert.equal(dash.counts.owners, 1);
    assert.ok(propDetail.activity.some((a: any) => a.type === 'lead.created' || a.type === 'property.created'));
  });

  test('edit, tag, assign, search, filter, sort, archive and restore', async () => {
    const { client, user } = await signup(api, 'property_manager', 'edit');
    const c1 = (await client.post('/api/contacts', { firstName: 'Zed', lastName: 'Zimmer', phone: '(512) 555-0111', tags: ['hot'], contactType: 'owner' })).body.contact;
    await client.post('/api/contacts', { firstName: 'Amy', lastName: 'Adams', email: 'amy@example.com', contactType: 'prospect' });

    const edited = await client.patch(`/api/contacts/${c1.id}`, { company: 'Zimmer Co', tags: ['hot', 'follow-up'], assignedUserId: user.id });
    assert.equal(edited.body.contact.company, 'Zimmer Co');
    assert.deepEqual(edited.body.contact.tags, ['hot', 'follow-up']);

    assert.equal((await client.get('/api/contacts?q=zimmer')).body.total, 1);
    assert.equal((await client.get('/api/contacts?q=amy@example')).body.total, 1);
    assert.equal((await client.get('/api/contacts?tag=follow-up')).body.items[0].id, c1.id);
    assert.equal((await client.get('/api/contacts?type=prospect')).body.total, 1);
    assert.equal((await client.get('/api/contacts?q=%25')).body.total, 0, 'LIKE wildcards are escaped');
    const sorted = (await client.get('/api/contacts?sort=name&dir=asc')).body.items.map((c: any) => c.firstName);
    assert.deepEqual(sorted, ['Amy', 'Zed']);
    assert.equal((await client.get('/api/search?q=zimmer')).body.results[0].type, 'contact');

    assert.equal((await client.post(`/api/contacts/${c1.id}/archive`)).status, 200);
    assert.equal((await client.get('/api/contacts')).body.total, 1);
    assert.equal((await client.get('/api/contacts?archived=true')).body.total, 1);
    assert.equal((await client.post(`/api/contacts/${c1.id}/archive`, { restore: true })).status, 200);
    assert.equal((await client.get('/api/contacts')).body.total, 2);

    const note = await client.post('/api/notes', { body: 'Called twice, prefers texts', contactId: c1.id });
    assert.equal(note.status, 201);
    assert.equal((await client.post('/api/notes', { body: 'orphan' })).status, 400, 'notes must attach to a record');
    const detail = (await client.get(`/api/contacts/${c1.id}`)).body;
    assert.equal(detail.notes.length, 1);
    assert.ok(detail.activity.some((a: any) => a.type === 'note.added'));
  });

  test('partial updates never reset fields that were not sent (schema defaults)', async () => {
    const { client } = await signup(api, 'property_manager', 'patch');
    const c = (await client.post('/api/contacts', { firstName: 'Pat', lastName: 'Chen', contactType: 'owner', doNotCall: true, tags: ['keep'] })).body.contact;
    const c2 = (await client.patch(`/api/contacts/${c.id}`, { company: 'Chen LLC' })).body.contact;
    assert.deepEqual([c2.doNotCall, c2.contactType, c2.lastName, c2.tags], [true, 'owner', 'Chen', ['keep']]);

    const p = (await client.post('/api/properties', prop('PATCH-1', { unitsCount: 4, squareFeet: 3000 }))).body.property;
    const p2 = (await client.patch(`/api/properties/${p.id}`, { notes: 'x' })).body.property;
    assert.deepEqual([p2.taxDelinquent, p2.isAbsenteeOwner, p2.unitsCount, p2.squareFeet, p2.estimatedValue], [true, true, 4, 3000, 400000]);

    const o = (await client.post('/api/owners', { name: 'Keep Trust', entityType: 'trust', tags: ['t'] })).body.owner;
    const o2 = (await client.patch(`/api/owners/${o.id}`, { notes: 'n' })).body.owner;
    assert.deepEqual([o2.entityType, o2.tags], ['trust', ['t']]);

    const l = (await client.post('/api/leads', { propertyId: p.id, stage: 'negotiating', value: 5000, tags: ['x'] })).body.lead;
    const l2 = (await client.patch(`/api/leads/${l.id}`, { title: 'Renamed' })).body.lead;
    assert.deepEqual([l2.stage, l2.value, l2.tags], ['negotiating', 5000, ['x']]);

    const t = (await client.post('/api/tasks', { title: 'T', priority: 'urgent' })).body.task;
    assert.equal((await client.patch(`/api/tasks/${t.id}`, { title: 'T2' })).body.task.priority, 'urgent');

    const w = (await client.post('/api/workflows', { name: 'W', triggerType: 'manual', conditions: [{ field: 'lead.stage', op: 'eq', value: 'won' }], actions: [{ type: 'create_activity', params: { summary: 's' } }] })).body.workflow;
    const w2 = (await client.patch(`/api/workflows/${w.id}`, { enabled: false })).body.workflow;
    assert.equal(w2.conditions.length, 1);
    assert.equal(w2.actions.length, 1);
    assert.equal((await client.patch(`/api/workflows/${w.id}`, { name: 'W2' })).body.workflow.enabled, false);
  });

  test('tasks: create, filter, complete, delete', async () => {
    const { client } = await signup(api, 'property_manager', 'tasks');
    const t = (await client.post('/api/tasks', { title: 'Call Bob', dueAt: new Date(Date.now() - 3600_000).toISOString(), priority: 'high' })).body.task;
    assert.equal((await client.get('/api/tasks?due=overdue')).body.total, 1);
    assert.equal((await client.patch(`/api/tasks/${t.id}`, { status: 'done' })).body.task.status, 'done');
    assert.equal((await client.get('/api/tasks')).body.total, 0);
    assert.equal((await client.get('/api/tasks?status=done')).body.total, 1);
    assert.equal((await client.get('/api/tasks?status=all')).body.total, 1);
    assert.equal((await client.del(`/api/tasks/${t.id}`)).status, 204);
    assert.equal((await client.post('/api/tasks', { title: 't', dueAt: 'tomorrow' })).status, 400);
  });

  test('property import upserts by APN and validates records', async () => {
    const { client } = await signup(api, 'property_manager', 'import');
    const rec = (apn: string) => ({ ...prop(apn), owner: { name: 'Import Owner', entityType: 'individual' } });
    const first = await client.post('/api/properties/import', { records: [rec('IMP-1'), rec('IMP-2')] });
    assert.deepEqual([first.body.inserted, first.body.updated], [2, 0]);
    const again = await client.post('/api/properties/import', { records: [rec('IMP-1')] });
    assert.deepEqual([again.body.inserted, again.body.updated], [0, 1]);
    assert.equal((await client.get('/api/owners')).body.total, 1, 'owner is reused by name');
    assert.equal((await client.post('/api/properties/import', { records: [{ address: 'x' }] })).status, 400);
    assert.equal((await client.post('/api/properties/import', { records: [] })).status, 400);
    assert.equal((await client.get('/api/properties?q=IMP-&taxDelinquent=true')).body.total, 2);
  });
});

describe('dialer and campaigns', { skip }, () => {
  const setup = async () => {
    const { client, user } = await signup(api, 'property_manager', 'dial');
    const contact = (await client.post('/api/contacts', { firstName: 'Dana', lastName: 'Dial', phone: '(555) 555-0101' })).body.contact; // ends in 1 → answered
    const property = (await client.post('/api/properties', prop(`DIAL-${Date.now()}`))).body.property;
    const lead = (await client.post('/api/leads', { propertyId: property.id, contactId: contact.id, assignedUserId: user.id })).body.lead;
    const campaign = (await client.post('/api/campaigns', { name: 'Test Campaign', script: 'Hello' })).body.campaign;
    return { client, user, contact, property, lead, campaign };
  };

  test('campaign lifecycle and membership rules', async () => {
    const { client, contact, lead, campaign } = await setup();
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'activate' })).status, 422, 'needs contacts');
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'pause' })).status, 409);
    const dnc = (await client.post('/api/contacts', { firstName: 'No', phone: '(555) 555-0102', doNotCall: true })).body.contact;
    const nophone = (await client.post('/api/contacts', { firstName: 'Nophone' })).body.contact;
    const added = (await client.post(`/api/campaigns/${campaign.id}/contacts`, { contactIds: [contact.id, dnc.id, nophone.id, 'bogus'], leadIds: [lead.id] })).body;
    assert.equal(added.added, 1);
    assert.equal(added.skipped.length, 3);
    assert.ok(added.skipped.some((s: any) => /Do Not Call/.test(s.reason)));
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/contacts`, { contactIds: [contact.id] })).body.added, 0, 'no duplicates');

    // Cannot dial before the campaign is active.
    assert.equal((await client.post('/api/calls', { contactId: contact.id, campaignId: campaign.id })).status, 422);
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/next`)).status, 422);

    assert.equal((await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'activate' })).body.campaign.status, 'active');
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'activate' })).status, 409);
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'pause' })).body.campaign.status, 'paused');
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'resume' })).body.campaign.status, 'active');
    assert.equal((await client.patch(`/api/campaigns/${campaign.id}`, { name: 'Renamed' })).body.campaign.name, 'Renamed');
    const detail = (await client.get(`/api/campaigns/${campaign.id}`)).body;
    assert.equal(detail.metrics.contacts.total, 1);
    assert.equal(detail.metrics.progressPercent, 0);
    assert.equal(detail.metrics.calls.total, 0);
    assert.equal((await client.del(`/api/campaigns/${campaign.id}/contacts/${contact.id}`)).status, 200);
    assert.equal((await client.get(`/api/campaigns/${campaign.id}`)).body.metrics.contacts.total, 0);
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'complete' })).body.campaign.status, 'completed');
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/contacts`, { contactIds: [contact.id] })).status, 409);
  });

  test('simulated call end to end: dial → ring → connect → outcome → follow-up → metrics', async () => {
    const { client, user, contact, lead, campaign } = await setup();
    await client.post(`/api/campaigns/${campaign.id}/contacts`, { leadIds: [lead.id] });
    await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'activate' });

    const next = (await client.post(`/api/campaigns/${campaign.id}/next`)).body.next;
    assert.equal(next.contact.id, contact.id);
    assert.equal(next.script, 'Hello');

    const started = await client.post('/api/calls', { contactId: contact.id, campaignId: campaign.id });
    assert.equal(started.status, 201);
    assert.equal(started.body.call.status, 'dialing');
    assert.equal(started.body.call.isSimulated, true);
    assert.equal(started.body.call.provider, 'simulated');
    assert.equal(started.body.call.leadId, lead.id, 'call is linked to the contact’s open lead');
    const callId = started.body.call.id;

    assert.equal((await client.post('/api/calls', { contactId: contact.id, campaignId: campaign.id })).status, 409, 'no double dialing');
    assert.equal((await client.post(`/api/campaigns/${campaign.id}/next`)).body.next, null, 'contact in a live call is not offered again');
    assert.equal((await client.post(`/api/calls/${callId}/complete`, { outcome: 'callback' })).status, 409, 'must be connected first');
    assert.equal((await client.post(`/api/calls/${callId}/advance`, { to: 'connected' })).status, 409, 'cannot skip ringing');

    assert.equal((await client.post(`/api/calls/${callId}/advance`)).body.call.status, 'ringing');
    const connected = (await client.post(`/api/calls/${callId}/advance`)).body.call;
    assert.equal(connected.status, 'connected');
    assert.ok(connected.answeredAt);

    const done = await client.post(`/api/calls/${callId}/complete`, {
      outcome: 'connected_interested', notes: 'Wants a valuation', durationSeconds: 240,
      followUp: { title: 'Send valuation', dueAt: new Date(Date.now() + 86400_000).toISOString(), priority: 'high' },
    });
    assert.equal(done.status, 200);
    assert.equal(done.body.call.status, 'completed');
    assert.equal(done.body.call.outcome, 'connected_interested');
    assert.equal(done.body.call.durationSeconds, 240);
    assert.equal(done.body.followUp.title, 'Send valuation');
    assert.equal(done.body.leadStageChanged, true);
    assert.equal((await client.post(`/api/calls/${callId}/complete`, { outcome: 'callback' })).status, 409, 'cannot complete twice');

    // Every view agrees on the result.
    const leadDetail = (await client.get(`/api/leads/${lead.id}`)).body;
    assert.equal(leadDetail.lead.stage, 'qualified');
    assert.equal(leadDetail.calls[0].id, callId);
    assert.equal(leadDetail.tasks.find((t: any) => t.title === 'Send valuation').assignedUserId, user.id);
    assert.equal(leadDetail.notes[0].body, 'Wants a valuation');
    assert.ok(leadDetail.activity.some((a: any) => a.type === 'call.completed'));
    const metrics = (await client.get(`/api/campaigns/${campaign.id}`)).body.metrics;
    assert.equal(metrics.calls.total, 1);
    assert.equal(metrics.calls.connected, 1);
    assert.equal(metrics.calls.connectRate, 100);
    assert.equal(metrics.outcomes.connected_interested, 1);
    assert.equal(metrics.contacts.completed, 1);
    assert.equal(metrics.progressPercent, 100);
    const cdetail = (await client.get(`/api/contacts/${contact.id}`)).body;
    assert.equal(cdetail.contact.lastContactedAt !== null, true);
    assert.equal(cdetail.calls.length, 1);
    const dash = (await client.get('/api/dashboard')).body;
    assert.equal(dash.calls.last30Days, 1);
    assert.equal(dash.calls.byOutcome[0].outcome, 'connected_interested');
    assert.equal((await client.get('/api/calls?campaignId=' + campaign.id)).body.total, 1);
  });

  test('unanswered, busy, failed and canceled calls are recorded without false progress', async () => {
    const { client, campaign } = await setup();
    const mk = async (phone: string) => (await client.post('/api/contacts', { firstName: 'N' + phone.slice(-1), phone })).body.contact;
    const noAns = await mk('(555) 555-0106'); const busy = await mk('(555) 555-0108'); const bad = await mk('(555) 555-0109'); const cancel = await mk('(555) 555-0103');
    await client.post(`/api/campaigns/${campaign.id}/contacts`, { contactIds: [noAns.id, busy.id, bad.id, cancel.id] });
    await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'activate' });
    const run = async (c: any, steps: number) => {
      const id = (await client.post('/api/calls', { contactId: c.id, campaignId: campaign.id })).body.call.id;
      let last: any;
      for (let i = 0; i < steps; i++) last = (await client.post(`/api/calls/${id}/advance`)).body.call;
      return { id, last };
    };
    assert.equal((await run(noAns, 2)).last.status, 'no_answer');
    assert.equal((await run(busy, 2)).last.status, 'busy');
    const failed = await run(bad, 2);
    assert.equal(failed.last.status, 'failed');
    assert.ok(failed.last.failureReason);
    assert.equal((await client.post(`/api/calls/${failed.id}/advance`)).status, 409, 'terminal calls cannot advance');

    const c = await run(cancel, 1);
    const canceled = await client.post(`/api/calls/${c.id}/cancel`);
    assert.equal(canceled.body.call.status, 'canceled');
    assert.equal((await client.post(`/api/calls/${c.id}/cancel`)).status, 409);

    const m = (await client.get(`/api/campaigns/${campaign.id}`)).body;
    assert.equal(m.metrics.calls.total, 4);
    assert.equal(m.metrics.calls.connected, 0);
    assert.equal(m.metrics.contacts.pending, 4, 'unanswered/canceled contacts stay in the queue');
    assert.equal(m.members.find((x: any) => x.contactId === cancel.id).attempts, 0, 'a canceled call is not an attempt');
    assert.equal(m.members.find((x: any) => x.contactId === noAns.id).attempts, 1);
  });

  test('do-not-call outcome blocks all further dialing and campaign work', async () => {
    const { client, contact, campaign } = await setup();
    await client.post(`/api/campaigns/${campaign.id}/contacts`, { contactIds: [contact.id] });
    await client.post(`/api/campaigns/${campaign.id}/status`, { action: 'activate' });
    const id = (await client.post('/api/calls', { contactId: contact.id, campaignId: campaign.id })).body.call.id;
    await client.post(`/api/calls/${id}/advance`); await client.post(`/api/calls/${id}/advance`);
    assert.equal((await client.post(`/api/calls/${id}/complete`, { outcome: 'do_not_call' })).status, 200);
    const again = await client.post('/api/calls', { contactId: contact.id });
    assert.equal(again.status, 422);
    assert.equal(again.body.code, 'do_not_call');
    assert.equal((await client.get(`/api/contacts/${contact.id}`)).body.contact.doNotCall, true);
    assert.equal((await client.get(`/api/campaigns/${campaign.id}`)).body.metrics.contacts.do_not_call, 1);
  });

  test('callback outcome auto-creates a follow-up task', async () => {
    const { client, contact } = await setup();
    const id = (await client.post('/api/calls', { contactId: contact.id })).body.call.id;
    await client.post(`/api/calls/${id}/advance`); await client.post(`/api/calls/${id}/advance`);
    const done = await client.post(`/api/calls/${id}/complete`, { outcome: 'callback' });
    assert.ok(done.body.followUp.title.startsWith('Call back'));
    assert.equal((await client.post('/api/calls', { contactId: contact.id })).status, 201, 'contact can be called again after completion');
  });

  test('dialer status states that calls are simulated', async () => {
    const { client } = await signup(api, 'property_manager', 'dstat');
    const s = (await client.get('/api/dialer/status')).body;
    assert.equal(s.simulated, true);
    assert.equal(s.realCallsEnabled, false);
  });
});

describe('workflows and agents', { skip }, () => {
  test('trigger → conditions → actions → run history → activity', async () => {
    const { client, user } = await signup(api, 'property_manager', 'wf');
    const wf = (await client.post('/api/workflows', {
      name: 'Hot lead handler', triggerType: 'lead.created',
      conditions: [{ field: 'lead.leadScore', op: 'gte', value: 50 }],
      actions: [
        { type: 'add_tag', params: { tag: 'hot', target: 'lead' } },
        { type: 'create_task', params: { title: 'Call {{lead.title}}', dueInDays: 1, priority: 'high', assignTo: 'actor' } },
        { type: 'update_lead', params: { addScore: 5 } },
        { type: 'send_notification', params: { message: 'New hot lead {{lead.title}}' } },
      ],
    })).body.workflow;
    assert.equal(wf.enabled, true);

    const hotProp = (await client.post('/api/properties', prop('WF-HOT'))).body.property;
    const hot = (await client.post(`/api/properties/${hotProp.id}/lead`)).body.lead;
    const coldProp = (await client.post('/api/properties', prop('WF-COLD', { taxDelinquent: false, isAbsenteeOwner: false, estimatedEquity: 1000, mortgageBalance: 399000 }))).body.property;
    const cold = (await client.post(`/api/properties/${coldProp.id}/lead`)).body.lead;

    const detail = (await client.get(`/api/workflows/${wf.id}`)).body;
    assert.equal(detail.runs.length, 2);
    const hotRun = detail.runs.find((r: any) => r.triggerPayload.lead.id === hot.id);
    const coldRun = detail.runs.find((r: any) => r.triggerPayload.lead.id === cold.id);
    assert.equal(hotRun.status, 'completed');
    assert.equal(hotRun.conditionsMet, true);
    assert.deepEqual(hotRun.steps.map((s: any) => s.status), ['completed', 'completed', 'completed', 'completed']);
    assert.equal(coldRun.status, 'completed');
    assert.equal(coldRun.conditionsMet, false);
    assert.equal(coldRun.steps.length, 0);

    const after = (await client.get(`/api/leads/${hot.id}`)).body;
    assert.ok(after.lead.tags.includes('hot'));
    assert.equal(after.lead.leadScore, hot.leadScore + 5);
    assert.equal(after.tasks[0].title, `Call ${hot.title}`);
    assert.equal(after.tasks[0].assignedUserId, user.id);
    assert.ok(after.activity.some((a: any) => a.type === 'workflow.completed' && a.actorKind === 'workflow'));
    assert.ok(after.activity.some((a: any) => a.type === 'notification'));
    assert.equal((await client.get(`/api/leads/${cold.id}`)).body.tasks.length, 0);

    // Disabled workflows do not fire; manual runs still work.
    await client.patch(`/api/workflows/${wf.id}`, { enabled: false });
    const p3 = (await client.post('/api/properties', prop('WF-OFF'))).body.property;
    await client.post(`/api/properties/${p3.id}/lead`);
    assert.equal((await client.get(`/api/workflows/${wf.id}`)).body.runs.length, 2);
    const manual = await client.post(`/api/workflows/${wf.id}/run`, { leadId: cold.id });
    assert.equal(manual.status, 200);
    assert.equal(manual.body.conditionsMet, false);
    assert.equal((await client.post(`/api/workflows/${wf.id}/run`, {})).status, 400);
    assert.equal((await client.get('/api/workflow-runs?status=completed')).body.items.length, 3);
  });

  test('failed actions mark the run failed with a clear error and stop', async () => {
    const { client } = await signup(api, 'property_manager', 'wffail');
    const wf = (await client.post('/api/workflows', {
      name: 'Broken', triggerType: 'manual', conditions: [],
      actions: [
        { type: 'create_activity', params: { summary: 'step one ran' } },
        { type: 'add_to_campaign', params: { campaignId: 'does-not-exist' } },
        { type: 'create_activity', params: { summary: 'never runs' } },
      ],
    })).body.workflow;
    const c = (await client.post('/api/contacts', { firstName: 'W', phone: '(555) 555-0101' })).body.contact;
    const run = (await client.post(`/api/workflows/${wf.id}/run`, { contactId: c.id })).body;
    assert.equal(run.status, 'failed');
    assert.match(run.error, /Step 2/);
    assert.deepEqual(run.steps.map((s: any) => s.status), ['completed', 'failed']);
    const acts = (await client.get(`/api/activity?contactId=${c.id}`)).body.items;
    assert.ok(acts.some((a: any) => a.type === 'workflow.failed'));
    assert.ok(!acts.some((a: any) => /never runs/.test(a.summary)));
  });

  test('workflow definitions are validated', async () => {
    const { client } = await signup(api, 'property_manager', 'wfval');
    const base = { name: 'x', triggerType: 'manual' };
    assert.equal((await client.post('/api/workflows', { ...base, actions: [] })).status, 400);
    assert.equal((await client.post('/api/workflows', { ...base, actions: [{ type: 'send_email', params: {} }] })).status, 400);
    assert.equal((await client.post('/api/workflows', { ...base, triggerType: 'nope', actions: [{ type: 'create_activity', params: { summary: 'x' } }] })).status, 400);
    assert.equal((await client.get('/api/workflows/meta')).body.actions.some((a: any) => /email|sms/i.test(a.type)), false);
  });

  test('property identified → owner → contact → lead → task', async () => {
    const { client } = await signup(api, 'property_manager', 'wfprop');
    await client.post('/api/workflows', {
      name: 'Property intake', triggerType: 'property.identified', conditions: [{ field: 'property.ownerId', op: 'exists' }],
      actions: [{ type: 'create_lead', params: {} }, { type: 'create_task', params: { title: 'Research {{property.address}}', assignTo: 'actor' } }],
    });
    const owner = (await client.post('/api/owners', { name: 'Pat Q Owner', phoneNumbers: ['(555) 555-0123'] })).body.owner;
    const p = (await client.post('/api/properties', prop('INTAKE-1', { ownerId: owner.id }))).body.property;
    const detail = (await client.get(`/api/properties/${p.id}`)).body;
    assert.equal(detail.leads.length, 1);
    assert.equal(detail.contacts.length, 1, 'owner contact created from owner phone');
    assert.equal(detail.contacts[0].lastName, 'Owner');
    assert.equal(detail.tasks[0].title, `Research ${p.address}`);
    const noOwner = (await client.post('/api/properties', prop('INTAKE-2'))).body.property;
    assert.equal((await client.get(`/api/properties/${noOwner.id}`)).body.leads.length, 0, 'condition not met → no lead');
  });

  test('automation cannot exceed the triggering user’s permissions or loop', async () => {
    const mgr = (await signup(api, 'property_manager', 'wfperm')).client;
    await mgr.post('/api/workflows', { name: 'Loop?', triggerType: 'lead.created', actions: [{ type: 'create_lead', params: {} }] });
    await mgr.post('/api/workflows', { name: 'Stage hook', triggerType: 'lead.stage_changed', actions: [{ type: 'update_lead', params: { stage: 'contacted' } }] });
    const p = (await mgr.post('/api/properties', prop('LOOP-1'))).body.property;
    const lead = (await mgr.post(`/api/properties/${p.id}/lead`)).body.lead;
    await mgr.patch(`/api/leads/${lead.id}`, { stage: 'qualified' });
    const runs = (await mgr.get('/api/workflow-runs?limit=100')).body.items;
    assert.ok(runs.length <= 3, `bounded runs, got ${runs.length}`);
    assert.equal((await mgr.get('/api/leads')).body.total, 1, 'create_lead inside lead.created is deduplicated and cannot recurse');
  });

  test('agents: permissions, runs, history', async () => {
    const { client } = await signup(api, 'property_manager', 'agent');
    const owner = (await client.post('/api/owners', { name: 'Agent Owner', mailingState: 'FL' })).body.owner;
    const p = (await client.post('/api/properties', prop('AG-1', { ownerId: owner.id }))).body.property;
    const lead = (await client.post('/api/leads', { propertyId: p.id, score: 5 })).body.lead;
    assert.equal(lead.leadScore, 5);

    const list = (await client.get('/api/agents')).body.agents;
    assert.ok(list.length >= 4 && list.every((a: any) => a.externalModel === false));
    const q = (await client.post('/api/agents/lead_qualification/run', { input: { leadId: lead.id } })).body;
    assert.equal(q.status, 'completed');
    assert.ok(q.output.score > 5);
    assert.equal((await client.get(`/api/leads/${lead.id}`)).body.lead.leadScore, q.output.score);
    const dry = (await client.post('/api/agents/lead_qualification/run', { input: { leadId: lead.id, apply: false } })).body;
    assert.equal(dry.output.applied, false);

    const intel = (await client.post('/api/agents/property_intelligence/run', { input: { propertyId: p.id } })).body;
    assert.match(intel.output.summary, /AG-1 Test St/);
    assert.ok(Array.isArray(intel.output.dataGaps));
    const brief = (await client.post('/api/agents/call_assistant/run', { input: { leadId: lead.id } })).body;
    assert.equal(brief.status, 'completed');
    assert.equal(brief.output.ready, false, 'lead has no contact');

    const missing = (await client.post('/api/agents/lead_qualification/run', { input: { leadId: 'nope' } })).body;
    assert.equal(missing.status, 'failed');
    assert.equal((await client.post('/api/agents/not_an_agent/run', { input: {} })).status, 404);
    assert.equal((await client.post('/api/agents/lead_qualification/run', { input: {} })).status, 400, 'input validated');
    const runs = (await client.get('/api/agent-runs')).body.items;
    assert.ok(runs.length >= 5 && runs.some((r: any) => r.status === 'failed'));
    assert.equal((await client.get(`/api/leads/${lead.id}`)).body.activity.some((a: any) => a.type === 'agent.run'), true);
  });

  test('a read-only role cannot run write agents; foreign records are not visible to agents', async () => {
    const a = (await signup(api, 'property_manager', 'agA')).client;
    const b = (await signup(api, 'property_manager', 'agB')).client;
    const p = (await a.post('/api/properties', prop('AG-X'))).body.property;
    const lead = (await a.post('/api/leads', { propertyId: p.id })).body.lead;
    const r = (await b.post('/api/agents/lead_qualification/run', { input: { leadId: lead.id } })).body;
    assert.equal(r.status, 'failed');
    assert.match(r.error, /not found/i);
  });
});

describe('demo mode', { skip }, () => {
  test('demo session is isolated, seeded, interactive, simulated and resettable', async () => {
    const demo = new Client(api.base);
    assert.equal((await demo.get('/api/demo/status')).status, 401, 'status route is behind auth');
    const started = await demo.post('/api/demo/session');
    assert.equal(started.status, 201);
    const me = (await demo.get('/api/auth/me')).body.user;
    assert.equal(me.isDemo, true);
    assert.equal(me.role, 'admin');

    const dash = (await demo.get('/api/dashboard')).body;
    assert.ok(dash.counts.contacts >= 10 && dash.counts.properties >= 10 && dash.counts.owners >= 5);
    assert.ok(dash.counts.openLeads >= 5 && dash.counts.activeCampaigns >= 1 && dash.counts.openTasks >= 5);
    assert.ok(dash.calls.last30Days >= 8, 'demo call history exists');
    assert.ok(dash.workflows.runs30Days >= 1, 'demo workflow runs exist');
    assert.ok(dash.recentActivity.length === 10);
    assert.equal((await demo.get('/api/workflows')).body.items.length, 4);
    assert.equal((await demo.get('/api/org/members')).body.items.length, 3);

    // Seeded data is clearly fictional and every historical call is simulated.
    const calls = (await demo.get('/api/calls?limit=200')).body.items;
    assert.ok(calls.length >= 8 && calls.every((c: any) => c.isSimulated && c.provider === 'simulated'));
    const props = (await demo.get('/api/properties?limit=50')).body.items;
    assert.ok(props.every((p: any) => p.provenance.source === 'demo_seed'));

    // Interactive: run a simulated call on a seeded contact.
    const campaigns = (await demo.get('/api/campaigns')).body.items;
    const active = campaigns.find((c: any) => c.status === 'active');
    const next = (await demo.post(`/api/campaigns/${active.id}/next`)).body.next;
    const call = (await demo.post('/api/calls', { contactId: next.contact.id, campaignId: active.id })).body.call;
    assert.equal(call.isSimulated, true);

    // Another demo visitor sees none of this.
    const other = new Client(api.base);
    await other.post('/api/demo/session');
    assert.equal((await other.get(`/api/calls/${call.id}`)).status, 404);
    assert.equal((await other.get('/api/calls?limit=200')).body.items.some((c: any) => c.id === call.id), false);

    // External/paid and account-creating actions are blocked in demo.
    assert.equal((await demo.post('/api/gemini/chat', { message: 'hi' })).status, 403);
    assert.equal((await demo.post('/api/integrations/gis-cloud/properties/x/sync')).status, 403);
    assert.equal((await demo.post('/api/org/members', { name: 'X', email: 'x@example.com', role: 'sales', password: 'long-enough-pw-1' })).status, 403);

    // Reset restores the seeded state and removes our changes.
    await demo.post('/api/contacts', { firstName: 'Temp', phone: '(555) 555-0100' });
    const before = (await demo.get('/api/dashboard')).body.counts.contacts;
    const reset = await demo.post('/api/demo/reset');
    assert.equal(reset.status, 200);
    const afterDash = (await demo.get('/api/dashboard')).body;
    assert.equal(afterDash.counts.contacts, before - 1);
    assert.equal((await demo.get(`/api/calls/${call.id}`)).status, 404);
    assert.equal((await demo.get('/api/auth/me')).status, 200, 'session survives reset');
    assert.equal((await other.get('/api/dashboard')).body.counts.contacts, before - 1, 'other demo org unaffected by reset');
  });

  test('reset is refused for real organizations', async () => {
    const { client } = await signup(api, 'property_manager', 'noreset');
    await client.post('/api/contacts', { firstName: 'Keep' });
    assert.equal((await client.post('/api/demo/reset')).status, 403);
    assert.equal((await client.get('/api/contacts')).body.total, 1);
  });
});

test('API hygiene: JSON 404, security headers, no stack traces', { skip }, async () => {
  const { client } = await signup(api, 'property_manager', 'hyg');
  const nf = await client.get('/api/does-not-exist');
  assert.equal(nf.status, 404);
  assert.equal(typeof nf.body, 'object');
  const res = await fetch(api.base + '/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  const bad = await fetch(api.base + '/api/contacts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
  assert.ok([400, 401].includes(bad.status));
  assert.doesNotMatch(await bad.text(), /at .*\.ts/);
});

/**
 * Demo / sandbox mode.
 *
 * A demo session gets its OWN throw-away organization (flagged is_demo) seeded with obviously
 * fictional data, so visitors can neither see each other's changes nor touch real tenants.
 * Demo data uses reserved fictional values (555-01xx phone numbers, example.com emails) and every
 * property carries provenance { source: "demo_seed" }; nothing here is real public-record data.
 *
 * Demo mode cannot cause external effects: the only telephony provider is the simulator, the app
 * has no email/SMS sender, and routes that call paid or external services (Gemini, GIS Cloud sync,
 * 3Min test) refuse demo organizations (see `blockInDemo`).
 */
import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { createSession, setSessionCookie } from '../middleware/auth.js';
import { ensureDatabaseReady, withTransaction } from '../db/index.js';
import { HttpError, forbidden, getDb, newId, route, withTx, type Ctx, type Db } from './core.js';
import { createContact } from './contacts.js';
import { createLead, updateLead } from './leads.js';
import { createOwner, createProperty } from './properties.js';
import { createNote, createTask } from './tasks.js';
import { executeWorkflow, type WorkflowRow } from './workflows.js';

export const DEMO_TTL_HOURS = 24;
const MAX_DEMO_ORGS = 500;

export const demoEnabled = () => String(process.env.DEMO_MODE_ENABLED ?? 'true').toLowerCase() !== 'false';

/** Express middleware: refuse requests from demo organizations (external/paid effects). */
export const blockInDemo = (req: Request, res: Response, next: NextFunction) => {
  if ((req as AuthRequest).user && (req as any).user.isDemo) {
    return res.status(403).json({ error: 'This action is disabled in demo mode.', code: 'demo_blocked' });
  }
  return next();
};

// ------------------------------------------------------------------ sample data
const day = 24 * 3600 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * day).toISOString();

const OWNERS = [
  { key: 'harlan', name: 'Harlan & Dee Whitfield', entityType: 'individual', mail: ['4410 Willow Bend Dr', 'Plano', 'TX', '75093'], phones: ['(972) 555-0141'], emails: ['harlan.whitfield@example.com'] },
  { key: 'cedar', name: 'Cedar Ridge Holdings LLC', entityType: 'llc', mail: ['900 Brickell Ave Ste 210', 'Miami', 'FL', '33131'], phones: ['(305) 555-0172'], emails: ['ops@cedarridge.example.com'] },
  { key: 'maria', name: 'Maria L. Ortega', entityType: 'individual', mail: ['2218 E Camelback Rd', 'Phoenix', 'AZ', '85016'], phones: ['(602) 555-0123'], emails: ['maria.ortega@example.com'] },
  { key: 'greer', name: 'Greer Family Trust', entityType: 'trust', mail: ['77 Peachtree Pl NE', 'Atlanta', 'GA', '30309'], phones: ['(404) 555-0168'], emails: [] },
  { key: 'tomas', name: 'Tomas Alvarez', entityType: 'individual', mail: ['1502 S Congress Ave', 'Austin', 'TX', '78704'], phones: ['(512) 555-0136'], emails: ['tomas.alvarez@example.com'] },
  { key: 'northgate', name: 'Northgate Rentals Inc', entityType: 'corporation', mail: ['3300 N Tryon St', 'Charlotte', 'NC', '28206'], phones: ['(704) 555-0189'], emails: ['info@northgate.example.com'] },
  { key: 'priya', name: 'Priya Raman', entityType: 'individual', mail: ['815 Lakeshore Blvd', 'Tampa', 'FL', '33602'], phones: ['(813) 555-0147'], emails: [] },
] as const;

const PROPERTIES = [
  { owner: 'harlan', address: '812 Maple Hollow Ln', city: 'Plano', state: 'TX', zip: '75074', county: 'Collin', apn: 'DEMO-TX-0001', type: 'Single Family', sqft: 2140, year: 1998, beds: 4, baths: 2.5, value: 438000, equity: 301000, mortgage: 137000, absentee: false, delinquent: false, sale: '2009-06-12', lat: 33.0198, lng: -96.6989 },
  { owner: 'harlan', address: '2306 Ridgeview Ct', city: 'Allen', state: 'TX', zip: '75013', county: 'Collin', apn: 'DEMO-TX-0002', type: 'Single Family', sqft: 1780, year: 2004, beds: 3, baths: 2, value: 365000, equity: 365000, mortgage: 0, absentee: true, delinquent: false, sale: '2011-03-28', lat: 33.1032, lng: -96.6706 },
  { owner: 'cedar', address: '1450 NW 7th St Unit 3', city: 'Miami', state: 'FL', zip: '33125', county: 'Miami-Dade', apn: 'DEMO-FL-0003', type: 'Multi-Family', sqft: 5200, year: 1974, beds: null, baths: null, value: 920000, equity: 410000, mortgage: 510000, absentee: true, delinquent: true, sale: '2016-09-02', lat: 25.7842, lng: -80.2184 },
  { owner: 'cedar', address: '88 SW 22nd Ave', city: 'Miami', state: 'FL', zip: '33135', county: 'Miami-Dade', apn: 'DEMO-FL-0004', type: 'Multi-Family', sqft: 4100, year: 1969, beds: null, baths: null, value: 780000, equity: 220000, mortgage: 560000, absentee: true, delinquent: false, sale: '2018-02-14', lat: 25.7651, lng: -80.2323 },
  { owner: 'cedar', address: '3101 Coral Way', city: 'Miami', state: 'FL', zip: '33145', county: 'Miami-Dade', apn: 'DEMO-FL-0005', type: 'Commercial', sqft: 6400, year: 1982, beds: null, baths: null, value: 1350000, equity: 790000, mortgage: 560000, absentee: true, delinquent: false, sale: '2014-11-20', lat: 25.7502, lng: -80.2412 },
  { owner: 'maria', address: '4519 E Thomas Rd', city: 'Phoenix', state: 'AZ', zip: '85018', county: 'Maricopa', apn: 'DEMO-AZ-0006', type: 'Single Family', sqft: 1620, year: 1971, beds: 3, baths: 2, value: 412000, equity: 412000, mortgage: 0, absentee: false, delinquent: false, sale: '1999-05-17', lat: 33.4806, lng: -111.9901 },
  { owner: 'greer', address: '1180 Piedmont Ave NE', city: 'Atlanta', state: 'GA', zip: '30309', county: 'Fulton', apn: 'DEMO-GA-0007', type: 'Condo', sqft: 1240, year: 2008, beds: 2, baths: 2, value: 389000, equity: 244000, mortgage: 145000, absentee: true, delinquent: false, sale: '2013-08-09', lat: 33.7892, lng: -84.3796 },
  { owner: 'tomas', address: '1707 Barton Springs Rd', city: 'Austin', state: 'TX', zip: '78704', county: 'Travis', apn: 'DEMO-TX-0008', type: 'Single Family', sqft: 1890, year: 1955, beds: 3, baths: 2, value: 695000, equity: 480000, mortgage: 215000, absentee: false, delinquent: true, sale: '2007-01-30', lat: 30.2603, lng: -97.7667 },
  { owner: 'northgate', address: '2240 Freedom Dr', city: 'Charlotte', state: 'NC', zip: '28208', county: 'Mecklenburg', apn: 'DEMO-NC-0009', type: 'Multi-Family', sqft: 7800, year: 1988, beds: null, baths: null, value: 1480000, equity: 520000, mortgage: 960000, absentee: true, delinquent: false, sale: '2019-04-03', lat: 35.2395, lng: -80.8767 },
  { owner: 'northgate', address: '615 Beatties Ford Rd', city: 'Charlotte', state: 'NC', zip: '28216', county: 'Mecklenburg', apn: 'DEMO-NC-0010', type: 'Multi-Family', sqft: 6900, year: 1992, beds: null, baths: null, value: 1210000, equity: 380000, mortgage: 830000, absentee: true, delinquent: false, sale: '2020-10-21', lat: 35.2593, lng: -80.8523 },
  { owner: 'priya', address: '902 W Bay to Bay Blvd', city: 'Tampa', state: 'FL', zip: '33606', county: 'Hillsborough', apn: 'DEMO-FL-0011', type: 'Single Family', sqft: 2010, year: 1962, beds: 4, baths: 3, value: 575000, equity: 575000, mortgage: 0, absentee: false, delinquent: false, sale: '2003-12-05', lat: 27.9231, lng: -82.4811 },
  { owner: null, address: '37 Orchard Row', city: 'Phoenix', state: 'AZ', zip: '85008', county: 'Maricopa', apn: 'DEMO-AZ-0012', type: 'Single Family', sqft: 1340, year: 1966, beds: 3, baths: 1.5, value: 298000, equity: 0, mortgage: 0, absentee: false, delinquent: false, sale: null, lat: 33.4609, lng: -111.9702 },
] as const;

const CONTACTS = [
  { first: 'Harlan', last: 'Whitfield', phone: '(972) 555-0141', email: 'harlan.whitfield@example.com', type: 'owner', owner: 'harlan', source: 'property_intelligence' },
  { first: 'Dana', last: 'Pruitt', phone: '(305) 555-0172', email: 'dana@cedarridge.example.com', type: 'owner', owner: 'cedar', source: 'property_intelligence', company: 'Cedar Ridge Holdings LLC' },
  { first: 'Maria', last: 'Ortega', phone: '(602) 555-0123', email: 'maria.ortega@example.com', type: 'owner', owner: 'maria', source: 'referral' },
  { first: 'Gregory', last: 'Greer', phone: '(404) 555-0168', email: null, type: 'owner', owner: 'greer', source: 'property_intelligence' },
  { first: 'Tomas', last: 'Alvarez', phone: '(512) 555-0136', email: 'tomas.alvarez@example.com', type: 'owner', owner: 'tomas', source: 'property_intelligence' },
  { first: 'Lena', last: 'Whitaker', phone: '(704) 555-0189', email: 'lena@northgate.example.com', type: 'owner', owner: 'northgate', source: 'property_intelligence', company: 'Northgate Rentals Inc' },
  { first: 'Priya', last: 'Raman', phone: '(813) 555-0147', email: null, type: 'owner', owner: 'priya', source: 'direct_mail' },
  { first: 'Marcus', last: 'Bell', phone: '(214) 555-0155', email: 'marcus.bell@example.com', type: 'prospect', owner: null, source: 'website' },
  { first: 'Sofia', last: 'Nguyen', phone: '(480) 555-0102', email: 'sofia.nguyen@example.com', type: 'prospect', owner: null, source: 'referral' },
  { first: 'Elijah', last: 'Park', phone: '(786) 555-0111', email: null, type: 'prospect', owner: null, source: 'cold_list' },
  { first: 'Rosa', last: 'Delgado', phone: '(713) 555-0138', email: 'rosa.delgado@example.com', type: 'prospect', owner: null, source: 'cold_list' },
  { first: 'Brent', last: 'Okafor', phone: '(678) 555-0126', email: 'brent.okafor@example.com', type: 'prospect', owner: null, source: 'cold_list' },
  { first: 'Wanda', last: 'Reyes', phone: '(919) 555-0149', email: null, type: 'prospect', owner: null, source: 'cold_list', dnc: true },
  { first: 'Chris', last: 'Lindqvist', phone: '(602) 555-0175', email: 'chris@lindqvist-plumbing.example.com', type: 'vendor', owner: null, source: 'referral', company: 'Lindqvist Plumbing' },
] as const;

// Leads: which property/contact, stage, and extra context.
const LEADS = [
  { property: 1, contact: 0, stage: 'qualified', source: 'property_intelligence', value: 18000, tags: ['absentee'] },
  { property: 2, contact: 1, stage: 'contacted', source: 'property_intelligence', value: 45000, tags: ['tax-delinquent', 'portfolio'] },
  { property: 5, contact: 2, stage: 'identified', source: 'referral', value: 22000, tags: ['free-and-clear'] },
  { property: 6, contact: 3, stage: 'appointment', source: 'property_intelligence', value: 16000, tags: [] },
  { property: 7, contact: 4, stage: 'contacted', source: 'property_intelligence', value: 31000, tags: ['tax-delinquent'] },
  { property: 8, contact: 5, stage: 'negotiating', source: 'property_intelligence', value: 52000, tags: ['portfolio'] },
  { property: 10, contact: 6, stage: 'identified', source: 'direct_mail', value: 28000, tags: ['free-and-clear'] },
  { property: 3, contact: 1, stage: 'identified', source: 'property_intelligence', value: 30000, tags: ['portfolio'] },
  { property: 0, contact: 0, stage: 'won', source: 'property_intelligence', value: 15000, tags: [] },
  { property: null, contact: 7, stage: 'lost', source: 'website', value: 9000, tags: [], title: 'Marcus Bell — rental portfolio inquiry' },
] as const;

const DEMO_WORKFLOWS = [
  {
    name: 'New lead → qualify → follow-up', description: 'Score every new lead, tag hot ones, assign round-robin and create a call task.',
    triggerType: 'lead.created', conditions: [],
    actions: [
      { type: 'invoke_agent', params: { agentKey: 'lead_qualification', input: {} } },
      { type: 'assign_user', params: { userId: 'round_robin' } },
      { type: 'create_task', params: { title: 'Call new lead: {{lead.title}}', dueInDays: 1, priority: 'high', assignTo: 'lead_assignee' } },
    ],
  },
  {
    name: 'Property identified → owner → lead', description: 'When a property is added with an owner, create/update the owner contact and open a lead plus a research task.',
    triggerType: 'property.identified', conditions: [{ field: 'property.ownerId', op: 'exists' }],
    actions: [
      { type: 'create_lead', params: { source: 'workflow' } },
      { type: 'create_task', params: { title: 'Research owner of {{property.address}}', dueInDays: 2, priority: 'normal', assignTo: 'lead_assignee' } },
    ],
  },
  {
    name: 'Call completed → update lead & follow-up', description: 'After an interested call, tag the lead and schedule a next step.',
    triggerType: 'call.completed', conditions: [{ field: 'call.outcome', op: 'in', value: ['connected_interested', 'appointment_set'] }],
    actions: [
      { type: 'add_tag', params: { tag: 'engaged', target: 'lead' } },
      { type: 'create_task', params: { title: 'Send follow-up materials: {{lead.title}}', dueInDays: 1, priority: 'normal', assignTo: 'actor' } },
      { type: 'send_notification', params: { message: 'Hot lead engaged: {{lead.title}}' } },
    ],
  },
  {
    name: 'High-score lead → priority campaign', description: 'Manual/test workflow: tag leads scoring 70+ as priority.',
    triggerType: 'manual', conditions: [{ field: 'lead.leadScore', op: 'gte', value: 70 }],
    actions: [{ type: 'add_tag', params: { tag: 'priority', target: 'lead' } }, { type: 'create_activity', params: { summary: 'Flagged as priority (score {{lead.leadScore}})' } }],
  },
] as const;

const HIST_CALLS: Array<{ contact: number; daysAgo: number; outcome: string | null; status: string; seconds: number; notes?: string }> = [
  { contact: 0, daysAgo: 9, outcome: 'connected_interested', status: 'completed', seconds: 412, notes: 'Open to an offer on the Allen rental; wants numbers by Friday.' },
  { contact: 1, daysAgo: 8, outcome: 'callback', status: 'completed', seconds: 96, notes: 'Dana asked us to call after the quarter closes.' },
  { contact: 2, daysAgo: 7, outcome: null, status: 'no_answer', seconds: 0 },
  { contact: 3, daysAgo: 6, outcome: 'appointment_set', status: 'completed', seconds: 538, notes: 'Meeting booked at the condo.' },
  { contact: 4, daysAgo: 5, outcome: 'voicemail', status: 'completed', seconds: 41, notes: 'Left a voicemail.' },
  { contact: 5, daysAgo: 5, outcome: 'connected_interested', status: 'completed', seconds: 655, notes: 'Interested in selling one of the two Charlotte buildings.' },
  { contact: 7, daysAgo: 4, outcome: 'not_interested', status: 'completed', seconds: 58 },
  { contact: 8, daysAgo: 3, outcome: null, status: 'busy', seconds: 0 },
  { contact: 9, daysAgo: 2, outcome: 'wrong_number', status: 'completed', seconds: 22 },
  { contact: 4, daysAgo: 1, outcome: 'callback', status: 'completed', seconds: 133, notes: 'Wants a callback Monday morning.' },
];

// ------------------------------------------------------------------ seeding
const ALL_ORG_TABLES = [
  'activities', 'notes', 'tasks', 'calls', 'campaign_contacts', 'campaigns', 'workflow_runs', 'workflows', 'agent_runs',
  'contacts', 'leads', 'properties', 'property_owners', 'integration_events',
];

/** Seeds one demo organization. Idempotent only on an empty org (reset clears it first). */
export const seedDemoData = async (orgId: string, adminUserId: string) => {
  const sys = (userId: string | null): Ctx => ({ orgId, userId, role: 'admin', kind: 'system', isDemo: true, depth: 1 });
  const refs = await withTransaction(async (db) => {
    const ctx = sys(adminUserId);
    // Team: two extra demo users that cannot sign in (no password hash).
    const tag = orgId.slice(0, 8);
    const team: string[] = [adminUserId];
    for (const [name, key] of [['Jordan Reyes', 'jordan'], ['Priya Shah', 'priya']] as const) {
      const id = newId();
      await db.query(
        `INSERT INTO users (id, organization_id, uid, email, password_hash, name, role) VALUES ($1,$2,$1,$3,NULL,$4,'sales')`,
        [id, orgId, `demo-${key}-${tag}@demo.invalid`, name]);
      team.push(id);
    }

    const ownerIds: Record<string, string> = {};
    for (const o of OWNERS) {
      const owner = await createOwner(db, ctx, {
        name: o.name, entityType: o.entityType as any, mailingAddress: o.mail[0], mailingCity: o.mail[1], mailingState: o.mail[2], mailingZip: o.mail[3],
        phoneNumbers: [...o.phones], emailAddresses: [...o.emails], notes: null, tags: [],
      });
      ownerIds[o.key] = owner.id;
    }

    const propertyIds: string[] = [];
    for (const p of PROPERTIES) {
      const prop = await createProperty(db, ctx, {
        address: p.address, city: p.city, state: p.state, zip: p.zip, county: p.county, apn: p.apn, propertyType: p.type,
        unitsCount: p.type === 'Multi-Family' ? 6 : 1, squareFeet: p.sqft, yearBuilt: p.year, bedrooms: p.beds, bathrooms: p.baths,
        latitude: p.lat, longitude: p.lng, estimatedValue: p.value, assessedTaxValue: Math.round(p.value * 0.82), estimatedEquity: p.equity,
        mortgageBalance: p.mortgage, isAbsenteeOwner: p.absentee, isCorporateOwned: false, taxDelinquent: p.delinquent,
        lastSaleDate: p.sale, lastSalePrice: p.sale ? Math.round(p.value * 0.55) : null, ownerId: p.owner ? ownerIds[p.owner] : null,
        notes: null, tags: [], lotSizeSqft: null,
      } as any, { source: 'demo_seed', note: 'Fictional demonstration data; not a public record.' });
      propertyIds.push(prop.id);
    }

    const contactIds: string[] = [];
    for (const [i, c] of CONTACTS.entries()) {
      const contact = await createContact(db, ctx, {
        firstName: c.first, lastName: c.last, phone: c.phone, email: c.email, company: (c as any).company ?? null, contactType: c.type as any,
        propertyOwnerId: c.owner ? ownerIds[c.owner] : null, assignedUserId: team[i % team.length], source: c.source, tags: [], doNotCall: Boolean((c as any).dnc),
      } as any);
      contactIds.push(contact.id);
    }

    const leadIds: string[] = [];
    for (const [i, l] of LEADS.entries()) {
      const { lead } = await createLead(db, ctx, {
        propertyId: l.property === null ? null : propertyIds[l.property], contactId: contactIds[l.contact], source: l.source, stage: 'identified',
        assignedUserId: team[(i % (team.length - 1)) + 1], tags: [...l.tags], value: l.value, title: (l as any).title,
      } as any);
      if (l.stage !== 'identified') await updateLead(db, ctx, lead.id, { stage: l.stage as any });
      leadIds.push(lead.id);
    }

    // Campaigns
    const campaignId = newId(); const draftId = newId();
    await db.query(
      `INSERT INTO campaigns (id, organization_id, name, description, script, status, created_by, started_at) VALUES ($1,$2,$3,$4,$5,'active',$6, now() - interval '9 days')`,
      [campaignId, orgId, 'Owner Outreach — Absentee & Tax-Delinquent',
       'Phone outreach to owners flagged absentee or tax-delinquent by property intelligence.',
       'Hi, this is {{agent}} with Vortex Realty. I’m calling about the property at {{address}}. Do you have a minute to talk about your plans for it?', adminUserId]);
    await db.query(`INSERT INTO campaigns (id, organization_id, name, description, status, created_by) VALUES ($1,$2,$3,$4,'draft',$5)`,
      [draftId, orgId, 'Cold List — Phoenix Single Family', 'Draft campaign for the Phoenix cold list; add contacts and activate when ready.', adminUserId]);
    for (const [ci, li] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [8, null], [9, null], [10, null], [11, null]] as Array<[number, number | null]>) {
      await db.query(`INSERT INTO campaign_contacts (id, organization_id, campaign_id, contact_id, lead_id) VALUES ($1,$2,$3,$4,$5)`,
        [newId(), orgId, campaignId, contactIds[ci], li === null ? null : leadIds[li]]);
    }

    // Historical simulated calls (backdated) + matching membership accounting.
    for (const h of HIST_CALLS) {
      const lead = LEADS.findIndex((l) => l.contact === h.contact);
      const leadRow = lead >= 0 ? leadIds[lead] : null;
      const propId = lead >= 0 && LEADS[lead].property !== null ? propertyIds[LEADS[lead].property as number] : null;
      const started = ago(h.daysAgo * day + 3 * 3600 * 1000);
      const callId = newId();
      await db.query(
        `INSERT INTO calls (id, organization_id, contact_id, lead_id, property_id, campaign_id, user_id, to_number, status, outcome, provider, is_simulated,
                            provider_call_id, notes, started_at, answered_at, ended_at, duration_seconds, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'simulated',true,$11,$12,$13,$14,$15,$16,$13,$13)`,
        [callId, orgId, contactIds[h.contact], leadRow, propId, h.contact <= 6 ? campaignId : null, team[1 + (h.contact % 2)], CONTACTS[h.contact].phone, h.status,
         h.outcome ?? (h.status === 'no_answer' ? 'no_answer' : h.status === 'busy' ? 'busy' : null), `sim_${callId}`, h.notes ?? null, started,
         h.seconds ? started : null, new Date(new Date(started).getTime() + h.seconds * 1000).toISOString(), h.seconds]);
      if (h.contact <= 6) {
        const terminal = ['connected_interested', 'appointment_set', 'not_interested', 'wrong_number'].includes(h.outcome ?? '');
        await db.query(
          `UPDATE campaign_contacts SET attempts=attempts+1, last_outcome=$1, last_called_at=$2, status=$3 WHERE campaign_id=$4 AND contact_id=$5`,
          [h.outcome ?? h.status, started, terminal ? 'completed' : 'pending', campaignId, contactIds[h.contact]]);
      }
      await db.query(
        `INSERT INTO activities (id, organization_id, type, summary, actor_kind, actor_user_id, contact_id, lead_id, property_id, campaign_id, call_id, metadata, created_at)
         VALUES ($1,$2,'call.completed',$3,'user',$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [newId(), orgId, `Call ${h.status === 'completed' ? `completed: ${(h.outcome ?? '').replace(/_/g, ' ')}` : h.status.replace('_', ' ')} (simulated)`, team[1], contactIds[h.contact],
         leadRow, propId, h.contact <= 6 ? campaignId : null, callId, JSON.stringify({ simulated: true, outcome: h.outcome }), started]);
      if (h.notes) {
        await db.query(`INSERT INTO notes (id, organization_id, body, author_id, contact_id, lead_id, property_id, call_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [newId(), orgId, h.notes, team[1], contactIds[h.contact], leadRow, propId, callId, started]);
      }
    }
    await db.query(`UPDATE contacts SET last_contacted_at = (SELECT max(started_at) FROM calls WHERE contact_id=contacts.id AND answered_at IS NOT NULL) WHERE organization_id=$1`, [orgId]);

    // Tasks
    for (const t of [
      { title: 'Send valuation comps to Harlan', due: inDays(1), p: 'high', lead: 0, contact: 0 },
      { title: 'Call Dana back after quarter close', due: inDays(3), p: 'high', lead: 1, contact: 1 },
      { title: 'Prepare appointment packet — Piedmont condo', due: inDays(0.5), p: 'urgent', lead: 3, contact: 3 },
      { title: 'Call Tomas Monday morning', due: inDays(2), p: 'normal', lead: 4, contact: 4 },
      { title: 'Draft offer outline — Freedom Dr', due: inDays(4), p: 'high', lead: 5, contact: 5 },
      { title: 'Verify mailing address for Priya Raman', due: ago(day), p: 'normal', lead: 6, contact: 6 },
      { title: 'Review overdue tax filings — Barton Springs', due: ago(2 * day), p: 'normal', lead: 4, contact: 4 },
    ]) {
      await createTask(db, ctx, {
        title: t.title, dueAt: t.due, priority: t.p as any, assignedUserId: team[(t.lead % (team.length - 1)) + 1], leadId: leadIds[t.lead], contactId: contactIds[t.contact],
        propertyId: LEADS[t.lead].property !== null ? propertyIds[LEADS[t.lead].property as number] : null,
      } as any);
    }
    await createNote(db, ctx, { body: 'Owner prefers email for documents but phone for scheduling.', contactId: contactIds[0], leadId: leadIds[0] } as any);
    await createNote(db, ctx, { body: 'Portfolio of 3 buildings — confirm which are under contract before pricing.', ownerId: ownerIds.cedar, propertyId: propertyIds[2] } as any);

    // Workflows
    const workflows: WorkflowRow[] = [];
    for (const w of DEMO_WORKFLOWS) {
      const id = newId();
      await db.query(
        `INSERT INTO workflows (id, organization_id, name, description, trigger_type, conditions, actions, enabled, created_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,true,$8)`,
        [id, orgId, w.name, w.description, w.triggerType, JSON.stringify(w.conditions), JSON.stringify(w.actions), adminUserId]);
      workflows.push({ id, name: w.name, triggerType: w.triggerType as any, conditions: w.conditions as any, actions: w.actions as any, enabled: true });
    }
    return { team, leadIds, workflows, contactIds, campaignId };
  });

  // After commit: record a couple of real workflow executions so history/analytics are populated.
  const ctx = { ...sys(adminUserId), depth: 0 };
  const manual = refs.workflows[3];
  for (const leadIndex of [5, 0]) {
    const lead = (await getDb().query('SELECT * FROM leads WHERE id=$1', [refs.leadIds[leadIndex]])).rows[0];
    await executeWorkflow(ctx, manual, 'manual', { lead: { id: lead.id, title: lead.title, leadScore: lead.lead_score, stage: lead.stage } });
  }
  // Spread activity timestamps over the last ~10 days so the feed looks lived-in.
  await getDb().query(
    `WITH ranked AS (SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn FROM activities WHERE organization_id=$1 AND created_at > now() - interval '5 minutes')
     UPDATE activities a SET created_at = now() - (ranked.rn * interval '70 minutes') FROM ranked WHERE a.id=ranked.id`, [orgId]);
  return refs;
};

/** Deletes every record of an organization (tenant data and users) — used by purge and reset. */
const wipeOrg = async (db: Db, orgId: string, keepUserId?: string) => {
  for (const t of ALL_ORG_TABLES) await db.query(`DELETE FROM ${t} WHERE organization_id=$1`, [orgId]);
  await db.query(`DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1 AND id <> COALESCE($2,''))`, [orgId, keepUserId ?? null]);
  await db.query(`DELETE FROM users WHERE organization_id=$1 AND id <> COALESCE($2,'')`, [orgId, keepUserId ?? null]);
};

export const purgeExpiredDemoOrgs = async () => {
  const expired = await getDb().query(`SELECT id FROM organizations WHERE is_demo=true AND demo_expires_at < now() LIMIT 25`);
  for (const row of expired.rows) {
    await withTransaction(async (db) => {
      await wipeOrg(db, row.id);
      await db.query('DELETE FROM organizations WHERE id=$1 AND is_demo=true', [row.id]);
    });
  }
  return expired.rows.length;
};

export const resetDemoOrg = async (ctx: Ctx) => {
  if (!ctx.isDemo) throw forbidden('Reset is only available in demo mode');
  await withTx(async (db) => {
    const org = (await db.query('SELECT is_demo FROM organizations WHERE id=$1 FOR UPDATE', [ctx.orgId])).rows[0];
    if (!org?.is_demo) throw forbidden('Reset is only available in demo mode');
    await wipeOrg(db, ctx.orgId, ctx.userId ?? undefined);
    await db.query(`UPDATE organizations SET demo_expires_at = now() + interval '${DEMO_TTL_HOURS} hours' WHERE id=$1`, [ctx.orgId]);
  });
  await seedDemoData(ctx.orgId, ctx.userId!);
};

// ------------------------------------------------------------------ routes
export const demoRouter = Router();

demoRouter.get('/demo/status', async (_req, res) => {
  res.json({ enabled: demoEnabled(), ttlHours: DEMO_TTL_HOURS });
});

/** Public: start a fresh isolated demo workspace and sign the visitor in. Rate limited by the caller. */
export const startDemoSession = async (_req: Request, res: Response) => {
  try {
    if (!demoEnabled()) return res.status(404).json({ error: 'Demo mode is not enabled' });
    await ensureDatabaseReady();
    await purgeExpiredDemoOrgs();
    const count = await getDb().query('SELECT count(*)::int AS n FROM organizations WHERE is_demo=true');
    if (count.rows[0].n >= MAX_DEMO_ORGS) return res.status(503).json({ error: 'Demo capacity reached. Please try again shortly.' });

    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await withTransaction(async (db) => {
      await db.query(
        `INSERT INTO organizations (id, name, slug, is_demo, demo_expires_at) VALUES ($1,'Vortex Demo Realty',$2,true, now() + interval '${DEMO_TTL_HOURS} hours')`,
        [orgId, `demo-${orgId.slice(0, 8)}`]);
      await db.query(
        `INSERT INTO users (id, organization_id, uid, email, password_hash, name, role) VALUES ($1,$2,$1,$3,NULL,'Demo Admin','admin')`,
        [userId, orgId, `demo-admin-${orgId.slice(0, 8)}@demo.invalid`]);
    });
    await seedDemoData(orgId, userId);
    const session = await createSession(userId);
    // Demo sessions end with the demo organization (24h), not the 30-day default.
    await getDb().query(`UPDATE auth_sessions SET expires_at = now() + interval '${DEMO_TTL_HOURS} hours' WHERE user_id=$1`, [userId]);
    setSessionCookie(res, session.id, new Date(Date.now() + DEMO_TTL_HOURS * 3600 * 1000));
    return res.status(201).json({ ok: true, demo: true });
  } catch (error) {
    console.error('Demo session error:', error);
    return res.status(500).json({ error: 'Unable to start the demo' });
  }
};

demoRouter.post('/demo/reset', route('demo:reset', async (_req, _res, ctx) => {
  await resetDemoOrg(ctx);
  return { ok: true, message: 'Demo data has been reset.' };
}));

export { HttpError };

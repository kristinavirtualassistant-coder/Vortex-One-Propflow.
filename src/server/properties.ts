import { Router } from 'express';
import { z } from 'zod';
import {
  Where, presentOnly, assertRef, badRequest, camel, camelRows, emit, getDb, likeEscape, logActivity, newId, notFound,
  pageParams, route, withTx, type Ctx, type Db,
} from './core.js';
import { createLead } from './leads.js';

export const ENTITY_TYPES = ['individual', 'llc', 'corporation', 'trust', 'partnership', 'other'] as const;
const tags = z.array(z.string().trim().min(1).max(40)).max(25);
const money = z.coerce.number().min(0).max(1e12);

// ---------------------------------------------------------------- owners
export const ownerCreate = z.object({
  name: z.string().trim().min(1).max(200),
  entityType: z.enum(ENTITY_TYPES).default('individual'),
  mailingAddress: z.string().trim().max(200).nullish(),
  mailingCity: z.string().trim().max(100).nullish(),
  mailingState: z.string().trim().max(2).nullish(),
  mailingZip: z.string().trim().max(10).nullish(),
  phoneNumbers: z.array(z.string().trim().max(32)).max(10).default([]),
  emailAddresses: z.array(z.string().trim().toLowerCase().email().max(200)).max(10).default([]),
  notes: z.string().trim().max(5000).nullish(),
  tags: tags.default([]),
});
export const ownerUpdate = ownerCreate.partial();

export const createOwner = async (db: Db, ctx: Ctx, input: z.infer<typeof ownerCreate>) => {
  const id = newId();
  const r = await db.query(
    `INSERT INTO property_owners
       (id, organization_id, name, entity_type, mailing_address, mailing_city, mailing_state, mailing_zip,
        phone_numbers, email_addresses, notes, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb) RETURNING *`,
    [id, ctx.orgId, input.name, input.entityType, input.mailingAddress ?? null, input.mailingCity ?? null,
     input.mailingState?.toUpperCase() ?? null, input.mailingZip ?? null, JSON.stringify(input.phoneNumbers),
     JSON.stringify(input.emailAddresses), input.notes ?? null, JSON.stringify(input.tags)],
  );
  await logActivity(db, ctx, 'owner.created', `Owner ${input.name} created`, { ownerId: id });
  return camel<any>(r.rows[0])!;
};

// ------------------------------------------------------------- properties
export const propertyCreate = z.object({
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 digits'),
  county: z.string().trim().min(1).max(100),
  apn: z.string().trim().min(1).max(64),
  propertyType: z.string().trim().min(1).max(60),
  unitsCount: z.coerce.number().int().min(1).max(10000).default(1),
  squareFeet: z.coerce.number().int().min(0).max(10_000_000).default(0),
  yearBuilt: z.coerce.number().int().min(1600).max(2200).nullish(),
  bedrooms: z.coerce.number().min(0).max(100).nullish(),
  bathrooms: z.coerce.number().min(0).max(100).nullish(),
  lotSizeSqft: z.coerce.number().int().min(0).nullish(),
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  estimatedValue: money.default(0),
  assessedTaxValue: money.default(0),
  estimatedEquity: z.coerce.number().min(-1e12).max(1e12).default(0),
  mortgageBalance: money.default(0),
  isAbsenteeOwner: z.boolean().default(false),
  isCorporateOwned: z.boolean().default(false),
  taxDelinquent: z.boolean().default(false),
  lastSaleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  lastSalePrice: money.nullish(),
  ownerId: z.string().max(64).nullish(),
  notes: z.string().trim().max(5000).nullish(),
  tags: tags.default([]),
});
export const propertyUpdate = propertyCreate.partial();

const PROPERTY_COLS: Record<string, string> = {
  address: 'address', city: 'city', state: 'state', zip: 'zip', county: 'county', apn: 'apn',
  propertyType: 'property_type', unitsCount: 'units_count', squareFeet: 'square_feet', yearBuilt: 'year_built',
  bedrooms: 'bedrooms', bathrooms: 'bathrooms', lotSizeSqft: 'lot_size_sqft', latitude: 'latitude',
  longitude: 'longitude', estimatedValue: 'estimated_value', assessedTaxValue: 'assessed_tax_value',
  estimatedEquity: 'estimated_equity', mortgageBalance: 'mortgage_balance', isAbsenteeOwner: 'is_absentee_owner',
  isCorporateOwned: 'is_corporate_owned', taxDelinquent: 'tax_delinquent', lastSaleDate: 'last_sale_date',
  lastSalePrice: 'last_sale_price', ownerId: 'owner_id', notes: 'notes', tags: 'tags',
};

export const createProperty = async (db: Db, ctx: Ctx, input: z.infer<typeof propertyCreate>, provenance: object = { source: 'manual' }) => {
  await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const dup = await db.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, input.apn]);
  if (dup.rows.length) throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
  const id = newId();
  const keys = Object.keys(PROPERTY_COLS);
  const values = keys.map((k) => {
    const v = (input as any)[k];
    return k === 'tags' ? JSON.stringify(v ?? []) : v ?? null;
  });
  const r = await db.query(
    `INSERT INTO properties (id, organization_id, provenance, ${keys.map((k) => PROPERTY_COLS[k]).join(',')})
     VALUES ($1,$2,$3::jsonb,${keys.map((k, i) => `$${i + 4}${k === 'tags' ? '::jsonb' : ''}`).join(',')}) RETURNING *`,
    [id, ctx.orgId, JSON.stringify(provenance), ...values],
  );
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.created', `Property ${property.address}, ${property.city} added`,
    { propertyId: id, ownerId: property.ownerId });
  return property;
};

const SORTS: Record<string, string> = {
  created: 'p.created_at', value: 'p.estimated_value', equity: 'p.estimated_equity', address: 'p.address',
  updated: 'p.updated_at',
};

const propertyFilters = (ctx: Ctx, q: Record<string, string>) => {
  const w = new Where(ctx.orgId, 'p.organization_id');
  w.add(q.archived === 'true' ? 'p.archived_at IS NOT NULL' : 'p.archived_at IS NULL');
  if (q.q?.trim()) {
    const like = `%${likeEscape(q.q.trim())}%`;
    w.add('(p.address ILIKE ? OR p.city ILIKE ? OR p.apn ILIKE ? OR p.zip ILIKE ? OR po.name ILIKE ?)', like, like, like, like, like);
  }
  if (q.state) w.add('p.state = ?', q.state.toUpperCase());
  if (q.county) w.add('p.county ILIKE ?', q.county);
  if (q.zip || q.postalCode) w.add('p.zip = ?', q.zip || q.postalCode);
  if (q.propertyType) w.add('p.property_type = ?', q.propertyType);
  if (q.ownerId) w.add('p.owner_id = ?', q.ownerId);
  if (Number(q.minValue) > 0) w.add('p.estimated_value >= ?', Number(q.minValue));
  if (Number(q.maxValue) > 0) w.add('p.estimated_value <= ?', Number(q.maxValue));
  if (q.taxDelinquent === 'true') w.add('p.tax_delinquent = true');
  if (q.absentee === 'true') w.add('p.is_absentee_owner = true');
  if (q.hasLead === 'true') w.add('EXISTS (SELECT 1 FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL)');
  if (q.hasLead === 'false') w.add('NOT EXISTS (SELECT 1 FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL)');
  return w;
};

export const propertiesRouter = Router();

const PUBLIC_RECORD_COUNTIES: Record<string, string> = {
  '06037': 'Los Angeles',
  '06075': 'San Francisco',
};

propertiesRouter.get('/public-records', route('crm:read', async (req, _res, _ctx) => {
  const q = req.query as Record<string, string>;
  const values: unknown[] = [];
  const where: string[] = [];

  if (q.countyFips) {
    values.push(q.countyFips);
    where.push('p.county_fips = propertiesRouter.get('/properties', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = propertyFilters(ctx, q);
  const order = `${SORTS[q.sort] ?? 'p.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, p.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM properties p LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT p.*, po.name AS owner_name, po.entity_type AS owner_type,
            (SELECT count(*)::int FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS lead_count,
            (SELECT max(l.lead_score) FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS top_lead_score
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/properties', route('crm:write', async (req, res, ctx) => {
  const input = propertyCreate.parse(req.body);
  const property = await withTx(async (client) => createProperty(client, ctx, input));
  await emit(ctx, 'property.identified', { property });
  res.status(201).json({ property });
}));

propertiesRouter.get('/properties/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const p = await db.query(
    `SELECT p.*, po.name AS owner_name FROM properties p
       LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2`, [id, ctx.orgId]);
  if (!p.rows.length) throw notFound('Property');
  const ownerId = p.rows[0].owner_id;
  const [owner, leads, contacts, tasks, calls, notes, activity] = await Promise.all([
    ownerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name FROM leads l
                LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.organization_id=$1 AND l.primary_property_id=$2
               ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    ownerId ? db.query(`SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL`, [ctx.orgId, ownerId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND property_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND property_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
  ]);
  const property = camel<any>(p.rows[0])!;
  return {
    property, owner: camel(owner.rows[0]), leads: camelRows(leads.rows), contacts: camelRows(contacts.rows),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows),
    activity: camelRows(activity.rows), sources: property.provenance && Object.keys(property.provenance).length ? [property.provenance] : [],
  };
}));

propertiesRouter.patch('/properties/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(propertyUpdate.parse(req.body), req.body);
  if (input.ownerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(PROPERTY_COLS)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  let r;
  try {
    r = await db.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  } catch (e: any) {
    if (e.code === '23505') throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
    throw e;
  }
  if (!r.rows.length) throw notFound('Property');
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.updated', `Property ${property.address} updated`,
    { propertyId: id, ownerId: property.ownerId }, { fields: Object.keys(input) });
  return { property };
}));

propertiesRouter.post('/properties/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE properties SET archived_at=${restore ? 'NULL' : 'now()'} WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Property');
  await logActivity(getDb(), ctx, restore ? 'property.restored' : 'property.archived',
    `Property ${r.rows[0].address} ${restore ? 'restored' : 'archived'}`, { propertyId: r.rows[0].id, ownerId: r.rows[0].owner_id });
  return { property: camel(r.rows[0]) };
}));

/** Convenience: score the property and open (or update) a lead for it. */
propertiesRouter.post('/properties/:id/lead', route('crm:write', async (req, res, ctx) => {
  const { lead, created } = await createLead(getDb(), ctx, { propertyId: String(req.params.id), source: 'property_intelligence' }, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead, created });
}));

// ----------------------------------------------------------------- import
const importRecord = propertyCreate.extend({
  owner: z.object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(ENTITY_TYPES).optional(),
    mailingAddress: z.string().max(200).nullish(),
    mailingCity: z.string().max(100).nullish(),
    mailingState: z.string().max(2).nullish(),
    mailingZip: z.string().max(10).nullish(),
  }).nullish(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});

propertiesRouter.post('/properties/import', route('crm:write', async (req, res, ctx) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) throw badRequest('records array is required');
  if (records.length > 5000) throw Object.assign(new Error('Import limited to 5,000 records per request.'), { status: 413 });
  const parsed = records.map((r: unknown, i: number) => {
    const result = importRecord.safeParse(r);
    if (!result.success) throw badRequest(`Record ${i + 1}: ${result.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
    return result.data;
  });
  let inserted = 0, updated = 0;
  await withTx(async (client) => {
    for (const rec of parsed) {
      let ownerId = rec.ownerId ?? null;
      if (rec.owner) {
        const found = await client.query('SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1', [ctx.orgId, rec.owner.name]);
        ownerId = found.rows[0]?.id ?? (await createOwner(client, ctx, ownerCreate.parse({
          name: rec.owner.name, entityType: rec.owner.entityType ?? 'individual', mailingAddress: rec.owner.mailingAddress,
          mailingCity: rec.owner.mailingCity, mailingState: rec.owner.mailingState, mailingZip: rec.owner.mailingZip,
        }))).id;
      }
      const existing = await client.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, rec.apn]);
      const provenance = rec.provenance ?? { source: 'import', importedAt: new Date().toISOString() };
      if (existing.rows.length) {
        const keys = Object.keys(PROPERTY_COLS).filter((k) => k !== 'tags' && k !== 'notes');
        const vals = keys.map((k) => (k === 'ownerId' ? ownerId : (rec as any)[k] ?? null));
        await client.query(
          `UPDATE properties SET ${keys.map((k, i) => `${PROPERTY_COLS[k]}=$${i + 3}`).join(',')}, provenance=$${keys.length + 3}::jsonb
            WHERE id=$1 AND organization_id=$2`,
          [existing.rows[0].id, ctx.orgId, ...vals, JSON.stringify(provenance)]);
        updated++;
      } else {
        await createProperty(client, ctx, { ...rec, ownerId } as any, provenance);
        inserted++;
      }
    }
  });
  res.status(201).json({ inserted, updated, total: parsed.length });
}));

// ----------------------------------------------------------------- owners routes
const OWNER_SORTS: Record<string, string> = { name: 'po.name', created: 'po.created_at', portfolio: 'portfolio_value' };

propertiesRouter.get('/owners', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'po.organization_id');
  w.add(q.archived === 'true' ? 'po.archived_at IS NOT NULL' : 'po.archived_at IS NULL');
  if (q.q?.trim()) { const like = `%${likeEscape(q.q.trim())}%`; w.add('(po.name ILIKE ? OR po.mailing_address ILIKE ? OR po.mailing_city ILIKE ?)', like, like, like); }
  if (q.entityType) w.add('po.entity_type = ?', q.entityType);
  const order = `${OWNER_SORTS[q.sort] ?? 'po.name'} ${q.dir === 'desc' ? 'DESC' : 'ASC'}, po.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM property_owners po WHERE ${w.sql}`, w.params);
  // Property counts and portfolio value are derived from properties, never trusted from stored columns.
  const rows = await db.query(
    `SELECT po.*, agg.properties_count, agg.portfolio_value, agg.portfolio_equity
       FROM property_owners po
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS properties_count, COALESCE(sum(estimated_value),0) AS portfolio_value,
                COALESCE(sum(estimated_equity),0) AS portfolio_equity
           FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id AND p.archived_at IS NULL) agg ON true
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  const items = camelRows<any>(rows.rows).map((o) => ({ ...o, portfolioValue: Number(o.portfolioValue), portfolioEquity: Number(o.portfolioEquity) }));
  return { items, total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/owners', route('crm:write', async (req, res, ctx) => {
  const owner = await createOwner(getDb(), ctx, ownerCreate.parse(req.body));
  res.status(201).json({ owner });
}));

propertiesRouter.get('/owners/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const o = await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!o.rows.length) throw notFound('Owner');
  const [properties, contacts, leads, notes, activity] = await Promise.all([
    db.query('SELECT * FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY created_at DESC', [ctx.orgId, id]),
    db.query('SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, id]),
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.property_owner_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_owner_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND property_owner_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  const props = camelRows<any>(properties.rows);
  const owner = camel<any>(o.rows[0])!;
  owner.propertiesCount = props.filter((p) => !p.archivedAt).length;
  owner.portfolioValue = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedValue, 0);
  owner.portfolioEquity = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedEquity, 0);
  return { owner, properties: props, contacts: camelRows(contacts.rows), leads: camelRows(leads.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows) };
}));

propertiesRouter.patch('/owners/:id', route('crm:write', async (req, _res, ctx) => {
  const input = presentOnly(ownerUpdate.parse(req.body), req.body);
  const cols: Record<string, string> = {
    name: 'name', entityType: 'entity_type', mailingAddress: 'mailing_address', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZip: 'mailing_zip', phoneNumbers: 'phone_numbers',
    emailAddresses: 'email_addresses', notes: 'notes', tags: 'tags',
  };
  const jsonCols = new Set(['phoneNumbers', 'emailAddresses', 'tags']);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    let v = (input as any)[k];
    if (v === undefined) continue;
    if (k === 'mailingState' && v) v = String(v).toUpperCase();
    params.push(jsonCols.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col}=$${params.length}${jsonCols.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(
    `UPDATE property_owners SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, 'owner.updated', `Owner ${r.rows[0].name} updated`, { ownerId: r.rows[0].id }, { fields: Object.keys(input) });
  return { owner: camel(r.rows[0]) };
}));

propertiesRouter.post('/owners/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE property_owners SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, restore ? 'owner.restored' : 'owner.archived', `Owner ${r.rows[0].name} ${restore ? 'restored' : 'archived'}`, { ownerId: r.rows[0].id });
  return { owner: camel(r.rows[0]) };
}));
 + values.length);
  }
  if (q.q?.trim()) {
    const like = '%' + q.q.trim().replace(/[\\%_]/g, '\\export const propertiesRouter = Router();

') + '%';
    const start = values.length + 1;
    values.push(like, like, like, like, like);
    where.push('(p.apn ILIKE propertiesRouter.get('/properties', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = propertyFilters(ctx, q);
  const order = `${SORTS[q.sort] ?? 'p.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, p.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM properties p LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT p.*, po.name AS owner_name, po.entity_type AS owner_type,
            (SELECT count(*)::int FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS lead_count,
            (SELECT max(l.lead_score) FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS top_lead_score
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/properties', route('crm:write', async (req, res, ctx) => {
  const input = propertyCreate.parse(req.body);
  const property = await withTx(async (client) => createProperty(client, ctx, input));
  await emit(ctx, 'property.identified', { property });
  res.status(201).json({ property });
}));

propertiesRouter.get('/properties/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const p = await db.query(
    `SELECT p.*, po.name AS owner_name FROM properties p
       LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2`, [id, ctx.orgId]);
  if (!p.rows.length) throw notFound('Property');
  const ownerId = p.rows[0].owner_id;
  const [owner, leads, contacts, tasks, calls, notes, activity] = await Promise.all([
    ownerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name FROM leads l
                LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.organization_id=$1 AND l.primary_property_id=$2
               ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    ownerId ? db.query(`SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL`, [ctx.orgId, ownerId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND property_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND property_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
  ]);
  const property = camel<any>(p.rows[0])!;
  return {
    property, owner: camel(owner.rows[0]), leads: camelRows(leads.rows), contacts: camelRows(contacts.rows),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows),
    activity: camelRows(activity.rows), sources: property.provenance && Object.keys(property.provenance).length ? [property.provenance] : [],
  };
}));

propertiesRouter.patch('/properties/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(propertyUpdate.parse(req.body), req.body);
  if (input.ownerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(PROPERTY_COLS)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  let r;
  try {
    r = await db.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  } catch (e: any) {
    if (e.code === '23505') throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
    throw e;
  }
  if (!r.rows.length) throw notFound('Property');
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.updated', `Property ${property.address} updated`,
    { propertyId: id, ownerId: property.ownerId }, { fields: Object.keys(input) });
  return { property };
}));

propertiesRouter.post('/properties/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE properties SET archived_at=${restore ? 'NULL' : 'now()'} WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Property');
  await logActivity(getDb(), ctx, restore ? 'property.restored' : 'property.archived',
    `Property ${r.rows[0].address} ${restore ? 'restored' : 'archived'}`, { propertyId: r.rows[0].id, ownerId: r.rows[0].owner_id });
  return { property: camel(r.rows[0]) };
}));

/** Convenience: score the property and open (or update) a lead for it. */
propertiesRouter.post('/properties/:id/lead', route('crm:write', async (req, res, ctx) => {
  const { lead, created } = await createLead(getDb(), ctx, { propertyId: String(req.params.id), source: 'property_intelligence' }, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead, created });
}));

// ----------------------------------------------------------------- import
const importRecord = propertyCreate.extend({
  owner: z.object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(ENTITY_TYPES).optional(),
    mailingAddress: z.string().max(200).nullish(),
    mailingCity: z.string().max(100).nullish(),
    mailingState: z.string().max(2).nullish(),
    mailingZip: z.string().max(10).nullish(),
  }).nullish(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});

propertiesRouter.post('/properties/import', route('crm:write', async (req, res, ctx) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) throw badRequest('records array is required');
  if (records.length > 5000) throw Object.assign(new Error('Import limited to 5,000 records per request.'), { status: 413 });
  const parsed = records.map((r: unknown, i: number) => {
    const result = importRecord.safeParse(r);
    if (!result.success) throw badRequest(`Record ${i + 1}: ${result.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
    return result.data;
  });
  let inserted = 0, updated = 0;
  await withTx(async (client) => {
    for (const rec of parsed) {
      let ownerId = rec.ownerId ?? null;
      if (rec.owner) {
        const found = await client.query('SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1', [ctx.orgId, rec.owner.name]);
        ownerId = found.rows[0]?.id ?? (await createOwner(client, ctx, ownerCreate.parse({
          name: rec.owner.name, entityType: rec.owner.entityType ?? 'individual', mailingAddress: rec.owner.mailingAddress,
          mailingCity: rec.owner.mailingCity, mailingState: rec.owner.mailingState, mailingZip: rec.owner.mailingZip,
        }))).id;
      }
      const existing = await client.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, rec.apn]);
      const provenance = rec.provenance ?? { source: 'import', importedAt: new Date().toISOString() };
      if (existing.rows.length) {
        const keys = Object.keys(PROPERTY_COLS).filter((k) => k !== 'tags' && k !== 'notes');
        const vals = keys.map((k) => (k === 'ownerId' ? ownerId : (rec as any)[k] ?? null));
        await client.query(
          `UPDATE properties SET ${keys.map((k, i) => `${PROPERTY_COLS[k]}=$${i + 3}`).join(',')}, provenance=$${keys.length + 3}::jsonb
            WHERE id=$1 AND organization_id=$2`,
          [existing.rows[0].id, ctx.orgId, ...vals, JSON.stringify(provenance)]);
        updated++;
      } else {
        await createProperty(client, ctx, { ...rec, ownerId } as any, provenance);
        inserted++;
      }
    }
  });
  res.status(201).json({ inserted, updated, total: parsed.length });
}));

// ----------------------------------------------------------------- owners routes
const OWNER_SORTS: Record<string, string> = { name: 'po.name', created: 'po.created_at', portfolio: 'portfolio_value' };

propertiesRouter.get('/owners', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'po.organization_id');
  w.add(q.archived === 'true' ? 'po.archived_at IS NOT NULL' : 'po.archived_at IS NULL');
  if (q.q?.trim()) { const like = `%${likeEscape(q.q.trim())}%`; w.add('(po.name ILIKE ? OR po.mailing_address ILIKE ? OR po.mailing_city ILIKE ?)', like, like, like); }
  if (q.entityType) w.add('po.entity_type = ?', q.entityType);
  const order = `${OWNER_SORTS[q.sort] ?? 'po.name'} ${q.dir === 'desc' ? 'DESC' : 'ASC'}, po.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM property_owners po WHERE ${w.sql}`, w.params);
  // Property counts and portfolio value are derived from properties, never trusted from stored columns.
  const rows = await db.query(
    `SELECT po.*, agg.properties_count, agg.portfolio_value, agg.portfolio_equity
       FROM property_owners po
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS properties_count, COALESCE(sum(estimated_value),0) AS portfolio_value,
                COALESCE(sum(estimated_equity),0) AS portfolio_equity
           FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id AND p.archived_at IS NULL) agg ON true
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  const items = camelRows<any>(rows.rows).map((o) => ({ ...o, portfolioValue: Number(o.portfolioValue), portfolioEquity: Number(o.portfolioEquity) }));
  return { items, total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/owners', route('crm:write', async (req, res, ctx) => {
  const owner = await createOwner(getDb(), ctx, ownerCreate.parse(req.body));
  res.status(201).json({ owner });
}));

propertiesRouter.get('/owners/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const o = await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!o.rows.length) throw notFound('Owner');
  const [properties, contacts, leads, notes, activity] = await Promise.all([
    db.query('SELECT * FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY created_at DESC', [ctx.orgId, id]),
    db.query('SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, id]),
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.property_owner_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_owner_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND property_owner_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  const props = camelRows<any>(properties.rows);
  const owner = camel<any>(o.rows[0])!;
  owner.propertiesCount = props.filter((p) => !p.archivedAt).length;
  owner.portfolioValue = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedValue, 0);
  owner.portfolioEquity = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedEquity, 0);
  return { owner, properties: props, contacts: camelRows(contacts.rows), leads: camelRows(leads.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows) };
}));

propertiesRouter.patch('/owners/:id', route('crm:write', async (req, _res, ctx) => {
  const input = presentOnly(ownerUpdate.parse(req.body), req.body);
  const cols: Record<string, string> = {
    name: 'name', entityType: 'entity_type', mailingAddress: 'mailing_address', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZip: 'mailing_zip', phoneNumbers: 'phone_numbers',
    emailAddresses: 'email_addresses', notes: 'notes', tags: 'tags',
  };
  const jsonCols = new Set(['phoneNumbers', 'emailAddresses', 'tags']);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    let v = (input as any)[k];
    if (v === undefined) continue;
    if (k === 'mailingState' && v) v = String(v).toUpperCase();
    params.push(jsonCols.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col}=$${params.length}${jsonCols.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(
    `UPDATE property_owners SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, 'owner.updated', `Owner ${r.rows[0].name} updated`, { ownerId: r.rows[0].id }, { fields: Object.keys(input) });
  return { owner: camel(r.rows[0]) };
}));

propertiesRouter.post('/owners/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE property_owners SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, restore ? 'owner.restored' : 'owner.archived', `Owner ${r.rows[0].name} ${restore ? 'restored' : 'archived'}`, { ownerId: r.rows[0].id });
  return { owner: camel(r.rows[0]) };
}));
 + start + ' OR p.situs_address ILIKE propertiesRouter.get('/properties', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = propertyFilters(ctx, q);
  const order = `${SORTS[q.sort] ?? 'p.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, p.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM properties p LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT p.*, po.name AS owner_name, po.entity_type AS owner_type,
            (SELECT count(*)::int FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS lead_count,
            (SELECT max(l.lead_score) FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS top_lead_score
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/properties', route('crm:write', async (req, res, ctx) => {
  const input = propertyCreate.parse(req.body);
  const property = await withTx(async (client) => createProperty(client, ctx, input));
  await emit(ctx, 'property.identified', { property });
  res.status(201).json({ property });
}));

propertiesRouter.get('/properties/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const p = await db.query(
    `SELECT p.*, po.name AS owner_name FROM properties p
       LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2`, [id, ctx.orgId]);
  if (!p.rows.length) throw notFound('Property');
  const ownerId = p.rows[0].owner_id;
  const [owner, leads, contacts, tasks, calls, notes, activity] = await Promise.all([
    ownerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name FROM leads l
                LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.organization_id=$1 AND l.primary_property_id=$2
               ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    ownerId ? db.query(`SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL`, [ctx.orgId, ownerId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND property_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND property_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
  ]);
  const property = camel<any>(p.rows[0])!;
  return {
    property, owner: camel(owner.rows[0]), leads: camelRows(leads.rows), contacts: camelRows(contacts.rows),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows),
    activity: camelRows(activity.rows), sources: property.provenance && Object.keys(property.provenance).length ? [property.provenance] : [],
  };
}));

propertiesRouter.patch('/properties/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(propertyUpdate.parse(req.body), req.body);
  if (input.ownerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(PROPERTY_COLS)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  let r;
  try {
    r = await db.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  } catch (e: any) {
    if (e.code === '23505') throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
    throw e;
  }
  if (!r.rows.length) throw notFound('Property');
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.updated', `Property ${property.address} updated`,
    { propertyId: id, ownerId: property.ownerId }, { fields: Object.keys(input) });
  return { property };
}));

propertiesRouter.post('/properties/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE properties SET archived_at=${restore ? 'NULL' : 'now()'} WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Property');
  await logActivity(getDb(), ctx, restore ? 'property.restored' : 'property.archived',
    `Property ${r.rows[0].address} ${restore ? 'restored' : 'archived'}`, { propertyId: r.rows[0].id, ownerId: r.rows[0].owner_id });
  return { property: camel(r.rows[0]) };
}));

/** Convenience: score the property and open (or update) a lead for it. */
propertiesRouter.post('/properties/:id/lead', route('crm:write', async (req, res, ctx) => {
  const { lead, created } = await createLead(getDb(), ctx, { propertyId: String(req.params.id), source: 'property_intelligence' }, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead, created });
}));

// ----------------------------------------------------------------- import
const importRecord = propertyCreate.extend({
  owner: z.object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(ENTITY_TYPES).optional(),
    mailingAddress: z.string().max(200).nullish(),
    mailingCity: z.string().max(100).nullish(),
    mailingState: z.string().max(2).nullish(),
    mailingZip: z.string().max(10).nullish(),
  }).nullish(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});

propertiesRouter.post('/properties/import', route('crm:write', async (req, res, ctx) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) throw badRequest('records array is required');
  if (records.length > 5000) throw Object.assign(new Error('Import limited to 5,000 records per request.'), { status: 413 });
  const parsed = records.map((r: unknown, i: number) => {
    const result = importRecord.safeParse(r);
    if (!result.success) throw badRequest(`Record ${i + 1}: ${result.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
    return result.data;
  });
  let inserted = 0, updated = 0;
  await withTx(async (client) => {
    for (const rec of parsed) {
      let ownerId = rec.ownerId ?? null;
      if (rec.owner) {
        const found = await client.query('SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1', [ctx.orgId, rec.owner.name]);
        ownerId = found.rows[0]?.id ?? (await createOwner(client, ctx, ownerCreate.parse({
          name: rec.owner.name, entityType: rec.owner.entityType ?? 'individual', mailingAddress: rec.owner.mailingAddress,
          mailingCity: rec.owner.mailingCity, mailingState: rec.owner.mailingState, mailingZip: rec.owner.mailingZip,
        }))).id;
      }
      const existing = await client.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, rec.apn]);
      const provenance = rec.provenance ?? { source: 'import', importedAt: new Date().toISOString() };
      if (existing.rows.length) {
        const keys = Object.keys(PROPERTY_COLS).filter((k) => k !== 'tags' && k !== 'notes');
        const vals = keys.map((k) => (k === 'ownerId' ? ownerId : (rec as any)[k] ?? null));
        await client.query(
          `UPDATE properties SET ${keys.map((k, i) => `${PROPERTY_COLS[k]}=$${i + 3}`).join(',')}, provenance=$${keys.length + 3}::jsonb
            WHERE id=$1 AND organization_id=$2`,
          [existing.rows[0].id, ctx.orgId, ...vals, JSON.stringify(provenance)]);
        updated++;
      } else {
        await createProperty(client, ctx, { ...rec, ownerId } as any, provenance);
        inserted++;
      }
    }
  });
  res.status(201).json({ inserted, updated, total: parsed.length });
}));

// ----------------------------------------------------------------- owners routes
const OWNER_SORTS: Record<string, string> = { name: 'po.name', created: 'po.created_at', portfolio: 'portfolio_value' };

propertiesRouter.get('/owners', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'po.organization_id');
  w.add(q.archived === 'true' ? 'po.archived_at IS NOT NULL' : 'po.archived_at IS NULL');
  if (q.q?.trim()) { const like = `%${likeEscape(q.q.trim())}%`; w.add('(po.name ILIKE ? OR po.mailing_address ILIKE ? OR po.mailing_city ILIKE ?)', like, like, like); }
  if (q.entityType) w.add('po.entity_type = ?', q.entityType);
  const order = `${OWNER_SORTS[q.sort] ?? 'po.name'} ${q.dir === 'desc' ? 'DESC' : 'ASC'}, po.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM property_owners po WHERE ${w.sql}`, w.params);
  // Property counts and portfolio value are derived from properties, never trusted from stored columns.
  const rows = await db.query(
    `SELECT po.*, agg.properties_count, agg.portfolio_value, agg.portfolio_equity
       FROM property_owners po
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS properties_count, COALESCE(sum(estimated_value),0) AS portfolio_value,
                COALESCE(sum(estimated_equity),0) AS portfolio_equity
           FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id AND p.archived_at IS NULL) agg ON true
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  const items = camelRows<any>(rows.rows).map((o) => ({ ...o, portfolioValue: Number(o.portfolioValue), portfolioEquity: Number(o.portfolioEquity) }));
  return { items, total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/owners', route('crm:write', async (req, res, ctx) => {
  const owner = await createOwner(getDb(), ctx, ownerCreate.parse(req.body));
  res.status(201).json({ owner });
}));

propertiesRouter.get('/owners/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const o = await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!o.rows.length) throw notFound('Owner');
  const [properties, contacts, leads, notes, activity] = await Promise.all([
    db.query('SELECT * FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY created_at DESC', [ctx.orgId, id]),
    db.query('SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, id]),
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.property_owner_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_owner_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND property_owner_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  const props = camelRows<any>(properties.rows);
  const owner = camel<any>(o.rows[0])!;
  owner.propertiesCount = props.filter((p) => !p.archivedAt).length;
  owner.portfolioValue = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedValue, 0);
  owner.portfolioEquity = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedEquity, 0);
  return { owner, properties: props, contacts: camelRows(contacts.rows), leads: camelRows(leads.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows) };
}));

propertiesRouter.patch('/owners/:id', route('crm:write', async (req, _res, ctx) => {
  const input = presentOnly(ownerUpdate.parse(req.body), req.body);
  const cols: Record<string, string> = {
    name: 'name', entityType: 'entity_type', mailingAddress: 'mailing_address', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZip: 'mailing_zip', phoneNumbers: 'phone_numbers',
    emailAddresses: 'email_addresses', notes: 'notes', tags: 'tags',
  };
  const jsonCols = new Set(['phoneNumbers', 'emailAddresses', 'tags']);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    let v = (input as any)[k];
    if (v === undefined) continue;
    if (k === 'mailingState' && v) v = String(v).toUpperCase();
    params.push(jsonCols.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col}=$${params.length}${jsonCols.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(
    `UPDATE property_owners SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, 'owner.updated', `Owner ${r.rows[0].name} updated`, { ownerId: r.rows[0].id }, { fields: Object.keys(input) });
  return { owner: camel(r.rows[0]) };
}));

propertiesRouter.post('/owners/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE property_owners SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, restore ? 'owner.restored' : 'owner.archived', `Owner ${r.rows[0].name} ${restore ? 'restored' : 'archived'}`, { ownerId: r.rows[0].id });
  return { owner: camel(r.rows[0]) };
}));
 + (start + 1) +
      ' OR p.situs_city ILIKE propertiesRouter.get('/properties', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = propertyFilters(ctx, q);
  const order = `${SORTS[q.sort] ?? 'p.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, p.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM properties p LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT p.*, po.name AS owner_name, po.entity_type AS owner_type,
            (SELECT count(*)::int FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS lead_count,
            (SELECT max(l.lead_score) FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS top_lead_score
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/properties', route('crm:write', async (req, res, ctx) => {
  const input = propertyCreate.parse(req.body);
  const property = await withTx(async (client) => createProperty(client, ctx, input));
  await emit(ctx, 'property.identified', { property });
  res.status(201).json({ property });
}));

propertiesRouter.get('/properties/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const p = await db.query(
    `SELECT p.*, po.name AS owner_name FROM properties p
       LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2`, [id, ctx.orgId]);
  if (!p.rows.length) throw notFound('Property');
  const ownerId = p.rows[0].owner_id;
  const [owner, leads, contacts, tasks, calls, notes, activity] = await Promise.all([
    ownerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name FROM leads l
                LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.organization_id=$1 AND l.primary_property_id=$2
               ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    ownerId ? db.query(`SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL`, [ctx.orgId, ownerId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND property_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND property_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
  ]);
  const property = camel<any>(p.rows[0])!;
  return {
    property, owner: camel(owner.rows[0]), leads: camelRows(leads.rows), contacts: camelRows(contacts.rows),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows),
    activity: camelRows(activity.rows), sources: property.provenance && Object.keys(property.provenance).length ? [property.provenance] : [],
  };
}));

propertiesRouter.patch('/properties/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(propertyUpdate.parse(req.body), req.body);
  if (input.ownerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(PROPERTY_COLS)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  let r;
  try {
    r = await db.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  } catch (e: any) {
    if (e.code === '23505') throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
    throw e;
  }
  if (!r.rows.length) throw notFound('Property');
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.updated', `Property ${property.address} updated`,
    { propertyId: id, ownerId: property.ownerId }, { fields: Object.keys(input) });
  return { property };
}));

propertiesRouter.post('/properties/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE properties SET archived_at=${restore ? 'NULL' : 'now()'} WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Property');
  await logActivity(getDb(), ctx, restore ? 'property.restored' : 'property.archived',
    `Property ${r.rows[0].address} ${restore ? 'restored' : 'archived'}`, { propertyId: r.rows[0].id, ownerId: r.rows[0].owner_id });
  return { property: camel(r.rows[0]) };
}));

/** Convenience: score the property and open (or update) a lead for it. */
propertiesRouter.post('/properties/:id/lead', route('crm:write', async (req, res, ctx) => {
  const { lead, created } = await createLead(getDb(), ctx, { propertyId: String(req.params.id), source: 'property_intelligence' }, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead, created });
}));

// ----------------------------------------------------------------- import
const importRecord = propertyCreate.extend({
  owner: z.object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(ENTITY_TYPES).optional(),
    mailingAddress: z.string().max(200).nullish(),
    mailingCity: z.string().max(100).nullish(),
    mailingState: z.string().max(2).nullish(),
    mailingZip: z.string().max(10).nullish(),
  }).nullish(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});

propertiesRouter.post('/properties/import', route('crm:write', async (req, res, ctx) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) throw badRequest('records array is required');
  if (records.length > 5000) throw Object.assign(new Error('Import limited to 5,000 records per request.'), { status: 413 });
  const parsed = records.map((r: unknown, i: number) => {
    const result = importRecord.safeParse(r);
    if (!result.success) throw badRequest(`Record ${i + 1}: ${result.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
    return result.data;
  });
  let inserted = 0, updated = 0;
  await withTx(async (client) => {
    for (const rec of parsed) {
      let ownerId = rec.ownerId ?? null;
      if (rec.owner) {
        const found = await client.query('SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1', [ctx.orgId, rec.owner.name]);
        ownerId = found.rows[0]?.id ?? (await createOwner(client, ctx, ownerCreate.parse({
          name: rec.owner.name, entityType: rec.owner.entityType ?? 'individual', mailingAddress: rec.owner.mailingAddress,
          mailingCity: rec.owner.mailingCity, mailingState: rec.owner.mailingState, mailingZip: rec.owner.mailingZip,
        }))).id;
      }
      const existing = await client.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, rec.apn]);
      const provenance = rec.provenance ?? { source: 'import', importedAt: new Date().toISOString() };
      if (existing.rows.length) {
        const keys = Object.keys(PROPERTY_COLS).filter((k) => k !== 'tags' && k !== 'notes');
        const vals = keys.map((k) => (k === 'ownerId' ? ownerId : (rec as any)[k] ?? null));
        await client.query(
          `UPDATE properties SET ${keys.map((k, i) => `${PROPERTY_COLS[k]}=$${i + 3}`).join(',')}, provenance=$${keys.length + 3}::jsonb
            WHERE id=$1 AND organization_id=$2`,
          [existing.rows[0].id, ctx.orgId, ...vals, JSON.stringify(provenance)]);
        updated++;
      } else {
        await createProperty(client, ctx, { ...rec, ownerId } as any, provenance);
        inserted++;
      }
    }
  });
  res.status(201).json({ inserted, updated, total: parsed.length });
}));

// ----------------------------------------------------------------- owners routes
const OWNER_SORTS: Record<string, string> = { name: 'po.name', created: 'po.created_at', portfolio: 'portfolio_value' };

propertiesRouter.get('/owners', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'po.organization_id');
  w.add(q.archived === 'true' ? 'po.archived_at IS NOT NULL' : 'po.archived_at IS NULL');
  if (q.q?.trim()) { const like = `%${likeEscape(q.q.trim())}%`; w.add('(po.name ILIKE ? OR po.mailing_address ILIKE ? OR po.mailing_city ILIKE ?)', like, like, like); }
  if (q.entityType) w.add('po.entity_type = ?', q.entityType);
  const order = `${OWNER_SORTS[q.sort] ?? 'po.name'} ${q.dir === 'desc' ? 'DESC' : 'ASC'}, po.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM property_owners po WHERE ${w.sql}`, w.params);
  // Property counts and portfolio value are derived from properties, never trusted from stored columns.
  const rows = await db.query(
    `SELECT po.*, agg.properties_count, agg.portfolio_value, agg.portfolio_equity
       FROM property_owners po
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS properties_count, COALESCE(sum(estimated_value),0) AS portfolio_value,
                COALESCE(sum(estimated_equity),0) AS portfolio_equity
           FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id AND p.archived_at IS NULL) agg ON true
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  const items = camelRows<any>(rows.rows).map((o) => ({ ...o, portfolioValue: Number(o.portfolioValue), portfolioEquity: Number(o.portfolioEquity) }));
  return { items, total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/owners', route('crm:write', async (req, res, ctx) => {
  const owner = await createOwner(getDb(), ctx, ownerCreate.parse(req.body));
  res.status(201).json({ owner });
}));

propertiesRouter.get('/owners/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const o = await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!o.rows.length) throw notFound('Owner');
  const [properties, contacts, leads, notes, activity] = await Promise.all([
    db.query('SELECT * FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY created_at DESC', [ctx.orgId, id]),
    db.query('SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, id]),
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.property_owner_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_owner_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND property_owner_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  const props = camelRows<any>(properties.rows);
  const owner = camel<any>(o.rows[0])!;
  owner.propertiesCount = props.filter((p) => !p.archivedAt).length;
  owner.portfolioValue = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedValue, 0);
  owner.portfolioEquity = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedEquity, 0);
  return { owner, properties: props, contacts: camelRows(contacts.rows), leads: camelRows(leads.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows) };
}));

propertiesRouter.patch('/owners/:id', route('crm:write', async (req, _res, ctx) => {
  const input = presentOnly(ownerUpdate.parse(req.body), req.body);
  const cols: Record<string, string> = {
    name: 'name', entityType: 'entity_type', mailingAddress: 'mailing_address', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZip: 'mailing_zip', phoneNumbers: 'phone_numbers',
    emailAddresses: 'email_addresses', notes: 'notes', tags: 'tags',
  };
  const jsonCols = new Set(['phoneNumbers', 'emailAddresses', 'tags']);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    let v = (input as any)[k];
    if (v === undefined) continue;
    if (k === 'mailingState' && v) v = String(v).toUpperCase();
    params.push(jsonCols.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col}=$${params.length}${jsonCols.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(
    `UPDATE property_owners SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, 'owner.updated', `Owner ${r.rows[0].name} updated`, { ownerId: r.rows[0].id }, { fields: Object.keys(input) });
  return { owner: camel(r.rows[0]) };
}));

propertiesRouter.post('/owners/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE property_owners SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, restore ? 'owner.restored' : 'owner.archived', `Owner ${r.rows[0].name} ${restore ? 'restored' : 'archived'}`, { ownerId: r.rows[0].id });
  return { owner: camel(r.rows[0]) };
}));
 + (start + 2) + ' OR p.situs_zip ILIKE propertiesRouter.get('/properties', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = propertyFilters(ctx, q);
  const order = `${SORTS[q.sort] ?? 'p.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, p.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM properties p LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT p.*, po.name AS owner_name, po.entity_type AS owner_type,
            (SELECT count(*)::int FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS lead_count,
            (SELECT max(l.lead_score) FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS top_lead_score
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/properties', route('crm:write', async (req, res, ctx) => {
  const input = propertyCreate.parse(req.body);
  const property = await withTx(async (client) => createProperty(client, ctx, input));
  await emit(ctx, 'property.identified', { property });
  res.status(201).json({ property });
}));

propertiesRouter.get('/properties/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const p = await db.query(
    `SELECT p.*, po.name AS owner_name FROM properties p
       LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2`, [id, ctx.orgId]);
  if (!p.rows.length) throw notFound('Property');
  const ownerId = p.rows[0].owner_id;
  const [owner, leads, contacts, tasks, calls, notes, activity] = await Promise.all([
    ownerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name FROM leads l
                LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.organization_id=$1 AND l.primary_property_id=$2
               ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    ownerId ? db.query(`SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL`, [ctx.orgId, ownerId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND property_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND property_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
  ]);
  const property = camel<any>(p.rows[0])!;
  return {
    property, owner: camel(owner.rows[0]), leads: camelRows(leads.rows), contacts: camelRows(contacts.rows),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows),
    activity: camelRows(activity.rows), sources: property.provenance && Object.keys(property.provenance).length ? [property.provenance] : [],
  };
}));

propertiesRouter.patch('/properties/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(propertyUpdate.parse(req.body), req.body);
  if (input.ownerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(PROPERTY_COLS)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  let r;
  try {
    r = await db.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  } catch (e: any) {
    if (e.code === '23505') throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
    throw e;
  }
  if (!r.rows.length) throw notFound('Property');
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.updated', `Property ${property.address} updated`,
    { propertyId: id, ownerId: property.ownerId }, { fields: Object.keys(input) });
  return { property };
}));

propertiesRouter.post('/properties/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE properties SET archived_at=${restore ? 'NULL' : 'now()'} WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Property');
  await logActivity(getDb(), ctx, restore ? 'property.restored' : 'property.archived',
    `Property ${r.rows[0].address} ${restore ? 'restored' : 'archived'}`, { propertyId: r.rows[0].id, ownerId: r.rows[0].owner_id });
  return { property: camel(r.rows[0]) };
}));

/** Convenience: score the property and open (or update) a lead for it. */
propertiesRouter.post('/properties/:id/lead', route('crm:write', async (req, res, ctx) => {
  const { lead, created } = await createLead(getDb(), ctx, { propertyId: String(req.params.id), source: 'property_intelligence' }, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead, created });
}));

// ----------------------------------------------------------------- import
const importRecord = propertyCreate.extend({
  owner: z.object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(ENTITY_TYPES).optional(),
    mailingAddress: z.string().max(200).nullish(),
    mailingCity: z.string().max(100).nullish(),
    mailingState: z.string().max(2).nullish(),
    mailingZip: z.string().max(10).nullish(),
  }).nullish(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});

propertiesRouter.post('/properties/import', route('crm:write', async (req, res, ctx) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) throw badRequest('records array is required');
  if (records.length > 5000) throw Object.assign(new Error('Import limited to 5,000 records per request.'), { status: 413 });
  const parsed = records.map((r: unknown, i: number) => {
    const result = importRecord.safeParse(r);
    if (!result.success) throw badRequest(`Record ${i + 1}: ${result.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
    return result.data;
  });
  let inserted = 0, updated = 0;
  await withTx(async (client) => {
    for (const rec of parsed) {
      let ownerId = rec.ownerId ?? null;
      if (rec.owner) {
        const found = await client.query('SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1', [ctx.orgId, rec.owner.name]);
        ownerId = found.rows[0]?.id ?? (await createOwner(client, ctx, ownerCreate.parse({
          name: rec.owner.name, entityType: rec.owner.entityType ?? 'individual', mailingAddress: rec.owner.mailingAddress,
          mailingCity: rec.owner.mailingCity, mailingState: rec.owner.mailingState, mailingZip: rec.owner.mailingZip,
        }))).id;
      }
      const existing = await client.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, rec.apn]);
      const provenance = rec.provenance ?? { source: 'import', importedAt: new Date().toISOString() };
      if (existing.rows.length) {
        const keys = Object.keys(PROPERTY_COLS).filter((k) => k !== 'tags' && k !== 'notes');
        const vals = keys.map((k) => (k === 'ownerId' ? ownerId : (rec as any)[k] ?? null));
        await client.query(
          `UPDATE properties SET ${keys.map((k, i) => `${PROPERTY_COLS[k]}=$${i + 3}`).join(',')}, provenance=$${keys.length + 3}::jsonb
            WHERE id=$1 AND organization_id=$2`,
          [existing.rows[0].id, ctx.orgId, ...vals, JSON.stringify(provenance)]);
        updated++;
      } else {
        await createProperty(client, ctx, { ...rec, ownerId } as any, provenance);
        inserted++;
      }
    }
  });
  res.status(201).json({ inserted, updated, total: parsed.length });
}));

// ----------------------------------------------------------------- owners routes
const OWNER_SORTS: Record<string, string> = { name: 'po.name', created: 'po.created_at', portfolio: 'portfolio_value' };

propertiesRouter.get('/owners', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'po.organization_id');
  w.add(q.archived === 'true' ? 'po.archived_at IS NOT NULL' : 'po.archived_at IS NULL');
  if (q.q?.trim()) { const like = `%${likeEscape(q.q.trim())}%`; w.add('(po.name ILIKE ? OR po.mailing_address ILIKE ? OR po.mailing_city ILIKE ?)', like, like, like); }
  if (q.entityType) w.add('po.entity_type = ?', q.entityType);
  const order = `${OWNER_SORTS[q.sort] ?? 'po.name'} ${q.dir === 'desc' ? 'DESC' : 'ASC'}, po.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM property_owners po WHERE ${w.sql}`, w.params);
  // Property counts and portfolio value are derived from properties, never trusted from stored columns.
  const rows = await db.query(
    `SELECT po.*, agg.properties_count, agg.portfolio_value, agg.portfolio_equity
       FROM property_owners po
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS properties_count, COALESCE(sum(estimated_value),0) AS portfolio_value,
                COALESCE(sum(estimated_equity),0) AS portfolio_equity
           FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id AND p.archived_at IS NULL) agg ON true
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  const items = camelRows<any>(rows.rows).map((o) => ({ ...o, portfolioValue: Number(o.portfolioValue), portfolioEquity: Number(o.portfolioEquity) }));
  return { items, total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/owners', route('crm:write', async (req, res, ctx) => {
  const owner = await createOwner(getDb(), ctx, ownerCreate.parse(req.body));
  res.status(201).json({ owner });
}));

propertiesRouter.get('/owners/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const o = await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!o.rows.length) throw notFound('Owner');
  const [properties, contacts, leads, notes, activity] = await Promise.all([
    db.query('SELECT * FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY created_at DESC', [ctx.orgId, id]),
    db.query('SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, id]),
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.property_owner_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_owner_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND property_owner_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  const props = camelRows<any>(properties.rows);
  const owner = camel<any>(o.rows[0])!;
  owner.propertiesCount = props.filter((p) => !p.archivedAt).length;
  owner.portfolioValue = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedValue, 0);
  owner.portfolioEquity = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedEquity, 0);
  return { owner, properties: props, contacts: camelRows(contacts.rows), leads: camelRows(leads.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows) };
}));

propertiesRouter.patch('/owners/:id', route('crm:write', async (req, _res, ctx) => {
  const input = presentOnly(ownerUpdate.parse(req.body), req.body);
  const cols: Record<string, string> = {
    name: 'name', entityType: 'entity_type', mailingAddress: 'mailing_address', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZip: 'mailing_zip', phoneNumbers: 'phone_numbers',
    emailAddresses: 'email_addresses', notes: 'notes', tags: 'tags',
  };
  const jsonCols = new Set(['phoneNumbers', 'emailAddresses', 'tags']);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    let v = (input as any)[k];
    if (v === undefined) continue;
    if (k === 'mailingState' && v) v = String(v).toUpperCase();
    params.push(jsonCols.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col}=$${params.length}${jsonCols.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(
    `UPDATE property_owners SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, 'owner.updated', `Owner ${r.rows[0].name} updated`, { ownerId: r.rows[0].id }, { fields: Object.keys(input) });
  return { owner: camel(r.rows[0]) };
}));

propertiesRouter.post('/owners/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE property_owners SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, restore ? 'owner.restored' : 'owner.archived', `Owner ${r.rows[0].name} ${restore ? 'restored' : 'archived'}`, { ownerId: r.rows[0].id });
  return { owner: camel(r.rows[0]) };
}));
 + (start + 3) +
      ' OR p.owner_name ILIKE propertiesRouter.get('/properties', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = propertyFilters(ctx, q);
  const order = `${SORTS[q.sort] ?? 'p.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, p.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM properties p LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT p.*, po.name AS owner_name, po.entity_type AS owner_type,
            (SELECT count(*)::int FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS lead_count,
            (SELECT max(l.lead_score) FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS top_lead_score
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/properties', route('crm:write', async (req, res, ctx) => {
  const input = propertyCreate.parse(req.body);
  const property = await withTx(async (client) => createProperty(client, ctx, input));
  await emit(ctx, 'property.identified', { property });
  res.status(201).json({ property });
}));

propertiesRouter.get('/properties/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const p = await db.query(
    `SELECT p.*, po.name AS owner_name FROM properties p
       LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2`, [id, ctx.orgId]);
  if (!p.rows.length) throw notFound('Property');
  const ownerId = p.rows[0].owner_id;
  const [owner, leads, contacts, tasks, calls, notes, activity] = await Promise.all([
    ownerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name FROM leads l
                LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.organization_id=$1 AND l.primary_property_id=$2
               ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    ownerId ? db.query(`SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL`, [ctx.orgId, ownerId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND property_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND property_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
  ]);
  const property = camel<any>(p.rows[0])!;
  return {
    property, owner: camel(owner.rows[0]), leads: camelRows(leads.rows), contacts: camelRows(contacts.rows),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows),
    activity: camelRows(activity.rows), sources: property.provenance && Object.keys(property.provenance).length ? [property.provenance] : [],
  };
}));

propertiesRouter.patch('/properties/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(propertyUpdate.parse(req.body), req.body);
  if (input.ownerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(PROPERTY_COLS)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  let r;
  try {
    r = await db.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  } catch (e: any) {
    if (e.code === '23505') throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
    throw e;
  }
  if (!r.rows.length) throw notFound('Property');
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.updated', `Property ${property.address} updated`,
    { propertyId: id, ownerId: property.ownerId }, { fields: Object.keys(input) });
  return { property };
}));

propertiesRouter.post('/properties/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE properties SET archived_at=${restore ? 'NULL' : 'now()'} WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Property');
  await logActivity(getDb(), ctx, restore ? 'property.restored' : 'property.archived',
    `Property ${r.rows[0].address} ${restore ? 'restored' : 'archived'}`, { propertyId: r.rows[0].id, ownerId: r.rows[0].owner_id });
  return { property: camel(r.rows[0]) };
}));

/** Convenience: score the property and open (or update) a lead for it. */
propertiesRouter.post('/properties/:id/lead', route('crm:write', async (req, res, ctx) => {
  const { lead, created } = await createLead(getDb(), ctx, { propertyId: String(req.params.id), source: 'property_intelligence' }, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead, created });
}));

// ----------------------------------------------------------------- import
const importRecord = propertyCreate.extend({
  owner: z.object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(ENTITY_TYPES).optional(),
    mailingAddress: z.string().max(200).nullish(),
    mailingCity: z.string().max(100).nullish(),
    mailingState: z.string().max(2).nullish(),
    mailingZip: z.string().max(10).nullish(),
  }).nullish(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});

propertiesRouter.post('/properties/import', route('crm:write', async (req, res, ctx) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) throw badRequest('records array is required');
  if (records.length > 5000) throw Object.assign(new Error('Import limited to 5,000 records per request.'), { status: 413 });
  const parsed = records.map((r: unknown, i: number) => {
    const result = importRecord.safeParse(r);
    if (!result.success) throw badRequest(`Record ${i + 1}: ${result.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
    return result.data;
  });
  let inserted = 0, updated = 0;
  await withTx(async (client) => {
    for (const rec of parsed) {
      let ownerId = rec.ownerId ?? null;
      if (rec.owner) {
        const found = await client.query('SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1', [ctx.orgId, rec.owner.name]);
        ownerId = found.rows[0]?.id ?? (await createOwner(client, ctx, ownerCreate.parse({
          name: rec.owner.name, entityType: rec.owner.entityType ?? 'individual', mailingAddress: rec.owner.mailingAddress,
          mailingCity: rec.owner.mailingCity, mailingState: rec.owner.mailingState, mailingZip: rec.owner.mailingZip,
        }))).id;
      }
      const existing = await client.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, rec.apn]);
      const provenance = rec.provenance ?? { source: 'import', importedAt: new Date().toISOString() };
      if (existing.rows.length) {
        const keys = Object.keys(PROPERTY_COLS).filter((k) => k !== 'tags' && k !== 'notes');
        const vals = keys.map((k) => (k === 'ownerId' ? ownerId : (rec as any)[k] ?? null));
        await client.query(
          `UPDATE properties SET ${keys.map((k, i) => `${PROPERTY_COLS[k]}=$${i + 3}`).join(',')}, provenance=$${keys.length + 3}::jsonb
            WHERE id=$1 AND organization_id=$2`,
          [existing.rows[0].id, ctx.orgId, ...vals, JSON.stringify(provenance)]);
        updated++;
      } else {
        await createProperty(client, ctx, { ...rec, ownerId } as any, provenance);
        inserted++;
      }
    }
  });
  res.status(201).json({ inserted, updated, total: parsed.length });
}));

// ----------------------------------------------------------------- owners routes
const OWNER_SORTS: Record<string, string> = { name: 'po.name', created: 'po.created_at', portfolio: 'portfolio_value' };

propertiesRouter.get('/owners', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'po.organization_id');
  w.add(q.archived === 'true' ? 'po.archived_at IS NOT NULL' : 'po.archived_at IS NULL');
  if (q.q?.trim()) { const like = `%${likeEscape(q.q.trim())}%`; w.add('(po.name ILIKE ? OR po.mailing_address ILIKE ? OR po.mailing_city ILIKE ?)', like, like, like); }
  if (q.entityType) w.add('po.entity_type = ?', q.entityType);
  const order = `${OWNER_SORTS[q.sort] ?? 'po.name'} ${q.dir === 'desc' ? 'DESC' : 'ASC'}, po.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM property_owners po WHERE ${w.sql}`, w.params);
  // Property counts and portfolio value are derived from properties, never trusted from stored columns.
  const rows = await db.query(
    `SELECT po.*, agg.properties_count, agg.portfolio_value, agg.portfolio_equity
       FROM property_owners po
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS properties_count, COALESCE(sum(estimated_value),0) AS portfolio_value,
                COALESCE(sum(estimated_equity),0) AS portfolio_equity
           FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id AND p.archived_at IS NULL) agg ON true
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  const items = camelRows<any>(rows.rows).map((o) => ({ ...o, portfolioValue: Number(o.portfolioValue), portfolioEquity: Number(o.portfolioEquity) }));
  return { items, total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/owners', route('crm:write', async (req, res, ctx) => {
  const owner = await createOwner(getDb(), ctx, ownerCreate.parse(req.body));
  res.status(201).json({ owner });
}));

propertiesRouter.get('/owners/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const o = await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!o.rows.length) throw notFound('Owner');
  const [properties, contacts, leads, notes, activity] = await Promise.all([
    db.query('SELECT * FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY created_at DESC', [ctx.orgId, id]),
    db.query('SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, id]),
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.property_owner_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_owner_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND property_owner_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  const props = camelRows<any>(properties.rows);
  const owner = camel<any>(o.rows[0])!;
  owner.propertiesCount = props.filter((p) => !p.archivedAt).length;
  owner.portfolioValue = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedValue, 0);
  owner.portfolioEquity = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedEquity, 0);
  return { owner, properties: props, contacts: camelRows(contacts.rows), leads: camelRows(leads.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows) };
}));

propertiesRouter.patch('/owners/:id', route('crm:write', async (req, _res, ctx) => {
  const input = presentOnly(ownerUpdate.parse(req.body), req.body);
  const cols: Record<string, string> = {
    name: 'name', entityType: 'entity_type', mailingAddress: 'mailing_address', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZip: 'mailing_zip', phoneNumbers: 'phone_numbers',
    emailAddresses: 'email_addresses', notes: 'notes', tags: 'tags',
  };
  const jsonCols = new Set(['phoneNumbers', 'emailAddresses', 'tags']);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    let v = (input as any)[k];
    if (v === undefined) continue;
    if (k === 'mailingState' && v) v = String(v).toUpperCase();
    params.push(jsonCols.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col}=$${params.length}${jsonCols.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(
    `UPDATE property_owners SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, 'owner.updated', `Owner ${r.rows[0].name} updated`, { ownerId: r.rows[0].id }, { fields: Object.keys(input) });
  return { owner: camel(r.rows[0]) };
}));

propertiesRouter.post('/owners/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE property_owners SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, restore ? 'owner.restored' : 'owner.archived', `Owner ${r.rows[0].name} ${restore ? 'restored' : 'archived'}`, { ownerId: r.rows[0].id });
  return { owner: camel(r.rows[0]) };
}));
 + (start + 4) + ')');
  }

  const limit = Math.min(Math.max(Number(q.limit) || 25, 1), 100);
  const offset = Math.max(Number(q.offset) || 0, 0);
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const db = getDb();
  const total = await db.query('SELECT count(*)::int AS n FROM core.parcels p' + whereSql, values);
  const rows = await db.query(
    `SELECT p.*,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'signalType', s.signal_type, 'observedOn', s.observed_on, 'value', s.value
      ) ORDER BY s.observed_on DESC) FROM core.signals s
       WHERE s.county_fips=p.county_fips AND s.apn=p.apn), '[]'::jsonb) AS signals
     FROM core.parcels p` + whereSql +
     ' ORDER BY p.situs_city NULLS LAST, p.situs_address NULLS LAST, p.apn LIMIT ' + limit + ' OFFSET ' + offset,
    values,
  );

  return {
    items: rows.rows.map((r: any) => ({
      ...camel(r),
      countyName: PUBLIC_RECORD_COUNTIES[r.county_fips] ?? r.county_fips,
      source: 'california_public_records',
    })),
    total: total.rows[0].n,
    limit,
    offset,
  };
}));

propertiesRouter.get('/properties', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = propertyFilters(ctx, q);
  const order = `${SORTS[q.sort] ?? 'p.created_at'} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, p.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const from = `FROM properties p LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id`;
  const total = await db.query(`SELECT count(*)::int AS n ${from} WHERE ${w.sql}`, w.params);
  const rows = await db.query(
    `SELECT p.*, po.name AS owner_name, po.entity_type AS owner_type,
            (SELECT count(*)::int FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS lead_count,
            (SELECT max(l.lead_score) FROM leads l WHERE l.primary_property_id=p.id AND l.archived_at IS NULL) AS top_lead_score
       ${from} WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  return { items: camelRows(rows.rows), total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/properties', route('crm:write', async (req, res, ctx) => {
  const input = propertyCreate.parse(req.body);
  const property = await withTx(async (client) => createProperty(client, ctx, input));
  await emit(ctx, 'property.identified', { property });
  res.status(201).json({ property });
}));

propertiesRouter.get('/properties/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const p = await db.query(
    `SELECT p.*, po.name AS owner_name FROM properties p
       LEFT JOIN property_owners po ON po.id=p.owner_id AND po.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2`, [id, ctx.orgId]);
  if (!p.rows.length) throw notFound('Property');
  const ownerId = p.rows[0].owner_id;
  const [owner, leads, contacts, tasks, calls, notes, activity] = await Promise.all([
    ownerId ? db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [ownerId, ctx.orgId]) : { rows: [] },
    db.query(`SELECT l.*, c.first_name || ' ' || c.last_name AS contact_name FROM leads l
                LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.organization_id=$1 AND l.primary_property_id=$2
               ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    ownerId ? db.query(`SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL`, [ctx.orgId, ownerId]) : { rows: [] },
    db.query(`SELECT * FROM tasks WHERE organization_id=$1 AND property_id=$2 ORDER BY status='open' DESC, due_at NULLS LAST LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM calls WHERE organization_id=$1 AND property_id=$2 ORDER BY started_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query(`SELECT * FROM activities WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50`, [ctx.orgId, id]),
  ]);
  const property = camel<any>(p.rows[0])!;
  return {
    property, owner: camel(owner.rows[0]), leads: camelRows(leads.rows), contacts: camelRows(contacts.rows),
    tasks: camelRows(tasks.rows), calls: camelRows(calls.rows), notes: camelRows(notes.rows),
    activity: camelRows(activity.rows), sources: property.provenance && Object.keys(property.provenance).length ? [property.provenance] : [],
  };
}));

propertiesRouter.patch('/properties/:id', route('crm:write', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const input = presentOnly(propertyUpdate.parse(req.body), req.body);
  if (input.ownerId !== undefined) await assertRef(db, ctx.orgId, 'owners', input.ownerId, 'owner');
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(PROPERTY_COLS)) {
    if ((input as any)[k] === undefined) continue;
    params.push(k === 'tags' ? JSON.stringify((input as any)[k]) : (input as any)[k]);
    sets.push(`${col}=$${params.length}${k === 'tags' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(id, ctx.orgId);
  let r;
  try {
    r = await db.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  } catch (e: any) {
    if (e.code === '23505') throw Object.assign(new Error('A property with this APN already exists'), { status: 409 });
    throw e;
  }
  if (!r.rows.length) throw notFound('Property');
  const property = camel<any>(r.rows[0])!;
  await logActivity(db, ctx, 'property.updated', `Property ${property.address} updated`,
    { propertyId: id, ownerId: property.ownerId }, { fields: Object.keys(input) });
  return { property };
}));

propertiesRouter.post('/properties/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE properties SET archived_at=${restore ? 'NULL' : 'now()'} WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Property');
  await logActivity(getDb(), ctx, restore ? 'property.restored' : 'property.archived',
    `Property ${r.rows[0].address} ${restore ? 'restored' : 'archived'}`, { propertyId: r.rows[0].id, ownerId: r.rows[0].owner_id });
  return { property: camel(r.rows[0]) };
}));

/** Convenience: score the property and open (or update) a lead for it. */
propertiesRouter.post('/properties/:id/lead', route('crm:write', async (req, res, ctx) => {
  const { lead, created } = await createLead(getDb(), ctx, { propertyId: String(req.params.id), source: 'property_intelligence' }, { dedupe: true });
  res.status(created ? 201 : 200).json({ lead, created });
}));

// ----------------------------------------------------------------- import
const importRecord = propertyCreate.extend({
  owner: z.object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(ENTITY_TYPES).optional(),
    mailingAddress: z.string().max(200).nullish(),
    mailingCity: z.string().max(100).nullish(),
    mailingState: z.string().max(2).nullish(),
    mailingZip: z.string().max(10).nullish(),
  }).nullish(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});

propertiesRouter.post('/properties/import', route('crm:write', async (req, res, ctx) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) throw badRequest('records array is required');
  if (records.length > 5000) throw Object.assign(new Error('Import limited to 5,000 records per request.'), { status: 413 });
  const parsed = records.map((r: unknown, i: number) => {
    const result = importRecord.safeParse(r);
    if (!result.success) throw badRequest(`Record ${i + 1}: ${result.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
    return result.data;
  });
  let inserted = 0, updated = 0;
  await withTx(async (client) => {
    for (const rec of parsed) {
      let ownerId = rec.ownerId ?? null;
      if (rec.owner) {
        const found = await client.query('SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1', [ctx.orgId, rec.owner.name]);
        ownerId = found.rows[0]?.id ?? (await createOwner(client, ctx, ownerCreate.parse({
          name: rec.owner.name, entityType: rec.owner.entityType ?? 'individual', mailingAddress: rec.owner.mailingAddress,
          mailingCity: rec.owner.mailingCity, mailingState: rec.owner.mailingState, mailingZip: rec.owner.mailingZip,
        }))).id;
      }
      const existing = await client.query('SELECT id FROM properties WHERE organization_id=$1 AND apn=$2', [ctx.orgId, rec.apn]);
      const provenance = rec.provenance ?? { source: 'import', importedAt: new Date().toISOString() };
      if (existing.rows.length) {
        const keys = Object.keys(PROPERTY_COLS).filter((k) => k !== 'tags' && k !== 'notes');
        const vals = keys.map((k) => (k === 'ownerId' ? ownerId : (rec as any)[k] ?? null));
        await client.query(
          `UPDATE properties SET ${keys.map((k, i) => `${PROPERTY_COLS[k]}=$${i + 3}`).join(',')}, provenance=$${keys.length + 3}::jsonb
            WHERE id=$1 AND organization_id=$2`,
          [existing.rows[0].id, ctx.orgId, ...vals, JSON.stringify(provenance)]);
        updated++;
      } else {
        await createProperty(client, ctx, { ...rec, ownerId } as any, provenance);
        inserted++;
      }
    }
  });
  res.status(201).json({ inserted, updated, total: parsed.length });
}));

// ----------------------------------------------------------------- owners routes
const OWNER_SORTS: Record<string, string> = { name: 'po.name', created: 'po.created_at', portfolio: 'portfolio_value' };

propertiesRouter.get('/owners', route('crm:read', async (req, _res, ctx) => {
  const q = req.query as Record<string, string>;
  const w = new Where(ctx.orgId, 'po.organization_id');
  w.add(q.archived === 'true' ? 'po.archived_at IS NOT NULL' : 'po.archived_at IS NULL');
  if (q.q?.trim()) { const like = `%${likeEscape(q.q.trim())}%`; w.add('(po.name ILIKE ? OR po.mailing_address ILIKE ? OR po.mailing_city ILIKE ?)', like, like, like); }
  if (q.entityType) w.add('po.entity_type = ?', q.entityType);
  const order = `${OWNER_SORTS[q.sort] ?? 'po.name'} ${q.dir === 'desc' ? 'DESC' : 'ASC'}, po.id`;
  const { limit, offset } = pageParams(q);
  const db = getDb();
  const total = await db.query(`SELECT count(*)::int AS n FROM property_owners po WHERE ${w.sql}`, w.params);
  // Property counts and portfolio value are derived from properties, never trusted from stored columns.
  const rows = await db.query(
    `SELECT po.*, agg.properties_count, agg.portfolio_value, agg.portfolio_equity
       FROM property_owners po
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS properties_count, COALESCE(sum(estimated_value),0) AS portfolio_value,
                COALESCE(sum(estimated_equity),0) AS portfolio_equity
           FROM properties p WHERE p.owner_id=po.id AND p.organization_id=po.organization_id AND p.archived_at IS NULL) agg ON true
      WHERE ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, w.params);
  const items = camelRows<any>(rows.rows).map((o) => ({ ...o, portfolioValue: Number(o.portfolioValue), portfolioEquity: Number(o.portfolioEquity) }));
  return { items, total: total.rows[0].n, limit, offset };
}));

propertiesRouter.post('/owners', route('crm:write', async (req, res, ctx) => {
  const owner = await createOwner(getDb(), ctx, ownerCreate.parse(req.body));
  res.status(201).json({ owner });
}));

propertiesRouter.get('/owners/:id', route('crm:read', async (req, _res, ctx) => {
  const db = getDb();
  const id = String(req.params.id);
  const o = await db.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2', [id, ctx.orgId]);
  if (!o.rows.length) throw notFound('Owner');
  const [properties, contacts, leads, notes, activity] = await Promise.all([
    db.query('SELECT * FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY created_at DESC', [ctx.orgId, id]),
    db.query('SELECT * FROM contacts WHERE organization_id=$1 AND property_owner_id=$2 AND archived_at IS NULL', [ctx.orgId, id]),
    db.query(`SELECT l.*, p.address AS property_address FROM leads l LEFT JOIN properties p ON p.id=l.primary_property_id
               WHERE l.organization_id=$1 AND l.property_owner_id=$2 ORDER BY l.updated_at DESC`, [ctx.orgId, id]),
    db.query(`SELECT n.*, u.name AS author_name FROM notes n LEFT JOIN users u ON u.id=n.author_id
               WHERE n.organization_id=$1 AND n.property_owner_id=$2 ORDER BY n.created_at DESC LIMIT 50`, [ctx.orgId, id]),
    db.query('SELECT * FROM activities WHERE organization_id=$1 AND property_owner_id=$2 ORDER BY created_at DESC LIMIT 50', [ctx.orgId, id]),
  ]);
  const props = camelRows<any>(properties.rows);
  const owner = camel<any>(o.rows[0])!;
  owner.propertiesCount = props.filter((p) => !p.archivedAt).length;
  owner.portfolioValue = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedValue, 0);
  owner.portfolioEquity = props.filter((p) => !p.archivedAt).reduce((s, p) => s + p.estimatedEquity, 0);
  return { owner, properties: props, contacts: camelRows(contacts.rows), leads: camelRows(leads.rows), notes: camelRows(notes.rows), activity: camelRows(activity.rows) };
}));

propertiesRouter.patch('/owners/:id', route('crm:write', async (req, _res, ctx) => {
  const input = presentOnly(ownerUpdate.parse(req.body), req.body);
  const cols: Record<string, string> = {
    name: 'name', entityType: 'entity_type', mailingAddress: 'mailing_address', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZip: 'mailing_zip', phoneNumbers: 'phone_numbers',
    emailAddresses: 'email_addresses', notes: 'notes', tags: 'tags',
  };
  const jsonCols = new Set(['phoneNumbers', 'emailAddresses', 'tags']);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    let v = (input as any)[k];
    if (v === undefined) continue;
    if (k === 'mailingState' && v) v = String(v).toUpperCase();
    params.push(jsonCols.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col}=$${params.length}${jsonCols.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw badRequest('No fields to update');
  params.push(String(req.params.id), ctx.orgId);
  const r = await getDb().query(
    `UPDATE property_owners SET ${sets.join(',')}, updated_at=now() WHERE id=$${params.length - 1} AND organization_id=$${params.length} RETURNING *`, params);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, 'owner.updated', `Owner ${r.rows[0].name} updated`, { ownerId: r.rows[0].id }, { fields: Object.keys(input) });
  return { owner: camel(r.rows[0]) };
}));

propertiesRouter.post('/owners/:id/archive', route('crm:write', async (req, _res, ctx) => {
  const restore = req.body?.restore === true;
  const r = await getDb().query(
    `UPDATE property_owners SET archived_at=${restore ? 'NULL' : 'now()'}, updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING *`,
    [String(req.params.id), ctx.orgId]);
  if (!r.rows.length) throw notFound('Owner');
  await logActivity(getDb(), ctx, restore ? 'owner.restored' : 'owner.archived', `Owner ${r.rows[0].name} ${restore ? 'restored' : 'archived'}`, { ownerId: r.rows[0].id });
  return { owner: camel(r.rows[0]) };
}));

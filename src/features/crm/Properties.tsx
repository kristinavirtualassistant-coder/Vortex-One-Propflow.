import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Bot, Plus, RotateCcw, Target } from 'lucide-react';
import { api, errorMessage } from './api';
import { fullName, money, num, titleCase } from './format';
import { ActivityTimeline, CallsTable, Facts, NotesPanel, RecordLink, Section, TasksPanel } from './shared';
import {
  Badge, Button, ConfirmDialog, DataTable, ErrorBanner, FormModal, Input, PageHeader, Pagination, Select, Spinner, StatusBadge,
  useFetch, useList, useToast, type Column, type FieldDef,
} from './ui';

const PROPERTY_TYPES = ['Single Family', 'Multi-Family', 'Condo', 'Townhouse', 'Commercial', 'Land', 'Mobile Home', 'Other'];
const ENTITY_TYPES = ['individual', 'llc', 'corporation', 'trust', 'partnership', 'other'];

const propertyFields: FieldDef[] = [
  { name: 'address', label: 'Street address', required: true, span: 2 },
  { name: 'city', label: 'City', required: true },
  { name: 'state', label: 'State (2 letters)', required: true },
  { name: 'zip', label: 'ZIP', required: true },
  { name: 'county', label: 'County', required: true },
  { name: 'apn', label: 'APN / parcel ID', required: true },
  { name: 'propertyType', label: 'Property type', type: 'select', required: true, options: PROPERTY_TYPES.map((v) => ({ value: v, label: v })) },
  { name: 'ownerId', label: 'Owner', type: 'record', record: 'owners' },
  { name: 'unitsCount', label: 'Units', type: 'number' },
  { name: 'squareFeet', label: 'Square feet', type: 'number' },
  { name: 'yearBuilt', label: 'Year built', type: 'number' },
  { name: 'bedrooms', label: 'Bedrooms', type: 'number' },
  { name: 'bathrooms', label: 'Bathrooms', type: 'number' },
  { name: 'latitude', label: 'Latitude', type: 'number' },
  { name: 'longitude', label: 'Longitude', type: 'number' },
  { name: 'estimatedValue', label: 'Estimated value ($)', type: 'number' },
  { name: 'estimatedEquity', label: 'Estimated equity ($)', type: 'number' },
  { name: 'mortgageBalance', label: 'Mortgage balance ($)', type: 'number' },
  { name: 'assessedTaxValue', label: 'Assessed value ($)', type: 'number' },
  { name: 'lastSaleDate', label: 'Last sale date', type: 'date' },
  { name: 'lastSalePrice', label: 'Last sale price ($)', type: 'number' },
  { name: 'taxDelinquent', label: 'Tax delinquent', type: 'checkbox' },
  { name: 'isAbsenteeOwner', label: 'Absentee owner', type: 'checkbox' },
  { name: 'isCorporateOwned', label: 'Corporate owned', type: 'checkbox' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
  { name: 'tags', label: 'Tags', type: 'tags' },
];

const numOrNull = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));
const toPropertyPayload = (v: Record<string, any>) => ({
  address: v.address, city: v.city, state: String(v.state ?? '').toUpperCase(), zip: v.zip, county: v.county, apn: v.apn, propertyType: v.propertyType,
  ownerId: v.ownerId || null, unitsCount: Number(v.unitsCount || 1), squareFeet: Number(v.squareFeet || 0), yearBuilt: numOrNull(v.yearBuilt),
  bedrooms: numOrNull(v.bedrooms), bathrooms: numOrNull(v.bathrooms), latitude: numOrNull(v.latitude), longitude: numOrNull(v.longitude),
  estimatedValue: Number(v.estimatedValue || 0), estimatedEquity: Number(v.estimatedEquity || 0), mortgageBalance: Number(v.mortgageBalance || 0),
  assessedTaxValue: Number(v.assessedTaxValue || 0), lastSaleDate: v.lastSaleDate || null, lastSalePrice: numOrNull(v.lastSalePrice),
  taxDelinquent: Boolean(v.taxDelinquent), isAbsenteeOwner: Boolean(v.isAbsenteeOwner), isCorporateOwned: Boolean(v.isCorporateOwned),
  notes: v.notes || null, tags: v.tags ?? [],
});

function PropertyForm({ property, ownerLabel, onClose, onSaved }: { property?: any; ownerLabel?: string; onClose: () => void; onSaved: (p: any) => void }) {
  const toast = useToast();
  const initial = property ? { ...property, lastSaleDate: property.lastSaleDate ? String(property.lastSaleDate).slice(0, 10) : '' } : { propertyType: 'Single Family', tags: [], unitsCount: 1 };
  const fields = propertyFields.map((f) => (f.name === 'ownerId' ? { ...f, recordLabel: ownerLabel } : f));
  return (
    <FormModal title={property ? 'Edit property' : 'New property'} fields={fields} wide initial={initial} submitLabel={property ? 'Save changes' : 'Create property'} onClose={onClose}
      onSubmit={async (v) => {
        const r = property ? await api.patch(`/properties/${property.id}`, toPropertyPayload(v)) : await api.post('/properties', toPropertyPayload(v));
        toast.success(property ? 'Property updated' : 'Property created');
        onSaved(r.property);
      }} />
  );
}

const Signals = ({ p }: { p: any }) => (
  <span className="flex flex-wrap gap-1">
    {p.taxDelinquent && <Badge tone="red">Tax delinquent</Badge>}{p.isAbsenteeOwner && <Badge tone="amber">Absentee</Badge>}{p.isCorporateOwned && <Badge tone="blue">Corporate</Badge>}
    {!p.taxDelinquent && !p.isAbsenteeOwner && !p.isCorporateOwned && <span className="text-slate-400">—</span>}
  </span>
);

export default function Properties() {
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const list = useList<any>('properties', { archived: showArchived ? 'true' : undefined });

  const columns: Column<any>[] = [
    { key: 'address', header: 'Property', sort: 'address', render: (p) => <div><div className="font-semibold text-slate-900 dark:text-white">{p.address}</div><div className="text-xs text-slate-500">{p.city}, {p.state} {p.zip} · APN {p.apn}</div></div> },
    { key: 'type', header: 'Type', render: (p) => p.propertyType },
    { key: 'owner', header: 'Owner', render: (p) => <RecordLink type="owner" id={p.ownerId}>{p.ownerName ?? '—'}</RecordLink> },
    { key: 'value', header: 'Value', sort: 'value', render: (p) => money(p.estimatedValue) },
    { key: 'equity', header: 'Equity', sort: 'equity', render: (p) => money(p.estimatedEquity) },
    { key: 'signals', header: 'Signals', render: (p) => <Signals p={p} /> },
    { key: 'lead', header: 'Lead', render: (p) => (p.leadCount ? <Badge tone="green">{p.leadCount} · score {p.topLeadScore}</Badge> : <span className="text-slate-400">None</span>) },
  ];

  return (
    <div>
      <PageHeader title="Properties" subtitle="Property intelligence: records, ownership and motivation signals. Demo data is fictional."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New property</Button>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[220px]"><Input aria-label="Search properties" value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Address, city, ZIP, APN or owner" /></div>
        <Input aria-label="State" className="w-24" maxLength={2} placeholder="State" value={list.filters.state ?? ''} onChange={(e) => list.setFilter('state', e.target.value)} />
        <Select aria-label="Property type" className="w-44" value={list.filters.propertyType ?? ''} onChange={(e) => list.setFilter('propertyType', e.target.value)}>
          <option value="">All types</option>{PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
        <Select aria-label="Lead status" className="w-40" value={list.filters.hasLead ?? ''} onChange={(e) => list.setFilter('hasLead', e.target.value)}>
          <option value="">Any lead status</option><option value="true">Has lead</option><option value="false">No lead</option></Select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={list.filters.taxDelinquent === 'true'} onChange={(e) => list.setFilter('taxDelinquent', e.target.checked ? 'true' : '')} /> Tax delinquent</label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={list.filters.absentee === 'true'} onChange={(e) => list.setFilter('absentee', e.target.checked ? 'true' : '')} /> Absentee</label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived</label>
      </div>
      <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} sort={list.sort} dir={list.dir} onSort={list.toggleSort}
        onRowClick={(p) => nav(`/dashboard/properties/${p.id}`)} emptyTitle={list.q || Object.values(list.filters).some(Boolean) ? 'No properties match your filters' : 'No properties yet'}
        emptyHint="Add a property manually, or load the demo workspace to explore sample data."
        emptyAction={<Button variant="primary" onClick={() => setCreating(true)}>New property</Button>} />
      {list.data && <Pagination total={list.data.total} limit={list.pageSize} offset={list.offset} onChange={list.setOffset} />}
      {creating && <PropertyForm onClose={() => setCreating(false)} onSaved={(p) => { list.reload(); nav(`/dashboard/properties/${p.id}`); }} />}
    </div>
  );
}

export function PropertyDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>(() => api.get(`/properties/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [brief, setBrief] = useState<any>(null);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <div className="space-y-3"><ErrorBanner message={error} onRetry={reload} /><Button onClick={() => nav('/dashboard/properties')}><ArrowLeft className="h-4 w-4" /> Back to properties</Button></div>;
  const { property: p, owner } = data;
  const archived = Boolean(p.archivedAt);

  const createLead = async () => {
    setBusy('lead');
    try { const r = await api.post(`/properties/${p.id}/lead`); toast.success(r.created ? 'Lead created and scored' : 'This property already has an open lead'); nav(`/dashboard/leads/${r.lead.id}`); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };
  const runIntel = async () => {
    setBusy('intel'); setBrief(null);
    try { const r = await api.post('/agents/property_intelligence/run', { input: { propertyId: p.id } }); if (r.status === 'completed') setBrief(r.output); else toast.error(r.error ?? 'Agent failed'); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => nav('/dashboard/properties')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Properties</button>
      <PageHeader title={p.address} subtitle={<span className="flex flex-wrap items-center gap-2">{p.city}, {p.state} {p.zip} · {p.county} County · APN {p.apn}{archived && <Badge>Archived</Badge>}</span>}
        actions={<>
          <Button variant="primary" loading={busy === 'lead'} disabled={archived} onClick={createLead}><Target className="h-4 w-4" /> Create lead</Button>
          <Button loading={busy === 'intel'} onClick={runIntel}><Bot className="h-4 w-4" /> Intelligence brief</Button>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button onClick={() => setArchiveOpen(true)}>{archived ? <><RotateCcw className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}</Button>
        </>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {brief && <div role="status" className="rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900 p-4 text-sm text-cyan-900 dark:text-cyan-100 space-y-2">
        <p>{brief.summary}</p>{brief.dataGaps.length > 0 && <p><b>Data gaps:</b> {brief.dataGaps.join('; ')}.</p>}<p className="text-xs opacity-70">Rule-based summary of stored records (no external model). Score {brief.score} ({brief.classification}).</p></div>}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Section title="Property facts">
            <Facts items={[['Type', p.propertyType], ['Units', num(p.unitsCount)], ['Square feet', num(p.squareFeet)], ['Year built', p.yearBuilt], ['Bed / bath', `${p.bedrooms ?? '—'} / ${p.bathrooms ?? '—'}`],
              ['Coordinates', p.latitude !== null && p.longitude !== null && p.latitude !== undefined ? `${p.latitude}, ${p.longitude}` : '—'],
              ['Estimated value', money(p.estimatedValue)], ['Estimated equity', money(p.estimatedEquity)], ['Mortgage balance', money(p.mortgageBalance)], ['Assessed value', money(p.assessedTaxValue)],
              ['Last sale', p.lastSaleDate ? `${String(p.lastSaleDate).slice(0, 10)} · ${money(p.lastSalePrice)}` : '—']]} />
            <div className="mt-4"><div className="text-xs text-slate-500 mb-1">Signals</div><Signals p={p} /></div>
            {data.sources.length > 0 && <p className="mt-4 text-xs text-slate-500">Source: {data.sources.map((s: any) => s.source ?? 'unknown').join(', ')}{data.sources[0]?.note ? ` — ${data.sources[0].note}` : ''}</p>}
          </Section>
          <Section title="Owner & contacts">
            {owner ? (
              <div className="space-y-3 text-sm">
                <div><RecordLink type="owner" id={owner.id}>{owner.name}</RecordLink> <Badge tone="violet">{titleCase(owner.entityType)}</Badge></div>
                <div className="text-slate-500">Mailing: {owner.mailingAddress ? `${owner.mailingAddress}, ${owner.mailingCity}, ${owner.mailingState} ${owner.mailingZip}` : '—'}</div>
                <div>{data.contacts.length ? data.contacts.map((c: any) => <div key={c.id}><RecordLink type="contact" id={c.id}>{fullName(c)}</RecordLink> · {c.phone ?? 'no phone'}</div>) : <span className="text-slate-500">No contact on file for this owner.</span>}</div>
              </div>
            ) : <p className="text-sm text-slate-500">No owner linked. Edit the property to link an owner record.</p>}
          </Section>
          <Section title="Leads">
            {data.leads.length ? <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">{data.leads.map((l: any) => <li key={l.id} className="py-2 flex items-center gap-3"><RecordLink type="lead" id={l.id}>{l.title}</RecordLink><span className="flex-1 text-xs text-slate-500">{l.contactName}</span><span className="font-semibold">{l.leadScore}</span><StatusBadge value={l.stage} /></li>)}</ul>
              : <p className="text-sm text-slate-500">No leads yet. “Create lead” scores this property from its record fields.</p>}
          </Section>
          <Section title="Calls"><CallsTable calls={data.calls} /></Section>
          <Section title="Notes"><NotesPanel notes={data.notes} refs={{ propertyId: p.id, ownerId: p.ownerId }} onChanged={reload} /></Section>
        </div>
        <div className="space-y-5">
          <Section title="Tasks"><TasksPanel tasks={data.tasks} refs={{ propertyId: p.id }} onChanged={reload} /></Section>
          <Section title="Activity"><ActivityTimeline items={data.activity} /></Section>
        </div>
      </div>
      {editing && <PropertyForm property={p} ownerLabel={owner?.name} onClose={() => setEditing(false)} onSaved={reload} />}
      {archiveOpen && <ConfirmDialog title={archived ? 'Restore property?' : 'Archive property?'} danger={!archived} confirmLabel={archived ? 'Restore' : 'Archive'}
        message={archived ? 'The property returns to lists and search.' : 'The property is hidden from lists and search. Leads and history are kept; you can restore it later.'} onClose={() => setArchiveOpen(false)}
        onConfirm={async () => { await api.post(`/properties/${p.id}/archive`, { restore: archived }); toast.success(archived ? 'Property restored' : 'Property archived'); reload(); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ owners
const ownerFields: FieldDef[] = [
  { name: 'name', label: 'Owner name', required: true, span: 2 },
  { name: 'entityType', label: 'Entity type', type: 'select', required: true, options: ENTITY_TYPES.map((v) => ({ value: v, label: titleCase(v) })) },
  { name: 'phoneNumbers', label: 'Phone numbers', type: 'tags', help: 'Press Enter after each number' },
  { name: 'emailAddresses', label: 'Email addresses', type: 'tags' },
  { name: 'mailingAddress', label: 'Mailing address', span: 2 },
  { name: 'mailingCity', label: 'City' },
  { name: 'mailingState', label: 'State' },
  { name: 'mailingZip', label: 'ZIP' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
  { name: 'tags', label: 'Tags', type: 'tags' },
];

function OwnerForm({ owner, onClose, onSaved }: { owner?: any; onClose: () => void; onSaved: (o: any) => void }) {
  const toast = useToast();
  return (
    <FormModal title={owner ? 'Edit owner' : 'New owner'} fields={ownerFields} wide initial={owner ? { ...owner } : { entityType: 'individual', phoneNumbers: [], emailAddresses: [], tags: [] }}
      submitLabel={owner ? 'Save changes' : 'Create owner'} onClose={onClose}
      onSubmit={async (v) => {
        const blank = (x: any) => (x === '' || x === undefined ? null : x);
        const body = { name: v.name, entityType: v.entityType, phoneNumbers: v.phoneNumbers ?? [], emailAddresses: v.emailAddresses ?? [], mailingAddress: blank(v.mailingAddress),
          mailingCity: blank(v.mailingCity), mailingState: blank(v.mailingState), mailingZip: blank(v.mailingZip), notes: blank(v.notes), tags: v.tags ?? [] };
        const r = owner ? await api.patch(`/owners/${owner.id}`, body) : await api.post('/owners', body);
        toast.success(owner ? 'Owner updated' : 'Owner created');
        onSaved(r.owner);
      }} />
  );
}

export function Owners() {
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const list = useList<any>('owners');
  const columns: Column<any>[] = [
    { key: 'name', header: 'Owner', sort: 'name', render: (o) => <div className="font-semibold text-slate-900 dark:text-white">{o.name}</div> },
    { key: 'type', header: 'Type', render: (o) => <Badge tone="violet">{titleCase(o.entityType)}</Badge> },
    { key: 'mailing', header: 'Mailing', render: (o) => (o.mailingCity ? `${o.mailingCity}, ${o.mailingState}` : '—') },
    { key: 'props', header: 'Properties', render: (o) => o.propertiesCount },
    { key: 'value', header: 'Portfolio value', sort: 'portfolio', render: (o) => money(o.portfolioValue) },
    { key: 'equity', header: 'Portfolio equity', render: (o) => money(o.portfolioEquity) },
  ];
  return (
    <div>
      <PageHeader title="Owners" subtitle="Property owners. Portfolio figures are calculated from their linked properties."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New owner</Button>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[220px]"><Input aria-label="Search owners" value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Search name or mailing address" /></div>
        <Select aria-label="Entity type" className="w-44" value={list.filters.entityType ?? ''} onChange={(e) => list.setFilter('entityType', e.target.value)}>
          <option value="">All entity types</option>{ENTITY_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
      </div>
      <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} sort={list.sort} dir={list.dir} onSort={list.toggleSort}
        onRowClick={(o) => nav(`/dashboard/owners/${o.id}`)} emptyTitle={list.q ? 'No owners match your search' : 'No owners yet'}
        emptyHint="Owners are created when you add them here or import properties." emptyAction={<Button variant="primary" onClick={() => setCreating(true)}>New owner</Button>} />
      {list.data && <Pagination total={list.data.total} limit={list.pageSize} offset={list.offset} onChange={list.setOffset} />}
      {creating && <OwnerForm onClose={() => setCreating(false)} onSaved={(o) => { list.reload(); nav(`/dashboard/owners/${o.id}`); }} />}
    </div>
  );
}

export function OwnerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>(() => api.get(`/owners/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error && !data) return <div className="space-y-3"><ErrorBanner message={error} onRetry={reload} /><Button onClick={() => nav('/dashboard/owners')}><ArrowLeft className="h-4 w-4" /> Back to owners</Button></div>;
  const o = data.owner;
  const archived = Boolean(o.archivedAt);
  return (
    <div className="space-y-5">
      <button type="button" onClick={() => nav('/dashboard/owners')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Owners</button>
      <PageHeader title={o.name} subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone="violet">{titleCase(o.entityType)}</Badge>{archived && <Badge>Archived</Badge>}{o.tags.map((t: string) => <Badge key={t} tone="blue">{t}</Badge>)}</span>}
        actions={<><Button onClick={() => setEditing(true)}>Edit</Button><Button onClick={() => setArchiveOpen(true)}>{archived ? 'Restore' : 'Archive'}</Button></>} />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Section title="Portfolio"><Facts items={[['Properties', o.propertiesCount], ['Portfolio value', money(o.portfolioValue)], ['Portfolio equity', money(o.portfolioEquity)],
            ['Mailing address', o.mailingAddress ? `${o.mailingAddress}, ${o.mailingCity}, ${o.mailingState} ${o.mailingZip}` : '—'], ['Phones', o.phoneNumbers.join(', ') || '—'], ['Emails', o.emailAddresses.join(', ') || '—']]} /></Section>
          <Section title="Properties">
            {data.properties.length ? <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">{data.properties.map((p: any) => <li key={p.id} className="py-2 flex items-center gap-3"><RecordLink type="property" id={p.id}>{p.address}</RecordLink><span className="flex-1 text-xs text-slate-500">{p.city}, {p.state}</span><span>{money(p.estimatedValue)}</span></li>)}</ul> : <p className="text-sm text-slate-500">No properties linked to this owner.</p>}
          </Section>
          <Section title="Contacts">{data.contacts.length ? <ul className="text-sm space-y-1">{data.contacts.map((c: any) => <li key={c.id}><RecordLink type="contact" id={c.id}>{fullName(c)}</RecordLink> · {c.phone ?? 'no phone'}</li>)}</ul> : <p className="text-sm text-slate-500">No contacts linked. Create a contact and link it to this owner record.</p>}</Section>
          <Section title="Leads">{data.leads.length ? <ul className="text-sm space-y-2">{data.leads.map((l: any) => <li key={l.id} className="flex items-center gap-3"><RecordLink type="lead" id={l.id}>{l.title}</RecordLink><StatusBadge value={l.stage} /></li>)}</ul> : <p className="text-sm text-slate-500">No leads for this owner.</p>}</Section>
          <Section title="Notes"><NotesPanel notes={data.notes} refs={{ ownerId: o.id }} onChanged={reload} /></Section>
        </div>
        <div className="space-y-5"><Section title="Activity"><ActivityTimeline items={data.activity} /></Section></div>
      </div>
      {editing && <OwnerForm owner={o} onClose={() => setEditing(false)} onSaved={reload} />}
      {archiveOpen && <ConfirmDialog title={archived ? 'Restore owner?' : 'Archive owner?'} danger={!archived} confirmLabel={archived ? 'Restore' : 'Archive'}
        message={archived ? 'The owner returns to lists.' : 'The owner is hidden from lists. Linked properties and contacts are unchanged.'} onClose={() => setArchiveOpen(false)}
        onConfirm={async () => { await api.post(`/owners/${o.id}/archive`, { restore: archived }); toast.success(archived ? 'Owner restored' : 'Owner archived'); reload(); }} />}
    </div>
  );
}

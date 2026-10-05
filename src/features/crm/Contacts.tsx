import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Phone, Plus, RotateCcw, Target } from 'lucide-react';
import { api, errorMessage } from './api';
import { fmtDate, fullName, titleCase } from './format';
import { ActivityTimeline, CallsTable, Facts, NotesPanel, RecordLink, Section, TasksPanel } from './shared';
import {
  Badge, Button, ConfirmDialog, DataTable, EmptyState, ErrorBanner, FormModal, Input, PageHeader, Pagination, Select, Spinner, StatusBadge,
  useFetch, useList, useToast, type Column, type FieldDef,
} from './ui';
import { LeadForm } from './Leads';

const TYPES = ['lead', 'contact', 'owner', 'prospect', 'tenant', 'vendor'];

export const contactFields: FieldDef[] = [
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Last name' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 555-0100' },
  { name: 'company', label: 'Company' },
  { name: 'contactType', label: 'Type', type: 'select', required: true, options: TYPES.map((v) => ({ value: v, label: titleCase(v) })) },
  { name: 'propertyOwnerId', label: 'Linked owner record', type: 'record', record: 'owners' },
  { name: 'assignedUserId', label: 'Assigned to', type: 'record', record: 'users' },
  { name: 'source', label: 'Source' },
  { name: 'tags', label: 'Tags', type: 'tags' },
  { name: 'doNotCall', label: 'Do Not Call', type: 'checkbox' },
];

const blank = (v: any) => (v === '' || v === undefined ? null : v);
export const toContactPayload = (v: Record<string, any>) => ({
  firstName: v.firstName, lastName: v.lastName ?? '', email: blank(v.email), phone: blank(v.phone), company: blank(v.company),
  contactType: v.contactType, propertyOwnerId: blank(v.propertyOwnerId), assignedUserId: blank(v.assignedUserId), source: blank(v.source),
  tags: v.tags ?? [], doNotCall: Boolean(v.doNotCall),
});

export function ContactForm({ contact, onClose, onSaved }: { contact?: any; onClose: () => void; onSaved: (c: any) => void }) {
  const toast = useToast();
  return (
    <FormModal title={contact ? 'Edit contact' : 'New contact'} fields={contactFields} wide
      initial={contact ? { ...contact } : { contactType: 'prospect', tags: [] }} submitLabel={contact ? 'Save changes' : 'Create contact'} onClose={onClose}
      onSubmit={async (v) => {
        const r = contact ? await api.patch(`/contacts/${contact.id}`, toContactPayload(v)) : await api.post('/contacts', toContactPayload(v));
        toast.success(contact ? 'Contact updated' : 'Contact created');
        onSaved(r.contact);
      }} />
  );
}

export default function Contacts() {
  const nav = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const list = useList<any>('contacts', { archived: showArchived ? 'true' : undefined });
  const [creating, setCreating] = useState(false);

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', sort: 'name', render: (c) => <div><div className="font-semibold text-slate-900 dark:text-white">{fullName(c)}</div>{c.company && <div className="text-xs text-slate-500">{c.company}</div>}</div> },
    { key: 'phone', header: 'Phone', render: (c) => <span>{c.phone ?? '—'}{c.doNotCall && <Badge tone="red">DNC</Badge>}</span> },
    { key: 'email', header: 'Email', render: (c) => c.email ?? '—' },
    { key: 'type', header: 'Type', render: (c) => <Badge tone="violet">{titleCase(c.contactType)}</Badge> },
    { key: 'owner', header: 'Owner record', render: (c) => <RecordLink type="owner" id={c.propertyOwnerId}>{c.ownerName ?? '—'}</RecordLink> },
    { key: 'assigned', header: 'Assigned', render: (c) => c.assignedUserName ?? '—' },
    { key: 'leads', header: 'Leads', render: (c) => c.leadCount },
    { key: 'last', header: 'Last contacted', sort: 'lastContacted', render: (c) => fmtDate(c.lastContactedAt) },
  ];

  return (
    <div>
      <PageHeader title="Contacts" subtitle="People you work with: owners, prospects, tenants and vendors."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New contact</Button>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[220px]"><Input aria-label="Search contacts" value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Search name, email, phone or company" /></div>
        <Select aria-label="Filter by type" className="w-44" value={list.filters.type ?? ''} onChange={(e) => list.setFilter('type', e.target.value)}>
          <option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived</label>
      </div>
      <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} sort={list.sort} dir={list.dir} onSort={list.toggleSort}
        onRowClick={(c) => nav(`/dashboard/contacts/${c.id}`)}
        emptyTitle={list.q || list.filters.type ? 'No contacts match your filters' : showArchived ? 'No archived contacts' : 'No contacts yet'}
        emptyHint={list.q ? 'Try a different search.' : 'Create your first contact to get started.'}
        emptyAction={!list.q && !showArchived ? <Button variant="primary" onClick={() => setCreating(true)}>New contact</Button> : undefined} />
      {list.data && <Pagination total={list.data.total} limit={list.pageSize} offset={list.offset} onChange={list.setOffset} />}
      {creating && <ContactForm onClose={() => setCreating(false)} onSaved={(c) => { list.reload(); nav(`/dashboard/contacts/${c.id}`); }} />}
    </div>
  );
}

export function ContactDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>(() => api.get(`/contacts/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <div className="space-y-3"><ErrorBanner message={error} onRetry={reload} /><Button onClick={() => nav('/dashboard/contacts')}><ArrowLeft className="h-4 w-4" /> Back to contacts</Button></div>;
  const c = data.contact;
  const archived = Boolean(c.archivedAt);
  const callable = c.phone && !c.doNotCall && !archived;

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => nav('/dashboard/contacts')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Contacts</button>
      <PageHeader title={fullName(c)} subtitle={<span className="flex flex-wrap items-center gap-2">{c.company}<Badge tone="violet">{titleCase(c.contactType)}</Badge>{c.doNotCall && <Badge tone="red">Do Not Call</Badge>}{archived && <Badge>Archived</Badge>}{c.tags.map((t: string) => <Badge key={t} tone="blue">{t}</Badge>)}</span>}
        actions={<>
          <Button variant="primary" disabled={!callable} title={callable ? 'Open in dialer (simulated)' : c.doNotCall ? 'On the Do Not Call list' : 'No phone number'} onClick={() => nav(`/dashboard/dialer?contact=${c.id}`)}><Phone className="h-4 w-4" /> Call</Button>
          <Button onClick={() => setLeadOpen(true)}><Target className="h-4 w-4" /> New lead</Button>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button onClick={() => setConfirmArchive(true)}>{archived ? <><RotateCcw className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}</Button>
        </>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Section title="Details"><Facts items={[['Phone', c.phone], ['Email', c.email], ['Source', c.source], ['Assigned to', c.assignedUserName], ['Owner record', <RecordLink key="o" type="owner" id={c.propertyOwnerId}>{c.ownerName}</RecordLink>], ['Last contacted', fmtDate(c.lastContactedAt)]]} /></Section>
          <Section title="Leads">
            {data.leads.length ? <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">{data.leads.map((l: any) => (
              <li key={l.id} className="py-2 flex items-center gap-3"><RecordLink type="lead" id={l.id}>{l.title}</RecordLink><span className="flex-1 text-xs text-slate-500">{l.propertyAddress}</span><StatusBadge value={l.stage} /></li>))}</ul>
              : <EmptyState title="No leads for this contact" />}
          </Section>
          <Section title="Properties (via owner record)">
            {data.properties.length ? <ul className="text-sm space-y-1">{data.properties.map((p: any) => <li key={p.id}><RecordLink type="property" id={p.id}>{p.address}</RecordLink>, {p.city}, {p.state} {p.zip}</li>)}</ul> : <p className="text-sm text-slate-500">No properties linked.</p>}
          </Section>
          <Section title="Calls"><CallsTable calls={data.calls} /></Section>
          <Section title="Notes"><NotesPanel notes={data.notes} refs={{ contactId: c.id }} onChanged={reload} /></Section>
        </div>
        <div className="space-y-5">
          <Section title="Tasks"><TasksPanel tasks={data.tasks} refs={{ contactId: c.id }} onChanged={reload} /></Section>
          <Section title="Campaigns">
            {data.campaigns.length ? <ul className="text-sm space-y-2">{data.campaigns.map((m: any) => (
              <li key={m.id} className="flex items-center gap-2"><RecordLink type="campaign" id={m.id}>{m.name}</RecordLink><StatusBadge value={m.membershipStatus} /></li>))}</ul> : <p className="text-sm text-slate-500">Not in any campaign.</p>}
          </Section>
          <Section title="Activity"><ActivityTimeline items={data.activity} /></Section>
        </div>
      </div>
      {editing && <ContactForm contact={c} onClose={() => setEditing(false)} onSaved={reload} />}
      {leadOpen && <LeadForm preset={{ contactId: c.id, contactLabel: fullName(c) }} onClose={() => setLeadOpen(false)} onSaved={(l) => nav(`/dashboard/leads/${l.id}`)} />}
      {confirmArchive && (
        <ConfirmDialog title={archived ? 'Restore contact?' : 'Archive contact?'} danger={!archived} confirmLabel={archived ? 'Restore' : 'Archive'}
          message={archived ? `${fullName(c)} will reappear in lists and can be called again.` : `${fullName(c)} will be hidden from lists and cannot be added to campaigns. Their history is kept and you can restore them later.`}
          onClose={() => setConfirmArchive(false)}
          onConfirm={async () => { try { await api.post(`/contacts/${c.id}/archive`, { restore: archived }); toast.success(archived ? 'Contact restored' : 'Contact archived'); reload(); } catch (e) { throw e; } }} />
      )}
    </div>
  );
}
void errorMessage;

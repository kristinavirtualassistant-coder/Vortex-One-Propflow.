import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Bot, Phone, Plus, RotateCcw } from 'lucide-react';
import { api, errorMessage } from './api';
import { fullName, money, titleCase } from './format';
import { ActivityTimeline, CallsTable, Facts, NotesPanel, RecordLink, Section, TasksPanel } from './shared';
import {
  Badge, Button, ConfirmDialog, DataTable, EmptyState, ErrorBanner, FormModal, Input, PageHeader, Pagination, Select, Spinner, StatusBadge,
  cx, useFetch, useList, useToast, type Column, type FieldDef,
} from './ui';

export const STAGES = ['identified', 'contacted', 'qualified', 'appointment', 'negotiating', 'won', 'lost'];

const leadFields = (preset?: Record<string, any>): FieldDef[] => [
  { name: 'title', label: 'Title', span: 2, help: 'Defaults to the property address' },
  { name: 'propertyId', label: 'Property', type: 'record', record: 'properties', recordLabel: preset?.propertyLabel },
  { name: 'contactId', label: 'Contact', type: 'record', record: 'contacts', recordLabel: preset?.contactLabel },
  { name: 'stage', label: 'Stage', type: 'select', required: true, options: STAGES.map((s) => ({ value: s, label: titleCase(s) })) },
  { name: 'assignedUserId', label: 'Assigned to', type: 'record', record: 'users' },
  { name: 'value', label: 'Estimated value ($)', type: 'number' },
  { name: 'source', label: 'Source' },
  { name: 'tags', label: 'Tags', type: 'tags' },
];

export function LeadForm({ lead, preset, onClose, onSaved }: { lead?: any; preset?: Record<string, any>; onClose: () => void; onSaved: (l: any) => void }) {
  const toast = useToast();
  return (
    <FormModal title={lead ? 'Edit lead' : 'New lead'} fields={leadFields(preset)} wide submitLabel={lead ? 'Save changes' : 'Create lead'} onClose={onClose}
      initial={lead ? { ...lead, value: lead.value || '' } : { stage: 'identified', tags: [], ...preset }}
      onSubmit={async (v) => {
        const blank = (x: any) => (x === '' || x === undefined ? null : x);
        const body: any = { title: blank(v.title), contactId: blank(v.contactId), assignedUserId: blank(v.assignedUserId), stage: v.stage, value: Number(v.value || 0), source: blank(v.source), tags: v.tags ?? [] };
        if (!lead) body.propertyId = blank(v.propertyId);
        const r = lead ? await api.patch(`/leads/${lead.id}`, body) : await api.post('/leads', body);
        toast.success(lead ? 'Lead updated' : 'Lead created');
        onSaved(r.lead);
      }} />
  );
}

const scoreTone = (c: string) => (c === 'hot' ? 'green' : c === 'warm' ? 'amber' : 'slate');

export default function Leads() {
  const nav = useNavigate();
  const [stage, setStage] = useState('');
  const [mine, setMine] = useState(false);
  const list = useList<any>('leads', { stage: stage || undefined, assignedUserId: mine ? 'me' : undefined });
  const pipeline = useFetch<any>(() => api.get('/leads/pipeline'), [list.data]);
  const [creating, setCreating] = useState(false);

  const columns: Column<any>[] = [
    { key: 'title', header: 'Lead', sort: 'title', render: (l) => <div><div className="font-semibold text-slate-900 dark:text-white">{l.title}</div><div className="text-xs text-slate-500">{l.propertyAddress ? `${l.propertyAddress}, ${l.propertyCity}` : 'No property'}</div></div> },
    { key: 'contact', header: 'Contact', render: (l) => <RecordLink type="contact" id={l.contactId}>{l.contactName ?? '—'}</RecordLink> },
    { key: 'stage', header: 'Stage', render: (l) => <StatusBadge value={l.stage} /> },
    { key: 'score', header: 'Score', sort: 'score', render: (l) => <span className="inline-flex items-center gap-2"><b>{l.leadScore}</b><Badge tone={scoreTone(l.classification) as any}>{l.classification}</Badge></span> },
    { key: 'value', header: 'Value', sort: 'value', render: (l) => (l.value ? money(l.value) : '—') },
    { key: 'assigned', header: 'Assigned', render: (l) => l.assignedUserName ?? '—' },
    { key: 'updated', header: 'Updated', sort: 'updated', render: (l) => new Date(l.updatedAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title="Leads" subtitle="Your pipeline, scored from property and owner records."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New lead</Button>} />
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by stage">
        <button type="button" onClick={() => { setStage(''); list.setOffset(0); }} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold border', !stage ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>All</button>
        {pipeline.data?.stages.map((s: any) => (
          <button key={s.stage} type="button" onClick={() => { setStage(s.stage); list.setOffset(0); }} aria-pressed={stage === s.stage}
            className={cx('rounded-full px-3 py-1.5 text-xs font-semibold border', stage === s.stage ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>
            {titleCase(s.stage)} · {s.count}{s.value ? ` · ${money(s.value)}` : ''}
          </button>))}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[220px]"><Input aria-label="Search leads" value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Search title, contact, address or owner" /></div>
        <Select aria-label="Filter by classification" className="w-44" value={list.filters.classification ?? ''} onChange={(e) => list.setFilter('classification', e.target.value)}>
          <option value="">All scores</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="nurture">Nurture</option></Select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me</label>
      </div>
      <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} sort={list.sort} dir={list.dir} onSort={list.toggleSort}
        onRowClick={(l) => nav(`/dashboard/leads/${l.id}`)} emptyTitle={list.q || stage ? 'No leads match your filters' : 'No leads yet'}
        emptyHint="Create a lead here, or open a property and choose “Create lead”."
        emptyAction={<Button variant="primary" onClick={() => setCreating(true)}>New lead</Button>} />
      {list.data && <Pagination total={list.data.total} limit={list.pageSize} offset={list.offset} onChange={list.setOffset} />}
      {creating && <LeadForm onClose={() => setCreating(false)} onSaved={(l) => { list.reload(); nav(`/dashboard/leads/${l.id}`); }} />}
    </div>
  );
}

export function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>(() => api.get(`/leads/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentResult, setAgentResult] = useState<any>(null);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <div className="space-y-3"><ErrorBanner message={error} onRetry={reload} /><Button onClick={() => nav('/dashboard/leads')}><ArrowLeft className="h-4 w-4" /> Back to leads</Button></div>;
  const { lead, property, owner, contact } = data;
  const archived = Boolean(lead.archivedAt);
  const callable = contact?.phone && !contact.doNotCall && !contact.archivedAt && !archived;

  const changeStage = async (stage: string) => {
    try { await api.patch(`/leads/${lead.id}`, { stage }); toast.success(`Stage changed to ${titleCase(stage)}`); reload(); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const runQualification = async () => {
    setAgentBusy(true); setAgentResult(null);
    try {
      const r = await api.post('/agents/lead_qualification/run', { input: { leadId: lead.id } });
      setAgentResult(r);
      if (r.status === 'completed') { toast.success('Lead re-scored'); reload(); } else toast.error(r.error ?? 'Agent failed');
    } catch (e) { toast.error(errorMessage(e)); } finally { setAgentBusy(false); }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => nav('/dashboard/leads')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Leads</button>
      <PageHeader title={lead.title} subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge value={lead.stage} /><Badge tone={scoreTone(lead.classification) as any}>{lead.classification} · {lead.leadScore}</Badge>{archived && <Badge>Archived</Badge>}{lead.tags.map((t: string) => <Badge key={t} tone="blue">{t}</Badge>)}</span>}
        actions={<>
          <Select aria-label="Change stage" className="w-40" value={lead.stage} onChange={(e) => changeStage(e.target.value)} disabled={archived}>{STAGES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
          <Button variant="primary" disabled={!callable} onClick={() => nav(`/dashboard/dialer?contact=${contact.id}&lead=${lead.id}`)} title={callable ? 'Open in dialer (simulated)' : 'No callable contact'}><Phone className="h-4 w-4" /> Call</Button>
          <Button loading={agentBusy} onClick={runQualification}><Bot className="h-4 w-4" /> Re-score</Button>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button onClick={() => setArchiveOpen(true)}>{archived ? <><RotateCcw className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}</Button>
        </>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {agentResult?.status === 'completed' && <div role="status" className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 p-3 text-sm text-sky-900 dark:text-sky-100">
        Qualification agent: score {agentResult.output.previousScore} → <b>{agentResult.output.score}</b> ({agentResult.output.classification}). {agentResult.output.reason ?? agentResult.output.factors?.map((f: any) => `${f.label} +${f.points}`).join(', ')}</div>}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Section title="Overview">
            <Facts items={[['Value', lead.value ? money(lead.value) : '—'], ['Source', lead.source ? titleCase(lead.source) : '—'], ['Assigned to', lead.assignedUserName], ['Next action', lead.nextRecommendedAction], ['Created', new Date(lead.createdAt).toLocaleDateString()], ['Last activity', new Date(lead.lastActivityDate).toLocaleDateString()]]} />
            {lead.factors?.length > 0 && <div className="mt-4"><div className="text-xs font-semibold text-slate-500 mb-1">Score factors</div><ul className="flex flex-wrap gap-2">{lead.factors.map((f: any) => <li key={f.key}><Badge tone="amber">{f.label} +{f.points}</Badge></li>)}</ul></div>}
          </Section>
          <Section title="Relationships">
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs text-slate-500">Property</div>{property ? <><RecordLink type="property" id={property.id}>{property.address}</RecordLink><div className="text-xs text-slate-500">{property.city}, {property.state} · {money(property.estimatedValue)}</div></> : '—'}</div>
              <div><div className="text-xs text-slate-500">Owner</div>{owner ? <><RecordLink type="owner" id={owner.id}>{owner.name}</RecordLink><div className="text-xs text-slate-500">{titleCase(owner.entityType)}</div></> : '—'}</div>
              <div><div className="text-xs text-slate-500">Contact</div>{contact ? <><RecordLink type="contact" id={contact.id}>{fullName(contact)}</RecordLink><div className="text-xs text-slate-500">{contact.phone}{contact.doNotCall && ' · DNC'}</div></> : '—'}</div>
            </div>
          </Section>
          <Section title="Calls"><CallsTable calls={data.calls} /></Section>
          <Section title="Notes"><NotesPanel notes={data.notes} refs={{ leadId: lead.id, contactId: lead.contactId, propertyId: lead.primaryPropertyId }} onChanged={reload} /></Section>
        </div>
        <div className="space-y-5">
          <Section title="Tasks"><TasksPanel tasks={data.tasks} refs={{ leadId: lead.id, contactId: lead.contactId, propertyId: lead.primaryPropertyId }} onChanged={reload} /></Section>
          <Section title="Activity"><ActivityTimeline items={data.activity} /></Section>
        </div>
      </div>
      {editing && <LeadForm lead={lead} preset={{ propertyLabel: property?.address, contactLabel: contact ? fullName(contact) : undefined }} onClose={() => setEditing(false)} onSaved={reload} />}
      {archiveOpen && <ConfirmDialog title={archived ? 'Restore lead?' : 'Archive lead?'} danger={!archived} confirmLabel={archived ? 'Restore' : 'Archive'}
        message={archived ? 'The lead returns to your pipeline.' : 'The lead leaves your pipeline and lists. Its history is kept and you can restore it.'} onClose={() => setArchiveOpen(false)}
        onConfirm={async () => { await api.post(`/leads/${lead.id}/archive`, { restore: archived }); toast.success(archived ? 'Lead restored' : 'Lead archived'); reload(); }} />}
    </div>
  );
}
void EmptyState;

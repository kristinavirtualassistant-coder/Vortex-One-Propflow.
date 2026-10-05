import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pause, Phone, Play, Plus, Square, Trash2, UserPlus } from 'lucide-react';
import { api, errorMessage, qs } from './api';
import { duration, fullName, titleCase } from './format';
import { ActivityTimeline, CallsTable, RecordLink, Section } from './shared';
import {
  Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorBanner, FormModal, Input, Modal, PageHeader, Pagination, Spinner, Stat, StatusBadge,
  useDebounced, useFetch, useList, useToast, type Column,
} from './ui';

const campaignFields = [
  { name: 'name', label: 'Campaign name', required: true, span: 2 as const },
  { name: 'description', label: 'Description', type: 'textarea' as const },
  { name: 'script', label: 'Call script', type: 'textarea' as const, help: 'Shown to the agent in the dialer.' },
];

function CampaignForm({ campaign, onClose, onSaved }: { campaign?: any; onClose: () => void; onSaved: (c: any) => void }) {
  const toast = useToast();
  return (
    <FormModal title={campaign ? 'Edit campaign' : 'New campaign'} fields={campaignFields} initial={campaign ? { ...campaign } : {}} submitLabel={campaign ? 'Save changes' : 'Create campaign'} onClose={onClose}
      onSubmit={async (v) => {
        const body = { name: v.name, description: v.description || null, script: v.script || null };
        const r = campaign ? await api.patch(`/campaigns/${campaign.id}`, body) : await api.post('/campaigns', body);
        toast.success(campaign ? 'Campaign updated' : 'Campaign created'); onSaved(r.campaign);
      }} />
  );
}

export default function Campaigns() {
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const list = useList<any>('campaigns');
  const columns: Column<any>[] = [
    { key: 'name', header: 'Campaign', render: (c) => <div><div className="font-semibold text-slate-900 dark:text-white">{c.name}</div><div className="text-xs text-slate-500 line-clamp-1">{c.description}</div></div> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge value={c.status} /> },
    { key: 'contacts', header: 'Contacts', render: (c) => c.contactsCount },
    { key: 'progress', header: 'Progress', render: (c) => {
      const pct = c.contactsCount ? Math.round((c.finishedCount / c.contactsCount) * 100) : 0;
      return <div className="w-32"><div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} /></div><div className="text-xs text-slate-500 mt-0.5">{c.finishedCount}/{c.contactsCount} · {pct}%</div></div>; } },
    { key: 'calls', header: 'Calls', render: (c) => c.callsCount },
  ];
  return (
    <div>
      <PageHeader title="Campaigns" subtitle="Organised outreach. Progress and results are calculated from real call records."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New campaign</Button>} />
      <div className="mb-4 max-w-sm"><Input aria-label="Search campaigns" value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Search campaigns" /></div>
      <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} onRowClick={(c) => nav(`/dashboard/campaigns/${c.id}`)}
        emptyTitle={list.q ? 'No campaigns match' : 'No campaigns yet'} emptyHint="Create a campaign, add contacts, then activate it to start dialing."
        emptyAction={<Button variant="primary" onClick={() => setCreating(true)}>New campaign</Button>} />
      {list.data && <Pagination total={list.data.total} limit={list.pageSize} offset={list.offset} onChange={list.setOffset} />}
      {creating && <CampaignForm onClose={() => setCreating(false)} onSaved={(c) => { list.reload(); nav(`/dashboard/campaigns/${c.id}`); }} />}
    </div>
  );
}

function AddContactsModal({ campaignId, onClose, onAdded }: { campaignId: string; onClose: () => void; onAdded: () => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: Array<{ id: string; reason: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, loading } = useFetch<any>(() => api.get(`/contacts${qs({ q: dq, limit: 25 })}`), [dq]);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const submit = async () => {
    setBusy(true); setError(null);
    try { const r = await api.post(`/campaigns/${campaignId}/contacts`, { contactIds: [...picked] }); setResult(r); onAdded(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add contacts to campaign" onClose={onClose} wide footer={<>
      <Button onClick={onClose}>{result ? 'Done' : 'Cancel'}</Button>
      {!result && <Button variant="primary" loading={busy} disabled={!picked.size} onClick={submit}>Add {picked.size || ''} contact{picked.size === 1 ? '' : 's'}</Button>}
    </>}>
      {result ? (
        <div className="space-y-3 text-sm" role="status">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">{result.added} contact{result.added === 1 ? '' : 's'} added.</p>
          {result.skipped.length > 0 && <div><p className="font-semibold">Skipped:</p><ul className="list-disc ml-5 text-slate-600 dark:text-slate-300">{result.skipped.map((s, i) => <li key={i}>{s.reason}</li>)}</ul></div>}
        </div>
      ) : (
        <div className="space-y-3">
          <Input aria-label="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts by name, phone or email" />
          {error && <ErrorBanner message={error} />}
          {loading && !data ? <Spinner /> : (
            <ul className="max-h-72 overflow-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
              {data?.items.map((c: any) => (
                <li key={c.id}><label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="flex-1">{fullName(c)}</span><span className="text-xs text-slate-500">{c.phone ?? 'no phone'}</span>{c.doNotCall && <Badge tone="red">DNC</Badge>}
                </label></li>))}
              {data?.items.length === 0 && <li className="p-4"><EmptyState title="No contacts found" /></li>}
            </ul>)}
          <p className="text-xs text-slate-500">Contacts without a phone number or on the Do Not Call list are skipped automatically.</p>
        </div>
      )}
    </Modal>
  );
}

export function CampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<any>(() => api.get(`/campaigns/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [remove, setRemove] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | 'complete' | 'archive'>(null);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <div className="space-y-3"><ErrorBanner message={error} onRetry={reload} /><Button onClick={() => nav('/dashboard/campaigns')}><ArrowLeft className="h-4 w-4" /> Back to campaigns</Button></div>;
  const { campaign: c, metrics: m } = data;

  const act = async (action: string, success: string) => {
    setBusy(action);
    try { await api.post(`/campaigns/${c.id}/status`, { action }); toast.success(success); reload(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  const memberCols: Column<any>[] = [
    { key: 'name', header: 'Contact', render: (r) => <RecordLink type="contact" id={r.contactId}>{r.contactName}</RecordLink> },
    { key: 'phone', header: 'Phone', render: (r) => r.phone },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'attempts', header: 'Attempts', render: (r) => `${r.attempts} / ${data.maxAttempts}` },
    { key: 'last', header: 'Last outcome', render: (r) => (r.lastOutcome ? titleCase(r.lastOutcome) : '—') },
    { key: 'rm', header: '', render: (r) => (c.status === 'completed' || c.status === 'archived' ? null : <Button size="sm" variant="ghost" aria-label={`Remove ${r.contactName}`} onClick={() => setRemove(r)}><Trash2 className="h-3 w-3" /></Button>) },
  ];
  const outcomes = Object.entries(m.outcomes as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const maxOutcome = Math.max(1, ...outcomes.map(([, n]) => n));

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => nav('/dashboard/campaigns')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Campaigns</button>
      <PageHeader title={c.name} subtitle={<span className="flex items-center gap-2"><StatusBadge value={c.status} />{c.description}</span>}
        actions={<>
          {c.status === 'draft' && <Button variant="primary" loading={busy === 'activate'} onClick={() => act('activate', 'Campaign activated')}><Play className="h-4 w-4" /> Activate</Button>}
          {c.status === 'active' && <><Button variant="primary" onClick={() => nav(`/dashboard/dialer?campaign=${c.id}`)}><Phone className="h-4 w-4" /> Open dialer</Button><Button loading={busy === 'pause'} onClick={() => act('pause', 'Campaign paused')}><Pause className="h-4 w-4" /> Pause</Button></>}
          {c.status === 'paused' && <Button variant="primary" loading={busy === 'resume'} onClick={() => act('resume', 'Campaign resumed')}><Play className="h-4 w-4" /> Resume</Button>}
          {(c.status === 'active' || c.status === 'paused') && <Button onClick={() => setConfirm('complete')}><Square className="h-4 w-4" /> Complete</Button>}
          {c.status === 'archived' ? <Button loading={busy === 'restore'} onClick={() => act('restore', 'Campaign restored')}>Restore</Button> : <Button onClick={() => setConfirm('archive')}>Archive</Button>}
          {c.status !== 'archived' && <Button onClick={() => setEditing(true)}>Edit</Button>}
        </>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Contacts" value={m.contacts.total} hint={`${m.contacts.pending} waiting`} />
        <Stat label="Progress" value={`${m.progressPercent}%`} hint={`${m.contacts.completed + m.contacts.do_not_call + m.contacts.exhausted} finished`} />
        <Stat label="Calls" value={m.calls.total} hint={m.calls.live ? `${m.calls.live} live` : 'simulated dialer'} />
        <Stat label="Connect rate" value={`${m.calls.connectRate}%`} hint={`${m.calls.connected} connected · avg ${duration(m.calls.avgDurationSeconds)}`} />
        <Stat label="Interested / appts" value={`${m.interested} / ${m.appointments}`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Section title="Contacts in this campaign" actions={c.status !== 'completed' && c.status !== 'archived' ? <Button size="sm" onClick={() => setAdding(true)}><UserPlus className="h-3 w-3" /> Add contacts</Button> : undefined}>
            <DataTable columns={memberCols} rows={data.members} loading={false} error={null} emptyTitle="No contacts yet" emptyHint="Add contacts so the dialer has someone to call." />
          </Section>
          <Section title="Recent calls"><CallsTable calls={data.calls} /></Section>
        </div>
        <div className="space-y-5">
          <Card title="Call outcomes">
            {outcomes.length ? <ul className="space-y-2 text-sm">{outcomes.map(([k, n]) => (
              <li key={k}><div className="flex justify-between"><span>{titleCase(k)}</span><b>{n}</b></div><div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(n / maxOutcome) * 100}%` }} /></div></li>))}</ul>
              : <p className="text-sm text-slate-500">No completed calls yet.</p>}
          </Card>
          {c.script && <Card title="Script"><p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{c.script}</p></Card>}
          <Card title="Activity"><ActivityTimeline items={data.activity} /></Card>
        </div>
      </div>
      {editing && <CampaignForm campaign={c} onClose={() => setEditing(false)} onSaved={reload} />}
      {adding && <AddContactsModal campaignId={c.id} onClose={() => setAdding(false)} onAdded={reload} />}
      {remove && <ConfirmDialog title="Remove from campaign?" danger confirmLabel="Remove" message={`${remove.contactName} will be removed from this campaign. Existing call history is kept.`} onClose={() => setRemove(null)}
        onConfirm={async () => { await api.del(`/campaigns/${c.id}/contacts/${remove.contactId}`); toast.success('Contact removed'); reload(); }} />}
      {confirm && <ConfirmDialog title={confirm === 'complete' ? 'Complete campaign?' : 'Archive campaign?'} danger={confirm === 'archive'} confirmLabel={confirm === 'complete' ? 'Complete' : 'Archive'}
        message={confirm === 'complete' ? 'No more calls can be made in this campaign. Results are kept.' : 'The campaign is hidden from the default list. Results are kept and it can be restored.'} onClose={() => setConfirm(null)}
        onConfirm={() => act(confirm, confirm === 'complete' ? 'Campaign completed' : 'Campaign archived')} />}
    </div>
  );
}

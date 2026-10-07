import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { api, errorMessage } from './api';
import { fmtDateTime, titleCase } from './format';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, RecordPicker, Spinner, StatusBadge, useFetch, useToast } from './ui';

const INPUT_KIND: Record<string, 'leads' | 'properties' | 'contacts' | 'none'> = {
  lead_qualification: 'leads', property_intelligence: 'properties', call_assistant: 'leads', follow_up: 'none',
};

function Output({ value }: { value: any }) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return value.length ? <ul className="list-disc ml-5">{value.map((v, i) => <li key={i}><Output value={v} /></li>)}</ul> : <span className="text-slate-400">none</span>;
  return (
    <dl className="space-y-1">{Object.entries(value).map(([k, v]) => (
      <div key={k} className="grid grid-cols-[150px_1fr] gap-2"><dt className="text-slate-500">{titleCase(k.replace(/([A-Z])/g, ' $1'))}</dt><dd><Output value={v} /></dd></div>))}</dl>
  );
}

function RunModal({ agent, onClose, onRan }: { agent: any; onClose: () => void; onRan: () => void }) {
  const toast = useToast();
  const kind = INPUT_KIND[agent.key] ?? 'none';
  const [record, setRecord] = useState<string | null>(null);
  const [staleDays, setStaleDays] = useState('7');
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const input: any = kind === 'leads' ? (agent.key === 'call_assistant' ? { leadId: record } : { leadId: record, apply }) : kind === 'properties' ? { propertyId: record } : { staleDays: Number(staleDays) || 7 };
      const r = await api.post(`/agents/${agent.key}/run`, { input });
      setResult(r); onRan();
      if (r.status === 'completed') toast.success(`${agent.name} completed`); else setError(r.error);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const ready = kind === 'none' || Boolean(record);

  return (
    <Modal title={agent.name} onClose={onClose} wide footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" loading={busy} disabled={!ready} onClick={run}><Bot className="h-4 w-4" /> Run agent</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">{agent.description}</p>
        {kind === 'leads' && <Field label="Lead" required>{(id) => <RecordPicker id={id} kind="leads" value={record} onChange={setRecord} />}</Field>}
        {kind === 'properties' && <Field label="Property" required>{(id) => <RecordPicker id={id} kind="properties" value={record} onChange={setRecord} />}</Field>}
        {agent.key === 'follow_up' && <Field label="Treat leads as stale after (days)">{(id) => <Input id={id} type="number" min={1} value={staleDays} onChange={(e) => setStaleDays(e.target.value)} />}</Field>}
        {agent.key === 'lead_qualification' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Save the new score to the lead (uncheck for a dry run)</label>}
        {error && <ErrorBanner message={error} />}
        {result?.status === 'completed' && <div role="status" className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 text-sm"><Output value={result.output} /></div>}
      </div>
    </Modal>
  );
}

export default function Agents() {
  const agents = useFetch<any>(() => api.get('/agents'), []);
  const runs = useFetch<any>(() => api.get('/agent-runs?limit=15'), []);
  const [selected, setSelected] = useState<any>(null);
  return (
    <div>
      <PageHeader title="AI Agents" subtitle="Modular agents that work through the same permissions as you. Every run is logged." />
      <div role="note" className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        Current agents are <b>rule-based</b>: they read your stored records and call no external AI model, so they never invent data. Add model-backed agents in <code>src/server/agents.ts</code>; they run through the same services and permission checks.
      </div>
      {agents.loading && !agents.data ? <Spinner /> : agents.error && !agents.data ? <ErrorBanner message={agents.error} onRetry={agents.reload} /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {agents.data.agents.map((a: any) => (
            <Card key={a.key}>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0"><Bot className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 dark:text-white">{a.name}</div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{a.description}</p>
                  <p className="text-xs text-slate-500 mt-1">Purpose: {a.purpose}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 items-center"><Badge tone="slate">{a.mode.replace('_', '-')}</Badge>{a.permissions.map((p: string) => <Badge key={p} tone="blue">{p}</Badge>)}</div>
                  <div className="mt-3"><Button variant="primary" size="sm" disabled={!a.allowed} title={a.allowed ? undefined : 'Your role does not have the permissions this agent needs'} onClick={() => setSelected(a)}>Run</Button>
                    {!a.allowed && <span className="ml-2 text-xs text-slate-500">Requires {a.permissions.join(', ')}</span>}</div>
                </div>
              </div>
            </Card>))}
        </div>)}
      <div className="mt-6">
        <Card title="Recent runs">
          {runs.data?.items.length ? <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">{runs.data.items.map((r: any) => (
            <li key={r.id} className="py-2 flex items-center gap-3"><StatusBadge value={r.status} /><span className="flex-1">{titleCase(r.agentKey)}{r.error && <span className="text-red-600"> — {r.error}</span>}</span><span className="text-xs text-slate-500">{r.triggeredByName ?? 'Workflow'} · {fmtDateTime(r.createdAt)}</span></li>))}</ul>
            : <EmptyState title="No agent runs yet" />}
        </Card>
      </div>
      {selected && <RunModal agent={selected} onClose={() => setSelected(null)} onRan={runs.reload} />}
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Play, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from './api';
import { fmtDateTime, relTime, titleCase } from './format';
import { usePermissions } from './permissions';
import { recordPath } from './shared';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, RecordPicker, Select, Spinner, StatusBadge, Textarea,
  cx, useFetch, useToast,
} from './ui';

type Cond = { field: string; op: string; value: string };
type Act = { type: string; params: Record<string, any> };

const ACTION_FIELDS: Record<string, Array<{ name: string; label: string; kind: 'text' | 'number' | 'select'; options?: string[]; required?: boolean; help?: string }>> = {
  create_task: [
    { name: 'title', label: 'Task title', kind: 'text', required: true, help: 'Use {{lead.title}}, {{contact.firstName}}, {{property.address}}…' },
    { name: 'dueInDays', label: 'Due in (days)', kind: 'number' },
    { name: 'priority', label: 'Priority', kind: 'select', options: ['low', 'normal', 'high', 'urgent'] },
    { name: 'assignTo', label: 'Assign to', kind: 'select', options: ['lead_assignee', 'actor', 'unassigned'] },
  ],
  update_lead: [
    { name: 'stage', label: 'Move to stage', kind: 'select', options: ['', 'identified', 'contacted', 'qualified', 'appointment', 'negotiating', 'won', 'lost'] },
    { name: 'addScore', label: 'Add to score (±)', kind: 'number' },
    { name: 'nextRecommendedAction', label: 'Next recommended action', kind: 'text' },
  ],
  assign_user: [{ name: 'userId', label: 'User', kind: 'select', options: ['round_robin'], required: true }],
  add_tag: [{ name: 'tag', label: 'Tag', kind: 'text', required: true }, { name: 'target', label: 'Apply to', kind: 'select', options: ['lead', 'contact', 'property'] }],
  add_to_campaign: [{ name: 'campaignId', label: 'Campaign', kind: 'select', options: [], required: true }],
  create_activity: [{ name: 'summary', label: 'Activity text', kind: 'text', required: true }],
  create_lead: [{ name: 'title', label: 'Lead title (optional)', kind: 'text' }, { name: 'source', label: 'Source', kind: 'text' }],
  send_notification: [{ name: 'message', label: 'In-app notification text', kind: 'text', required: true, help: 'In-app only. No email or SMS is ever sent.' }],
  invoke_agent: [{ name: 'agentKey', label: 'Agent', kind: 'select', options: [], required: true }],
};

const defaultParams = (type: string): Record<string, any> => (type === 'create_task' ? { title: '', dueInDays: 1, priority: 'normal', assignTo: 'lead_assignee' } : type === 'add_tag' ? { tag: '', target: 'lead' } : type === 'create_lead' ? { source: 'workflow' } : {});

const toCond = (c: any): Cond => ({ field: c.field, op: c.op, value: Array.isArray(c.value) ? c.value.join(', ') : c.value === undefined || c.value === null ? '' : String(c.value) });
const fromCond = (c: Cond) => {
  const base: any = { field: c.field.trim(), op: c.op };
  if (c.op === 'exists') return base;
  if (c.op === 'in') return { ...base, value: c.value.split(',').map((s) => s.trim()).filter(Boolean) };
  if (['gt', 'gte', 'lt', 'lte'].includes(c.op)) return { ...base, value: Number(c.value) };
  return { ...base, value: c.value };
};
const cleanParams = (type: string, p: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const f of ACTION_FIELDS[type] ?? []) {
    const v = p[f.name];
    if (v === '' || v === undefined || v === null) continue;
    out[f.name] = f.kind === 'number' ? Number(v) : v;
  }
  if (type === 'invoke_agent') out.input = {};
  return out;
};

function describeCond(c: any) {
  const val = Array.isArray(c.value) ? `[${c.value.join(', ')}]` : c.value;
  return `${c.field} ${c.op}${c.op === 'exists' ? '' : ` ${val}`}`;
}
function describeAction(a: any) {
  const p = a.params ?? {};
  const bits = Object.entries(p).filter(([k]) => k !== 'input').map(([k, v]) => `${k}: ${v}`).join(', ');
  return `${titleCase(a.type)}${bits ? ` (${bits})` : ''}`;
}

function WorkflowBuilder({ workflow, onClose, onSaved }: { workflow?: any; onClose: () => void; onSaved: (w: any) => void }) {
  const toast = useToast();
  const meta = useFetch<any>(() => api.get('/workflows/meta'), []);
  const members = useFetch<any>(() => api.get('/org/members'), []);
  const campaigns = useFetch<any>(() => api.get('/campaigns?limit=100'), []);
  const agents = useFetch<any>(() => api.get('/agents'), []);
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [trigger, setTrigger] = useState(workflow?.triggerType ?? 'lead.created');
  const [conds, setConds] = useState<Cond[]>((workflow?.conditions ?? []).map(toCond));
  const [acts, setActs] = useState<Act[]>(workflow?.actions?.length ? workflow.actions.map((a: any) => ({ type: a.type, params: { ...a.params } })) : [{ type: 'create_task', params: defaultParams('create_task') }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsFor = (type: string, name: string, base?: string[]) => {
    if (type === 'assign_user' && name === 'userId') return ['round_robin', ...(members.data?.items ?? []).filter((m: any) => !m.disabledAt).map((m: any) => m.id)];
    return base ?? [];
  };
  const labelFor = (type: string, name: string, v: string) => {
    if (name === 'userId' && v !== 'round_robin') return members.data?.items.find((m: any) => m.id === v)?.name ?? v;
    if (name === 'campaignId') return campaigns.data?.items.find((c: any) => c.id === v)?.name ?? v;
    if (name === 'agentKey') return agents.data?.agents.find((a: any) => a.key === v)?.name ?? v;
    return v === '' ? '—' : titleCase(v);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!name.trim()) return setError('Give the workflow a name.');
    if (!acts.length) return setError('Add at least one action.');
    for (const a of acts) for (const f of ACTION_FIELDS[a.type] ?? []) if (f.required && !String(a.params[f.name] ?? '').trim()) return setError(`${titleCase(a.type)}: ${f.label} is required.`);
    setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim() || null, triggerType: trigger, conditions: conds.filter((c) => c.field.trim()).map(fromCond), actions: acts.map((a) => ({ type: a.type, params: cleanParams(a.type, a.params) })) };
      const r = workflow ? await api.patch(`/workflows/${workflow.id}`, body) : await api.post('/workflows', body);
      toast.success(workflow ? 'Workflow updated' : 'Workflow created'); onSaved(r.workflow); onClose();
    } catch (err: any) { setError(err?.issues?.length ? err.issues.map((i: any) => `${i.path}: ${i.message}`).join('; ') : errorMessage(err)); setBusy(false); }
  };

  const fieldHints: string[] = meta.data?.payloadFields?.[trigger] ?? [];
  return (
    <Modal title={workflow ? 'Edit workflow' : 'New workflow'} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-5" noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Trigger" help="The event that starts this workflow.">{(id) => <Select id={id} value={trigger} onChange={(e) => setTrigger(e.target.value)}>{(meta.data?.triggers ?? ['lead.created']).map((t: string) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>}</Field>
          <div className="sm:col-span-2"><Field label="Description">{(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[56px]" />}</Field></div>
        </div>

        <section aria-labelledby="cond-h">
          <div className="flex items-center justify-between"><h3 id="cond-h" className="text-sm font-bold">Conditions <span className="font-normal text-slate-500">(all must match; none = always run)</span></h3>
            <Button size="sm" onClick={() => setConds([...conds, { field: fieldHints[0] ?? '', op: 'eq', value: '' }])}><Plus className="h-3 w-3" /> Add</Button></div>
          <datalist id="payload-fields">{fieldHints.map((f) => <option key={f} value={f} />)}</datalist>
          <div className="mt-2 space-y-2">
            {conds.map((c, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center">
                <Input aria-label="Condition field" list="payload-fields" className="flex-1 min-w-[160px]" value={c.field} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} placeholder="lead.leadScore" />
                <Select aria-label="Operator" className="w-32" value={c.op} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}>{(meta.data?.operators ?? ['eq']).map((o: string) => <option key={o}>{o}</option>)}</Select>
                {c.op !== 'exists' && <Input aria-label="Value" className="w-44" value={c.value} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder={c.op === 'in' ? 'a, b, c' : 'value'} />}
                <Button size="sm" variant="ghost" aria-label="Remove condition" onClick={() => setConds(conds.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
              </div>))}
            {!conds.length && <p className="text-sm text-slate-500">Runs every time the trigger fires.</p>}
          </div>
        </section>

        <section aria-labelledby="act-h">
          <div className="flex items-center justify-between"><h3 id="act-h" className="text-sm font-bold">Actions <span className="font-normal text-slate-500">(run in order; stops at the first failure)</span></h3>
            <Button size="sm" onClick={() => setActs([...acts, { type: 'create_activity', params: {} }])}><Plus className="h-3 w-3" /> Add</Button></div>
          <div className="mt-2 space-y-3">
            {acts.map((a, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-500">{i + 1}</span>
                  <Select aria-label={`Action ${i + 1} type`} value={a.type} onChange={(e) => setActs(acts.map((x, j) => (j === i ? { type: e.target.value, params: defaultParams(e.target.value) } : x)))}>
                    {(meta.data?.actions ?? []).map((m: any) => <option key={m.type} value={m.type}>{m.label}</option>)}</Select>
                  <Button size="sm" variant="ghost" aria-label={`Remove action ${i + 1}`} onClick={() => setActs(acts.filter((_, j) => j !== i))} disabled={acts.length === 1}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(ACTION_FIELDS[a.type] ?? []).map((f) => (
                    <Field key={f.name} label={f.label} required={f.required} help={f.help}>{(id) => {
                      const setP = (v: any) => setActs(acts.map((x, j) => (j === i ? { ...x, params: { ...x.params, [f.name]: v } } : x)));
                      if (f.kind === 'select') {
                        let opts = optionsFor(a.type, f.name, f.options);
                        if (f.name === 'campaignId') opts = (campaigns.data?.items ?? []).filter((c: any) => !['completed', 'archived'].includes(c.status)).map((c: any) => c.id);
                        if (f.name === 'agentKey') opts = (agents.data?.agents ?? []).map((x: any) => x.key);
                        return <Select id={id} value={a.params[f.name] ?? ''} onChange={(e) => setP(e.target.value)}>{(f.required || opts[0] !== '') && <option value="">— Choose —</option>}{opts.map((o: string) => <option key={o} value={o}>{labelFor(a.type, f.name, o)}</option>)}</Select>;
                      }
                      return <Input id={id} type={f.kind === 'number' ? 'number' : 'text'} value={a.params[f.name] ?? ''} onChange={(e) => setP(e.target.value)} />;
                    }}</Field>))}
                </div>
              </div>))}
          </div>
        </section>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" loading={busy}>{workflow ? 'Save changes' : 'Create workflow'}</Button></div>
      </form>
    </Modal>
  );
}

export default function Workflows() {
  const nav = useNavigate();
  const toast = useToast();
  const { can } = usePermissions();
  const { data, loading, error, reload } = useFetch<any>(() => api.get('/workflows'), []);
  const [building, setBuilding] = useState(false);

  const toggle = async (w: any) => {
    try { await api.patch(`/workflows/${w.id}`, { enabled: !w.enabled }); toast.success(w.enabled ? 'Workflow disabled' : 'Workflow enabled'); reload(); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div>
      <PageHeader title="Workflows" subtitle="When something happens → check conditions → take actions. Every run is recorded."
        actions={can('workflows:manage') ? <Button variant="primary" onClick={() => setBuilding(true)}><Plus className="h-4 w-4" /> New workflow</Button> : undefined} />
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBanner message={error} onRetry={reload} /> : data.items.length === 0 ? (
        <EmptyState title="No workflows yet" hint="Automate follow-ups, assignments and lead handling." action={can('workflows:manage') ? <Button variant="primary" onClick={() => setBuilding(true)}>Create a workflow</Button> : undefined} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.items.map((w: any) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between gap-3">
                <button type="button" className="text-left min-w-0" onClick={() => nav(`/dashboard/workflows/${w.id}`)}>
                  <div className="font-bold text-slate-900 dark:text-white hover:underline">{w.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{w.description}</div>
                </button>
                <button type="button" role="switch" aria-checked={w.enabled} aria-label={`${w.name} enabled`} disabled={!can('workflows:manage')} onClick={() => toggle(w)}
                  className={cx('relative h-6 w-11 shrink-0 rounded-full disabled:opacity-50', w.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}>
                  <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', w.enabled ? 'left-[22px]' : 'left-0.5')} /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><Badge tone="violet">{titleCase(w.triggerType)}</Badge><Badge>{w.conditions.length} condition{w.conditions.length === 1 ? '' : 's'}</Badge><Badge>{w.actions.length} action{w.actions.length === 1 ? '' : 's'}</Badge></div>
              <div className="mt-3 text-xs text-slate-500">{w.runsCount} run{w.runsCount === 1 ? '' : 's'}{w.failedCount > 0 && <span className="text-red-600 font-semibold"> · {w.failedCount} failed</span>} · last run {w.lastRunAt ? relTime(w.lastRunAt) : 'never'}</div>
            </Card>))}
        </div>
      )}
      {building && <WorkflowBuilder onClose={() => setBuilding(false)} onSaved={(w) => { reload(); nav(`/dashboard/workflows/${w.id}`); }} />}
    </div>
  );
}

function StepList({ steps }: { steps: any[] }) {
  if (!steps?.length) return <p className="text-xs text-slate-500">No actions ran.</p>;
  return (
    <ol className="space-y-1 text-xs">{steps.map((s) => (
      <li key={s.index} className="flex gap-2"><StatusBadge value={s.status} /><span className="font-semibold">{titleCase(s.type)}</span>
        <span className={cx('flex-1 break-all', s.status === 'failed' ? 'text-red-600' : 'text-slate-500')}>{s.error ?? JSON.stringify(s.output)}</span></li>))}</ol>
  );
}

export function WorkflowDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = usePermissions();
  const { data, loading, error, reload } = useFetch<any>(() => api.get(`/workflows/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [runKind, setRunKind] = useState<'lead' | 'contact' | 'property'>('lead');
  const [runRecord, setRunRecord] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <div className="space-y-3"><ErrorBanner message={error} onRetry={reload} /><Button onClick={() => nav('/dashboard/workflows')}><ArrowLeft className="h-4 w-4" /> Back</Button></div>;
  const w = data.workflow;

  const run = async () => {
    if (!runRecord) return;
    setRunning(true); setRunResult(null);
    try { const r = await api.post(`/workflows/${w.id}/run`, { [`${runKind}Id`]: runRecord }); setRunResult(r); reload(); toast.success(r.status === 'completed' ? (r.conditionsMet ? 'Workflow ran' : 'Conditions not met — nothing ran') : 'Workflow failed'); }
    catch (e) { toast.error(errorMessage(e)); } finally { setRunning(false); }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => nav('/dashboard/workflows')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Workflows</button>
      <PageHeader title={w.name} subtitle={<span className="flex items-center gap-2"><Badge tone="violet">{titleCase(w.triggerType)}</Badge><StatusBadge value={w.enabled ? 'active' : 'paused'} />{w.description}</span>}
        actions={can('workflows:manage') ? <><Button onClick={() => setEditing(true)}>Edit</Button><Button variant="danger" onClick={() => setDeleting(true)}>Delete</Button></> : undefined} />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Definition">
            <div className="space-y-4 text-sm">
              <div><div className="text-xs font-semibold text-slate-500 mb-1">WHEN</div>{titleCase(w.triggerType)}</div>
              <div><div className="text-xs font-semibold text-slate-500 mb-1">IF</div>{w.conditions.length ? <ul className="list-disc ml-5">{w.conditions.map((c: any, i: number) => <li key={i}><code>{describeCond(c)}</code></li>)}</ul> : 'Always'}</div>
              <div><div className="text-xs font-semibold text-slate-500 mb-1">THEN</div><ol className="list-decimal ml-5 space-y-1">{w.actions.map((a: any, i: number) => <li key={i}>{describeAction(a)}</li>)}</ol></div>
            </div>
          </Card>
          <Card title="Run history">
            {data.runs.length === 0 ? <p className="text-sm text-slate-500">This workflow has not run yet.</p> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">{data.runs.map((r: any) => (
                <li key={r.id} className="py-2">
                  <button type="button" className="w-full flex items-center gap-3 text-sm text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                    {open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<StatusBadge value={r.status} />
                    <span className="flex-1">{r.conditionsMet === false ? 'Skipped — conditions not met' : `${r.steps.length} action${r.steps.length === 1 ? '' : 's'}`} · {titleCase(r.triggerType)}</span>
                    <span className="text-xs text-slate-500">{fmtDateTime(r.createdAt)}</span></button>
                  {open === r.id && <div className="mt-2 ml-7 space-y-2">{r.error && <ErrorBanner message={r.error} />}<StepList steps={r.steps} /></div>}
                </li>))}</ul>)}
          </Card>
        </div>
        <div>
          {can('workflows:run') && (
            <Card title="Test run on a record">
              <p className="text-xs text-slate-500 mb-3">Runs this workflow now against a real record. Its actions make real (logged) changes to that record.</p>
              <div className="space-y-3">
                <Select aria-label="Record type" value={runKind} onChange={(e) => { setRunKind(e.target.value as any); setRunRecord(null); }}><option value="lead">Lead</option><option value="contact">Contact</option><option value="property">Property</option></Select>
                <RecordPicker key={runKind} kind={(runKind === 'lead' ? 'leads' : runKind === 'contact' ? 'contacts' : 'properties')} value={runRecord} onChange={setRunRecord} />
                <Button variant="primary" loading={running} disabled={!runRecord} onClick={run}><Play className="h-4 w-4" /> Run now</Button>
              </div>
              {runResult && <div className="mt-4 space-y-2" role="status"><div className="flex items-center gap-2"><StatusBadge value={runResult.status} /><span className="text-xs text-slate-500">{runResult.conditionsMet ? 'Conditions met' : 'Conditions not met'}</span></div>{runResult.error && <ErrorBanner message={runResult.error} />}<StepList steps={runResult.steps} /></div>}
            </Card>)}
        </div>
      </div>
      {editing && <WorkflowBuilder workflow={w} onClose={() => setEditing(false)} onSaved={reload} />}
      {deleting && <ConfirmDialog title="Delete workflow?" danger confirmLabel="Delete" message={`“${w.name}” and its run history will be permanently deleted. Changes it already made to records are not undone.`} onClose={() => setDeleting(false)}
        onConfirm={async () => { await api.del(`/workflows/${w.id}`); toast.success('Workflow deleted'); nav('/dashboard/workflows'); }} />}
    </div>
  );
}
void recordPath;

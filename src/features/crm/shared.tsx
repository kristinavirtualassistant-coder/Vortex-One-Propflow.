import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { api, errorMessage } from './api';
import { fmtDateTime, relTime, titleCase } from './format';
import { Button, Card, EmptyState, FormModal, StatusBadge, Textarea, useToast, type FieldDef } from './ui';

export const recordPath = (type: string, id: string) => {
  switch (type) {
    case 'contact': return `/dashboard/contacts/${id}`;
    case 'lead': return `/dashboard/leads/${id}`;
    case 'property': return `/dashboard/properties/${id}`;
    case 'owner': return `/dashboard/owners/${id}`;
    case 'campaign': return `/dashboard/campaigns/${id}`;
    default: return '/dashboard/tasks';
  }
};

export const RecordLink = ({ type, id, children }: { type: string; id: string | null | undefined; children: React.ReactNode }) =>
  id ? <Link to={recordPath(type, id)} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{children}</Link> : <>{children}</>;

export function ActivityTimeline({ items, empty = 'No activity yet' }: { items: any[]; empty?: string }) {
  if (!items?.length) return <EmptyState title={empty} />;
  return (
    <ol className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.actorKind === 'workflow' ? 'bg-indigo-500' : a.actorKind === 'agent' ? 'bg-sky-500' : a.actorKind === 'system' ? 'bg-slate-400' : 'bg-indigo-500'}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-slate-800 dark:text-slate-200">{a.summary}</p>
            <p className="text-xs text-slate-500" title={fmtDateTime(a.createdAt)}>
              {a.actorKind !== 'user' ? titleCase(a.actorKind) : a.actorName ?? 'User'} · {relTime(a.createdAt)} · {titleCase(a.type)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function NotesPanel({ notes, refs, onChanged }: { notes: any[]; refs: Record<string, string | null | undefined>; onChanged: () => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try { await api.post('/notes', { body, ...refs }); setBody(''); toast.success('Note added'); onChanged(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div>
      <form onSubmit={add} className="space-y-2">
        <label htmlFor="note-body" className="sr-only">New note</label>
        <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" />
        <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!body.trim()}>Add note</Button>
      </form>
      <ul className="mt-4 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-sm">
            <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{n.body}</p>
            <p className="mt-1 text-xs text-slate-500">{n.authorName ?? 'System'} · {fmtDateTime(n.createdAt)}</p>
          </li>
        ))}
        {!notes.length && <li className="text-sm text-slate-500">No notes yet.</li>}
      </ul>
    </div>
  );
}

export const taskFields = (extra: FieldDef[] = []): FieldDef[] => [
  { name: 'title', label: 'Task', required: true, span: 2 },
  { name: 'dueAt', label: 'Due', type: 'date' },
  { name: 'priority', label: 'Priority', type: 'select', required: true, options: ['low', 'normal', 'high', 'urgent'].map((v) => ({ value: v, label: titleCase(v) })) },
  { name: 'assignedUserId', label: 'Assigned to', type: 'record', record: 'users' },
  ...extra,
  { name: 'description', label: 'Details', type: 'textarea' },
];

/** `due` from a date input (YYYY-MM-DD) to an ISO timestamp at 17:00 local. */
export const dueToIso = (d: string | undefined) => (d ? new Date(`${d}T17:00:00`).toISOString() : null);

export function TasksPanel({ tasks, refs, onChanged }: { tasks: any[]; refs: Record<string, string | null | undefined>; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const toggle = async (t: any) => {
    try { await api.patch(`/tasks/${t.id}`, { status: t.status === 'done' ? 'open' : 'done' }); onChanged(); toast.success(t.status === 'done' ? 'Task reopened' : 'Task completed'); }
    catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 text-sm">
            <button type="button" onClick={() => toggle(t)} aria-label={t.status === 'done' ? `Reopen ${t.title}` : `Complete ${t.title}`}
              className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
              {t.status === 'done' && <Check className="h-3 w-3" />}
            </button>
            <span className={`flex-1 ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{t.title}</span>
            {t.status === 'open' && t.dueAt && <span className={`text-xs ${new Date(t.dueAt) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{relTime(t.dueAt)}</span>}
            <StatusBadge value={t.priority !== 'normal' ? t.priority : null} />
          </li>
        ))}
        {!tasks.length && <li className="text-sm text-slate-500">No tasks.</li>}
      </ul>
      <Button size="sm" className="mt-3" onClick={() => setAdding(true)}><Plus className="h-3 w-3" /> Add task</Button>
      {adding && (
        <FormModal title="New task" fields={taskFields()} initial={{ priority: 'normal' }} submitLabel="Create task" onClose={() => setAdding(false)}
          onSubmit={async (v) => {
            await api.post('/tasks', { title: v.title, description: v.description || null, dueAt: dueToIso(v.dueAt), priority: v.priority, assignedUserId: v.assignedUserId || undefined, ...refs });
            toast.success('Task created'); onChanged();
          }} />
      )}
    </div>
  );
}

export function CallsTable({ calls }: { calls: any[] }) {
  if (!calls?.length) return <EmptyState title="No calls yet" />;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
      {calls.map((c) => (
        <li key={c.id} className="py-2 flex items-center gap-3">
          <StatusBadge value={c.outcome ?? c.status} />
          <span className="flex-1 text-slate-700 dark:text-slate-200">{c.contactName ?? c.toNumber}{c.isSimulated && <span className="ml-2 text-[10px] font-bold uppercase text-amber-600">simulated</span>}</span>
          <span className="text-xs text-slate-500">{fmtDateTime(c.startedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return <Card title={title} actions={actions}>{children}</Card>;
}

export function Facts({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{v ?? '—'}</dd></div>
      ))}
    </dl>
  );
}

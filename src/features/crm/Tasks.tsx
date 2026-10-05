import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { api, errorMessage } from './api';
import { relTime } from './format';
import { RecordLink, dueToIso, taskFields } from './shared';
import { Button, DataTable, FormModal, Input, PageHeader, Pagination, Select, StatusBadge, cx, useList, useToast, type Column } from './ui';

export default function Tasks() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useList<any>('tasks', { status, assignedUserId: mine ? 'me' : undefined });

  const toggle = async (t: any) => {
    try { await api.patch(`/tasks/${t.id}`, { status: t.status === 'done' ? 'open' : 'done' }); toast.success(t.status === 'done' ? 'Task reopened' : 'Task completed'); list.reload(); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  const columns: Column<any>[] = [
    { key: 'done', header: '', className: 'w-10', render: (t) => (
      <button type="button" onClick={(e) => { e.stopPropagation(); toggle(t); }} aria-label={t.status === 'done' ? `Reopen ${t.title}` : `Complete ${t.title}`}
        className={cx('h-5 w-5 rounded-md border flex items-center justify-center', t.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600')}>{t.status === 'done' && <Check className="h-3 w-3" />}</button>) },
    { key: 'title', header: 'Task', sort: 'created', render: (t) => <span className={cx('font-medium', t.status === 'done' && 'line-through text-slate-400')}>{t.title}</span> },
    { key: 'related', header: 'Related', render: (t) => (
      <span className="text-xs space-x-2">
        {t.leadId && <RecordLink type="lead" id={t.leadId}>{t.leadTitle ?? 'Lead'}</RecordLink>}
        {t.contactId && <RecordLink type="contact" id={t.contactId}>{t.contactName ?? 'Contact'}</RecordLink>}
        {t.propertyId && <RecordLink type="property" id={t.propertyId}>{t.propertyAddress ?? 'Property'}</RecordLink>}
      </span>) },
    { key: 'due', header: 'Due', sort: 'due', render: (t) => <span className={cx(t.status === 'open' && t.dueAt && new Date(t.dueAt) < new Date() && 'text-red-600 font-semibold')}>{t.dueAt ? `${new Date(t.dueAt).toLocaleDateString()} (${relTime(t.dueAt)})` : '—'}</span> },
    { key: 'priority', header: 'Priority', sort: 'priority', render: (t) => <StatusBadge value={t.priority} /> },
    { key: 'assigned', header: 'Assigned', render: (t) => t.assignedUserName ?? '—' },
  ];

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Follow-ups and to-dos across leads, contacts and properties."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New task</Button>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[220px]"><Input aria-label="Search tasks" value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Search tasks" /></div>
        <Select aria-label="Status" className="w-36" value={status} onChange={(e) => { setStatus(e.target.value); list.setOffset(0); }}><option value="open">Open</option><option value="done">Done</option><option value="all">All</option></Select>
        <Select aria-label="Due" className="w-40" value={list.filters.due ?? ''} onChange={(e) => list.setFilter('due', e.target.value)}><option value="">Any due date</option><option value="overdue">Overdue</option><option value="today">Due today</option></Select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me</label>
      </div>
      <DataTable columns={columns} rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} sort={list.sort} dir={list.dir} onSort={list.toggleSort}
        emptyTitle={status === 'open' ? 'No open tasks — you’re all caught up' : 'No tasks found'} emptyHint="Tasks are created from leads, contacts, calls and workflows."
        emptyAction={<Button variant="primary" onClick={() => setCreating(true)}>New task</Button>} />
      {list.data && <Pagination total={list.data.total} limit={list.pageSize} offset={list.offset} onChange={list.setOffset} />}
      {creating && (
        <FormModal title="New task" wide submitLabel="Create task" onClose={() => setCreating(false)} initial={{ priority: 'normal' }}
          fields={taskFields([{ name: 'leadId', label: 'Lead', type: 'record', record: 'leads' }, { name: 'contactId', label: 'Contact', type: 'record', record: 'contacts' }, { name: 'propertyId', label: 'Property', type: 'record', record: 'properties' }])}
          onSubmit={async (v) => {
            await api.post('/tasks', { title: v.title, description: v.description || null, dueAt: dueToIso(v.dueAt), priority: v.priority, assignedUserId: v.assignedUserId || undefined,
              leadId: v.leadId || undefined, contactId: v.contactId || undefined, propertyId: v.propertyId || undefined });
            toast.success('Task created'); list.reload();
          }} />
      )}
    </div>
  );
}

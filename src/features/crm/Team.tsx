import React, { useState } from 'react';
import { RotateCcw, UserPlus } from 'lucide-react';
import { api, errorMessage } from './api';
import { fmtDate, titleCase } from './format';
import { usePermissions } from './permissions';
import { Badge, Button, Card, ConfirmDialog, DataTable, FormModal, PageHeader, Select, useFetch, useToast, type Column } from './ui';

const ROLES = ['admin', 'property_manager', 'sales', 'landlord'];

export default function Team() {
  const toast = useToast();
  const { can, isDemo, role, userId } = usePermissions();
  const org = useFetch<any>(() => api.get('/org'), []);
  const members = useFetch<any>(() => api.get('/org/members'), []);
  const [adding, setAdding] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const manage = can('members:manage');

  const update = async (id: string, body: any, ok: string) => {
    try { await api.patch(`/org/members/${id}`, body); toast.success(ok); members.reload(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', render: (m) => <span className="font-semibold">{m.name}{m.id === userId && <span className="ml-2 text-xs text-slate-500">(you)</span>}</span> },
    { key: 'email', header: 'Email', render: (m) => (isDemo && m.email.endsWith('@demo.invalid') ? <span className="text-slate-400">demo account</span> : m.email) },
    { key: 'role', header: 'Role', render: (m) => (manage && m.id !== userId && !isDemo
      ? <Select aria-label={`Role for ${m.name}`} className="w-44" value={m.role} onChange={(e) => update(m.id, { role: e.target.value }, 'Role updated')} disabled={m.role === 'admin' && role !== 'admin'}>
        {[...new Set([...ROLES, m.role])].map((r) => <option key={r} value={r} disabled={r === 'admin' && role !== 'admin'}>{titleCase(r)}</option>)}</Select>
      : <Badge tone="violet">{titleCase(m.role)}</Badge>) },
    { key: 'status', header: 'Status', render: (m) => (m.disabledAt ? <Badge tone="red">Disabled</Badge> : <Badge tone="green">Active</Badge>) },
    { key: 'last', header: 'Last sign-in', render: (m) => fmtDate(m.lastLoginAt) },
    { key: 'act', header: '', render: (m) => (manage && m.id !== userId && !isDemo ? <Button size="sm" onClick={() => update(m.id, { disabled: !m.disabledAt }, m.disabledAt ? 'Member re-enabled' : 'Member disabled and signed out')}>{m.disabledAt ? 'Enable' : 'Disable'}</Button> : null) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Team & workspace" subtitle={org.data ? <>Workspace: <b>{org.data.organization.name}</b></> : undefined}
        actions={manage && !isDemo ? <Button variant="primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Add team member</Button> : undefined} />
      {isDemo && (
        <Card title="Demo workspace">
          <p className="text-sm text-slate-600 dark:text-slate-300">You are in an isolated demo workspace with fictional data. Nothing here touches real customers, and calls are simulated: no real calls, texts or emails are ever sent. It is deleted automatically after 24 hours{org.data?.organization.demoExpiresAt ? ` (${new Date(org.data.organization.demoExpiresAt).toLocaleString()})` : ''}.</p>
          <div className="mt-4"><Button variant="danger" onClick={() => setResetOpen(true)}><RotateCcw className="h-4 w-4" /> Reset demo data</Button></div>
        </Card>)}
      <DataTable columns={columns} rows={members.data?.items} loading={members.loading} error={members.error} onRetry={members.reload} emptyTitle="No team members" />
      {!manage && <p className="text-xs text-slate-500">Only managers and admins can add or change team members.</p>}
      {adding && (
        <FormModal title="Add team member" submitLabel="Create account" onClose={() => setAdding(false)} initial={{ role: 'sales' }}
          fields={[
            { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'role', label: 'Role', type: 'select', required: true, options: ROLES.filter((r) => r !== 'admin' || role === 'admin').map((r) => ({ value: r, label: titleCase(r) })) },
            { name: 'password', label: 'Temporary password', required: true, help: 'At least 10 characters. Share it securely; they can change it after signing in.' },
          ]}
          onSubmit={async (v) => { await api.post('/org/members', { name: v.name, email: v.email, role: v.role, password: v.password }); toast.success('Team member added'); members.reload(); }} />)}
      {resetOpen && <ConfirmDialog title="Reset demo data?" danger confirmLabel="Reset demo data" message="All changes you made in this demo are deleted and the original sample data is restored." onClose={() => setResetOpen(false)}
        onConfirm={async () => { await api.post('/demo/reset'); toast.success('Demo data reset'); window.location.assign('/dashboard'); }} />}
    </div>
  );
}

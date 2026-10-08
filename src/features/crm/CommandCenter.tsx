import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from './api';
import { money, relTime, titleCase } from './format';
import { ActivityTimeline, RecordLink } from './shared';
import { usePermissions } from './permissions';
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, Stat, StatusBadge, useFetch } from './ui';

const STAGE_ORDER = ['identified', 'contacted', 'qualified', 'appointment', 'negotiating', 'won', 'lost'];

export default function CommandCenter() {
  const nav = useNavigate();
  const { isDemo } = usePermissions();
  const { data, loading, error, reload } = useFetch<any>(() => api.get('/dashboard'), []);
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBanner message={error} onRetry={reload} />;
  const { counts: c, calls, pipeline } = data;
  const pipelineData = STAGE_ORDER.map((s) => ({ stage: titleCase(s), Leads: pipeline.find((p: any) => p.stage === s)?.count ?? 0 }));
  const empty = c.contacts === 0 && c.properties === 0 && c.openLeads === 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Command Center" subtitle="Live view of your pipeline, outreach and automation." />
      {isDemo && <div role="note" className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-100">
        <b>Demo workspace.</b> Everything here is fictional and fully interactive. Calls are simulated. Use <button type="button" className="underline font-semibold" onClick={() => nav('/dashboard/team')}>Team & workspace → Reset demo data</button> to start over.</div>}
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {empty && <Card><EmptyState title="Your workspace is empty" hint="Add your first property or contact to see metrics here." action={<div className="flex gap-2"><Button variant="primary" onClick={() => nav('/dashboard/properties')}>Add a property</Button><Button onClick={() => nav('/dashboard/contacts')}>Add a contact</Button></div>} /></Card>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Open leads" value={c.openLeads} hint={`${money(c.pipelineValue)} pipeline`} />
        <Stat label="Properties / owners" value={`${c.properties} / ${c.owners}`} />
        <Stat label="Open tasks" value={c.openTasks} hint={c.overdueTasks ? `${c.overdueTasks} overdue` : 'none overdue'} tone={c.overdueTasks ? 'red' : undefined} />
        <Stat label="Active campaigns" value={c.activeCampaigns} hint={`${c.contacts} contacts`} />
        <Stat label="Calls (30d)" value={calls.last30Days} hint="simulated dialer" />
        <Stat label="Connect rate" value={`${calls.connectRate}%`} hint={`${calls.connected} connected`} />
        <Stat label="Appointments (30d)" value={calls.appointments} />
        <Stat label="Workflow runs (30d)" value={data.workflows.runs30Days} hint={data.workflows.failed ? `${data.workflows.failed} failed` : 'no failures'} tone={data.workflows.failed ? 'red' : undefined} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Pipeline by stage">
          <div role="img" aria-label={`Leads by stage: ${pipelineData.map((p) => `${p.stage} ${p.Leads}`).join(', ')}`} className="h-64">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={pipelineData} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="stage" interval={0} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="Leads" fill="#6548f5" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </Card>
        <Card title="Calls, last 7 days">
          <div role="img" aria-label={`Calls per day: ${calls.byDay.map((d: any) => `${d.day} ${d.calls}`).join(', ')}`} className="h-64">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={calls.byDay.map((d: any) => ({ day: d.day.slice(5), Calls: d.calls, Connected: d.connected }))} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="Calls" fill="#94a3b8" radius={[6, 6, 0, 0]} /><Bar dataKey="Connected" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Top leads" actions={<Button size="sm" onClick={() => nav('/dashboard/leads')}>All leads</Button>}>
          {data.hotLeads.length ? <ul className="space-y-3 text-sm">{data.hotLeads.map((l: any) => (
            <li key={l.id} className="flex items-center gap-3"><div className="flex-1 min-w-0"><RecordLink type="lead" id={l.id}>{l.title}</RecordLink><div className="text-xs text-slate-500 truncate">{l.propertyAddress}</div></div><StatusBadge value={l.stage} /><Badge tone={l.classification === 'hot' ? 'green' : l.classification === 'warm' ? 'amber' : 'slate'}>{l.leadScore}</Badge></li>))}</ul>
            : <EmptyState title="No open leads" />}
        </Card>
        <Card title="Upcoming tasks" actions={<Button size="sm" onClick={() => nav('/dashboard/tasks')}>All tasks</Button>}>
          {data.upcomingTasks.length ? <ul className="space-y-2 text-sm">{data.upcomingTasks.map((t: any) => (
            <li key={t.id} className="flex items-center gap-2"><span className="flex-1">{t.leadId ? <RecordLink type="lead" id={t.leadId}>{t.title}</RecordLink> : t.title}</span><span className={`text-xs ${t.dueAt && new Date(t.dueAt) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{relTime(t.dueAt)}</span></li>))}</ul>
            : <EmptyState title="Nothing due" />}
        </Card>
        <Card title="Recent activity"><ActivityTimeline items={data.recentActivity} /></Card>
      </div>
    </div>
  );
}

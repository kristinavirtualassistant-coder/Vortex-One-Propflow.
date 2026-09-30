import React from 'react';
import { ShieldAlert, Users, Settings, Database, Activity, ArrowUpRight, Server, LockKeyhole } from 'lucide-react';
import AdminAuditLog from '../../components/AdminAuditLog';

function Metric({ label, value, detail, icon: Icon, tone = 'violet' }: { label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }>; tone?: 'violet' | 'emerald' | 'amber' }) {
  const tones = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>;
}

export default function AdminPortal({ activeTab = 'dashboard' }: { activeTab?: string }) {
  if (activeTab === 'dashboard') {
    return (
      <div className="min-h-full space-y-6">
        <section className="relative overflow-hidden rounded-[22px] bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(124,58,237,.28),transparent_38%),radial-gradient(circle_at_10%_100%,rgba(6,182,212,.16),transparent_35%)]" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Platform control center</div><h2 className="text-3xl font-black tracking-tight md:text-4xl">System command center</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Monitor platform health, user activity, security posture, and operational events from one controlled workspace.</p></div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"><Server className="h-5 w-5 text-cyan-300" /><div><p className="text-xs font-semibold text-white">All core services operational</p><p className="text-[11px] text-slate-400">Last platform check: live</p></div></div>
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total users" value="1,248" detail="+38 this month" icon={Users} /><Metric label="System health" value="99.9%" detail="Core services available" icon={Activity} tone="emerald" /><Metric label="Security events" value="12" detail="Requires review" icon={ShieldAlert} tone="amber" /><Metric label="Data services" value="4/4" detail="Connected and responding" icon={Database} /></div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Audit stream</p><h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Recent platform activity</h3></div><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live</span></div><div className="h-[560px] overflow-auto"><AdminAuditLog /></div></section>
          <aside className="space-y-4"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-600 dark:text-violet-400"><LockKeyhole className="h-5 w-5" /></div><div><p className="font-bold text-slate-950 dark:text-white">Security posture</p><p className="text-xs text-slate-500">Access controls are active</p></div></div><div className="mt-5 space-y-3 text-sm">{['Role permissions','Authentication','Audit logging'].map(item => <div key={item} className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><span className="text-slate-600 dark:text-slate-300">{item}</span><span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Healthy</span></div>)}</div></div><div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70"><Settings className="h-5 w-5 text-slate-500" /><h3 className="mt-3 font-bold text-slate-950 dark:text-white">Administration</h3><p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Manage users, roles, system configuration, and connected services.</p><button className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-violet-600 dark:text-violet-400">Open controls <ArrowUpRight className="h-4 w-4" /></button></div></aside>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-center text-slate-500">
      Admin view for {activeTab} is under construction.
    </div>
  );
}

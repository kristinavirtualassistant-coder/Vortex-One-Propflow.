import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Search, Activity, Database, Wrench, Users, FileText, MessageSquare, Bot, Settings, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react';

type Module = { id:string; label:string; description:string; icon:React.ElementType; href:string; status:'live'|'partial'|'blocked' };

const modules: Module[] = [
  {id:'overview',label:'Overview',description:'Organization-wide operating view',icon:Activity,href:'/dashboard',status:'live'},
  {id:'properties',label:'Property intelligence',description:'Search, import, owners and lead signals',icon:Database,href:'/dashboard/property-search',status:'live'},
  {id:'prospecting',label:'Prospecting',description:'Lead discovery and pipeline actions',icon:Search,href:'/dashboard/prospecting',status:'partial'},
  {id:'crm',label:'CRM & workflows',description:'Contacts, leads and workflow state',icon:Users,href:'/dashboard/crm',status:'partial'},
  {id:'operations',label:'Maintenance & operations',description:'Requests, dispatch and technician work',icon:Wrench,href:'/dashboard/maintenance',status:'live'},
  {id:'communications',label:'Communications',description:'Messages and operational coordination',icon:MessageSquare,href:'/dashboard/communications',status:'partial'},
  {id:'documents',label:'Documents & leasing',description:'Leases, files and compliance records',icon:FileText,href:'/dashboard/documents',status:'partial'},
  {id:'ai',label:'AI assistant',description:'Server-side Gemini workflows',icon:Bot,href:'/dashboard/ai',status:'live'},
  {id:'integrations',label:'Integrations',description:'Real connection health and webhooks',icon:Link2,href:'/dashboard/integrations',status:'live'},
  {id:'settings',label:'Security & settings',description:'Account, access and configuration',icon:Settings,href:'/dashboard/security',status:'live'}
];

const statusTone = { live:'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900', partial:'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900', blocked:'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900' };

export default function PropFlowWorkspace(){
  const [health,setHealth] = useState<'loading'|'ready'|'degraded'>('loading');
  const [query,setQuery] = useState('');
  const [lastChecked,setLastChecked] = useState<string>('—');

  const refresh = async () => {
    setHealth('loading');
    try {
      const r = await fetch('/api/ready',{credentials:'same-origin',cache:'no-store'});
      setHealth(r.ok ? 'ready' : 'degraded');
    } catch { setHealth('degraded'); }
    setLastChecked(new Date().toLocaleTimeString());
  };
  useEffect(()=>{ void refresh(); },[]);

  const filtered = useMemo(()=>modules.filter(m => `${m.label} ${m.description}`.toLowerCase().includes(query.toLowerCase())),[query]);

  return <div className="space-y-8">
    <section className="rounded-3xl border border-slate-800/80 bg-[#0b1120] text-white p-7 md:p-9 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(99,102,241,.26),transparent_28%),radial-gradient(circle_at_15%_90%,rgba(34,211,238,.12),transparent_25%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] uppercase tracking-[0.16em] text-slate-400"><span>Vortex One</span><span>•</span><span>PropFlow workspace</span></div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div><h2 className="text-3xl md:text-4xl font-black tracking-tight">A real workspace, not a demo page.</h2><p className="mt-3 max-w-2xl text-slate-300">Each module below is tied to a route or an explicit integration state. No fake “connected” badges and no dead-end navigation.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 min-w-[220px]">
            <div className="flex items-center justify-between gap-4"><span className="text-xs text-slate-400">Backend readiness</span><span className={`text-xs font-bold ${health==='ready'?'text-emerald-400':health==='degraded'?'text-rose-400':'text-amber-300'}`}>{health==='ready'?'READY':health==='degraded'?'DEGRADED':'CHECKING'}</span></div>
            <div className="mt-2 text-[11px] text-slate-500">Last checked {lastChecked}</div>
            <button type="button" onClick={()=>void refresh()} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md"><RefreshCw className="h-3.5 w-3.5"/>Recheck</button>
          </div>
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((m)=>{ const Icon=m.icon; return <a key={m.id} href={m.href} className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <div className="flex items-start justify-between gap-4"><div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><Icon className="h-5 w-5"/></div><span className={`px-2 py-1 rounded-full border text-[10px] font-bold uppercase ${statusTone[m.status]}`}>{m.status==='live'?'Live':m.status==='partial'?'In progress':'Blocked'}</span></div>
        <div className="mt-5"><h3 className="font-bold text-slate-900 dark:text-white text-base">{m.label}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400 min-h-[40px]">{m.description}</p></div>
        <div className="mt-5 flex items-center justify-between text-sm font-semibold text-indigo-600 dark:text-indigo-400"><span>Open module</span><ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform"/></div>
      </a>})}
    </section>

    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h3 className="font-bold text-slate-900 dark:text-white">Find a capability</h3><p className="text-sm text-slate-500 dark:text-slate-400">Search by what you need to do, then open the real workflow.</p></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search capabilities" placeholder="Search modules..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div></div>
    </section>
  </div>;
}

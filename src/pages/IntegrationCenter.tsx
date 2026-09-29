import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Link2, Webhook, ExternalLink, AlertTriangle } from 'lucide-react';

type ThreeMinEndpoint={id:string;endpointName:string;apiUrl:string;productionIsActive:boolean;sandboxIsActive:boolean;description?:string};

type Probe={status:'idle'|'checking'|'success'|'failed';message?:string};

export default function IntegrationCenter(){
 const [health,setHealth]=useState<any>(null); const [endpoint,setEndpoint]=useState<ThreeMinEndpoint|null>(null); const [probe,setProbe]=useState<Probe>({status:'idle'}); const [busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);try{const [h,e]=await Promise.all([fetch('/api/health',{cache:'no-store'}),fetch('/api/integrations/3min/status',{credentials:'same-origin',cache:'no-store'})]);setHealth(await h.json());if(e.ok)setEndpoint(await e.json());}catch(err:any){setHealth({status:'error',error:err.message});}finally{setBusy(false)}};
 useEffect(()=>{void load()},[]);
 const test=async()=>{setProbe({status:'checking'});try{const r=await fetch('/api/integrations/3min/test',{method:'POST',credentials:'same-origin'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Integration test failed');setProbe({status:'success',message:d.message||'Sandbox event accepted.'});}catch(err:any){setProbe({status:'failed',message:err.message});}};
 return <div className="space-y-6">
  <div><h2 className="text-2xl font-black text-slate-900 dark:text-white">Integration Center</h2><p className="text-slate-500 dark:text-slate-400">Only show an integration as live when its connection is actually verified.</p></div>
  <div className="grid gap-5 lg:grid-cols-2">
   <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
    <div className="flex items-start justify-between"><div><div className="h-11 w-11 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400"><Webhook className="h-5 w-5"/></div><h3 className="mt-4 font-bold text-slate-900 dark:text-white">3Min API</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Event ingestion and webhook delivery into PropFlow.</p></div><span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Configured</span></div>
    <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2 text-xs"><div className="flex justify-between gap-4"><span className="text-slate-500">Endpoint</span><span className="font-mono text-slate-700 dark:text-slate-300 break-all">{endpoint?.endpointName||'Loading…'}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Production</span><span>{endpoint?.productionIsActive?<CheckCircle2 className="inline h-4 w-4 text-emerald-500"/>:<XCircle className="inline h-4 w-4 text-rose-500"/>}</span></div></div>
    <button type="button" onClick={()=>void test()} disabled={probe.status==='checking'} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${probe.status==='checking'?'animate-spin':''}`}/>Test sandbox event</button>
    {probe.status!=='idle'&&<div className={`mt-3 rounded-xl border p-3 text-sm ${probe.status==='success'?'border-emerald-200 bg-emerald-50 text-emerald-700':probe.status==='failed'?'border-rose-200 bg-rose-50 text-rose-700':'border-amber-200 bg-amber-50 text-amber-700'}`}>{probe.message||'Testing…'}</div>}
   </div>
   <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-6">
    <div className="flex items-start gap-3"><AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5"/><div><h3 className="font-bold text-amber-900 dark:text-amber-300">Do not fake connection states</h3><p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">External integrations must be backed by an authenticated server route, a credential handshake, or a verified webhook. UI-only toggles are not treated as connections.</p></div></div>
    <div className="mt-5 grid gap-3 text-sm"><div className="flex items-center justify-between border-b border-amber-200/70 dark:border-amber-900/40 pb-3"><span>Backend health</span><span className="font-semibold">{health?.status||'Checking'}</span></div><div className="flex items-center justify-between"><span>3Min receiver</span><span className="font-semibold">/api/integrations/3min/webhook</span></div></div>
    <a href="https://www.3minapi.com/" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300 hover:underline">Open 3Min API <ExternalLink className="h-3.5 w-3.5"/></a>
   </div>
  </div>
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"><div className="flex items-center gap-3"><Link2 className="h-5 w-5 text-indigo-500"/><div><h3 className="font-bold text-slate-900 dark:text-white">Integration rule</h3><p className="text-sm text-slate-500 dark:text-slate-400">Buttons should perform an action, navigate to a real workflow, or clearly explain why setup is required.</p></div></div></div>
 </div>
}

import React, { useEffect, useState } from 'react';
import { MapPinned, RefreshCw, ExternalLink, Layers3, Database, Smartphone } from 'lucide-react';

type GisMap={id:string;name:string;editor_url:string};

export default function GISWorkspace(){
  const [maps,setMaps]=useState<GisMap[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{
    setLoading(true); setError('');
    try{
      const r=await fetch('/api/integrations/gis-cloud/maps',{credentials:'same-origin',cache:'no-store'});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||'GIS Cloud connection failed');
      setMaps(d.maps||[]);
    }catch(e:any){ setError(e.message||'GIS Cloud connection failed'); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ void load(); },[]);
  return <div className="space-y-6">
    <div className="rounded-3xl border border-slate-800 bg-[#0b1120] text-white p-7">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-2"><MapPinned className="h-4 w-4"/>Vortex One / GIS Cloud</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Spatial intelligence workspace</h2>
          <p className="mt-2 max-w-2xl text-slate-300">Live GIS Cloud maps are surfaced here instead of being represented by a placeholder. Property intelligence can use maps, layers and field-collection data as spatial context.</p>
        </div>
        <button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"><RefreshCw className={loading?'h-4 w-4 animate-spin':'h-4 w-4'}/>Refresh maps</button>
      </div>
    </div>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 p-4">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><Layers3 className="h-5 w-5 text-indigo-500"/><div className="mt-3 font-bold">Maps</div><div className="text-2xl font-black mt-1">{maps.length}</div><div className="text-xs text-slate-500 mt-1">Visible from GIS Cloud</div></div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><Database className="h-5 w-5 text-sky-500"/><div className="mt-3 font-bold">Property intelligence</div><div className="text-sm text-slate-500 mt-1">Designed for parcel, owner and field layers.</div></div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><Smartphone className="h-5 w-5 text-emerald-500"/><div className="mt-3 font-bold">Mobile collection</div><div className="text-sm text-slate-500 mt-1">GIS Cloud MDC projects can be surfaced and linked.</div></div>
    </div>
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      <div className="flex items-center justify-between gap-4 mb-4"><div><h3 className="font-bold text-slate-900 dark:text-white">GIS Cloud maps</h3><p className="text-sm text-slate-500 dark:text-slate-400">Open a map in the GIS Cloud editor to inspect layers and spatial data.</p></div></div>
      <div className="space-y-2">
        {loading && <div className="text-sm text-slate-500">Loading GIS Cloud maps…</div>}
        {!loading && !maps.length && <div className="text-sm text-slate-500">No maps were returned for this account.</div>}
        {!loading && maps.map(m=><a key={m.id} href={m.editor_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
          <div><div className="font-semibold text-slate-900 dark:text-white">{m.name}</div><div className="text-xs text-slate-500">GIS Cloud map ID {m.id}</div></div>
          <ExternalLink className="h-4 w-4 text-indigo-500"/>
        </a>)}
      </div>
    </section>
  </div>;
}

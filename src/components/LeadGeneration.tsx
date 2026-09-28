import React,{useState} from 'react';

export default function LeadGeneration(){
  const [q,setQ]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [items,setItems]=useState<any[]>([]);
  async function run(){setLoading(true);setError('');try{
    const token=localStorage.getItem('vortex_one_session')||'';
    const r=await fetch('/api/properties/search?q='+encodeURIComponent(q)+'&limit=100',{headers:{Authorization:'Bearer '+token}});
    const d=await r.json(); if(!r.ok)throw new Error(d.error||'Lead search failed');
    const ranked=(d.properties||[]).map((p:any)=>{let score=0;const reasons:string[]=[];if(p.vacancy_status==='vacant'){score+=25;reasons.push('Vacant')}if(p.tax_delinquent){score+=25;reasons.push('Tax delinquent')}if(p.pre_foreclosure){score+=30;reasons.push('Pre-foreclosure')}if(p.foreclosure){score+=35;reasons.push('Foreclosure')}if(p.probate){score+=20;reasons.push('Probate')}if(p.owner_occupied===false){score+=15;reasons.push('Absentee owner')}return {...p,score:Math.min(score,100),reasons}}).sort((a:any,b:any)=>b.score-a.score);
    setItems(ranked);
  }catch(err:any){setError(err.message||'Lead search failed')}finally{setLoading(false)}}
  return <div className="max-w-6xl mx-auto space-y-6"><div><h2 className="text-2xl font-bold">Lead Intelligence</h2><p className="text-slate-500">Rank property records using explicit motivation signals. No synthetic scraping results.</p></div>
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border flex gap-3"><input className="flex-1 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800" value={q} onChange={e=>setQ(e.target.value)} placeholder="City, ZIP, county, address or APN"/><button onClick={run} disabled={loading} className="px-6 rounded-lg bg-indigo-600 text-white font-bold">{loading?'Analyzing...':'Find Leads'}</button></div>
    {error&&<div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">{error}</div>}
    <div className="space-y-3">{items.map(p=><div key={p.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border"><div className="flex justify-between"><div><b>{p.address_line1||'Address unavailable'}</b><div className="text-sm text-slate-500">{[p.city,p.state,p.postal_code].filter(Boolean).join(', ')}</div></div><div className="font-bold text-indigo-600">{p.score}/100</div></div><div className="mt-2 text-sm text-slate-600">{p.reasons.length?p.reasons.join(' • '):'No current motivation signals'}</div></div>)}</div>
  </div>;
}
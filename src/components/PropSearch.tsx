import React, { useState } from 'react';

type Property={id:number;apn?:string;address_line1?:string;city?:string;state?:string;postal_code?:string;property_type?:string;bedrooms?:string;bathrooms?:string;living_sqft?:number;estimated_value?:string;estimated_rent?:string;vacancy_status?:string;owner_occupied?:boolean;tax_delinquent?:boolean;pre_foreclosure?:boolean;foreclosure?:boolean;probate?:boolean;owners?:Array<{name:string}>};

export default function PropSearch(){
  const [q,setQ]=useState(''); const [state,setState]=useState(''); const [type,setType]=useState('');
  const [vacant,setVacant]=useState(false); const [tax,setTax]=useState(false); const [pre,setPre]=useState(false);
  const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [items,setItems]=useState<Property[]>([]);
  async function search(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');try{
    const p=new URLSearchParams(); if(q)p.set('q',q); if(state)p.set('state',state); if(type)p.set('propertyType',type);
    if(vacant)p.set('vacant','true'); if(tax)p.set('taxDelinquent','true'); if(pre)p.set('preForeclosure','true'); p.set('limit','100');
    const r=await fetch('/api/properties/search?'+p.toString(),{credentials:'same-origin'});
    const d=await r.json(); if(!r.ok)throw new Error(d.error||'Property search failed'); setItems(d.properties||[]);
  }catch(err:any){setError(err.message||'Property search failed')}finally{setLoading(false)}}
  return <div className="max-w-7xl mx-auto space-y-6">
    <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">Property Intelligence Search</h2><p className="text-slate-500">Search Vortex One property records and owner intelligence.</p></div>
    <form onSubmit={search} className="bg-white dark:bg-slate-900 p-5 rounded-xl border space-y-4">
      <div className="flex gap-3"><input className="flex-1 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800" value={q} onChange={e=>setQ(e.target.value)} placeholder="Address, city, ZIP or APN"/><button disabled={loading} className="px-7 rounded-lg bg-blue-600 text-white font-bold">{loading?'Searching...':'Search'}</button></div>
      <div className="flex flex-wrap gap-4 items-center"><input className="p-2 rounded border" value={state} onChange={e=>setState(e.target.value)} placeholder="State"/><input className="p-2 rounded border" value={type} onChange={e=>setType(e.target.value)} placeholder="Property type"/><label><input type="checkbox" checked={vacant} onChange={e=>setVacant(e.target.checked)}/> Vacant</label><label><input type="checkbox" checked={tax} onChange={e=>setTax(e.target.checked)}/> Tax delinquent</label><label><input type="checkbox" checked={pre} onChange={e=>setPre(e.target.checked)}/> Pre-foreclosure</label></div>
    </form>
    {error&&<div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">{error}</div>}
    <div className="space-y-3">{items.map(p=><div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border">
      <div className="flex justify-between gap-4"><div><h3 className="font-bold text-lg">{p.address_line1||'Address unavailable'}</h3><p className="text-sm text-slate-500">{[p.city,p.state,p.postal_code].filter(Boolean).join(', ')}</p></div><div className="text-right font-bold text-emerald-600">{p.estimated_value?'$'+Number(p.estimated_value).toLocaleString():'No valuation'}</div></div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 text-sm"><div><span className="text-slate-500">Beds/Baths</span><br/><b>{p.bedrooms||'—'} / {p.bathrooms||'—'}</b></div><div><span className="text-slate-500">Sqft</span><br/><b>{p.living_sqft?.toLocaleString()||'—'}</b></div><div><span className="text-slate-500">Rent</span><br/><b>{p.estimated_rent?'$'+Number(p.estimated_rent).toLocaleString():'—'}</b></div><div><span className="text-slate-500">APN</span><br/><b>{p.apn||'—'}</b></div><div><span className="text-slate-500">Owner</span><br/><b>{p.owners?.[0]?.name||'—'}</b></div><div><span className="text-slate-500">Signals</span><br/><b>{[p.vacancy_status==='vacant'?'Vacant':null,p.tax_delinquent?'Tax':null,p.pre_foreclosure?'Pre-FC':null,p.foreclosure?'FC':null,p.probate?'Probate':null].filter(Boolean).join(', ')||'None'}</b></div></div>
    </div>)}</div>
  </div>;
}
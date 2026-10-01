import React from 'react';
import { ArrowUpRight, CircleDot, Link2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';

type EntityTone = 'violet' | 'teal' | 'emerald' | 'amber';

const toneClasses: Record<EntityTone, string> = {
  violet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800',
  teal: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
};

export function IntelligenceEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
      <Sparkles className="h-3 w-3 text-violet-500" aria-hidden="true" />
      {children}
    </div>
  );
}

export function EntityBadge({ tone = 'violet', children }: { tone?: EntityTone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${toneClasses[tone]}`}>{children}</span>;
}

export function ProvenanceStrip({ source, confidence = 'High' }: { source: string; confidence?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
      <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Source: {source}</span>
      <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
      <span>Confidence: {confidence}</span>
    </div>
  );
}

export function RelationshipRow({ kind, label, meta, onOpen }: { kind: string; label: string; meta?: string; onOpen?: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900/70">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <Link2 className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{kind}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
        {meta && <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{meta}</span>}
      </span>
      <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
    </button>
  );
}

export function PropertySnapshot({ address, city, stats }: { address: string; city: string; stats: Array<{label: string; value: string}> }) {
  return (
    <section className="premium-card overflow-hidden">
      <div className="border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
        <IntelligenceEyebrow>Property intelligence</IntelligenceEyebrow>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">{address}</h2>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-3.5 w-3.5" />{city}</div>
          </div>
          <EntityBadge tone="teal"><CircleDot className="h-3 w-3" />Connected</EntityBadge>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y border-b border-slate-200/70 dark:divide-white/10 dark:border-white/10 sm:grid-cols-4 sm:divide-y-0">
        {stats.map((stat) => (
          <div key={stat.label} className="px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{stat.label}</div>
            <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">{stat.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

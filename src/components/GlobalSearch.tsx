import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Command } from 'lucide-react';
import { api, errorMessage } from '../features/crm/api';
import { recordPath } from '../features/crm/shared';
import { usePermissions } from '../features/crm/permissions';

type SearchResult = { type: string; id: string; label: string; sub: string | null };

/** Command-bar search over contacts, leads, properties, owners, campaigns and tasks (server-side, organization-scoped). */
export default function GlobalSearch() {
  const { can } = usePermissions();
  const nav = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); setIsOpen(true); }
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);

  // 300ms debounce; a stale response never overwrites a newer one.
  useEffect(() => {
    const term = text.trim();
    if (term.length < 2) { setResults([]); setLoading(false); setError(null); return; }
    setLoading(true);
    const id = ++seq.current;
    const t = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(term)}`).then(
        (r) => { if (id === seq.current) { setResults(r.results); setActive(0); setError(null); setLoading(false); } },
        (e) => { if (id === seq.current) { setError(errorMessage(e)); setResults([]); setLoading(false); } },
      );
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  if (!can('crm:read')) return <div className="flex-1" />;

  const go = (r: SearchResult) => { nav(recordPath(r.type, r.id)); setIsOpen(false); setText(''); };

  return (
    <div ref={box} className="relative flex-1 max-w-xl">
      <label htmlFor="global-search" className="sr-only">Search records</label>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
      <input id="global-search" ref={input} value={text} role="combobox" aria-expanded={isOpen && text.trim().length >= 2} aria-controls="global-search-results" autoComplete="off"
        onChange={(e) => { setText(e.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) go(results[active]);
        }}
        placeholder="Search contacts, leads, properties, owners…" className="w-full pl-9 pr-16 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-sm" />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Searching" />}
        {text ? <button type="button" aria-label="Clear search" onClick={() => { setText(''); input.current?.focus(); }}><X className="h-4 w-4 text-slate-400" /></button>
          : <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1"><Command className="h-3 w-3" />K</span>}
      </div>
      {isOpen && text.trim().length >= 2 && (
        <ul id="global-search-results" role="listbox" className="absolute z-50 mt-2 w-full max-h-96 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          {error && <li role="alert" className="px-4 py-3 text-sm text-red-600">{error}</li>}
          {!error && !loading && results.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No results for “{text.trim()}”</li>}
          {results.map((r, i) => (
            <li key={`${r.type}-${r.id}`} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => go(r)} onMouseEnter={() => setActive(i)} className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm ${i === active ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                <span className="w-16 shrink-0 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">{r.type}</span>
                <span className="flex-1 min-w-0"><span className="block truncate font-medium text-slate-900 dark:text-white">{r.label}</span>{r.sub && <span className="block truncate text-xs text-slate-500">{r.sub}</span>}</span>
              </button>
            </li>))}
        </ul>)}
    </div>
  );
}

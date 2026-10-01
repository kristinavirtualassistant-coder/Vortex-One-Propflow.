import React, { useEffect, useRef, useState } from 'react';
import { Search, Building2, User, Wrench, X, Loader2, Command } from 'lucide-react';
import { collection, getDocs, limit, query } from '../lib/dataClient';
import { db } from '../lib/dataClient';

type SearchResult = { type: string; id: string; title: string; subtitle: string };

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [composing, setComposing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchData = async () => {
      if (composing || !searchQuery.trim() || searchQuery.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const queryText = searchQuery.trim().toLowerCase();
        const searchResults: SearchResult[] = [];
        const maintenance = await getDocs(query(collection(db, 'maintenance_requests'), limit(50)));

        maintenance.docs.forEach((doc) => {
          const data = doc.data() as Record<string, any>;
          const title = String(data.title ?? '');
          const description = String(data.description ?? '');
          if (title.toLowerCase().includes(queryText) || description.toLowerCase().includes(queryText)) {
            searchResults.push({
              type: 'maintenance',
              id: doc.id,
              title: title || 'Maintenance request',
              subtitle: `Status: ${String(data.status ?? 'unknown').replace('_', ' ')} • Priority: ${String(data.priority ?? 'normal')}`,
            });
          }
        });

        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = window.setTimeout(searchData, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery, composing]);

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const getIcon = (type: string) => {
    if (type === 'property') return <Building2 className="h-4 w-4 text-emerald-500" />;
    if (type === 'tenant') return <User className="h-4 w-4 text-sky-500" />;
    if (type === 'maintenance') return <Wrench className="h-4 w-4 text-amber-500" />;
    return <Search className="h-4 w-4 text-slate-500" />;
  };

  return (
    <div className="relative w-full max-w-xl hidden md:block" ref={containerRef}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <Search className="h-4 w-4" aria-hidden="true" />
        </div>
        <input
          ref={inputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setIsOpen(true);
          }}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onFocus={() => setIsOpen(true)}
          className="block w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-10 pr-24 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
          placeholder="Search properties, owners, APNs, tasks..."
          aria-label="Search Vortex One"
        />
        {!searchQuery && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 text-[10px] text-slate-400">
            <Command className="h-3 w-3" />
            K
          </span>
        )}
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && searchQuery.trim().length >= 2 && (
        <div
          className="absolute top-full z-50 mt-2 max-h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          role="region"
          aria-label="Search results"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching Vortex One…
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">No matching records</div>
              <div className="mt-1 text-xs text-slate-500">Try a property, owner, APN, or task name.</div>
            </div>
          ) : (
            <div className="app-scroll max-h-[440px] overflow-y-auto p-2">
              {results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {getIcon(item.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

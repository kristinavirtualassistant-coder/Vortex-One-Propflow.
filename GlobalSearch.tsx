import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, User, Wrench, X, Loader2 } from 'lucide-react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ type: string, id: string, title: string, subtitle: string }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const queryText = searchQuery.toLowerCase();
        const searchResults: any[] = [];

        // Mock Properties
        const mockProperties = [
          { id: 'p1', name: 'Apartment 4B', address: '123 Main St' },
          { id: 'p2', name: 'Suite 102', address: '456 Oak Ave' },
          { id: 'p3', name: 'Unit 7C', address: '789 Pine Rd' },
        ];
        
        mockProperties.forEach(p => {
          if (p.name.toLowerCase().includes(queryText) || p.address.toLowerCase().includes(queryText)) {
            searchResults.push({
              type: 'property',
              id: p.id,
              title: p.name,
              subtitle: p.address
            });
          }
        });

        // Mock Tenants
        const mockTenants = [
          { id: 't1', name: 'Alice Smith', unit: 'Apartment 4B' },
          { id: 't2', name: 'Bob Johnson', unit: 'Suite 102' },
          { id: 't3', name: 'Charlie Davis', unit: 'Unit 7C' },
        ];

        mockTenants.forEach(t => {
          if (t.name.toLowerCase().includes(queryText) || t.unit.toLowerCase().includes(queryText)) {
            searchResults.push({
              type: 'tenant',
              id: t.id,
              title: t.name,
              subtitle: `Tenant - ${t.unit}`
            });
          }
        });

        // Real Maintenance Requests (fetch limited)
        const q = query(collection(db, 'maintenance_requests'), limit(50));
        const reqSnapshot = await getDocs(q);
        
        reqSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.title?.toLowerCase().includes(queryText) || data.description?.toLowerCase().includes(queryText)) {
            searchResults.push({
              type: 'maintenance',
              id: doc.id,
              title: data.title,
              subtitle: `Status: ${data.status.replace('_', ' ')} • Priority: ${data.priority}`
            });
          }
        });

        setResults(searchResults);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(() => {
      searchData();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const getIcon = (type: string) => {
    switch(type) {
      case 'property': return <Building2 className="w-4 h-4 text-emerald-500" />;
      case 'tenant': return <User className="w-4 h-4 text-blue-500" />;
      case 'maintenance': return <Wrench className="w-4 h-4 text-amber-500" />;
      default: return <Search className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative w-96 hidden md:block" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
          <Search className="h-4 w-4" />
        </div>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="block w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500" 
          placeholder="Search properties, tenants, or tasks..." 
        />
        {searchQuery && (
          <button 
            onClick={() => {
              setSearchQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && searchQuery.length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50 max-h-[400px] flex flex-col">
          {loading ? (
            <div className="flex justify-center items-center p-8 text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="overflow-y-auto">
              <div className="p-2">
                {results.map((item, idx) => (
                  <div key={`${item.type}-${item.id}-${idx}`} className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors">
                    <div className="mt-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-md shadow-sm flex-shrink-0">
                      {getIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 capitalize">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Search, MapPin, Home, DollarSign, AlertCircle, Building, CheckCircle2, Link2, Box } from 'lucide-react';

export default function PropSearch() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setSearching(true);
    
    setTimeout(() => {
      setHasSearched(true);
      setSearching(false);
    }, 1500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Prop Search</h2>
        <p className="text-slate-500 dark:text-slate-400">Search for properties across multiple listing platforms simultaneously.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-4 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Enter an address, neighborhood, city, or ZIP code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>
          <button 
            type="submit" 
            disabled={searching}
            className="bg-[#006AFF] hover:bg-[#0055CC] text-white px-8 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {hasSearched && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Platform Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Zillow */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 hover:shadow-md transition-shadow text-center">
              <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                <span className="font-bold text-xl">Z</span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Zillow</h4>
              <a href={`https://www.zillow.com/homes/${encodeURIComponent(query)}_rb/`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 mt-3">
                <Link2 className="h-4 w-4" /> View on Zillow
              </a>
            </div>

            {/* Realtor.com */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 hover:shadow-md transition-shadow text-center">
              <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 mb-4">
                <span className="font-bold text-xl">R</span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Realtor.com</h4>
              <a href={`https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 dark:text-red-400 hover:underline flex items-center justify-center gap-1 mt-3">
                <Link2 className="h-4 w-4" /> View on Realtor
              </a>
            </div>

            {/* Redfin */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 hover:shadow-md transition-shadow text-center">
              <div className="w-16 h-16 mx-auto bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-600 mb-4">
                <span className="font-bold text-xl">Re</span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Redfin</h4>
              <a href={`https://www.redfin.com/city/${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-rose-600 dark:text-rose-400 hover:underline flex items-center justify-center gap-1 mt-3">
                <Link2 className="h-4 w-4" /> View on Redfin
              </a>
            </div>

            {/* Trulia */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 hover:shadow-md transition-shadow text-center">
              <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                <span className="font-bold text-xl">T</span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Trulia</h4>
              <a href={`https://www.trulia.com/`} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1 mt-3">
                <Link2 className="h-4 w-4" /> View on Trulia
              </a>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mt-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Aggregated Property Data</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><Home className="h-4 w-4" /> Beds / Baths</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">3 / 2.5</div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><Box className="h-4 w-4" /> Living Sqft</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">1,850</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><MapPin className="h-4 w-4" /> Lot Sqft</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">4,200</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><Building className="h-4 w-4" /> Property Type</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">Single Family</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Vacancy</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Vacant</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-500 mb-1 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Estimated Rent</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">$2,800/mo</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

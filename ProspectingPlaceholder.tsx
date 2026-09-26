import React from 'react';
import { Search, Map, PhoneCall, Mail, Filter, Layers, Navigation } from 'lucide-react';

export default function ProspectingPlaceholder() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Prospecting & Deal Sourcing</h2>
          <p className="text-slate-500 dark:text-slate-400">Find off-market deals, skip trace owners, and manage outreach campaigns.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2">
          <Navigation className="h-4 w-4" /> Driving for Dollars
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lead Sourcing */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm col-span-1 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Property Database</h3>
              <p className="text-xs text-slate-500">130+ advanced filters</p>
            </div>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="Search address, zip, or city..." className="flex-1 text-sm px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800" />
            <button className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" /> Filters
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-medium rounded-full">Pre-foreclosures</span>
            <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium rounded-full">High Equity</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium rounded-full">Absentee Owner</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium rounded-full flex items-center gap-1"><Layers className="h-3 w-3" /> List Stacking</span>
          </div>
        </div>

        {/* Skip Tracing */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Map className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Skip Tracing</h3>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Instantly pull owner phone numbers and emails with TCPA compliance checks.</p>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
              <div className="text-xs text-slate-500 mb-1">Batch Progress</div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mb-1">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">500/500 Records Found</div>
            </div>
          </div>
        </div>

        {/* Outreach */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Outreach</h3>
          </div>
          <div className="space-y-3">
             <button className="w-full flex items-center justify-between p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
               <div className="flex items-center gap-2">
                 <Mail className="h-4 w-4 text-purple-500" />
                 <span className="text-sm font-medium">Direct Mail</span>
               </div>
               <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded">Active</span>
             </button>
             <button className="w-full flex items-center justify-between p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
               <div className="flex items-center gap-2">
                 <PhoneCall className="h-4 w-4 text-emerald-500" />
                 <span className="text-sm font-medium">Click-to-Dial</span>
               </div>
               <span className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded">Ready</span>
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

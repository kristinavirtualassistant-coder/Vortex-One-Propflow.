import React, { useState } from 'react';
import { Bot, MapPin, Building, Search, Download, TrendingUp, AlertTriangle } from 'lucide-react';

export default function LeadGeneration() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [leads, setLeads] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  const handleStartScraping = () => {
    setRunning(true);
    setLeads([]);
    setProgress(0);
    setStatus('Initializing AI Scraper Agents...');
    
    setTimeout(() => { setStatus('Scanning local public records...'); setProgress(25); }, 1500);
    setTimeout(() => { setStatus('Analyzing rental listings for absentee owners...'); setProgress(50); }, 3000);
    setTimeout(() => { 
      setStatus('Cross-referencing tax defaults & code violations...'); 
      setProgress(75); 
      setLeads([
        { id: 1, address: '842 Summit Ave', owner: 'Out of State LLC', issue: 'Code Violations (3)', potentialValue: '$850k', contact: 'Skip Trace Required' },
        { id: 2, address: '1904 River Blvd', owner: 'John Smith', issue: 'Pre-Foreclosure', potentialValue: '$420k', contact: 'jsmith82@email.com' }
      ]);
    }, 4500);
    setTimeout(() => { 
      setStatus('Scraping complete.'); 
      setProgress(100); 
      setRunning(false);
      setLeads(prev => [
        ...prev,
        { id: 3, address: '5501 N Lincoln St', owner: 'Tired Landlord Mgmt', issue: 'Long Vacancy (60+ days)', potentialValue: '$1.2M', contact: '555-0199' },
        { id: 4, address: '223 W Willow Rd', owner: 'Estate of M. Johnson', issue: 'Probate / Vacant', potentialValue: '$650k', contact: 'Skip Trace Required' }
      ]);
    }, 6000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            AI Lead Generator
          </h2>
          <p className="text-slate-500 dark:text-slate-400">Deploy scraper agents to find off-market deals and management leads.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Scraper Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Area (ZIP/City)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input type="text" defaultValue="90210" className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Indicators</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-100 border-slate-300" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Absentee Owners</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-100 border-slate-300" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Pre-Foreclosures</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-100 border-slate-300" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Code Violations</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-100 border-slate-300" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Probate / Estate</span>
                  </label>
                </div>
              </div>
              
              <button 
                onClick={handleStartScraping}
                disabled={running}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {running ? <Search className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {running ? 'Agents Deployed...' : 'Deploy AI Scrapers'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-900 dark:text-white">Scraping Results</h3>
              {leads.length > 0 && !running && (
                <button className="text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center gap-1 hover:underline">
                  <Download className="h-4 w-4" /> Export CSV
                </button>
              )}
            </div>
            
            {running && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">{status}</span>
                  <span className="text-slate-500">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}
            
            {!running && leads.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-4">
                  <Bot className="h-8 w-8" />
                </div>
                <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No active scraping jobs</h4>
                <p className="text-slate-500 max-w-sm">Configure your target area and deploy AI agents to scrape public records and real estate APIs for motivated sellers.</p>
              </div>
            )}
            
            {leads.length > 0 && (
              <div className="flex-1 overflow-auto">
                <div className="space-y-4">
                  {leads.map(lead => (
                    <div key={lead.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{lead.address}</h4>
                        <span className="bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {lead.issue}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Owner</div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{lead.owner}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Est. Value</div>
                          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> {lead.potentialValue}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-xs text-slate-500 mb-1">Contact Info</div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {lead.contact === 'Skip Trace Required' ? (
                              <button className="text-indigo-600 dark:text-indigo-400 hover:underline">Run Skip Trace (1 Credit)</button>
                            ) : lead.contact}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

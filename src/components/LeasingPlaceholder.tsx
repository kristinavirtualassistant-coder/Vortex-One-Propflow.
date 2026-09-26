import React, { useState } from 'react';
import { FileSignature, FolderArchive, ShieldCheck, FileText, Upload, Globe, Bot, Search, ExternalLink, BookOpen, Key } from 'lucide-react';
import { GoogleWorkspaceService } from '../lib/workspace';
import DocumentManager from './DocumentManager';
import LeaseManagement from './LeaseManagement';
import DocumentUpload from './DocumentUpload';

export default function LeasingPlaceholder() {
  const [activeSubTab, setActiveSubTab] = useState<'leases' | 'syndication'>('leases');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await GoogleWorkspaceService.searchDriveFiles(searchQuery);
      setSearchResults(response.files || []);
    } catch (error) {
      console.error('Search failed', error);
      alert('Failed to search Google Drive. Have you connected Workspace in the Integrations tab?');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Sub Tabs Selection */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab('leases')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeSubTab === 'leases'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Key className="w-4 h-4 text-indigo-500" />
          Active Lease Agreements
        </button>
        <button
          onClick={() => setActiveSubTab('syndication')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeSubTab === 'syndication'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4 text-indigo-500" />
          Syndication & Drive Search
        </button>
      </div>

      {activeSubTab === 'leases' ? (
        <LeaseManagement />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Leasing & Documents</h2>
              <p className="text-slate-500 dark:text-slate-400">Manage syndication, tenant screening, and search property documents via Google Drive.</p>
            </div>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2">
              <Upload className="h-4 w-4" /> New Listing
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Listing Syndication & AI Assistant */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Globe className="h-6 w-6" />
                </div>
                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded">2 Active</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Listing Syndication</h3>
              <p className="text-slate-500 text-sm mb-6">One-click publishing to Zillow, Trulia, Realtor.com, and 30+ other premium listing sites.</p>
              
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                  <Bot className="h-4 w-4 text-indigo-500" /> AI Leasing Assistant
                </h4>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 mb-2">Currently handling prospect inquiries, answering FAQs, and scheduling self-guided tours 24/7.</p>
                  <div className="flex gap-2">
                    <span className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800">43 Inquiries Answered</span>
                    <span className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800">12 Tours Booked</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Drive Document Search */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <FolderArchive className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Google Drive Search</h3>
              <p className="text-slate-500 text-sm mb-4">Search and preview property-related documents directly from your connected Workspace.</p>
              
              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents (e.g. 'Lease')" 
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                  type="submit" 
                  disabled={searching || !searchQuery}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </form>

              <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px]">
                {searchResults.length === 0 && !searching && (
                  <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                    No documents found. Search to see results.
                  </div>
                )}
                {searchResults.map((file) => (
                  <a 
                    key={file.id} 
                    href={file.webViewLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {file.iconLink ? (
                        <img src={file.iconLink} alt="" className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        <FileText className="h-5 w-5 text-slate-400" />
                      )}
                      <span className="font-medium text-slate-900 dark:text-white text-sm truncate">{file.name}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <DocumentUpload />
          <div className="pt-6">
            <DocumentManager />
          </div>
        </div>
      )}
    </div>
  );
}

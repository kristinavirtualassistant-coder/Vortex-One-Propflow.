import React, { useState } from 'react';
import { FileText, Folder, Upload, Download, Search, MoreVertical, File } from 'lucide-react';

export default function DocumentCenter() {
  const [activeFolder, setActiveFolder] = useState('Leases');

  const folders = ['Leases', 'Compliance', 'Financials', 'Property Photos', 'Vendor Contracts'];
  const documents = [
    { id: 1, name: 'Lease_Apt4B_Smith.pdf', folder: 'Leases', date: '2025-08-15', size: '2.4 MB', type: 'pdf' },
    { id: 2, name: 'Lease_Suite102_Johnson.pdf', folder: 'Leases', date: '2025-09-01', size: '1.8 MB', type: 'pdf' },
    { id: 3, name: 'Building_Safety_Inspection.pdf', folder: 'Compliance', date: '2025-06-10', size: '4.2 MB', type: 'pdf' },
    { id: 4, name: '2025_Q2_P&L.xlsx', folder: 'Financials', date: '2025-07-01', size: '156 KB', type: 'excel' },
    { id: 5, name: 'Plumbing_Contract_Acme.pdf', folder: 'Vendor Contracts', date: '2025-01-15', size: '1.1 MB', type: 'pdf' },
  ];

  const filteredDocs = documents.filter(doc => doc.folder === activeFolder);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex h-[600px]">
      {/* Sidebar Folders */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-800/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Folders</p>
          {folders.map(folder => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFolder === folder 
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Folder className={`w-4 h-4 ${activeFolder === folder ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              {folder}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-500" />
            {activeFolder}
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search files..." 
              className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                  <th className="pb-3 pl-4">Name</th>
                  <th className="pb-3">Date Added</th>
                  <th className="pb-3">Size</th>
                  <th className="pb-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                      No documents found in this folder.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => (
                    <tr key={doc.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${doc.type === 'pdf' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'}`}>
                            {doc.type === 'pdf' ? <FileText className="w-4 h-4" /> : <File className="w-4 h-4" />}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-slate-200 text-sm">{doc.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-slate-500">{doc.date}</td>
                      <td className="py-3 text-sm text-slate-500">{doc.size}</td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

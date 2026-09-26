import React from 'react';
import { ShieldCheck, UserCheck, Search, Clock, FileText, CheckCircle, XCircle } from 'lucide-react';

export default function TenantScreening() {
  const applications = [
    { id: 'APP-101', name: 'John Doe', unit: 'Apt 4B', status: 'approved', credit: 720, background: 'Clear', income: '$85k/yr' },
    { id: 'APP-102', name: 'Jane Smith', unit: 'Suite 102', status: 'pending', credit: 'Pending', background: 'Processing', income: 'Verifying' },
    { id: 'APP-103', name: 'Michael Lee', unit: 'Unit 7C', status: 'rejected', credit: 580, background: 'Flagged', income: '$45k/yr' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Screening & Applications
          </h3>
          <p className="text-xs text-slate-500 mt-1">Review background checks and credit reports.</p>
        </div>
        <button className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          New Invite
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 dark:border-slate-800 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search applicants..." 
          className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {applications.map((app) => (
          <div key={app.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-slate-900">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{app.name}</h4>
                  <p className="text-xs text-slate-500">Applying for: {app.unit}</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                app.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                app.status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30' :
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
              }`}>
                {app.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Credit Score</p>
                <p className={`font-semibold text-sm ${typeof app.credit === 'number' && app.credit >= 650 ? 'text-emerald-600' : typeof app.credit === 'number' ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>
                  {app.credit}
                </p>
              </div>
              <div className="text-center border-x border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Background</p>
                <p className={`font-semibold text-sm ${app.background === 'Clear' ? 'text-emerald-600' : app.background === 'Flagged' ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>
                  {app.background}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Income</p>
                <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                  {app.income}
                </p>
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1">
                <FileText className="w-3 h-3" /> View Full Report
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

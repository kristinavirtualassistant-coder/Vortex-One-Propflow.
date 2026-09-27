import React from 'react';
import { Calendar, AlertCircle } from 'lucide-react';

export default function LeaseExpirationsWidget() {
  const expiringLeases: any[] = [];


  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Upcoming Renewals
        </h3>
        <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold px-2 py-1 rounded-full">
          {expiringLeases.length} Action Needed
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {expiringLeases.map((lease, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">{lease.unit}</p>
                <p className="text-xs text-slate-500 mt-0.5">{lease.tenant}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {new Date(lease.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className={`text-xs font-bold mt-1 flex items-center justify-end gap-1 ${
                  lease.daysLeft < 30 ? 'text-rose-600' : 'text-amber-600'
                }`}>
                  {lease.daysLeft < 30 && <AlertCircle className="w-3 h-3" />}
                  {lease.daysLeft} days left
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center">
        <button className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:underline">
          View All Leases
        </button>
      </div>
    </div>
  );
}

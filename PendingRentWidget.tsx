import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AlertCircle, Mail, DollarSign, Send, Clock } from 'lucide-react';

export default function PendingRentWidget() {
  const [pendingTenants, setPendingTenants] = useState<any[]>([]);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [nudgeSuccess, setNudgeSuccess] = useState<string | null>(null);

  useEffect(() => {
    // For demo purposes, we can hardcode some pending tenants or fetch real ones
    // We'll simulate fetching real ones here since we don't have a robust "leases" or "balances" collection set up yet.
    const mockPendingTenants = [
      { id: '1', name: 'Alice Smith', unit: 'Apt 4B', amount: 1450, daysLate: 2, email: 'alice@example.com' },
      { id: '2', name: 'Bob Johnson', unit: 'Suite 102', amount: 2100, daysLate: 5, email: 'bob@example.com' },
      { id: '3', name: 'Charlie Davis', unit: 'Unit 7C', amount: 950, daysLate: 12, email: 'charlie@example.com' },
    ];
    
    setPendingTenants(mockPendingTenants);
  }, []);

  const handleNudge = async (tenantId: string, email: string) => {
    setNudgingId(tenantId);
    
    try {
      // Simulate calling a cloud function to send the email
      await new Promise(resolve => setTimeout(resolve, 800));
      setNudgeSuccess(tenantId);
      
      setTimeout(() => {
        setNudgeSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to send nudge', error);
      alert('Failed to send reminder email');
    } finally {
      setNudgingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          Pending Rent Payments
        </h3>
        <span className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold px-2.5 py-1 rounded-full">
          {pendingTenants.length} Action Needed
        </span>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Tenant</th>
              <th className="px-6 py-4 font-medium">Amount Due</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {pendingTenants.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  All tenants are fully paid!
                </td>
              </tr>
            ) : (
              pendingTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{tenant.name}</div>
                    <div className="text-xs text-slate-500">{tenant.unit}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white flex items-center">
                      <DollarSign className="w-3 h-3 text-slate-400 mr-0.5" />
                      {tenant.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-medium bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">
                      <Clock className="w-3 h-3" />
                      {tenant.daysLate} days late
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {nudgeSuccess === tenant.id ? (
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                        Sent!
                      </span>
                    ) : (
                      <button
                        onClick={() => handleNudge(tenant.id, tenant.email)}
                        disabled={nudgingId === tenant.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {nudgingId === tenant.id ? (
                          <>Sending...</>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Nudge
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

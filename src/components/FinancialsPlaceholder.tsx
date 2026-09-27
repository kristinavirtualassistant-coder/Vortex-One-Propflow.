import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, FileText, TrendingUp, Download, PieChart, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { GoogleWorkspaceService } from '../lib/workspace';

import FinancialInsights from './FinancialInsights';
import FinanceAnalytics from './FinanceAnalytics';

export default function FinancialsPlaceholder() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error('Error fetching metrics', err));
  }, []);

  const paymentHistory: any[] = [];


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Financials & Payments</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage rent collection, accounting ledgers, and payment processing.</p>
        </div>
        <div className="flex gap-4 items-center">
          {sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline">
              View Exported Sheet
            </a>
          )}
          <button 
            onClick={handleExport} 
            disabled={exporting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export to Sheets'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Rent Collection</h3>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">$42,500.00</div>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> +12% from last month
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Processing via</span>
              <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1"><CreditCard className="h-4 w-4" /> Stripe / ACH</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Outstanding Invoices</h3>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">$3,200.00</div>
          <p className="text-sm text-slate-500">4 tenants with late fees</p>
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <button className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline">
              Send Reminders
            </button>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <PieChart className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">General Ledger</h3>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Automated</div>
          <p className="text-sm text-slate-500">Income & expense tracking</p>
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <button className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline">
              View Accounting Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Performance Trends Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialInsights />
        <FinanceAnalytics />
        
        {metrics.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">Occupancy Rate (%)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis domain={[80, 100]} axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(value) => `${value}%`} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => [`${value}%`, 'Occupancy']}
                  />
                  <Bar dataKey="occupancyRate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Payment History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Payment History</h3>
          <p className="text-sm text-slate-500">Recent rent payments and transactions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 font-medium">Invoice ID</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Tenant / Unit</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Method</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {paymentHistory.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{payment.id}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{payment.date}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{payment.tenant}</div>
                    <div className="text-xs text-slate-500">{payment.unit}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{payment.amount}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{payment.method}</td>
                  <td className="px-6 py-4">
                    {payment.status === 'Paid' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Paid
                      </span>
                    )}
                    {payment.status === 'Pending' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                    {payment.status === 'Late' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3" /> Late
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30" title="Download PDF Receipt">
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center py-12 hidden">
        <CreditCard className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Secure Payment Gateway Integration</h3>
        <p className="text-slate-500 max-w-md mx-auto">This module connects directly to Stripe or PayPal for secure, compliant payment processing, ACH transfers, and automatic ledger reconciliation.</p>
      </div>
    </div>
  );
}

import React from 'react';
import { FileText, Plus, CheckCircle, Clock } from 'lucide-react';

export default function WorkOrderInvoicingPlaceholder() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Work Order Invoicing</h2>
          <p className="text-slate-500 dark:text-slate-400">Submit final invoices for completed jobs to get paid faster.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create Invoice
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
              <th className="p-4 font-medium">Invoice ID</th>
              <th className="p-4 font-medium">Property / Job</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            <tr>
              <td className="p-4 text-slate-900 dark:text-white font-medium">INV-1042</td>
              <td className="p-4">
                <div className="text-sm font-medium text-slate-900 dark:text-white">123 Main St - Unit 4</div>
                <div className="text-xs text-slate-500">Dishwasher repair</div>
              </td>
              <td className="p-4 text-slate-900 dark:text-white font-medium">$185.00</td>
              <td className="p-4">
                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 w-max"><CheckCircle className="h-3 w-3" /> Paid</span>
              </td>
              <td className="p-4 text-right">
                <button className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-sm font-medium">View Receipt</button>
              </td>
            </tr>
            <tr>
              <td className="p-4 text-slate-900 dark:text-white font-medium">INV-1043</td>
              <td className="p-4">
                <div className="text-sm font-medium text-slate-900 dark:text-white">456 Oak Ave - Unit 12</div>
                <div className="text-xs text-slate-500">Plumbing fix</div>
              </td>
              <td className="p-4 text-slate-900 dark:text-white font-medium">$350.00</td>
              <td className="p-4">
                <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 w-max"><Clock className="h-3 w-3" /> Pending Approval</span>
              </td>
              <td className="p-4 text-right">
                <button className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-sm font-medium">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

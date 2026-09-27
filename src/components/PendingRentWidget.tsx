import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function PendingRentWidget() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-slate-400" />
          Pending Rent Payments
        </h3>
      </div>
      <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No rent-payment records are available yet. This panel will display only verified payment data once a connected lease and payment source is configured.
      </div>
    </div>
  );
}

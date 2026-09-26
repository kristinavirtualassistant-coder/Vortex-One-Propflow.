import React from 'react';
import { CreditCard, CheckCircle, AlertTriangle, Calendar, ShieldCheck, Zap } from 'lucide-react';

export default function BillingPlaceholder() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Subscription & Billing</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage your subscription, payment methods, and billing history.</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 shadow-md text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-6 w-6 text-amber-200" />
            <h3 className="text-xl font-bold">1 Week Free Trial Active</h3>
          </div>
          <p className="text-amber-100 max-w-lg mb-4">
            You currently have full access to all enterprise features for testing and navigation. No credit card required during the trial.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-2">
              <Calendar className="h-4 w-4" /> 7 Days Remaining
            </div>
            <button className="bg-white text-amber-600 px-4 py-1.5 rounded-full hover:bg-amber-50 transition-colors">
              Upgrade Now
            </button>
          </div>
        </div>
        <CreditCard className="absolute -right-8 -bottom-10 h-48 w-48 text-white/10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Current Plan</h3>
            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Enterprise Trial
            </span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-900 dark:text-white">PropertyFlow Enterprise</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Price</span>
              <span className="font-medium text-slate-900 dark:text-white">$0.00 / month (Trial)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Renewal Date</span>
              <span className="font-medium text-slate-900 dark:text-white">-</span>
            </div>
          </div>
          <button className="w-full mt-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium py-2 rounded-lg transition-colors text-sm">
            View Plan Details
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Payment Method</h3>
          </div>
          <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-500">
            <CreditCard className="h-8 w-8 mb-2 text-slate-400" />
            <p className="text-sm">No payment method added.</p>
          </div>
          <button className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors text-sm">
            Add Payment Method
          </button>
        </div>
      </div>
    </div>
  );
}

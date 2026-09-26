import React from 'react';
import { Hammer, CheckCircle, FileText, Send, Users } from 'lucide-react';

export default function VendorBiddingPlaceholder() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Vendor Bidding & Work Orders</h2>
          <p className="text-slate-500 dark:text-slate-400">Request quotes from multiple contractors and manage work orders.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2">
          <Send className="h-4 w-4" /> New Bid Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Hammer className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">HVAC Replacement - Unit 4B</h3>
                <p className="text-xs text-slate-500">Sent to 3 vendors</p>
              </div>
            </div>
            <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded">Awaiting Bids</span>
          </div>
          
          <div className="space-y-3 mt-6">
            <div className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">CoolAir Techs</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">$4,200</span>
            </div>
            <div className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Elite HVAC</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">$3,950</span>
            </div>
            <div className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg opacity-50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">City Heating & Cooling</span>
              </div>
              <span className="text-sm text-slate-500 italic">Pending response...</span>
            </div>
          </div>
          
          <button className="w-full mt-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium py-2 rounded-lg transition-colors text-sm">
            Review & Award Job
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Plumbing Fix - Unit 12</h3>
                <p className="text-xs text-slate-500">Awarded to: Rapid Plumbing</p>
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Job Complete</span>
          </div>
          
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="flex justify-between mb-2 text-sm">
              <span className="text-slate-500">Invoice #</span>
              <span className="font-medium text-slate-900 dark:text-white">INV-8492</span>
            </div>
            <div className="flex justify-between mb-2 text-sm">
              <span className="text-slate-500">Amount Due</span>
              <span className="font-medium text-slate-900 dark:text-white">$350.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Final Notes</span>
              <span className="text-slate-900 dark:text-white text-right max-w-[200px] truncate">Replaced P-trap under sink.</span>
            </div>
          </div>
          
          <button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors text-sm">
            Approve & Pay Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

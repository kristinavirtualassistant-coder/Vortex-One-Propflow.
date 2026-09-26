import React from 'react';
import { Users, Mail, GitBranch, CheckSquare, MessageSquare, Plus } from 'lucide-react';

export default function CrmPlaceholder() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CRM & Process Automation</h2>
          <p className="text-slate-500 dark:text-slate-400">Automate your sales pipelines, shared inboxes, and operational workflows.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Shared Inbox & Lead Ingestion */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Shared Inbox</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">Unified inbox for calls, texts, and emails. Automated lead routing.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white text-sm">Owner Lead: John S.</div>
                  <div className="text-xs text-slate-500">"Interested in management..."</div>
                </div>
              </div>
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            </div>
             <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white text-sm">Tenant: Apt 4B</div>
                  <div className="text-xs text-slate-500">"Moving out next month."</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Management */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Sales Pipeline</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">Visual deal tracking for property management sales.</p>
          <div className="space-y-3 relative">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mb-1">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '65%' }}></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium mb-4">
              <span>Prospecting (12)</span>
              <span>Closing (4)</span>
            </div>
            <div className="p-3 border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
              <div className="font-medium text-emerald-900 dark:text-emerald-400 text-sm">12 Unit Complex</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">Contract Sent - Waiting Signature</div>
            </div>
          </div>
        </div>

        {/* Workflow Engine */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GitBranch className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Workflow Engine</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">Automate complex operations like move-ins and evictions.</p>
          <div className="space-y-3">
             <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium text-slate-900 dark:text-white text-sm">Tenant Move-In (Apt 2A)</div>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">3/5 Steps</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckSquare className="h-3 w-3 text-emerald-500" /> Welcome Email Sent
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckSquare className="h-3 w-3 text-emerald-500" /> Lease Executed
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-white">
                  <div className="w-3 h-3 border border-slate-300 dark:border-slate-600 rounded-sm"></div> Key Handover Scheduled
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

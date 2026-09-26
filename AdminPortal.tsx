import React from 'react';
import { ShieldAlert, Users, Settings, Database, Activity } from 'lucide-react';
import AdminAuditLog from '../../components/AdminAuditLog';

export default function AdminPortal({ activeTab = 'dashboard' }: { activeTab?: string }) {
  if (activeTab === 'dashboard') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h2>
          <p className="text-slate-500 dark:text-slate-400">System overview and platform management.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Users</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">1,248</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">System Health</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">99.9%</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Activity className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 h-[600px]">
          <AdminAuditLog />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-center text-slate-500">
      Admin view for {activeTab} is under construction.
    </div>
  );
}

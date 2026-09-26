import React from 'react';
import { Activity, ShieldAlert, UserPlus, Key, Settings, AlertTriangle } from 'lucide-react';

export default function AdminAuditLog() {
  const logs = [
    { id: 1, action: 'User Created', user: 'admin@propertyflow.com', target: 'bob.technician@mail.com', time: '10:42 AM', date: 'Today', type: 'user' },
    { id: 2, action: 'Permissions Changed', user: 'admin@propertyflow.com', target: 'Alice Smith (Tenant -> Lead Tenant)', time: '09:15 AM', date: 'Today', type: 'security' },
    { id: 3, action: 'Failed Login Attempt', user: 'System', target: 'IP: 192.168.1.45', time: '11:30 PM', date: 'Yesterday', type: 'alert' },
    { id: 4, action: 'System Settings Updated', user: 'admin@propertyflow.com', target: 'Global Payment Gateway', time: '04:20 PM', date: 'Yesterday', type: 'system' },
    { id: 5, action: 'API Key Generated', user: 'admin@propertyflow.com', target: 'Stripe Integration', time: '02:10 PM', date: 'Aug 14', type: 'security' },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'user': return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'security': return <Key className="w-4 h-4 text-emerald-500" />;
      case 'alert': return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'system': return <Settings className="w-4 h-4 text-slate-500" />;
      default: return <Activity className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          System Audit Log
        </h3>
        <button className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
          Download CSV
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">User / Source</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Target</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      {getIcon(log.type)}
                    </div>
                    <span className="font-medium text-sm text-slate-900 dark:text-white">{log.action}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                  {log.user}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                  {log.target}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span className="font-semibold text-slate-900 dark:text-white">{log.time}</span>
                  <span className="text-slate-500 ml-2">{log.date}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

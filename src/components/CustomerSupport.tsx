import React from 'react';
import { Mail } from 'lucide-react';

const SUPPORT_EMAIL = 'info@remoteaccountmanagers.online';

export default function CustomerSupport() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Support</h2>
        <p className="text-slate-500 dark:text-slate-400">Questions or problems? Email us and include the page you were on.</p>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Mail className="h-6 w-6" />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white mb-1">Email support</h3>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">{SUPPORT_EMAIL}</a>
      </div>
    </div>
  );
}

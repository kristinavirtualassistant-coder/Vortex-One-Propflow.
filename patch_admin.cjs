const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/AdminPortal.tsx', 'utf8');

if (!content.includes('import AdminAuditLog')) {
  content = content.replace(
    "import { ShieldAlert, Users, Settings, Database, Activity } from 'lucide-react';",
    "import { ShieldAlert, Users, Settings, Database, Activity } from 'lucide-react';\nimport AdminAuditLog from '../../components/AdminAuditLog';"
  );
}

const target = `<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Active Errors</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">2</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>`;

const replacement = `<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Active Errors</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">2</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <AdminAuditLog />
        </div>`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/portals/AdminPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}

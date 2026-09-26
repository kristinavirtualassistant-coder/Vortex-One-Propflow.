const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const target = `<div className="relative w-96 hidden md:block">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Menu className="h-4 w-4" />
              </div>
              <input type="text" className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Search properties, tenants, or tasks..." />
            </div>`;

if(content.includes(target)) {
    content = content.replace(target, '<GlobalSearch />');
    fs.writeFileSync('src/pages/Dashboard.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}

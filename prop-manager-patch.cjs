const fs = require('fs');

const path = 'src/pages/portals/PropertyManagerPortal.tsx';
let content = fs.readFileSync(path, 'utf8');

const propertiesSummaryData = `
  const propertiesSummary = [
    { id: 1, name: 'Skyline Apartments', units: 120, occupancy: '94%', pendingTasks: 12, status: 'Healthy', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&q=80' },
    { id: 2, name: 'Oakwood Residences', units: 45, occupancy: '100%', pendingTasks: 3, status: 'Optimal', image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=500&q=80' },
    { id: 3, name: 'Riverfront Lofts', units: 80, occupancy: '82%', pendingTasks: 24, status: 'Needs Attention', image: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=500&q=80' },
  ];
`;

const propertiesSummaryJSX = `
      {/* Properties Summary View */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Portfolio Properties</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {propertiesSummary.map(prop => (
            <div key={prop.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-40 overflow-hidden">
                <img src={prop.image} alt={prop.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">{prop.name}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{prop.units} Units Total</p>
                  </div>
                  <span className={\`px-2.5 py-1 text-xs font-bold uppercase rounded-full \${prop.status === 'Needs Attention' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}\`}>
                    {prop.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                      <Percent className="w-4 h-4" />
                      <span className="text-xs font-medium">Occupancy</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{prop.occupancy}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium">Pending Tasks</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{prop.pendingTasks}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
`;

// Insert the data array
content = content.replace("const metricsData = [", propertiesSummaryData + "\\n  const metricsData = [");

// Insert the JSX right before {/* Charts */} or after KPI cards
// Actually there is no {/* Charts */}, the charts are just in `<div className="grid gap-6 lg:grid-cols-2">`
// Let's insert it before the first `<div className="grid gap-6 lg:grid-cols-2">`
content = content.replace('<div className="grid gap-6 lg:grid-cols-2">', propertiesSummaryJSX + '\\n\\n      <div className="grid gap-6 lg:grid-cols-2">');

fs.writeFileSync(path, content, 'utf8');

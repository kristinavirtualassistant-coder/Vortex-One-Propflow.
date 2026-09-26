const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/TechnicianPortal.tsx', 'utf8');

const targetList = `<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map(req => (
          <div key={req.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-1">{req.title}</h3>
              <span className={\`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider \${
                req.priority === 'urgent' ? 'bg-red-500 text-white' :
                req.priority === 'high' ? 'bg-orange-500 text-white' :
                'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }\`}>
                {req.priority}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-1">{req.description}</p>
            
            <div className="space-y-3 mt-auto">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 flex items-center">
                  <MapPin className="h-4 w-4 mr-1" /> Unit 4B
                </span>
                <span className="text-slate-500 flex items-center">
                  <Clock className="h-4 w-4 mr-1" /> 
                  {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d, HH:mm') : 'N/A'}
                </span>
              </div>
              
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Update Status</label>
                <select
                  value={req.status}
                  onChange={(e) => updateStatus(req.id, e.target.value)}
                  className={\`w-full text-sm font-medium rounded-lg px-3 py-2 border outline-none appearance-none cursor-pointer \${getStatusColor(req.status)} border-transparent focus:ring-2 focus:ring-primary-500\`}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>`;

const kanbanBoard = `<div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4">
        {['pending', 'in_progress', 'resolved'].map((status) => (
          <div key={status} className="flex-1 min-w-[320px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 capitalize flex items-center justify-between">
              {status.replace('_', ' ')}
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs py-1 px-2.5 rounded-full">
                {requests.filter(r => r.status === status).length}
              </span>
            </h3>
            <div className="space-y-4 flex-1">
              {requests.filter(r => r.status === status).map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider \${
                      req.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      req.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }\`}>
                      {req.priority}
                    </span>
                    <select
                      value={req.status}
                      onChange={(e) => updateStatus(req.id, e.target.value)}
                      className="text-xs bg-transparent text-slate-500 font-medium cursor-pointer outline-none hover:text-indigo-600"
                    >
                      <option value="pending">Move to Pending</option>
                      <option value="in_progress">Move to In Progress</option>
                      <option value="resolved">Move to Resolved</option>
                    </select>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2">{req.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{req.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                    <span className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" /> Unit {req.unit || 'TBD'}
                    </span>
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" /> 
                      {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d') : 'New'}
                    </span>
                  </div>
                </div>
              ))}
              {requests.filter(r => r.status === status).length === 0 && (
                <div className="h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>`;

if(content.includes(targetList)) {
    content = content.replace(targetList, kanbanBoard);
    fs.writeFileSync('src/pages/portals/TechnicianPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}

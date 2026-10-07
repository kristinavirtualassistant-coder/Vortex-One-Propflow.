import React from 'react';
import { Megaphone, Calendar, Users, Info } from 'lucide-react';

export default function CommunityBoard() {
  const announcements: { id: number; title: string; date: string; type: string; message: string; author: string }[] = [];

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return <Megaphone className="w-5 h-5 text-amber-500" />;
      case 'event': return <Calendar className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Community Board
        </h3>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          {announcements.map((item) => (
            <div key={item.id} className="flex gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                item.type === 'alert' ? 'bg-amber-100 dark:bg-amber-900/30' :
                item.type === 'event' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                {getIcon(item.type)}
              </div>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-1 gap-1">
                  <h4 className="font-bold text-slate-900 dark:text-white">{item.title}</h4>
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{item.date}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                  {item.message}
                </p>
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  Posted by {item.author}
                </p>
              </div>
            </div>
          ))}
          {announcements.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">No announcements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

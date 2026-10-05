import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from './api';
import { ActivityTimeline } from './shared';

/** In-app notifications: activity rows of type "notification" (written by workflows) plus failed workflow runs. */
export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = () => api.get('/activity?type=notification&limit=8').then((r) => { setItems(r.items); setError(false); }, () => setError(true));
  useEffect(() => { void load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const recent = items.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 24 * 3600 * 1000).length;

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); void load(); }} aria-label={`Notifications${recent ? `, ${recent} in the last day` : ''}`} aria-expanded={open}
        className="relative p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg">
        <Bell className="h-5 w-5" />{recent > 0 && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-h-96 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl">
          <div className="text-sm font-bold mb-3">Notifications</div>
          {error ? <p className="text-sm text-red-600">Unable to load notifications.</p> : items.length ? <ActivityTimeline items={items} /> : <p className="text-sm text-slate-500">You’re all caught up. Workflows can send in-app notifications here.</p>}
        </div>)}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy } from '../../lib/dataClient';
import { db } from '../../lib/dataClient';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Clock, CheckCircle, AlertTriangle, X, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

import MaintenanceRequest from '../../components/MaintenanceRequest';
import PaymentHistoryChart from '../../components/PaymentHistoryChart';
import CommunityBoard from '../../components/CommunityBoard';
import TenantChatbot from '../../components/TenantChatbot';

export default function TenantPortal({ activeTab = 'dashboard' }: { activeTab?: string }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('low');

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'maintenance_requests'),
      where('tenantId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(reqs);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    try {
      await addDoc(collection(db, 'maintenance_requests'), {
        title,
        description,
        priority,
        status: 'pending',
        tenantId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setPriority('low');
    } catch (error) {
      console.error("Error adding request: ", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'in_progress': return <AlertTriangle className="h-5 w-5 text-blue-500" />;
      case 'resolved': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return <Clock className="h-5 w-5 text-slate-500" />;
    }
  };

  if (activeTab === 'maintenance') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">My Maintenance Requests</h2>
            <p className="text-slate-500 dark:text-slate-400">Track and manage your property issues.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" /> New Request
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.length === 0 ? (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
              <p className="text-slate-500 dark:text-slate-400 text-lg">No maintenance requests found.</p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-1">{req.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      req.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      req.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {req.priority}
                    </span>
                    {getStatusIcon(req.status)}
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">{req.description || "No description provided."}</p>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                  Created: {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                </div>
              </div>
            ))
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="relative max-w-2xl w-full">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-10"
              >
                <X className="h-6 w-6" />
              </button>
              <MaintenanceRequest onClose={() => setIsModalOpen(false)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[22px] bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(124,58,237,.28),transparent_38%),radial-gradient(circle_at_10%_100%,rgba(6,182,212,.14),transparent_35%)]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Resident workspace</div><h2 className="text-3xl font-black tracking-tight md:text-4xl">Home at a glance</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Maintenance requests, community updates, and your documents in one focused workspace.</p></div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Balance due</p><p className="mt-2 text-2xl font-black text-slate-400">—</p><p className="mt-1 text-xs text-slate-500">Online rent accounts are not available yet</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Maintenance</p><p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{requests.length}</p><p className="mt-1 text-xs text-slate-500">{requests.filter(r => r.status === 'resolved').length} resolved</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Lease</p><p className="mt-2 text-2xl font-black text-slate-400">—</p><p className="mt-1 text-xs text-slate-500">No lease on file</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Maintenance</p><h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Recent requests</h3></div><button onClick={() => setIsModalOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">New request</button></div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">{requests.slice(0,4).map(req => <div key={req.id} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{req.title}</p><p className="mt-1 text-xs text-slate-500">{req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}</p></div><div className="flex items-center gap-2">{getStatusIcon(req.status)}<span className="text-xs font-semibold capitalize text-slate-500">{req.status?.replace('_',' ')}</span></div></div>)}{requests.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-500">No maintenance requests yet.</div>}</div>
          </section>
          <div className="grid gap-6 lg:grid-cols-2"><PaymentHistoryChart /><CommunityBoard /></div>
        </div>
        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Lease</p><h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">No lease on file</h3><p className="mt-3 text-sm text-slate-500">Lease details appear here once your property manager adds them.</p></section>
        </aside>
      </div>

      {isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="relative w-full max-w-2xl"><button onClick={() => setIsModalOpen(false)} className="absolute right-4 top-4 z-10 text-slate-400 hover:text-white"><X className="h-6 w-6" /></button><MaintenanceRequest onClose={() => setIsModalOpen(false)} /></div></div>}
      <div className="fixed bottom-6 right-6 z-40">{isChatbotOpen ? <div className="w-[350px] sm:w-[400px]"><TenantChatbot onClose={() => setIsChatbotOpen(false)} /></div> : <button onClick={() => setIsChatbotOpen(true)} className="rounded-full bg-indigo-600 p-4 text-white shadow-2xl hover:bg-indigo-700"><MessageSquare className="h-6 w-6" /></button>}</div>
    </div>
  );
}
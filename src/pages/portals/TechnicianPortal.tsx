import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, orderBy } from '../../lib/dataClient';
import { db } from '../../lib/dataClient';
import { Wrench, MapPin, Clock, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

export default function TechnicianPortal({ activeTab = 'dashboard' }: { activeTab?: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [connectedSystems, setConnectedSystems] = useState<Record<string, boolean>>({
    'Home Depot Pro': true,
    'Google Maps API': true,
    'Jobber': false,
    'QuickBooks Time': false,
  });

  const [activeAgents, setActiveAgents] = useState<Record<string, boolean>>({
    'Diagnostic Assistant': false,
    'Route Optimizer': false,
    'PropertyFlow Omni Agent': false,
  });

  const [activeModal, setActiveModal] = useState<{
    name: string;
    type: 'system' | 'agent';
    desc: string;
  } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const q = query(
      collection(db, 'maintenance_requests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        hasPendingWrites: snapshot.metadata.hasPendingWrites
      }));
      setRequests(reqs);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'maintenance_requests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  if (activeTab === 'integrations') {
    const systemsList = [
      { name: 'Home Depot Pro', desc: 'Sync materials and parts purchasing.' },
      { name: 'Google Maps API', desc: 'Optimize route planning.' },
      { name: 'Jobber', desc: 'Import work orders from external clients.' },
      { name: 'QuickBooks Time', desc: 'Sync timesheets for payroll.' }
    ];

    const agentsList = [
      { name: 'Diagnostic Assistant', desc: 'Upload photos of broken appliances and receive instant AI-powered diagnostic suggestions and required parts lists.' },
      { name: 'Route Optimizer', desc: 'Dynamically rearranges your daily schedule based on traffic conditions and urgent emergency requests.' },
      { name: 'PropertyFlow Omni Agent', desc: 'Responds to messages and alerts, makes bid requests, tracks maintenance work orders, summarizes weekly reports, and generates invoices, documents, and templates.' }
    ];

    const handleSystemToggle = (name: string, desc: string) => {
      setActiveModal({ name, type: 'system', desc });
    };

    const handleAgentToggle = (name: string, desc: string) => {
      setActiveModal({ name, type: 'agent', desc });
    };

    const confirmModalAction = () => {
      if (!activeModal) return;
      if (activeModal.type === 'system') {
        setConnectedSystems(prev => ({
          ...prev,
          [activeModal.name]: !prev[activeModal.name]
        }));
      } else {
        setActiveAgents(prev => ({
          ...prev,
          [activeModal.name]: !prev[activeModal.name]
        }));
      }
      setActiveModal(null);
    };

    return (
      <div className="space-y-6 relative">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations & AI Agents</h2>
          <p className="text-slate-500 dark:text-slate-400">Connect tool suppliers, scheduling software, and configure your AI assistants.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Third-Party Integrations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Systems Integrations</h3>
            <div className="space-y-4">
              {systemsList.map((int, i) => {
                const isConnected = connectedSystems[int.name];
                return (
                  <div key={i} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{int.name}</h4>
                      <p className="text-xs text-slate-500">{int.desc}</p>
                    </div>
                    <button 
                      onClick={() => handleSystemToggle(int.name, int.desc)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                        isConnected 
                          ? 'text-emerald-600 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isConnected ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Agents */}
          <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
              <span className="text-xl">🤖</span> AI Agents Add-ons
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">
              These intelligent agents are custom add-ons configured per account. Click to configure or toggle.
            </p>
            <div className="space-y-4">
              {agentsList.map((agent, i) => {
                const isActive = activeAgents[agent.name];
                return (
                  <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{agent.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded font-bold transition-all ${
                        isActive 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                      }`}>
                        {isActive ? 'Active' : 'Add-on'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      {agent.desc}
                    </p>
                    <button 
                      onClick={() => handleAgentToggle(agent.name, agent.desc)}
                      className={`text-xs font-bold px-3 py-1.5 rounded transition-all ${
                        isActive 
                          ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/20' 
                          : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/20'
                      }`}
                    >
                      {isActive ? 'Deactivate Agent' : 'Activate Agent'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CONNECTION MODAL */}
        {activeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeModal.type === 'system' ? '🔌' : '🤖'}</span>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    {activeModal.type === 'system' ? 'System Integration Connection' : 'AI Agent Configuration'}
                  </h3>
                  <p className="text-xs text-slate-500">{activeModal.name}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {activeModal.type === 'system' 
                  ? `Would you like to sync Propflow with your ${activeModal.name} credentials? This establishes a secure sync channel.` 
                  : `Are you sure you want to deploy the ${activeModal.name} for your portfolio? This agent runs 24/7.`}
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs text-slate-500">
                <strong>Description:</strong> {activeModal.desc}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModalAction}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md"
                >
                  {activeModal.type === 'system' 
                    ? (connectedSystems[activeModal.name] ? 'Disconnect' : 'Connect Account')
                    : (activeAgents[activeModal.name] ? 'Deactivate' : 'Activate Add-on')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[22px] bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(6,182,212,.2),transparent_38%),radial-gradient(circle_at_5%_100%,rgba(124,58,237,.18),transparent_35%)]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300"><span className={`h-2 w-2 rounded-full ${isOffline ? 'bg-amber-400' : 'bg-emerald-400'}`} /> Field operations</div><h2 className="text-3xl font-black tracking-tight md:text-4xl">Work order command center</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Prioritize urgent jobs, move work through the queue, and stay productive even when connectivity changes.</p></div>
          <div className={`rounded-xl border px-4 py-3 backdrop-blur ${isOffline ? 'border-amber-400/20 bg-amber-400/10' : 'border-white/10 bg-white/5'}`}><p className="text-xs font-semibold">{isOffline ? 'Offline mode' : 'Connected'}</p><p className="mt-1 text-[11px] text-slate-400">{isOffline ? 'Changes will sync automatically' : 'Live maintenance feed active'}</p></div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Pending</p><p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{requests.filter(r=>r.status==='pending').length}</p><p className="mt-1 text-xs text-amber-600">Awaiting dispatch</p></div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">In progress</p><p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{requests.filter(r=>r.status==='in_progress').length}</p><p className="mt-1 text-xs text-cyan-600">Currently active</p></div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Resolved</p><p className="mt-2 text-3xl font-black text-emerald-600">{requests.filter(r=>r.status==='resolved').length}</p><p className="mt-1 text-xs text-slate-500">Completed jobs</p></div></div>
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-400">Live queue</p><h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Maintenance workflow</h3></div><span className="text-xs font-semibold text-slate-500">{requests.length} total</span></div><div className="grid gap-4 p-4 lg:grid-cols-3">{['pending','in_progress','resolved'].map(status=><div key={status} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70"><div className="mb-3 flex items-center justify-between px-1"><span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{status.replace('_',' ')}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm dark:bg-slate-800">{requests.filter(r=>r.status===status).length}</span></div><div className="space-y-3">{requests.filter(r=>r.status===status).slice(0,5).map(req=><div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${req.priority==='urgent'?'bg-rose-500/10 text-rose-600':req.priority==='high'?'bg-amber-500/10 text-amber-600':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{req.priority}</span><Wrench className="h-4 w-4 text-slate-400"/></div><p className="mt-3 line-clamp-2 text-sm font-bold text-slate-950 dark:text-white">{req.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{req.description}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800"><span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>Unit {req.unit || 'TBD'}</span><select value={req.status} onChange={e=>updateStatus(req.id,e.target.value)} className="max-w-[120px] bg-transparent text-[11px] font-semibold outline-none"><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div></div>)}{requests.filter(r=>r.status===status).length===0&&<div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">No tasks</div>}</div></div>)}</div></section>
    </div>
  );
}
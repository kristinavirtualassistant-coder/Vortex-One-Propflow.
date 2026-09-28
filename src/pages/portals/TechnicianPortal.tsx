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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Active Work Orders</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage and update your maintenance tasks.</p>
        </div>
        {isOffline && (
          <div className="flex items-center text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-full text-sm font-medium">
            <Smartphone className="h-4 w-4 mr-2" /> Working Offline - Changes will sync automatically
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4">
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      req.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      req.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
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
      </div>
    </div>
  );
}

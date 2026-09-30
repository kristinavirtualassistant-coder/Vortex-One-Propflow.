import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from '../../lib/dataClient';
import { db } from '../../lib/dataClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, CheckCircle, Clock, AlertTriangle, Building2, Percent, TrendingUp, CalendarDays } from 'lucide-react';
import { GoogleWorkspaceService } from '../../lib/workspace';
import PendingRentWidget from '../../components/PendingRentWidget';
import ActivityFeedWidget from '../../components/ActivityFeedWidget';
import FinancialOverviewChart from '../../components/FinancialOverviewChart';
import MessageCenter from '../../components/MessageCenter';
import DocumentCenter from '../../components/DocumentCenter';
import TenantScreening from '../../components/TenantScreening';
import LeaseExpirationsWidget from '../../components/LeaseExpirationsWidget';

export default function PropertyManagerPortal({ activeTab = 'dashboard' }: { activeTab?: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [connectedSystems, setConnectedSystems] = useState<Record<string, boolean>>({
    'QuickBooks Online': true,
    'Stripe': true,
    'Zapier': false,
    'Zillow Rental Network': false,
    'SmartThings IoT': false,
  });

  const [activeAgents, setActiveAgents] = useState<Record<string, boolean>>({
    'Leasing Assistant Agent': false,
    'Maintenance Triage Agent': false,
    'PropertyFlow Omni Agent': false,
  });

  const [activeModal, setActiveModal] = useState<{
    name: string;
    type: 'system' | 'agent';
    desc: string;
  } | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'maintenance_requests'),
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
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      setLoadingEvents(true);
      GoogleWorkspaceService.getUpcomingEvents()
        .then(res => setEvents(res.items || []))
        .catch(err => console.error('Failed to load events:', err))
        .finally(() => setLoadingEvents(false));
    }
  }, [activeTab]);

  if (activeTab === 'market_intel') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Deal Finder & Comps</h2>
          <p className="text-slate-500 dark:text-slate-400">Discover off-market properties, analyze rental comps, and source new management deals.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex gap-4">
              <input type="text" placeholder="Search by address, ZIP, or neighborhood..." className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Search Map</button>
            </div>

            <div className="space-y-4">
              {[
                { address: '1452 W Willow St', type: 'Multi-Family', units: 4, estRent: '$6,400/mo', value: '$850k', status: 'Pre-foreclosure' },
                { address: '890 N Summit Ave', type: 'Single Family', units: 1, estRent: '$2,800/mo', value: '$420k', status: 'High Equity' },
                { address: '331 E River Blvd', type: 'Multi-Family', units: 12, estRent: '$18,500/mo', value: '$2.1M', status: 'Tired Landlord' }
              ].map((prop, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex justify-between items-center cursor-pointer hover:border-indigo-300 transition-colors">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{prop.address}</h3>
                    <div className="flex gap-3 text-sm text-slate-500 mt-1">
                      <span>{prop.type} • {prop.units} Units</span>
                      <span>Est Value: {prop.value}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 rounded bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold uppercase mb-2">
                      {prop.status}
                    </span>
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                      Est. Rent: {prop.estRent}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Saved Filters & Lists</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                  <span className="text-slate-700 dark:text-slate-300">Absentee Owners (Out of State)</span>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-xs font-medium">1,204</span>
                </div>
                <div className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                  <span className="text-slate-700 dark:text-slate-300">Pre-Foreclosures (90 days)</span>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-xs font-medium">89</span>
                </div>
                <div className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                  <span className="text-slate-700 dark:text-slate-300">High Equity (60%+)</span>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-xs font-medium">4,532</span>
                </div>
              </div>
              <button className="w-full mt-4 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Create New List
              </button>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-5 shadow-sm text-white">
              <h3 className="font-bold text-lg mb-2">Automated Direct Mail</h3>
              <p className="text-sm text-indigo-100 mb-4">Send customized postcards to your targeted lists automatically when new properties match your criteria.</p>
              <button className="bg-white text-indigo-600 w-full py-2 rounded-lg text-sm font-bold shadow-sm">
                Set Up Campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'crm') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CRM & Leads</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage prospective tenants and leasing pipelines.</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">New Inquiries</h3>
            <div className="space-y-3">
              {[] .map((lead, i) => (

                <div key={i} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{lead.name}</span>
                    <span className="text-xs text-slate-500">{lead.date}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">{lead.email}</div>
                  <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 inline-block px-2 py-1 rounded">
                    {lead.property}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Tour Scheduled</h3>
            <div className="space-y-3">
              {[] .map((lead, i) => (
                <div key={i} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{lead.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">{lead.email}</div>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 inline-block px-2 py-1 rounded mb-2 block w-fit">
                    {lead.property}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> {lead.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Application Pending</h3>
            <div className="space-y-3">
               <div className="p-3 border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Michael Chen</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">Screening</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">chen.m@example.com</div>
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 inline-block px-2 py-1 rounded">
                    Oakwood #44
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'integrations') {
    const systemsList = [
      { name: 'QuickBooks Online', desc: 'Sync accounting and rent payments.' },
      { name: 'Stripe', desc: 'Process tenant payments securely.' },
      { name: 'Zapier', desc: 'Connect 5,000+ apps and automate workflows.' },
      { name: 'Zillow Rental Network', desc: 'Syndicate listings automatically.' },
      { name: 'SmartThings IoT', desc: 'Monitor smart locks and thermostats.' }
    ];

    const agentsList = [
      { name: 'Leasing Assistant Agent', desc: 'Automatically responds to email inquiries, answers FAQs about properties, and books tours on your calendar.' },
      { name: 'Maintenance Triage Agent', desc: 'Analyzes incoming maintenance tickets, assigns priority, and auto-dispatches available technicians based on skill set.' },
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
          <p className="text-slate-500 dark:text-slate-400">Connect third-party services and configure automated AI agents.</p>
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

  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const inProgressRequests = requests.filter(r => r.status === 'in_progress').length;
  const resolvedRequests = requests.filter(r => r.status === 'resolved').length;
  
  
  const propertiesSummary = [
    { id: 1, name: 'Skyline Apartments', units: 120, occupancy: '94%', pendingTasks: 12, status: 'Healthy', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=500&q=80' },
    { id: 2, name: 'Oakwood Residences', units: 45, occupancy: '100%', pendingTasks: 3, status: 'Optimal', image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=500&q=80' },
    { id: 3, name: 'Riverfront Lofts', units: 80, occupancy: '82%', pendingTasks: 24, status: 'Needs Attention', image: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=500&q=80' },
  ];
  const metricsData = [
    { name: 'Mon', completed: 4, new: 6 },
    { name: 'Tue', completed: 7, new: 5 },
    { name: 'Wed', completed: 5, new: 8 },
    { name: 'Thu', completed: 8, new: 4 },
    { name: 'Fri', completed: 12, new: 7 },
    { name: 'Sat', completed: 3, new: 2 },
    { name: 'Sun', completed: 4, new: 3 },
  ];

  return (
    <div className="space-y-6">
      {activeTab === 'dashboard' && (
        <>
          <section className="relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-slate-950 px-5 py-6 text-white shadow-[0_24px_70px_rgba(15,23,42,.16)] sm:px-7 sm:py-7 dark:border-white/10">
            <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
            <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-violet-300">
                  <Activity className="h-3.5 w-3.5" /> Live portfolio command center
                </div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Good operations start with what needs attention.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Monitor maintenance, occupancy, cash flow, and the next operational decisions from one workspace.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <HeroStat label="Requests" value={totalRequests} />
                <HeroStat label="Pending" value={pendingRequests} tone="amber" />
                <HeroStat label="In progress" value={inProgressRequests} tone="cyan" />
                <HeroStat label="Resolved" value={resolvedRequests} tone="emerald" />
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Portfolio occupancy" value="92.4%" delta="+2.1%" detail="vs. previous month" icon={<Building2 className="h-4 w-4" />} />
            <MetricCard label="Open maintenance" value={pendingRequests + inProgressRequests} delta={pendingRequests ? `${pendingRequests} pending` : 'Clear'} detail="requires attention" icon={<AlertTriangle className="h-4 w-4" />} tone={pendingRequests ? 'amber' : 'emerald'} />
            <MetricCard label="Monthly collections" value="$58.2k" delta="+6.4%" detail="vs. previous month" icon={<TrendingUp className="h-4 w-4" />} tone="emerald" />
            <MetricCard label="Renewals due" value="0" delta="No alerts" detail="upcoming lease actions" icon={<CalendarDays className="h-4 w-4" />} tone="violet" />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.85fr)]">
            <div className="min-w-0 rounded-[22px] border border-slate-200/70 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/60 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600 dark:text-violet-300">Operational flow</p>
                  <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-white">Requests this week</h3>
                  <p className="mt-1 text-xs text-slate-500">New work entering the queue versus completed work.</p>
                </div>
                <span className="hidden rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-500 sm:inline-flex dark:border-white/10 dark:text-slate-400">Live data</span>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.14} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={28} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,.22)', boxShadow: '0 12px 30px rgba(15,23,42,.10)' }} />
                    <Line type="monotone" dataKey="new" name="New" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0">
              <ActivityFeedWidget />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]">
            <div className="min-w-0">
              <FinancialOverviewChart />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <PendingRentWidget />
              <LeaseExpirationsWidget />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Portfolio</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-white">Property health</h3>
              </div>
              <span className="text-xs text-slate-500">{propertiesSummary.length} tracked properties</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {propertiesSummary.map(property => (
                <article key={property.id} className="group overflow-hidden rounded-[20px] border border-slate-200/70 bg-white/85 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/70 hover:shadow-lg dark:border-white/10 dark:bg-slate-950/60">
                  <div className="relative h-32 overflow-hidden">
                    <img src={property.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3 text-white">
                      <h4 className="text-sm font-bold">{property.name}</h4>
                      <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold backdrop-blur">{property.status}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-white/10">
                    <MiniStat label="Units" value={property.units} />
                    <MiniStat label="Occupancy" value={property.occupancy} />
                    <MiniStat label="Open tasks" value={property.pendingTasks} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'communications' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Communications</h2>
            <p className="text-slate-500 dark:text-slate-400">Message tenants, landlords, and vendors.</p>
          </div>
          <MessageCenter />
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Document Center</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage leases, contracts, and compliance files.</p>
          </div>
          <DocumentCenter />
        </div>
      )}

    </div>
  );
}

function HeroStat({ label, value, tone = 'violet' }: { label: string; value: React.ReactNode; tone?: 'violet' | 'amber' | 'cyan' | 'emerald' }) {
  const tones = { violet: 'text-violet-300', amber: 'text-amber-300', cyan: 'text-cyan-300', emerald: 'text-emerald-300' };
  return <div className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5 backdrop-blur"><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-1 text-xl font-black ${tones[tone]}`}>{value}</div></div>;
}
function MetricCard({ label, value, delta, detail, icon, tone = 'violet' }: { label: string; value: React.ReactNode; delta: string; detail: string; icon: React.ReactNode; tone?: 'violet' | 'amber' | 'emerald' }) {
  const tones = { violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300', amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' };
  return <div className="rounded-[18px] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/55"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span></div><div className="mt-3 flex items-baseline gap-2"><span className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</span><span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{delta}</span></div><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>;
}
function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800 dark:text-slate-200">{value}</p></div>;
}


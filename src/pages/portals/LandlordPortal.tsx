import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from '../../lib/dataClient';
import { db } from '../../lib/dataClient';
import { Building2, DollarSign, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function LandlordPortal({ activeTab = 'dashboard' }: { activeTab?: string }) {
  const [properties, setProperties] = useState<any[]>([]);
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

  // Dummy data for landlord financials
  const financialData = [
    { name: 'Jan', revenue: 45000, expenses: 12000 },
    { name: 'Feb', revenue: 45000, expenses: 8000 },
    { name: 'Mar', revenue: 48000, expenses: 15000 },
    { name: 'Apr', revenue: 48000, expenses: 9000 },
    { name: 'May', revenue: 52000, expenses: 11000 },
    { name: 'Jun', revenue: 52000, expenses: 14000 },
  ];

  if (activeTab === 'market_intel') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Deal Finder & Comps</h2>
          <p className="text-slate-500 dark:text-slate-400">Discover off-market properties, analyze rental comps, and expand your portfolio.</p>
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

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[22px] bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_15%,rgba(124,58,237,.28),transparent_38%),radial-gradient(circle_at_8%_100%,rgba(16,185,129,.12),transparent_35%)]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Ownership workspace</div><h2 className="text-3xl font-black tracking-tight md:text-4xl">Portfolio at a glance</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Track property performance, revenue, occupancy, and the people operating your portfolio.</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"><p className="text-xs font-semibold text-white">Portfolio health</p><p className="mt-1 text-lg font-black text-emerald-300">94% occupied</p></div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Properties</p><p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">12</p><p className="mt-1 text-xs text-slate-500">Across your portfolio</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Revenue</p><p className="mt-2 text-3xl font-black text-emerald-600">$52k</p><p className="mt-1 text-xs text-slate-500">Monthly gross</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Occupancy</p><p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">94%</p><p className="mt-1 text-xs text-slate-500">Current portfolio</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Tenants</p><p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">142</p><p className="mt-1 text-xs text-slate-500">Active residents</p></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Financial pulse</p><h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Revenue vs expenses</h3></div><span className="text-xs font-semibold text-slate-500">6 months</span></div><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={financialData} margin={{top:0,right:0,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.12}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#64748b',fontSize:12}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#64748b',fontSize:12}}/><Tooltip cursor={{fill:'transparent'}} contentStyle={{backgroundColor:'#0f172a',borderColor:'#334155',borderRadius:'10px',color:'#fff'}}/><Bar dataKey="revenue" name="Revenue" fill="#8b5cf6" radius={[5,5,0,0]}/><Bar dataKey="expenses" name="Expenses" fill="#10b981" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></section>
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">Portfolio</p><h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Properties</h3></div><button className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">Add property</button></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{[['Skyline Apartments','120 Units • Downtown Core','98% Occupied','Sarah Jenkins'],['Oakwood Plaza','45 Units • Northwest Region','84% Occupied','David Martinez'],['The Lex Penthouse','Single Unit • East Side Suburbs','100% Occupied','Sarah Jenkins']].map(([name,meta,occupancy,pm])=><div key={name} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="font-semibold text-slate-950 dark:text-white">{name}</p><p className="mt-1 text-xs text-slate-500">{meta}</p></div><div className="text-right"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${occupancy === '84% Occupied' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>{occupancy}</span><p className="mt-1 text-[11px] text-slate-500">PM: {pm}</p></div></div>)}</div></section>
      </div>
    </div>
  );
}
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Portfolio Overview</h2>
        <p className="text-slate-500 dark:text-slate-400">Manage properties, track revenue, and monitor property managers.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Properties</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">12</h3>
            </div>
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Monthly Revenue</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 mt-1">$52k</h3>
            </div>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-500">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Occupancy Rate</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">94%</h3>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-500">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Tenants</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">142</h3>
            </div>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-500">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Financial Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Revenue vs Expenses</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Property List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Properties</h3>
            <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-indigo-700">Add Property</button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Skyline Apartments</h4>
                <p className="text-sm text-slate-500">120 Units • Downtown Core</p>
              </div>
              <div className="text-right">
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-semibold dark:bg-emerald-900/30 dark:text-emerald-400">98% Occupied</span>
                <p className="text-xs text-slate-500 mt-1">PM: Sarah Jenkins</p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Oakwood Plaza</h4>
                <p className="text-sm text-slate-500">45 Units • Northwest Region</p>
              </div>
              <div className="text-right">
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-semibold dark:bg-amber-900/30 dark:text-amber-400">84% Occupied</span>
                <p className="text-xs text-slate-500 mt-1">PM: David Martinez</p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">The Lex Penthouse</h4>
                <p className="text-sm text-slate-500">Single Unit • East Side Suburbs</p>
              </div>
              <div className="text-right">
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-semibold dark:bg-emerald-900/30 dark:text-emerald-400">100% Occupied</span>
                <p className="text-xs text-slate-500 mt-1">PM: Sarah Jenkins</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

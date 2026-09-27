import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from '../../lib/dataClient';
import { db } from '../../lib/firebase';
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
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations & AI Agents</h2>
          <p className="text-slate-500 dark:text-slate-400">Connect third-party services and configure automated AI agents.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Third-Party Integrations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Systems Integrations</h3>
            <div className="space-y-4">
              {[
                { name: 'QuickBooks Online', desc: 'Sync accounting and rent payments.', status: 'Connected', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
                { name: 'Stripe', desc: 'Process tenant payments securely.', status: 'Connected', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
                { name: 'Zapier', desc: 'Connect 5,000+ apps and automate workflows.', status: 'Connect', color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
                { name: 'Zillow Rental Network', desc: 'Syndicate listings automatically.', status: 'Connect', color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
                { name: 'SmartThings IoT', desc: 'Monitor smart locks and thermostats.', status: 'Connect', color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' }
              ].map((int, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{int.name}</h4>
                    <p className="text-xs text-slate-500">{int.desc}</p>
                  </div>
                  <button className={`text-xs font-bold px-3 py-1.5 rounded-md ${int.color}`}>
                    {int.status}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* AI Agents */}
          <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
              <span className="text-xl">🤖</span> AI Agents Add-ons
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">
              These intelligent agents are custom add-ons configured per account. Contact sales to upgrade and activate.
            </p>
            <div className="space-y-4 opacity-75">
              <div className="p-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Leasing Assistant Agent</h4>
                  <span className="text-xs bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 px-2 py-1 rounded font-bold">Add-on</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Automatically responds to email inquiries, answers FAQs about properties, and books tours on your calendar.
                </p>
                <button className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Contact Sales</button>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Maintenance Triage Agent</h4>
                  <span className="text-xs bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 px-2 py-1 rounded font-bold">Add-on</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Analyzes incoming maintenance tickets, assigns priority, and auto-dispatches available technicians based on skill set.
                </p>
                <button className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Contact Sales</button>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">PropertyFlow Omni Agent</h4>
                  <span className="text-xs bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 px-2 py-1 rounded font-bold">Add-on</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Responds to messages and alerts, makes bid requests, tracks maintenance work orders, summarizes weekly reports, and generates invoices, documents, and templates.
                </p>
                <button className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Contact Sales</button>
              </div>
            </div>
          </div>
        </div>
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
    <div className="space-y-8">
      {activeTab === 'dashboard' && (
        <>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Property Overview</h2>
        <p className="text-slate-500 dark:text-slate-400">Real-time metrics and maintenance tracking.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Requests</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalRequests}</h3>
            </div>
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending</p>
              <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-500 mt-1">{pendingRequests}</h3>
            </div>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600 dark:text-yellow-500">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">In Progress</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-500 mt-1">{inProgressRequests}</h3>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Resolved</p>
              <h3 className="text-2xl font-bold text-green-600 dark:text-green-500 mt-1">{resolvedRequests}</h3>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-500">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      
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
                  <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full ${prop.status === 'Needs Attention' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
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
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Weekly Volume</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metricsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="new" name="New Requests" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Technician Uptime & Efficiency</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                />
                <Line type="monotone" dataKey="completed" name="Efficiency Score" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, fill: '#8b5cf6'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FinancialOverviewChart />
        <div className="flex flex-col gap-6">
          <div className="flex-1"><LeaseExpirationsWidget /></div>
          <div className="flex-1"><TenantScreening /></div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PendingRentWidget />
        <ActivityFeedWidget />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        {/* Recent Requests List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Maintenance Logs</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-6 py-4 font-medium">Issue</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {requests.slice(0, 5).map(req => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white line-clamp-1">{req.title}</div>
                      <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        req.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        req.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        req.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        req.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calendar Widget */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Calendar & Schedule
            </h3>
            <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md font-semibold hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400">View Full</a>
          </div>
          <div className="overflow-x-auto flex-1 p-4 space-y-3 max-h-[300px] overflow-y-auto">
            {loadingEvents ? (
              <div className="text-center py-8 text-slate-500 text-sm">Syncing with Google Calendar...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                No upcoming events found. Connect Workspace to sync maintenance and move-ins.
              </div>
            ) : (
              events.map((event, i) => {
                const date = new Date(event.start?.dateTime || event.start?.date);
                const isAllDay = !event.start?.dateTime;
                return (
                  <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex gap-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs font-bold text-slate-500 uppercase">{date.toLocaleString('default', { month: 'short' })}</div>
                      <div className="text-xl font-black text-slate-900 dark:text-white">{date.getDate()}</div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{event.summary || 'Untitled Event'}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {isAllDay ? 'All Day' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {event.htmlLink && (
                      <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors">
                        <CalendarDays className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
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

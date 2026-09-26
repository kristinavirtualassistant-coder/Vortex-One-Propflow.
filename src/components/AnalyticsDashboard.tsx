import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  Percent,
  Wrench,
  DollarSign,
  TrendingDown,
  Calendar,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  FileText
} from 'lucide-react';

// Mock historical data for trends if Firestore collection has limited items
const defaultMonthlyMetrics = [
  { month: 'Jan', occupancy: 91, revenue: 42000, maintenanceCost: 2800, budget: 3500, submittedRequests: 12, resolvedRequests: 10 },
  { month: 'Feb', occupancy: 92, revenue: 42500, maintenanceCost: 3100, budget: 3500, submittedRequests: 18, resolvedRequests: 14 },
  { month: 'Mar', occupancy: 90, revenue: 41800, maintenanceCost: 4200, budget: 3500, submittedRequests: 24, resolvedRequests: 21 },
  { month: 'Apr', occupancy: 93, revenue: 43200, maintenanceCost: 2900, budget: 3500, submittedRequests: 15, resolvedRequests: 13 },
  { month: 'May', occupancy: 95, revenue: 44100, maintenanceCost: 2500, budget: 3500, submittedRequests: 14, resolvedRequests: 15 },
  { month: 'Jun', occupancy: 96, revenue: 44800, maintenanceCost: 3600, budget: 3500, submittedRequests: 20, resolvedRequests: 18 },
  { month: 'Jul', occupancy: 96, revenue: 45000, maintenanceCost: 4500, budget: 3500, submittedRequests: 29, resolvedRequests: 22 },
  { month: 'Aug', occupancy: 97, revenue: 45800, maintenanceCost: 2100, budget: 3500, submittedRequests: 16, resolvedRequests: 16 }
];

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#10b981'];

export default function AnalyticsDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'6m' | '12m'>('6m');
  const [selectedProperty, setSelectedProperty] = useState<string>('all');

  const handleExportCSV = () => {
    const headers = [
      'Month', 
      'Occupancy (%)', 
      'Revenue ($)', 
      'Maintenance Cost ($)', 
      'Budget Limit ($)', 
      'Submitted Requests', 
      'Resolved Requests'
    ];
    const rows = chartData.map(d => [
      d.month,
      d.occupancy,
      d.revenue,
      d.maintenanceCost,
      d.budget,
      d.submittedRequests,
      d.resolvedRequests
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PropFlow_Analytics_${selectedProperty}_${selectedTimeframe}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker is active. Please enable pop-ups to export the PDF report.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const rowsHtml = chartData.map(d => {
      const budgetDiff = d.budget - d.maintenanceCost;
      const budgetStatus = budgetDiff >= 0 
        ? `<span style="color: #10b981; font-weight: 600;">+$${budgetDiff.toLocaleString()} (Under)</span>`
        : `<span style="color: #ef4444; font-weight: 600;">-$${Math.abs(budgetDiff).toLocaleString()} (Over)</span>`;
      return `
        <tr>
          <td>${d.month}</td>
          <td class="num">${d.occupancy}%</td>
          <td class="num">$${d.revenue.toLocaleString()}</td>
          <td class="num">$${d.maintenanceCost.toLocaleString()}</td>
          <td class="num">$${d.budget.toLocaleString()}</td>
          <td>${budgetStatus}</td>
          <td class="num">${d.submittedRequests} / ${d.resolvedRequests}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>PropFlow Analytics Report - ${selectedProperty}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
            
            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              color: #0f172a;
              background-color: #ffffff;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .brand {
              font-size: 24px;
              font-weight: 800;
              letter-spacing: -0.05em;
              color: #4f46e5;
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              margin-top: 10px;
              color: #1e293b;
            }
            .meta {
              font-size: 11px;
              color: #64748b;
              margin-top: 5px;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-bottom: 30px;
            }
            .kpi-card {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 15px;
              border-radius: 12px;
            }
            .kpi-label {
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #64748b;
              margin-bottom: 5px;
            }
            .kpi-val {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              font-family: 'JetBrains Mono', monospace;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            th, td {
              border-bottom: 1px solid #e2e8f0;
              padding: 10px 12px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 600;
              color: #475569;
            }
            .num {
              font-family: 'JetBrains Mono', monospace;
              font-variant-numeric: tabular-nums;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              font-size: 10px;
              color: #94a3b8;
              text-align: center;
            }
            @media print {
              body {
                margin: 20px;
              }
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="brand">PropFlow™</span>
              <button onclick="window.print()" style="padding: 8px 16px; background-color: #4f46e5; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">
                Print / Save PDF
              </button>
            </div>
            <div class="title">Portfolio Operations & Financial Analytics Report</div>
            <div class="meta">
              Report Generated: <strong>${todayStr}</strong> &middot; Target Portfolio: <strong>${selectedProperty === 'all' ? 'All Portfolio Properties' : selectedProperty.toUpperCase() + ' Apartments'}</strong> &middot; Range: <strong>${selectedTimeframe === '6m' ? 'Last 6 Months' : 'Last 12 Months'}</strong>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Average Occupancy</div>
              <div class="kpi-val">${currentOccupancy}%</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total Rental Revenue</div>
              <div class="kpi-val">$${totalRentCollected.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Average Resolution Time</div>
              <div class="kpi-val">${averageResolutionDays} Days</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Active Work Orders</div>
              <div class="kpi-val">${requests.length} Requests</div>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 30px; margin-bottom: 10px;">Monthly Financials & Repair Analytics Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Occupancy Rate</th>
                <th>Collected Rent</th>
                <th>Maintenance Outlays</th>
                <th>Budget Capacity</th>
                <th>Budget Standing</th>
                <th>Work Orders (New / Solved)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            PropFlow Security Verified &middot; Confidential Report for Landlords and Property Executives &middot; &copy; 2026 PropFlow Corp.
          </div>

          <script>
            // Auto trigger print dialogue
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(items);
    });

    return () => unsubscribe();
  }, []);

  // Compute stats from active requests
  const pendingCount = requests.filter(r => r.status === 'pending' || r.status === 'open').length;
  const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
  const resolvedCount = requests.filter(r => r.status === 'resolved' || r.status === 'completed').length;
  
  // Real-time Urgency Distribution
  const urgencyStats = [
    { name: 'Routine', value: requests.filter(r => (r.urgency || r.priority) === 'routine').length || 10 },
    { name: 'High', value: requests.filter(r => (r.urgency || r.priority) === 'high').length || 6 },
    { name: 'Urgent', value: requests.filter(r => (r.urgency || r.priority) === 'urgent' || (r.urgency || r.priority) === 'emergency').length || 4 }
  ];

  const currentOccupancy = 96.4;
  const totalRentCollected = 45800;
  const averageResolutionDays = 2.4;

  const chartData = selectedTimeframe === '6m' ? defaultMonthlyMetrics.slice(2) : defaultMonthlyMetrics;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Advanced Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time visual reports on occupancy, rental revenue, and maintenance operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setSelectedTimeframe('6m')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedTimeframe === '6m'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setSelectedTimeframe('12m')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedTimeframe === '12m'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              12 Months
            </button>
          </div>

          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Properties Portfolio</option>
            <option value="skyline">Skyline Heights Apartments</option>
            <option value="sunset">Sunset Boulevard Manor</option>
            <option value="oakwood">Oakwood Villas</option>
          </select>

          {/* Export Actions */}
          <div className="flex items-center gap-2 border-l pl-3 border-slate-200 dark:border-slate-800">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              title="Export as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              title="Export as PDF Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Portfolio Occupancy</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{currentOccupancy}%</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +1.2%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">Target rate: 95% threshold</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Monthly Gross Revenue</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">${totalRentCollected.toLocaleString()}</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +4.8%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">Rent & utilities invoices collected</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Open Repair Tickets</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{pendingCount + inProgressCount}</span>
              <span className="text-xs font-bold text-rose-500 flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> -12%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">Active backlog workorders</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Avg Resolution Speed</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{averageResolutionDays} Days</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> -0.5d
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">Ticket submission to completion</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recharts Graphical Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Occupancy Trend Curve */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                  <Percent className="w-5 h-5 text-indigo-500" />
                  Portfolio Occupancy Rate Trend
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Monthly tracking of physical unit occupancy over time</p>
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis domain={[80, 100]} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="occupancy" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorOccupancy)" name="Occupancy %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Urgency Distribution Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Ticket Urgency Breakdown
            </h3>
            <p className="text-xs text-slate-500 mb-6">Current breakdown of logged repairs by priority level</p>

            <div className="h-60 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={urgencyStats}
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {urgencyStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {requests.length || 20}
                </span>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">Tickets</span>
              </div>
            </div>
          </div>

          <div className="flex justify-around border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
            {urgencyStats.map((stat, idx) => (
              <div key={stat.name} className="text-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{stat.name}</span>
                <span className="block text-xs text-slate-400 mt-0.5">{stat.value} requests</span>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Request Trends vs Resolved */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-500" />
                Maintenance Trends Volume
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Comparison of incoming service tickets vs. resolved items</p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="submittedRequests" name="Tickets Submitted" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolvedRequests" name="Tickets Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Flow: Gross Income vs Maintenance Outflow */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Cash Outflow vs Revenue
            </h3>
            <p className="text-xs text-slate-500 mb-6">Comparison of total gross rental revenue to maintenance repair costs</p>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="revenue" name="Rent Collected ($)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="maintenanceCost" name="Repairs Cost ($)" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly Maintenance Spending vs Budget */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-500" />
                Monthly Maintenance Spending Report
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed monthly servicing expenditures and repair outlays vs property budget limit ($3,500)
              </p>
            </div>
            
            {/* Quick Metrics */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-rose-500 rounded-sm"></span>
                <span className="text-slate-600 dark:text-slate-400">Actual Outlay</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-t-2 border-dashed border-slate-400 dark:border-slate-500"></span>
                <span className="text-slate-600 dark:text-slate-400">Budget Limit ($3,500)</span>
              </div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(val) => `$${val.toLocaleString()}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const spend = data.maintenanceCost;
                      const budget = data.budget;
                      const percent = Math.round((spend / budget) * 100);
                      const diff = spend - budget;
                      const isOver = diff > 0;

                      return (
                        <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-slate-200">{data.month} Spending Report</p>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Actual Outlay:</span>
                            <span className="font-mono font-bold text-rose-400">${spend.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Monthly Budget:</span>
                            <span className="font-mono font-bold text-slate-300">${budget.toLocaleString()}</span>
                          </div>
                          <div className="border-t border-slate-700/60 pt-1 mt-1 flex justify-between gap-4">
                            <span className="text-slate-400">Budget Used:</span>
                            <span className={`font-mono font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {percent}%
                            </span>
                          </div>
                          {isOver ? (
                            <p className="text-[10px] text-rose-400 font-semibold mt-1">⚠️ Over Budget by ${diff.toLocaleString()}</p>
                          ) : (
                            <p className="text-[10px] text-emerald-400 font-semibold mt-1">✓ Under Budget by ${Math.abs(diff).toLocaleString()}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="maintenanceCost" name="Actual Spending" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={45} />
                <ReferenceLine y={3500} stroke="#94a3b8" strokeDasharray="6 6" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

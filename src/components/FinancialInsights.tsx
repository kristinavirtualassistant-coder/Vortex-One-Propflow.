import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, Download, Loader2 } from 'lucide-react';
import { GoogleWorkspaceService } from '../lib/workspace';

export default function FinancialInsights() {
  const [data, setData] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'rental_income_trends'),
      orderBy('order', 'asc') // Use an order field to keep months sorted
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const metrics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (metrics.length > 0) {
        setData(metrics);
      } else {
        // Fallback UI data if Firestore collection is empty
        setData([
          { month: 'Jan', income: 42000 },
          { month: 'Feb', income: 45000 },
          { month: 'Mar', income: 47500 },
          { month: 'Apr', income: 46200 },
          { month: 'May', income: 51000 },
          { month: 'Jun', income: 54000 }
        ]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleExport = async () => {
    if (data.length === 0) return;
    setExporting(true);
    setSheetUrl(null);
    try {
      const headers = ['Month', 'Rental Income ($)'];
      const rows = data.map(m => [m.month, m.income?.toString() || '0']);
      const url = await GoogleWorkspaceService.exportToSheets(`Rental Income Trends - ${new Date().toLocaleDateString()}`, headers, rows);
      setSheetUrl(url);
    } catch (error) {
      console.error('Export failed', error);
      alert('Failed to export to Google Sheets. Have you connected Workspace?');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Rental Income Trends (Firestore)</h3>
            <p className="text-sm text-slate-500">Monthly revenue tracked via real-time database.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline">
              View Sheet
            </a>
          )}
          <button 
            onClick={handleExport} 
            disabled={exporting}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </button>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(value) => `$${value/1000}k`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
              formatter={(value: any) => [`$${value.toLocaleString()}`, 'Income']}
            />
            <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

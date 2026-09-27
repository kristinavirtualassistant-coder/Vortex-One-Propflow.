import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from './src/lib/dataClient';
import { db } from './src/lib/dataClient';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DollarSign } from 'lucide-react';

export default function FinanceAnalytics() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'finance_analytics'),
      orderBy('order', 'asc') // Keep months sorted
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
          { month: 'Jan', income: 42000, expenses: 12500 },
          { month: 'Feb', income: 45000, expenses: 14000 },
          { month: 'Mar', income: 47500, expenses: 18000 },
          { month: 'Apr', income: 46200, expenses: 11000 },
          { month: 'May', income: 51000, expenses: 15500 },
          { month: 'Jun', income: 54000, expenses: 13200 }
        ]);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Finance Analytics</h3>
          <p className="text-sm text-slate-500">Income vs Expenditures (Firestore)</p>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(value) => `$${value/1000}k`} />
            <Tooltip 
              cursor={{fill: 'transparent'}}
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
              formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="income" name="Rental Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="expenses" name="Maintenance Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

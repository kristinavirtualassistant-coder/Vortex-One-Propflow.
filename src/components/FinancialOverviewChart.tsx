import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export default function FinancialOverviewChart() {
  const data = [
    { month: 'Jan', income: 45000, expenses: 28000 },
    { month: 'Feb', income: 47000, expenses: 32000 },
    { month: 'Mar', income: 52000, expenses: 29000 },
    { month: 'Apr', income: 51000, expenses: 35000 },
    { month: 'May', income: 54000, expenses: 31000 },
    { month: 'Jun', income: 58000, expenses: 33000 },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Financial Overview
          </h3>
          <p className="text-sm text-slate-500 mt-1">Income vs Expenses (Last 6 Months)</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Income</p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
              $307k <TrendingUp className="w-4 h-4" />
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Expenses</p>
            <p className="text-lg font-black text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
              $188k <TrendingDown className="w-4 h-4" />
            </p>
          </div>
        </div>
      </div>
      <div className="p-6 flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(value) => `$${value / 1000}k`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
              cursor={{fill: '#374151', opacity: 0.1}}
              formatter={(value) => [`$${value.toLocaleString()}`, '']}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

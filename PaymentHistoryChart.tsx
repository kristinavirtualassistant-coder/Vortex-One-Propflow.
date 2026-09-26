import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PaymentHistoryChart() {
  const data = [
    { month: 'Sep', amount: 1450 },
    { month: 'Oct', amount: 1450 },
    { month: 'Nov', amount: 1450 },
    { month: 'Dec', amount: 1450 },
    { month: 'Jan', amount: 1450 },
    { month: 'Feb', amount: 1450 },
    { month: 'Mar', amount: 1450 },
    { month: 'Apr', amount: 1450 },
    { month: 'May', amount: 1450 },
    { month: 'Jun', amount: 1450 },
    { month: 'Jul', amount: 1450 },
    { month: 'Aug', amount: 1450 },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Payment History (Last 12 Months)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value) => [`$${value}`, 'Amount Paid']}
            />
            <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} dot={{r: 4, fill: '#4f46e5'}} activeDot={{r: 6}} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp } from '../lib/dataClient';
import { db } from '../lib/dataClient';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Zap, Droplet, Flame, Plus, Loader2 } from 'lucide-react';

export default function UtilityTracking() {
  const { user } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    property: 'Apartment 4B',
    month: new Date().toISOString().slice(0, 7), // YYYY-MM format
    utilityType: 'electricity',
    cost: '',
    usage: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'utility_bills'),
      orderBy('month', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBills(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'utility_bills'), {
        ...formData,
        cost: parseFloat(formData.cost),
        usage: parseFloat(formData.usage),
        addedBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setFormData({
        ...formData,
        cost: '',
        usage: ''
      });
    } catch (error) {
      console.error('Error adding utility bill:', error);
      alert('Failed to add utility bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group data by month for the chart
  const getChartData = () => {
    const dataByMonth: Record<string, any> = {};
    
    bills.forEach(bill => {
      if (!dataByMonth[bill.month]) {
        dataByMonth[bill.month] = { 
          month: bill.month, 
          electricity: 0, 
          water: 0, 
          gas: 0 
        };
      }
      dataByMonth[bill.month][bill.utilityType] += bill.cost;
    });

    return Object.values(dataByMonth).sort((a, b) => a.month.localeCompare(b.month));
  };

  const chartData = getChartData();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Utility Tracking</h2>
          <p className="text-slate-500 dark:text-slate-400">Monitor and track utility usage and costs across properties.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add Utility Bill</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Property</label>
              <select
                value={formData.property}
                onChange={(e) => setFormData({...formData, property: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="Apartment 4B">Apartment 4B</option>
                <option value="Suite 102">Suite 102</option>
                <option value="Building C">Building C</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Month</label>
              <input
                type="month"
                value={formData.month}
                onChange={(e) => setFormData({...formData, month: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Utility Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, utilityType: 'electricity'})}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-sm transition-colors ${
                    formData.utilityType === 'electricity' 
                      ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Zap className="w-5 h-5 mb-1" />
                  Electricity
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, utilityType: 'water'})}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-sm transition-colors ${
                    formData.utilityType === 'water' 
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Droplet className="w-5 h-5 mb-1" />
                  Water
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, utilityType: 'gas'})}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-sm transition-colors ${
                    formData.utilityType === 'gas' 
                      ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Flame className="w-5 h-5 mb-1" />
                  Gas
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData({...formData, cost: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 150.50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usage</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.usage}
                  onChange={(e) => setFormData({...formData, usage: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={
                    formData.utilityType === 'electricity' ? 'kWh' :
                    formData.utilityType === 'water' ? 'Gallons' : 'Therms'
                  }
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Bill
            </button>
          </form>
        </div>
        
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Utility Cost Trends</h3>
          
          {chartData.length > 0 ? (
            <div className="h-72 w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="electricity" name="Electricity" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="water" name="Water" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="gas" name="Gas" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
              <div className="flex gap-4 mb-4 opacity-50">
                <Zap className="w-8 h-8 text-amber-500" />
                <Droplet className="w-8 h-8 text-blue-500" />
                <Flame className="w-8 h-8 text-red-500" />
              </div>
              <p>No utility data available yet.</p>
              <p className="text-sm">Add a bill to start tracking trends.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Bills</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4 font-medium">Month</th>
                <th className="px-6 py-4 font-medium">Property</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Usage</th>
                <th className="px-6 py-4 font-medium text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">No bills recorded yet</td>
                </tr>
              ) : (
                [...bills].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 10).map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{bill.month}</td>
                    <td className="px-6 py-4">{bill.property}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {bill.utilityType === 'electricity' && <Zap className="w-4 h-4 text-amber-500" />}
                        {bill.utilityType === 'water' && <Droplet className="w-4 h-4 text-blue-500" />}
                        {bill.utilityType === 'gas' && <Flame className="w-4 h-4 text-red-500" />}
                        <span className="capitalize">{bill.utilityType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {bill.usage} 
                      <span className="text-xs ml-1 text-slate-400">
                        {bill.utilityType === 'electricity' ? 'kWh' : bill.utilityType === 'water' ? 'gal' : 'therms'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-white">
                      ${bill.cost.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

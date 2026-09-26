import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  User,
  DollarSign,
  Briefcase,
  AlertCircle,
  CheckCircle,
  X,
  Trash2,
  RefreshCw,
  Clock
} from 'lucide-react';
import { format, addMonths, setDate, isAfter, parseISO } from 'date-fns';

export interface Lease {
  id: string;
  tenantName: string;
  tenantEmail: string;
  unitName: string;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  dueDay: number; // e.g. 1st, 5th of the month
  status: 'active' | 'expiring' | 'pending' | 'terminated';
  createdAt: any;
  updatedAt: any;
}

export default function LeaseManagement() {
  const { user } = useAuth();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New Lease Form State
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [unitName, setUnitName] = useState('');
  const [monthlyRent, setMonthlyRent] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDay, setDueDay] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'leases'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lease[];
      setLeases(items);
    }, (err) => {
      console.error('Error fetching leases:', err);
    });

    return () => unsubscribe();
  }, []);

  // Helper: auto-calculate next rent due date
  const calculateNextDueDate = (lease: Lease): string => {
    try {
      const today = new Date();
      const start = parseISO(lease.startDate);
      const end = parseISO(lease.endDate);

      // If lease is terminated or expired
      if (lease.status === 'terminated' || today > end) {
        return 'N/A';
      }

      // Start calculating with this month's due date
      let candidate = setDate(today, lease.dueDay);

      // If today is past the candidate due date, the next one is next month
      if (isAfter(today, candidate)) {
        candidate = addMonths(candidate, 1);
      }

      // Make sure the candidate is within the lease timeframe
      if (candidate < start) {
        return format(start, 'MMM d, yyyy');
      }
      if (candidate > end) {
        return 'Lease Expired';
      }

      return format(candidate, 'MMM d, yyyy');
    } catch (e) {
      return 'N/A';
    }
  };

  const handleCreateLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !tenantEmail.trim() || !unitName.trim() || !monthlyRent || !startDate || !endDate) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, 'leases'), {
        tenantName,
        tenantEmail,
        unitName,
        monthlyRent: Number(monthlyRent),
        startDate,
        endDate,
        dueDay: Number(dueDay),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Clear Form and Close Modal
      setTenantName('');
      setTenantEmail('');
      setUnitName('');
      setMonthlyRent('');
      setStartDate('');
      setEndDate('');
      setDueDay(1);
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Error creating lease:', err);
      setError(err.message || 'Failed to register lease. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateLeaseStatus = async (id: string, newStatus: Lease['status']) => {
    try {
      await updateDoc(doc(db, 'leases', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to update lease status:', err);
    }
  };

  const deleteLease = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lease agreement?')) return;
    try {
      await deleteDoc(doc(db, 'leases', id));
    } catch (err) {
      console.error('Failed to delete lease:', err);
    }
  };

  const filteredLeases = leases.filter(l => {
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesSearch = !searchQuery ||
      (l.tenantName && l.tenantName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.tenantEmail && l.tenantEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.unitName && l.unitName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: Lease['status']) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> Active</span>;
      case 'expiring':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="w-3.5 h-3.5" /> Expiring Soon</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><AlertCircle className="w-3.5 h-3.5" /> Pending Signature</span>;
      case 'terminated':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"><X className="w-3.5 h-3.5" /> Terminated</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Lease & Agreement Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View active contracts, add new leases, and track automated rent due schedules.
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Add Lease Agreement
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Controls Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/10">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by tenant, email, unit..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Leases</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring Soon</option>
              <option value="pending">Pending Signature</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>

        {/* Lease Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4 font-semibold">Tenant & Unit</th>
                <th className="px-6 py-4 font-semibold">Duration</th>
                <th className="px-6 py-4 font-semibold">Monthly Rent</th>
                <th className="px-6 py-4 font-semibold">Rent Due Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLeases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                    No active or registered lease agreements found matching this view.
                  </td>
                </tr>
              ) : (
                filteredLeases.map((lease) => (
                  <tr key={lease.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        {lease.tenantName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{lease.tenantEmail}</div>
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                        Unit: {lease.unitName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>{lease.startDate}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">to {lease.endDate}</div>
                    </td>
                    <td className="px-6 py-4 font-extrabold text-slate-900 dark:text-white">
                      ${lease.monthlyRent?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 dark:text-slate-300">
                        Day {lease.dueDay} of month
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        Next: {calculateNextDueDate(lease)}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(lease.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={lease.status}
                          onChange={(e) => updateLeaseStatus(lease.id, e.target.value as Lease['status'])}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="active">Active</option>
                          <option value="expiring">Expiring</option>
                          <option value="pending">Pending</option>
                          <option value="terminated">Terminated</option>
                        </select>
                        <button
                          onClick={() => deleteLease(lease.id)}
                          className="p-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                          title="Delete agreement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lease Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-slide-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Register New Lease Agreement
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="m-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateLease} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tenant Name *</label>
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                    placeholder="e.g. David Chen"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tenant Email *</label>
                  <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    required
                    placeholder="e.g. david@chen.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Property / Unit *</label>
                  <input
                    type="text"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    required
                    placeholder="e.g. Skyline Heights, Apt 14A"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Monthly Rent ($) *</label>
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value ? Number(e.target.value) : '')}
                    required
                    placeholder="e.g. 1850"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Rent Due Day *</label>
                  <select
                    value={dueDay}
                    onChange={(e) => setDueDay(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {[1, 5, 10, 15, 20, 25].map(day => (
                      <option key={day} value={day}>Day {day} of month</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real-time preview of first calculation */}
              {startDate && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                    Rent Schedule Calculation Preview
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    The monthly payment schedule will be generated dynamically. The first rent cycle is scheduled to mature on:
                    <span className="font-bold text-slate-800 dark:text-white block mt-1">
                      {calculateNextDueDate({
                        startDate,
                        endDate,
                        dueDay,
                        status: 'active'
                      } as Lease)}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 min-w-[150px]"
                >
                  {isSubmitting ? 'Registering...' : 'Submit Lease'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

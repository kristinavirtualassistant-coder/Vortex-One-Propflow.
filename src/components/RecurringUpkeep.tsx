import React, { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc
} from '../lib/dataClient';
import {
  Calendar,
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  UserCheck,
  Building,
  CheckCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Search,
  Sliders,
  Tag,
  X
} from 'lucide-react';
import { format, addMonths, parseISO, isValid } from 'date-fns';

export interface RecurringSchedule {
  id: string;
  title: string;
  property: string;
  frequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually';
  nextOccurrence: string;
  assignedVendor: string;
  category: string;
  urgency: 'routine' | 'high' | 'urgent';
  status: 'active' | 'paused';
  createdAt: any;
  userId: string;
}

export default function RecurringUpkeep() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Creation modal/drawer state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [property, setProperty] = useState('all');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'semi_annually' | 'annually'>('quarterly');
  const [nextOccurrence, setNextOccurrence] = useState('');
  const [assignedVendor, setAssignedVendor] = useState('');
  const [category, setCategory] = useState('general');
  const [urgency, setUrgency] = useState<'routine' | 'high' | 'urgent'>('routine');
  
  // Feedback states
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // Load schedules
  useEffect(() => {
    const q = query(
      collection(db, 'recurring_upkeep_schedules'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RecurringSchedule[];
      setSchedules(items);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching recurring schedules:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !nextOccurrence || !assignedVendor.trim()) {
      setActionError('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await addDoc(collection(db, 'recurring_upkeep_schedules'), {
        title,
        property,
        frequency,
        nextOccurrence,
        assignedVendor,
        category,
        urgency,
        status: 'active',
        userId: user?.uid || 'anonymous',
        createdAt: serverTimestamp()
      });

      setActionSuccess(`Recurring upkeep schedule for "${title}" successfully created!`);
      // Reset form
      setTitle('');
      setProperty('all');
      setFrequency('quarterly');
      setNextOccurrence('');
      setAssignedVendor('');
      setCategory('general');
      setUrgency('routine');
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Failed to create schedule:', err);
      setActionError(err.message || 'Failed to save recurring schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (schedule: RecurringSchedule) => {
    const newStatus = schedule.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'recurring_upkeep_schedules', schedule.id), {
        status: newStatus
      });
      setActionSuccess(`Schedule "${schedule.title}" is now ${newStatus === 'active' ? 'Active' : 'Paused'}.`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setActionError('Failed to change schedule status.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the recurring upkeep schedule for "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'recurring_upkeep_schedules', id));
      setActionSuccess(`Recurring schedule for "${name}" successfully deleted.`);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      setActionError('Failed to delete schedule.');
    }
  };

  // Helper to calculate the next calendar date based on frequency intervals
  const calculateNextDate = (currentDateStr: string, freq: 'monthly' | 'quarterly' | 'semi_annually' | 'annually') => {
    try {
      const parsed = parseISO(currentDateStr);
      if (!isValid(parsed)) return currentDateStr;
      
      let added;
      switch (freq) {
        case 'monthly':
          added = addMonths(parsed, 1);
          break;
        case 'quarterly':
          added = addMonths(parsed, 3);
          break;
        case 'semi_annually':
          added = addMonths(parsed, 6);
          break;
        case 'annually':
          added = addMonths(parsed, 12);
          break;
        default:
          added = addMonths(parsed, 3);
      }
      return format(added, 'yyyy-MM-dd');
    } catch (e) {
      console.error('Date calculation error:', e);
      return currentDateStr;
    }
  };

  // Automatically dispatches a work order, updating next event interval
  const triggerEarly = async (schedule: RecurringSchedule) => {
    setTriggeringId(schedule.id);
    setActionSuccess(null);
    setActionError(null);

    try {
      // 1. Create the active work order in maintenance_requests
      await addDoc(collection(db, 'maintenance_requests'), {
        title: `[Seasonal Upkeep] ${schedule.title}`,
        description: `Automated Seasonal Upkeep scheduled recurring task.\nProperty: ${schedule.property === 'all' ? 'All Portfolio Properties' : schedule.property}\nAssigned Contract Vendor: ${schedule.assignedVendor}\nFrequency: ${schedule.frequency.replace('_', ' ')}`,
        unit: schedule.property === 'all' ? 'All Properties' : schedule.property,
        urgency: schedule.urgency,
        priority: schedule.urgency,
        category: schedule.category,
        status: 'pending',
        assignedTo: schedule.assignedVendor,
        userId: user?.uid || 'system',
        userEmail: user?.email || 'landlord@propertyflow.app',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: 'Automated Upkeep Engine'
      });

      // 2. Calculate next calendar date
      const nextRunDate = calculateNextDate(schedule.nextOccurrence, schedule.frequency);

      // 3. Update the schedule meta in the portal store
      await updateDoc(doc(db, 'recurring_upkeep_schedules', schedule.id), {
        nextOccurrence: nextRunDate,
        lastTriggered: serverTimestamp()
      });

      setActionSuccess(`Work Order successfully created for "${schedule.title}"! Next recurrence moved to: ${nextRunDate}`);
    } catch (err: any) {
      console.error('Failed to trigger maintenance schedule:', err);
      setActionError(err.message || 'Failed to dispatch work order.');
    } finally {
      setTriggeringId(null);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'semi_annually': return 'Semi-Annually';
      case 'annually': return 'Annually';
      default: return freq;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action metrics header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            Automated Preventive Upkeep Controller
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure calendar intervals to schedule regular system services, cleaning events, and recurring property safety inspections.
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Recurrent Upkeep
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-slide-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center justify-between animate-slide-in">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 font-bold hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Grid of active schedules */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading recurring portfolio schedules...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">No preventive schedules set up</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            Avoid costly breakdowns by configuring seasonal inspections, heating checkups, filter replacements, or exterior cleaning.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            Schedule Upkeep Tasks
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule) => {
            const isActive = schedule.status === 'active';
            const isTriggering = triggeringId === schedule.id;

            return (
              <div
                key={schedule.id}
                className={`relative bg-white dark:bg-slate-900 border ${
                  isActive ? 'border-slate-200 dark:border-slate-800' : 'border-slate-100 dark:border-slate-900 opacity-60'
                } rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between`}
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                        <span className="flex items-center gap-0.5 font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
                          <Tag className="w-3 h-3" /> {schedule.category}
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold tracking-wider uppercase text-slate-500">
                          {getFrequencyLabel(schedule.frequency)}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm line-clamp-1">
                        {schedule.title}
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      isActive 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <div className="space-y-2 mt-4 text-xs border-t border-slate-50 dark:border-slate-800/50 pt-3">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>Property: <strong className="text-slate-800 dark:text-slate-200 capitalize">{schedule.property.replace('_', ' ')}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Vendor: <strong className="text-slate-800 dark:text-slate-200">{schedule.assignedVendor}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Next Run: <strong className="text-slate-800 dark:text-slate-200 font-mono">{schedule.nextOccurrence}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Operations Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleStatus(schedule)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors bg-slate-50 dark:bg-slate-800/40"
                      title={isActive ? "Pause Upkeep Schedule" : "Resume Upkeep Schedule"}
                    >
                      {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id, schedule.title)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition-colors bg-slate-50 dark:bg-slate-800/40"
                      title="Delete Schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => triggerEarly(schedule)}
                    disabled={isTriggering || !isActive}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[11px] font-bold text-indigo-700 dark:text-indigo-400 transition-colors disabled:opacity-40"
                    title="Generate live work order and push next calendar schedule forward"
                  >
                    {isTriggering ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Triggering...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Trigger Early
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- RECURRING SCHEDULE FORM MODAL --- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Recurrent Schedule</h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              {/* Task Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Upkeep Task Name *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Gutter Cleaning & Downspout Service"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Target Portfolio Property */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Portfolio Scope Property
                </label>
                <select
                  value={property}
                  onChange={(e) => setProperty(e.target.value)}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none capitalize font-semibold"
                >
                  <option value="all">All Properties</option>
                  <option value="sunset">Sunset Boulevard Manor</option>
                  <option value="oakwood">Oakwood Villas</option>
                </select>
              </div>

              {/* Maintenance Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category Tag
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none capitalize font-semibold"
                  >
                    <option value="general">General</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="hvac">HVAC</option>
                    <option value="structural">Structural</option>
                    <option value="pest_control">Pest Control</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Urgency Level
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none capitalize font-semibold"
                  >
                    <option value="routine">Routine</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Upkeep Schedule Frequency & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Frequency *
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annually">Semi-Annually</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Starting / Next Run *
                  </label>
                  <input
                    type="date"
                    value={nextOccurrence}
                    onChange={(e) => setNextOccurrence(e.target.value)}
                    required
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Vendor / Handler */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Assigned Vendor / Handler Contract *
                </label>
                <input
                  type="text"
                  value={assignedVendor}
                  onChange={(e) => setAssignedVendor(e.target.value)}
                  required
                  placeholder="e.g. Apex HVAC Pros / In-House Maintenance"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-70 min-w-[120px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Schedule'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

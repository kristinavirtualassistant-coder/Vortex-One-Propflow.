import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, updateDoc, doc } from '../lib/dataClient';
import { db } from '../lib/dataClient';
import { useAuth } from '../contexts/AuthContext';
import { GoogleWorkspaceService } from '../lib/workspace';
import { Wrench, Loader2, CheckCircle, Clock, AlertTriangle, Plus, Search, Filter, FileText, Sparkles, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import OpenMultiSelect from './OpenMultiSelect';

export default function MaintenanceRequest({ onClose, defaultTab = 'track' }: { onClose?: () => void; defaultTab?: 'submit' | 'track' }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'track'>(defaultTab);
  
  // Form state
  const [unit, setUnit] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'high' | 'urgent'>('routine');
  const [categories, setCategories] = useState<string[]>(['General Repairs']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI Assistant State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  // Tracking state
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(items);
    }, (err) => {
      console.error('Error fetching maintenance requests:', err);
    });

    return () => unsubscribe();
  }, []);

  // AI Analyzer dispatch call
  const handleAiAnalysis = async () => {
    if (!description.trim()) {
      setError('Please write an issue description first so the AI Smart-Assistant has context to analyze!');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAiFeedback(null);
    setAiExplanation(null);

    try {
      const response = await fetch('/api/maintenance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });

      if (!response.ok) {
        throw new Error('AI Analysis server request failed');
      }

      const data = await response.json();
      
      // Auto-populate based on smart dispatch results
      if (data.summary) {
        setTitle(data.summary);
      }
      if (data.priority) {
        setUrgency(data.priority);
      }
      if (data.category) {
        setCategories([data.category]);
      }
      if (data.explanation) {
        setAiExplanation(data.explanation);
      }
      setAiFeedback('Smart-Assistant processed successfully! Review and submit below.');
    } catch (err: any) {
      console.error('AI Smart Assistant error:', err);
      setError('The AI dispatch server is currently offline or busy. Please fill out details manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit.trim() || !description.trim() || !title.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Attempt to create a Google Form / Workspace record if connected
      try {
        await GoogleWorkspaceService.createMaintenanceForm();
      } catch (wsErr) {
        console.warn('Workspace sync skipped or not connected:', wsErr);
      }

      await addDoc(collection(db, 'maintenance_requests'), {
        title,
        description,
        unit,
        urgency,
        priority: urgency, // maintain compatibility with both keys
        category: categories.join(', ') || 'General Repairs',
        categories: categories.length > 0 ? categories : ['General Repairs'],
        status: 'pending',
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: 'Dashboard Maintenance Module'
      });

      setSubmittedMessage('Maintenance request successfully submitted and logged!');
      setUnit('');
      setTitle('');
      setDescription('');
      setUrgency('routine');
      setCategories(['General Repairs']);
      setAiExplanation(null);
      setAiFeedback(null);
      setActiveTab('track');
    } catch (err: any) {
      console.error('Error submitting maintenance request:', err);
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'maintenance_requests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter || req.priority === urgencyFilter;
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesSearch = !searchTerm || 
      (req.title && req.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.description && req.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.unit && req.unit.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesUrgency && matchesCategory && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'completed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> Resolved</span>;
      case 'in_progress':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Clock className="w-3.5 h-3.5" /> In Progress</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5" /> Pending</span>;
    }
  };

  const getUrgencyBadge = (urgencyLevel: string) => {
    switch (urgencyLevel) {
      case 'urgent':
      case 'emergency':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">High</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Routine</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden max-w-5xl mx-auto">
      {/* Header & Tabs */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Maintenance Portal</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Submit and track property repair requests in real-time</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('track')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'track'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Track Requests ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'submit'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" /> New Request
          </button>
        </div>
      </div>

      {submittedMessage && (
        <div className="mx-6 mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{submittedMessage}</span>
          </div>
          <button onClick={() => setSubmittedMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">&times;</button>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold">&times;</button>
        </div>
      )}

      {/* Content Area */}
      <div className="p-6">
        {activeTab === 'submit' ? (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto py-2">
            
            {/* Unit Info */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Property / Unit Name *
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                placeholder="e.g. Sunset Apartments, Apt 4B"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Description First for AI Hook */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Detailed Description *
                </label>
                <button
                  type="button"
                  onClick={handleAiAnalysis}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto-Categorize with AI
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="Describe your issue in detail (e.g., 'Water is leaking from under the kitchen sink, flooding the hardwood floors. It's pooling fast...')"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
            </div>

            {/* AI Assistant Output Card */}
            {aiFeedback && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3.5 items-start animate-slide-in">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white mt-0.5 flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-200">{aiFeedback}</h4>
                  {aiExplanation && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">AI Dispatch Logic:</span> {aiExplanation}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Auto-populated Summary Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Issue Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Leaking kitchen faucet / AC unit not cooling"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Category selection */}
            <div>
              <OpenMultiSelect
                label="Trade Categories (Select one or more, or add custom)"
                presetOptions={[
                  'General Repairs', 'Plumbing', 'Electrical', 'HVAC',
                  'Appliance Repair', 'Structural', 'Carpentry', 'Pest Control',
                  'Roofing', 'Locksmith', 'Painting'
                ]}
                selectedValues={categories}
                onChange={setCategories}
                placeholder="Type additional trade category & press Enter..."
                helperText="Select all relevant categories or enter custom trade tags."
              />
            </div>

            {/* Priority/Urgency selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Urgency Level *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['routine', 'high', 'urgent'] as const).map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setUrgency(lvl)}
                    className={`py-3 px-4 rounded-xl border text-sm font-semibold capitalize transition-all ${
                      urgency === lvl
                        ? lvl === 'urgent'
                          ? 'bg-red-600 text-white border-red-600 shadow-md'
                          : lvl === 'high'
                          ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                          : 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search requests by title, unit..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Urgency Levels</option>
                  <option value="routine">Routine</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Categories</option>
                  <option value="general">General</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="appliance">Appliance</option>
                  <option value="structural">Structural</option>
                  <option value="carpentry">Carpentry</option>
                  <option value="pest_control">Pest Control</option>
                </select>
              </div>
            </div>

            {/* Requests List Grid */}
            {filteredRequests.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No maintenance requests found</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Try adjusting your filters or submit a new repair request.</p>
                <button
                  onClick={() => setActiveTab('submit')}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
                >
                  Create New Request
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRequests.map((req) => (
                  <div key={req.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              {req.unit || 'General Unit'}
                            </span>
                            <span className="text-[10px] text-slate-400">•</span>
                            {(Array.isArray(req.categories) && req.categories.length > 0
                              ? req.categories
                              : (req.category ? String(req.category).split(',').map((s: string) => s.trim()) : ['general'])
                            ).map((catName: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-[9px] uppercase font-bold tracking-wider text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/40"
                              >
                                {catName}
                              </span>
                            ))}
                          </div>
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">
                            {req.title || 'Untitled Request'}
                          </h3>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {getStatusBadge(req.status)}
                          {getUrgencyBadge(req.urgency || req.priority)}
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 mb-4">
                        {req.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-500 mt-auto">
                      <span>
                        Submitted: {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d, yyyy h:mm a') : 'Just now'}
                      </span>

                      <div className="flex items-center gap-2">
                        <select
                          value={req.status || 'pending'}
                          onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

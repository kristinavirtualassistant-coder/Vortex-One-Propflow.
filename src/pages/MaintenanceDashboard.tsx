import React, { useState, useEffect } from 'react';
import { Wrench, Calendar, ClipboardCheck, Smartphone, Clock, UserCheck, ExternalLink, Loader2, Link, Filter, Plus, MoreHorizontal, Search, Sliders } from 'lucide-react';
import { GoogleWorkspaceService } from '../lib/workspace';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import RecurringUpkeep from '../components/RecurringUpkeep';

export default function MaintenanceDashboard() {
  const [activeTab, setActiveTab] = useState<'orders' | 'recurring'>('orders');
  const [formCreating, setFormCreating] = useState(false);
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

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

  const handleCreateForm = async () => {
    setFormCreating(true);
    try {
      const form = await GoogleWorkspaceService.createMaintenanceForm();
      setFormUrl(form.responderUri);
      setFormId(form.formId);
    } catch (error) {
      console.error('Form creation failed', error);
      alert('Failed to create Google Form. Have you connected Workspace in the Integrations tab?');
    } finally {
      setFormCreating(false);
    }
  };

  const handleSyncResponses = async () => {
    if (!formId) return;
    setSyncing(true);
    try {
      const data = await GoogleWorkspaceService.getFormResponses(formId);
      if (data.responses && data.responses.length > 0) {
        let syncedCount = 0;
        for (const response of data.responses) {
          // Assuming the answers map to our questions. In a real scenario, map by question ID.
          // For simplicity, we just extract text answers if available.
          let propertyName = "Unknown Property";
          let issueDesc = "Unknown Issue";
          
          if (response.answers) {
            const answerValues = Object.values(response.answers) as any[];
            if (answerValues.length > 0) propertyName = answerValues[0]?.textAnswers?.answers?.[0]?.value || propertyName;
            if (answerValues.length > 1) issueDesc = answerValues[1]?.textAnswers?.answers?.[0]?.value || issueDesc;
          }

          // Check if already exists (naive check by title/description)
          const exists = requests.some(r => r.unit === propertyName && r.description === issueDesc);
          if (!exists) {
            await addDoc(collection(db, 'maintenance_requests'), {
              title: issueDesc.substring(0, 50) + (issueDesc.length > 50 ? '...' : ''),
              description: issueDesc,
              unit: propertyName,
              status: 'pending',
              priority: 'routine',
              createdAt: serverTimestamp(),
              source: 'Google Forms'
            });
            syncedCount++;
          }
        }
        alert(`Synced ${syncedCount} new maintenance requests from Google Forms!`);
      } else {
        alert('No new responses found.');
      }
    } catch (error) {
      console.error('Sync failed', error);
      alert('Failed to sync form responses.');
    } finally {
      setSyncing(false);
    }
  };

  const updateRequestStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'maintenance_requests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesFilter = filter === 'all' || req.status === filter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    const matchesSearch = !searchQuery || 
      (req.title && req.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (req.description && req.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.unit && req.unit.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesPriority && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'resolved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">In Progress</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Open</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">High</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Routine</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Maintenance & Operations</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Manage work orders, preventive schedules, and property inspections.</p>
        </div>
        
        {/* Tab Controls */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/40 dark:border-slate-700/60 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'orders'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Active Work Orders
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'recurring'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Preventive Scheduling
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <>
          {/* Google Forms Integration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Tenant Maintenance Requests (Google Forms)</h3>
                <p className="text-slate-500 text-sm">Automatically log maintenance submissions directly into your tracking table.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {formUrl && (
                <a href={formUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-purple-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-4 h-4" /> View Live Form
                </a>
              )}
              <button 
                onClick={handleCreateForm}
                disabled={formCreating || !!formUrl}
                className="bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {formCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                {formUrl ? 'Form Connected' : 'Generate Form'}
              </button>
              {formUrl && (
                <button
                  onClick={handleSyncResponses}
                  disabled={syncing}
                  className="bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  Sync Responses
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 text-center cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setFilter('all')}>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{requests.length}</div>
              <div className="text-sm font-medium text-slate-500 mt-1">Total Requests</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 text-center cursor-pointer hover:border-yellow-300 transition-colors" onClick={() => setFilter('pending')}>
              <div className="text-3xl font-extrabold text-yellow-600 dark:text-yellow-500">{requests.filter(r => r.status === 'pending').length}</div>
              <div className="text-sm font-medium text-slate-500 mt-1">Open</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 text-center cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setFilter('in_progress')}>
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-500">{requests.filter(r => r.status === 'in_progress').length}</div>
              <div className="text-sm font-medium text-slate-500 mt-1">In Progress</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 text-center cursor-pointer hover:border-green-300 transition-colors" onClick={() => setFilter('resolved')}>
              <div className="text-3xl font-extrabold text-green-600 dark:text-green-500">{requests.filter(r => r.status === 'resolved').length}</div>
              <div className="text-sm font-medium text-slate-500 mt-1">Completed</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Work Orders
              </h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search requests..."
                    className="pl-9 pr-4 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 transition-all focus:w-64"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select 
                    value={priorityFilter} 
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="routine">Routine</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <select 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Completed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-6 py-4 font-medium">Issue</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Assigned To</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        No requests found matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white line-clamp-1">{req.title}</div>
                          <div className="mt-1 flex items-center gap-2">
                            {getPriorityBadge(req.priority)}
                            <span className="text-xs text-slate-500">{req.unit || 'Unknown Unit'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600 dark:text-slate-400">{req.assignedTo || 'Unassigned'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <select
                            value={req.status}
                            onChange={(e) => updateRequestStatus(req.id, e.target.value)}
                            className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1 focus:outline-none"
                          >
                            <option value="pending">Mark Open</option>
                            <option value="in_progress">Mark In Progress</option>
                            <option value="resolved">Mark Completed</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <RecurringUpkeep />
      )}
    </div>
  );
}


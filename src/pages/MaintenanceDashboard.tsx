import React, { useState, useEffect } from 'react';
import { 
  Wrench, Calendar, ClipboardCheck, Clock, UserCheck, 
  ExternalLink, Loader2, Link as LinkIcon, Filter, Plus, 
  Search, ShieldCheck, Check, CheckCircle, AlertTriangle, 
  X, ChevronRight, Sparkles, Settings, DollarSign, MapPin, 
  Activity, Phone, User, Info
} from 'lucide-react';
import { GoogleWorkspaceService } from '../lib/workspace';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc, getDocs } from '../lib/dataClient';
import { db } from '../lib/dataClient';
import { useAuth } from '../contexts/AuthContext';
import RecurringUpkeep from '../components/RecurringUpkeep';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function MaintenanceDashboard() {
  const { userData, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'recurring' | 'onboarding'>('orders');
  
  // Google Form Integration States
  const [formCreating, setFormCreating] = useState(false);
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Maintenance Requests states
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Assign Technician States
  const [assigningRequest, setAssigningRequest] = useState<any | null>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [assigningLoading, setAssigningLoading] = useState(false);

  // Post-Registration Onboarding UI States
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Onboarding Form States
  const [phone, setPhone] = useState(userData?.phone || '');
  
  // Technician onboarding fields
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(
    userData?.tradeSpecialty ? userData.tradeSpecialty.split(', ').filter(Boolean) : ['General Repairs']
  );
  const [hourlyRate, setHourlyRate] = useState(userData?.hourlyRate || '$85');
  const [serviceRadius, setServiceRadius] = useState(userData?.serviceRadius || '25 miles');
  const [emergencyDispatch, setEmergencyDispatch] = useState(userData?.emergencyDispatch || 'no');

  // Landlord/Manager onboarding fields
  const [companyName, setCompanyName] = useState(userData?.companyName || '');
  const [portfolioSize, setPortfolioSize] = useState(userData?.portfolioSize || '1-5 units');
  const [managementFee, setManagementFee] = useState(userData?.managementFee || '8%');
  const [propertyTypes, setPropertyTypes] = useState(userData?.propertyTypes || 'Residential');

  // Tenant onboarding fields
  const [currentAddress, setCurrentAddress] = useState(userData?.currentAddress || '');
  const [employmentStatus, setEmploymentStatus] = useState(userData?.employmentStatus || 'Employed');
  const [monthlyIncome, setMonthlyIncome] = useState(userData?.monthlyIncome || '');
  const [occupantsCount, setOccupantsCount] = useState(userData?.occupantsCount || 1);
  const [hasPets, setHasPets] = useState(userData?.hasPets || 'no');

  // Available specialty options for Technicians
  const tradeSpecialtyOptions = [
    'Plumbing',
    'Electrical',
    'HVAC',
    'Appliance Repair',
    'Carpentry',
    'General Repairs',
    'Pest Control',
    'Cleaning',
    'Locksmith',
    'Roofing'
  ];

  // Fetch maintenance requests
  useEffect(() => {
    setLoadingRequests(true);
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
      setLoadingRequests(false);
    }, (error) => {
      console.error('Failed to load maintenance requests:', error);
      setLoadingRequests(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch technicians for allocation
  const loadTechnicians = async () => {
    setLoadingTechs(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter((u: any) => u.role === 'technician');
      setTechnicians(list);
    } catch (error) {
      console.error('Failed to load technicians:', error);
    } finally {
      setLoadingTechs(false);
    }
  };

  useEffect(() => {
    if (assigningRequest) {
      loadTechnicians();
    }
  }, [assigningRequest]);

  // Google Forms methods
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
          let propertyName = "Unknown Property";
          let issueDesc = "Unknown Issue";
          
          if (response.answers) {
            const answerValues = Object.values(response.answers) as any[];
            if (answerValues.length > 0) propertyName = answerValues[0]?.textAnswers?.answers?.[0]?.value || propertyName;
            if (answerValues.length > 1) issueDesc = answerValues[1]?.textAnswers?.answers?.[0]?.value || issueDesc;
          }

          // Check if already exists
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

  // Assign request to technician
  const handleAssignTechnician = async (tech: any) => {
    if (!assigningRequest) return;
    setAssigningLoading(true);
    try {
      await updateDoc(doc(db, 'maintenance_requests', assigningRequest.id), {
        assignedTo: tech.name,
        assignedToUid: tech.uid || tech.id,
        assignedToEmail: tech.email,
        status: 'in_progress',
        updatedAt: serverTimestamp()
      });
      setAssigningRequest(null);
    } catch (error) {
      console.error('Assignment failed:', error);
      alert('Failed to assign technician. Please try again.');
    } finally {
      setAssigningLoading(false);
    }
  };

  // Update status directly from table
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

  // Profile preferences saving (Onboarding preference)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      let onboardingPayload: Record<string, any> = { phone };

      if (userData?.role === 'technician') {
        onboardingPayload = {
          ...onboardingPayload,
          tradeSpecialty: selectedSpecialties.join(', '),
          hourlyRate,
          serviceRadius,
          emergencyDispatch
        };
      } else if (userData?.role === 'landlord' || userData?.role === 'property_manager') {
        onboardingPayload = {
          ...onboardingPayload,
          companyName,
          portfolioSize,
          managementFee,
          propertyTypes
        };
      } else if (userData?.role === 'tenant') {
        onboardingPayload = {
          ...onboardingPayload,
          currentAddress,
          employmentStatus,
          monthlyIncome,
          occupantsCount: Number(occupantsCount),
          hasPets
        };
      }

      await updateProfile(onboardingPayload);
      setProfileSuccessMsg('Preferences successfully configured! Your workspace profile has been fully updated.');
      
      // Auto-dismiss banner after 4 seconds
      setTimeout(() => {
        setShowOnboardingBanner(false);
      }, 4000);
    } catch (error: any) {
      setProfileErrorMsg(error?.message || 'Failed to save preferences. Please check your inputs.');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleSpecialty = (spec: string) => {
    if (selectedSpecialties.includes(spec)) {
      setSelectedSpecialties(selectedSpecialties.filter(s => s !== spec));
    } else {
      setSelectedSpecialties([...selectedSpecialties, spec]);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesFilter = filter === 'all' || req.status === filter;
    
    // Support both 'priority' and 'urgency' fields
    const reqPriority = req.priority || req.urgency || 'routine';
    const matchesPriority = priorityFilter === 'all' || reqPriority === priorityFilter;
    
    const reqCategory = req.category || 'general';
    const matchesCategory = categoryFilter === 'all' || reqCategory.toLowerCase() === categoryFilter.toLowerCase();
    
    const matchesSearch = !searchQuery || 
      (req.title && req.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (req.description && req.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.unit && req.unit.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.assignedTo && req.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return matchesFilter && matchesPriority && matchesCategory && matchesSearch;
  });

  // Check if user has incomplete profile (any primary field missing)
  const isProfileIncomplete = () => {
    if (!userData) return false;
    if (userData.role === 'technician') {
      return !userData.tradeSpecialty || !userData.hourlyRate;
    }
    if (userData.role === 'property_manager' || userData.role === 'landlord') {
      return !userData.companyName;
    }
    if (userData.role === 'tenant') {
      return !userData.currentAddress;
    }
    return false;
  };

  // Formatting helpers following the Zero-Pill Rule (pure unboxed text with typographic separators)
  const renderMetadata = (req: any) => {
    const priority = req.priority || req.urgency || 'routine';
    const category = req.category || 'general';
    const unit = req.unit || 'Unknown Unit';
    
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
        <span className="capitalize">{category}</span>
        <span className="text-slate-300" aria-hidden="true">·</span>
        <span className="capitalize">{priority}</span>
        <span className="text-slate-300" aria-hidden="true">·</span>
        <span>{unit}</span>
      </div>
    );
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'resolved':
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400 font-semibold';
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-400 font-semibold';
      default:
        return 'text-amber-600 dark:text-amber-500 font-semibold';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'resolved':
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Open';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Maintenance & Operations</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Manage work orders, configure dispatch preferences, and track property assets.</p>
        </div>
        
        {/* Tab Selection Navigation */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/40 dark:border-slate-700/60 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'orders'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Active Work Orders
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'recurring'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Preventive Scheduling
          </button>
          <button
            onClick={() => setActiveTab('onboarding')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'onboarding'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-indigo-500" />
            Workspace Preferences
          </button>
        </div>
      </div>

      {/* Onboarding Banner - Displayed if fields are unconfigured or initial registration is incomplete */}
      {isProfileIncomplete() && showOnboardingBanner && (
        <div className="p-5 bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-slate-900/40 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex gap-3.5 items-start">
            <div className="p-2 bg-indigo-600 text-white rounded-xl flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">🚀 Complete Your Workspace Category Setup</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                {userData?.role === 'technician' 
                  ? "Select your trade specialty categories and hourly rates so property managers and landlords can find and assign tasks matching your expertise."
                  : "Complete your profile preferences to configure smart dispatch options and organize maintenance tracking."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setActiveTab('onboarding')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              Configure Now
            </button>
            <button
              onClick={() => setShowOnboardingBanner(false)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE WORK ORDERS TAB */}
      {activeTab === 'orders' && (
        <>
          {/* Google Forms Quick Connect */}
          {(userData?.role === 'property_manager' || userData?.role === 'landlord' || userData?.role === 'admin') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Workspace Google Forms Integration</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Automatically pull work order requests submitted via tenant feedback sheets.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                {formUrl && (
                  <a 
                    href={formUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 px-2 py-1.5 transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Live Form
                  </a>
                )}
                <button 
                  onClick={handleCreateForm}
                  disabled={formCreating || !!formUrl}
                  className="bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  {formCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
                  {formUrl ? 'Form Live' : 'Generate Form'}
                </button>
                {formUrl && (
                  <button
                    onClick={handleSyncResponses}
                    disabled={syncing}
                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 whitespace-nowrap"
                  >
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                    Sync Responses
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Stats Summary Widget */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors" onClick={() => setFilter('all')}>
              <div className="text-2xl font-mono tabular-nums font-bold text-slate-900 dark:text-white">{requests.length}</div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Total Work Orders</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-amber-300 dark:hover:border-amber-800/60 transition-colors" onClick={() => setFilter('pending')}>
              <div className="text-2xl font-mono tabular-nums font-bold text-amber-600 dark:text-amber-500">{requests.filter(r => r.status === 'pending').length}</div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Open/Pending</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-blue-300 dark:hover:border-blue-800/60 transition-colors" onClick={() => setFilter('in_progress')}>
              <div className="text-2xl font-mono tabular-nums font-bold text-blue-600 dark:text-blue-500">{requests.filter(r => r.status === 'in_progress').length}</div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">In Progress</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-colors" onClick={() => setFilter('resolved')}>
              <div className="text-2xl font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-500">{requests.filter(r => r.status === 'resolved' || r.status === 'completed').length}</div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Completed</div>
            </div>
          </div>

          {/* Operations Cash Flow Overview Line Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Operational Cash Flow Overview
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Monthly gross rental revenue vs maintenance repair costs</p>
              </div>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                  <span className="text-slate-700 dark:text-slate-300">Rental Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
                  <span className="text-slate-700 dark:text-slate-300">Maintenance Cost</span>
                </div>
              </div>
            </div>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[
                  { month: 'Apr', revenue: 60500, maintenanceCost: 2800 },
                  { month: 'May', revenue: 61200, maintenanceCost: 3200 },
                  { month: 'Jun', revenue: 62500, maintenanceCost: 3600 },
                  { month: 'Jul', revenue: 62000, maintenanceCost: 4100 },
                  { month: 'Aug', revenue: 61800, maintenanceCost: 3400 },
                  { month: 'Sep', revenue: 63000, maintenanceCost: 2700 }
                ]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `$${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    formatter={(val) => [`$${val.toLocaleString()}`, '']}
                  />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="maintenanceCost" name="Maintenance" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Main Work Orders Tracking Desk */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden">
            
            {/* Table Action Controls */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Work Dispatch Desk</h3>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search text input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search orders..."
                    className="pl-8 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-40 transition-all focus:sm:w-56"
                  />
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  
                  {/* Category filter */}
                  <select 
                    value={categoryFilter} 
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Specialties</option>
                    <option value="general">General</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="hvac">HVAC</option>
                    <option value="appliance">Appliance</option>
                    <option value="structural">Structural</option>
                    <option value="carpentry">Carpentry</option>
                    <option value="pest_control">Pest Control</option>
                  </select>

                  {/* Priority filter */}
                  <select 
                    value={priorityFilter} 
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="routine">Routine</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>

                  {/* Status filter */}
                  <select 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto">
              {loadingRequests ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-500 mt-2">Loading active work requests...</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">Issue Detail / Category</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Date Lodged</th>
                      <th className="px-6 py-3.5">Assigned Technician</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                          No active requests matching the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map(req => {
                        const isMatchMyTech = userData?.role === 'technician' && req.assignedToUid === userData.uid;
                        
                        return (
                          <tr key={req.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${isMatchMyTech ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}>
                            {/* Issue & details */}
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{req.title}</div>
                              <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 max-w-md">{req.description}</p>
                              {renderMetadata(req)}
                            </td>
                            
                            {/* Status label conforming to zero-pill rules */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={getStatusStyle(req.status)}>
                                {getStatusLabel(req.status)}
                              </span>
                            </td>
                            
                            {/* Lodged time */}
                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                              {req.createdAt?.toDate 
                                ? new Date(req.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                                : typeof req.createdAt === 'string' ? new Date(req.createdAt).toLocaleDateString() : 'Just now'}
                            </td>
                            
                            {/* Assigned Tech Info */}
                            <td className="px-6 py-4">
                              {req.assignedTo ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{req.assignedTo}</span>
                                  <span className="text-[10px] text-slate-400">{req.assignedToEmail}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-medium italic">Unassigned</span>
                              )}
                            </td>
                            
                            {/* Actions dropdown and dispatcher controls */}
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2.5">
                                
                                {/* Status update (Any role can change their status if authorized) */}
                                <select
                                  value={req.status}
                                  onChange={(e) => updateRequestStatus(req.id, e.target.value)}
                                  className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="pending">Mark Open</option>
                                  <option value="in_progress">Mark In Progress</option>
                                  <option value="resolved">Mark Completed</option>
                                </select>

                                {/* Technician assignment desk (Available to Landlord, PM, and Admins) */}
                                {(userData?.role === 'property_manager' || userData?.role === 'landlord' || userData?.role === 'admin') && (
                                  <button
                                    onClick={() => setAssigningRequest(req)}
                                    className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-[10px] font-bold border border-indigo-100 dark:border-indigo-900"
                                  >
                                    Assign Tech
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* RENDER RECURRING PREVENTIVE SCHEDULING TAB */}
      {activeTab === 'recurring' && (
        <RecurringUpkeep />
      )}

      {/* RENDER ONBOARDING & PREFERENCES CONFIG TAB (Optional post-registration category setup step) */}
      {activeTab === 'onboarding' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Workspace Category & Profile Settings</h3>
              <p className="text-xs text-slate-500">Configure your specific role parameters, trade categories, and operational dispatch rules.</p>
            </div>
          </div>

          {profileSuccessMsg && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-xl mb-6">
              {profileSuccessMsg}
            </div>
          )}

          {profileErrorMsg && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-semibold rounded-xl mb-6">
              {profileErrorMsg}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    disabled
                    value={userData?.name || ''}
                    className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Registered Email</label>
                <input
                  type="text"
                  disabled
                  value={userData?.email || ''}
                  className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 1. TECHNICIAN SERVICE-SPECIFIC CATEGORY CONFIG */}
            {userData?.role === 'technician' && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Service Specialties & Trade Categories</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Select all specific maintenance specialties you service. Property dispatch managers filter technicians based on these selections.</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {tradeSpecialtyOptions.map(spec => {
                    const active = selectedSpecialties.includes(spec);
                    return (
                      <button
                        type="button"
                        key={spec}
                        onClick={() => toggleSpecialty(spec)}
                        className={`flex items-center gap-2 px-3.5 py-2.5 border rounded-xl text-left transition-colors ${
                          active 
                            ? 'border-indigo-600 bg-indigo-50/20 text-indigo-800 dark:border-indigo-500 dark:text-indigo-300' 
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                          {active && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="text-xs font-bold">{spec}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Hourly Service Rate</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                        placeholder="e.g. $85"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Max Service Radius</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={serviceRadius}
                        onChange={(e) => setServiceRadius(e.target.value)}
                        placeholder="e.g. 25 miles"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Emergency Off-Hours Dispatch</label>
                    <select
                      value={emergencyDispatch}
                      onChange={(e) => setEmergencyDispatch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="no">Business Hours Only</option>
                      <option value="yes">Accept 24/7 On-Call Dispatch</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 2. LANDLORD/PM PREFERENCES CONFIG */}
            {(userData?.role === 'landlord' || userData?.role === 'property_manager') && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Property & Company Preferences</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Company / Firm Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Sunset Property Management"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Portfolio Size</label>
                    <select
                      value={portfolioSize}
                      onChange={(e) => setPortfolioSize(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="1-5 units">1 - 5 residential units</option>
                      <option value="6-20 units">6 - 20 residential units</option>
                      <option value="21-100 units">21 - 100 residential units</option>
                      <option value="100+ units">100+ residential / commercial units</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Standard Management Commission</label>
                    <input
                      type="text"
                      value={managementFee}
                      onChange={(e) => setManagementFee(e.target.value)}
                      placeholder="e.g. 8%"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Portfolio Focus Types</label>
                    <select
                      value={propertyTypes}
                      onChange={(e) => setPropertyTypes(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Residential">Residential</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Mixed-use">Mixed-Use</option>
                      <option value="Industrial">Industrial</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TENANT PREFERENCES CONFIG */}
            {userData?.role === 'tenant' && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Tenant Residency Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Unit Address</label>
                    <input
                      type="text"
                      value={currentAddress}
                      onChange={(e) => setCurrentAddress(e.target.value)}
                      placeholder="e.g. Sunset Apartments, Apt 4B"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Employment Status</label>
                    <select
                      value={employmentStatus}
                      onChange={(e) => setEmploymentStatus(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="Employed">Employed</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Student">Student</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Gross Income</label>
                    <input
                      type="text"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      placeholder="e.g. $5000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Household Size (Occupants)</label>
                    <input
                      type="number"
                      value={occupantsCount}
                      onChange={(e) => setOccupantsCount(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Do you have pets?</label>
                    <select
                      value={hasPets}
                      onChange={(e) => setHasPets(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="no">No Pets</option>
                      <option value="yes">Yes, I have pets</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving Preferences...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL WINDOW FOR ASSIGNING MAINTENANCE WORK TO A REGISTERED TECHNICIAN */}
      {assigningRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Assign Dispatch Work Order</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Choose a specialized service technician to handle this task.</p>
                </div>
              </div>
              <button 
                onClick={() => setAssigningRequest(null)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Task summary info card */}
            <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-slate-100 dark:border-slate-800 text-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 dark:text-white line-clamp-1">{assigningRequest.title}</span>
                <span className="capitalize font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-100/50 dark:bg-indigo-950/60 rounded">{assigningRequest.category || 'general'}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{assigningRequest.description}</p>
            </div>

            {/* Technicians match list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Available Technicians</h4>
              
              {loadingTechs ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-500 mt-1.5">Scanning dispatch directory...</p>
                </div>
              ) : technicians.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Info className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No registered technicians found in directory.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Technicians must set their trade specialty in workspace preferences to be listed.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {technicians.map(tech => {
                    const techSpecialties = tech.trade_specialty ? tech.trade_specialty.split(', ') : [];
                    // Match specialty of request with tech's declared trade specialties
                    const isSpecialtyMatch = techSpecialties.some((s: string) => s.toLowerCase() === (assigningRequest.category || 'general').toLowerCase());
                    
                    return (
                      <div 
                        key={tech.id} 
                        className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-colors ${
                          isSpecialtyMatch 
                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/10' 
                            : 'border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{tech.name}</span>
                            {isSpecialtyMatch && (
                              <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400">Match</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{tech.email}</p>
                          
                          {/* Specialties listed as pure text conforming to zero-pill */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-medium mt-1">
                            <span>Specialty: {tech.trade_specialty || 'General repairs'}</span>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span>Rate: {tech.hourly_rate || '$80/hr'}</span>
                            {tech.service_radius && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span>Radius: {tech.service_radius}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleAssignTechnician(tech)}
                          disabled={assigningLoading}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50 shrink-0"
                        >
                          Assign Job
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
              <button
                onClick={() => setAssigningRequest(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

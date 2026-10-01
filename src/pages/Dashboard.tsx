import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogOut, Menu, Moon, Sun, User as UserIcon, X, Activity, Search, Sparkles } from 'lucide-react';
import GISWorkspace from './GISWorkspace';
import TenantPortal from './portals/TenantPortal';
import TechnicianPortal from './portals/TechnicianPortal';
import PropertyManagerPortal from './portals/PropertyManagerPortal';
import LandlordPortal from './portals/LandlordPortal';
import AdminPortal from './portals/AdminPortal';
import WorkspacePortal from './portals/WorkspacePortal';
import UserSettings from '../components/UserSettings';
import Sidebar from '../components/Sidebar';
import CustomerSupport from '../components/CustomerSupport';
import PropSearch from '../components/PropSearch';
import GlobalDirectory from '../components/GlobalDirectory';
import LeadGeneration from '../components/LeadGeneration';
import FinancialsPlaceholder from '../components/FinancialsPlaceholder';
import LeasingPlaceholder from '../components/LeasingPlaceholder';
import MessagesPlaceholder from '../components/MessagesPlaceholder';
import VendorBiddingPlaceholder from '../components/VendorBiddingPlaceholder';
import WorkOrderInvoicingPlaceholder from '../components/WorkOrderInvoicingPlaceholder';
import GeminiChatbot from '../components/GeminiChatbot';
import BillingPlaceholder from '../components/BillingPlaceholder';
import MaintenanceDashboard from './MaintenanceDashboard';
import CrmPlaceholder from '../components/CrmPlaceholder';
import ProspectingPlaceholder from '../components/ProspectingPlaceholder';
import UtilityTracking from '../components/UtilityTracking';
import GlobalSearch from '../components/GlobalSearch';
import VendorDirectory from '../components/VendorDirectory';
import NotificationSystem from '../components/NotificationSystem';
import RoleRoute from '../components/RoleRoute';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import QuickActions from '../components/QuickActions';
import IntegrationCenter from './IntegrationCenter';
import PropFlowWorkspace from './PropFlowWorkspace';

const ROUTE_TO_TAB: Record<string, string> = {
  dashboard: 'dashboard',
  hub: 'hub',
  analytics: 'analytics',
  'property-search': 'zillow',
  zillow: 'zillow',
  prospecting: 'prospecting',
  crm: 'crm',
  leads: 'leads',
  leasing: 'leasing',
  maintenance: 'maintenance',
  messages: 'messages',
  utilities: 'utilities',
  vendors: 'vendors',
  financials: 'financials',
  documents: 'documents',
  communications: 'communications',
  directory: 'directory',
  bidding: 'bidding',
  invoicing: 'invoicing',
  integrations: 'integrations',
  gis: 'gis',
  ai: 'chatbot',
  chatbot: 'chatbot',
  workspace: 'workspace',
  billing: 'billing',
  security: 'security',
  support: 'support',
};

const TAB_TO_ROUTE: Record<string, string> = {
  dashboard: '',
  hub: 'hub',
  analytics: 'analytics',
  zillow: 'property-search',
  prospecting: 'prospecting',
  crm: 'crm',
  leads: 'leads',
  leasing: 'leasing',
  maintenance: 'maintenance',
  messages: 'messages',
  utilities: 'utilities',
  vendors: 'vendors',
  financials: 'financials',
  documents: 'documents',
  communications: 'communications',
  directory: 'directory',
  bidding: 'bidding',
  invoicing: 'invoicing',
  integrations: 'integrations',
  gis: 'gis',
  chatbot: 'ai',
  workspace: 'workspace',
  billing: 'billing',
  security: 'security',
  support: 'support',
};

export default function Dashboard() {
  const { user, userData, loading, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const pathPart = location.pathname.replace(/^\/dashboard\/?/, '') || 'dashboard';
  const activeTab = ROUTE_TO_TAB[pathPart] || 'dashboard';

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-950 dark:text-white">Loading...</div>;
  }

  if (!user || !userData) {
    return <Navigate to="/" />;
  }

  const goToTab = (tab: string) => {
    const routePart = TAB_TO_ROUTE[tab] ?? tab;
    navigate(routePart ? `/dashboard/${routePart}` : '/dashboard');
    setIsSidebarOpen(false);
  };

  const renderPortal = () => {
    if (activeTab === 'hub') {
      return <PropFlowWorkspace />;
    }

    if (activeTab === 'integrations') {
      return <IntegrationCenter />;
    }

    if (activeTab === 'gis') {
      return <GISWorkspace />;
    }

    if (activeTab === 'security') {
      return <UserSettings />;
    }

    if (activeTab === 'billing') {
      return <BillingPlaceholder />;
    }

    if (activeTab === 'support') {
      return <CustomerSupport />;
    }

    if (activeTab === 'chatbot') {
      return <GeminiChatbot />;
    }

    if (activeTab === 'zillow') {
      return <PropSearch />;
    }

    if (activeTab === 'workspace') {
      return <WorkspacePortal />;
    }

    if (activeTab === 'financials') {
      return <FinancialsPlaceholder />;
    }

    if (activeTab === 'analytics') {
      return (
        <RoleRoute allowedRoles={['property_manager', 'landlord', 'admin']}>
          <AnalyticsDashboard />
        </RoleRoute>
      );
    }

    if (activeTab === 'leasing') {
      return <LeasingPlaceholder />;
    }

    if (activeTab === 'maintenance') {
      return <MaintenanceDashboard />;
    }

    if (activeTab === 'crm') {
      return <CrmPlaceholder />;
    }

    if (activeTab === 'prospecting') {
      return <ProspectingPlaceholder />;
    }

    if (activeTab === 'messages') {
      return <MessagesPlaceholder />;
    }

    if (activeTab === 'utilities') {
      return <UtilityTracking />;
    }

    if (activeTab === 'vendors') {
      return <VendorDirectory />;
    }

    if (activeTab === 'directory') {
      return (
        <RoleRoute allowedRoles={['property_manager', 'admin']}>
          <GlobalDirectory />
        </RoleRoute>
      );
    }

    if (activeTab === 'leads') {
      return (
        <RoleRoute allowedRoles={['property_manager', 'admin']}>
          <LeadGeneration />
        </RoleRoute>
      );
    }

    if (activeTab === 'bidding') {
      return (
        <RoleRoute allowedRoles={['property_manager', 'admin']}>
          <VendorBiddingPlaceholder />
        </RoleRoute>
      );
    }

    if (activeTab === 'invoicing') {
      return (
        <RoleRoute allowedRoles={['technician']}>
          <WorkOrderInvoicingPlaceholder />
        </RoleRoute>
      );
    }

    switch (userData.role) {
      case 'tenant':
        return <TenantPortal activeTab={activeTab} />;
      case 'technician':
        return <TechnicianPortal activeTab={activeTab} />;
      case 'property_manager':
        return <PropertyManagerPortal activeTab={activeTab} />;
      case 'landlord':
        return <LandlordPortal activeTab={activeTab} />;
      case 'admin':
        return <AdminPortal activeTab={activeTab} />;
      default:
        return <div className="p-8">Portal for {userData.role} under construction.</div>;
    }
  };

  const getSidebarLinks = () => {
    const links = [
      { id: 'dashboard', label: 'Overview', section: 'Command Center' },
      { id: 'hub', label: 'Capability Hub', section: 'Command Center' },
    ];

    if (userData.role === 'property_manager' || userData.role === 'admin' || userData.role === 'landlord') {
      links.push({ id: 'analytics', label: 'Analytics', section: 'Command Center' });
    }

    links.push(
      { id: 'zillow', label: 'Property Search', section: 'Portfolio' },
      { id: 'leasing', label: 'Leasing & Documents', section: 'Portfolio' },
      { id: 'financials', label: 'Financials', section: 'Portfolio' },
      { id: 'documents', label: 'Documents', section: 'Portfolio' },
      { id: 'prospecting', label: 'Prospecting', section: 'Growth' },
      { id: 'crm', label: 'CRM & Workflows', section: 'Growth' },
      { id: 'leads', label: 'Leads', section: 'Growth' },
      { id: 'maintenance', label: 'Maintenance & Ops', section: 'Operations' },
      { id: 'messages', label: 'Messages', section: 'Operations' },
      { id: 'utilities', label: 'Utilities', section: 'Operations' },
      { id: 'vendors', label: 'Vendors', section: 'Operations' },
      { id: 'communications', label: 'Communications', section: 'Operations' }
    );

    if (userData.role === 'property_manager' || userData.role === 'admin') {
      links.push({ id: 'directory', label: 'Directory', section: 'Operations' });
      links.push({ id: 'bidding', label: 'Vendor Bidding', section: 'Operations' });
    }

    if (userData.role === 'technician') {
      links.push({ id: 'invoicing', label: 'Work Order Invoicing', section: 'Operations' });
    }

    if (userData.role === 'property_manager' || userData.role === 'admin' || userData.role === 'landlord' || userData.role === 'technician') {
      links.push({ id: 'integrations', label: 'Integrations', section: 'Automation' });
      links.push({ id: 'gis', label: 'GIS & Mapping', section: 'Automation' });
      links.push({ id: 'chatbot', label: 'AI Assistant', section: 'Automation' });
      links.push({ id: 'workspace', label: 'Google Workspace', section: 'Automation' });
    }

    if (userData.role === 'property_manager' || userData.role === 'admin') {
      links.push(
        { id: 'billing', label: 'Subscription & Billing', section: 'Administration' },
        { id: 'security', label: 'Settings', section: 'Administration' }
      );
    } else {
      links.push({ id: 'security', label: 'Settings', section: 'Administration' });
    }

    links.push({ id: 'support', label: 'Support', section: 'Administration' });

    return Array.from(new Map(links.map(item => [item.id, item])).values());
  };

  const sidebarLinks = getSidebarLinks();
  const activeLabel = sidebarLinks.find(link => link.id === activeTab)?.label ?? 'Overview';

  return (
    <div className="flex h-screen w-full bg-[#f5f7fb] font-sans text-slate-900 overflow-hidden dark:bg-[#070b14] dark:text-slate-100 premium-grid selection:bg-violet-100 selection:text-violet-950 dark:selection:bg-violet-900/50 dark:selection:text-white">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        activeTab={activeTab} 
        setActiveTab={goToTab} 
        links={sidebarLinks} 
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-[72px] bg-white/82 dark:bg-slate-950/72 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between px-4 sm:px-7 flex-shrink-0 shadow-[0_10px_40px_rgba(15,23,42,.05)]">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              type="button"
              className="md:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-6 w-6" />
            </button>
            <GlobalSearch />
            <div className="hidden xl:flex items-center gap-2 ml-2 px-3 py-1.5 rounded-full bg-slate-100/80 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              <span>Command Center</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button type="button" onClick={toggleTheme} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg" aria-label="Toggle Theme">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationSystem />
            <button type="button" className="flex items-center gap-3 border-l pl-4 border-slate-200 dark:border-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg" onClick={() => setIsLogoutModalOpen(true)} aria-label="Open account actions">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{userData.name}</div>
                <div className="text-xs text-slate-500">{userData.email}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-violet-600 dark:text-violet-300 font-bold">
                <UserIcon className="h-4 w-4" />
              </div>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_right,rgba(124,92,255,.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(33,212,253,.06),transparent_24%)] p-4 sm:p-6 lg:p-7">
          <div className="max-w-[1680px] mx-auto animate-slide-in">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Vortex One
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">{activeLabel}</h1>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-50/90 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-400/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Search className="h-3.5 w-3.5" />
                <span>Search, navigate, act</span>
              </div>
            </div>
            {renderPortal()}
          </div>
        </div>
        
        {/* Status Bar */}
        <footer className="h-9 bg-white/70 dark:bg-slate-950/70 border-t border-slate-200/60 dark:border-white/10 backdrop-blur-xl px-6 flex items-center justify-between text-[10px] text-slate-400 flex-shrink-0">
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Service UI ready</span>
            <span className="hidden sm:inline">Backend status is checked in Capability Hub</span>
          </div>
          <div className="flex gap-4">
            <span className="hidden sm:inline">Authenticated session</span>
            <span className="font-bold text-slate-500">PropFlow</span>
          </div>
        </footer>
      </main>

      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sign-out-title">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
              aria-label="Close sign out dialog"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                <LogOut className="h-6 w-6" />
              </div>
              <h2 id="sign-out-title" className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sign Out</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to sign out of your account?</p>
              <div className="flex gap-3 w-full">
                <button type="button" onClick={() => setIsLogoutModalOpen(false)} className="flex-1 py-2.5 px-4 rounded-xl font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Cancel</button>
                <button type="button" onClick={() => { setIsLogoutModalOpen(false); void logout(); }} className="flex-1 py-2.5 px-4 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <QuickActions />
    </div>
  );
}

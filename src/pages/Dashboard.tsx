import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogOut, Menu, Moon, Sun, User as UserIcon, X, AlertTriangle } from 'lucide-react';
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

export default function Dashboard() {
  const { user, userData, loading, logout, switchRole } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-950 dark:text-white">Loading...</div>;
  }

  if (!user || !userData) {
    return <Navigate to="/" />;
  }

  const renderPortal = () => {
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
    // We group them into 'Analytics', 'Property Management', 'Maintenance', 'Workspace & AI', 'Administrative'
    const links = [
      { id: 'dashboard', label: 'Dashboard', section: 'Analytics' },
    ];

    if (userData.role === 'property_manager' || userData.role === 'admin' || userData.role === 'landlord') {
      links.push({ id: 'analytics', label: 'Advanced Analytics', section: 'Analytics' });
    }

    links.push(
      { id: 'messages', label: 'Messages & Alerts', section: 'Property Management' },
      { id: 'financials', label: 'Financials & Payments', section: 'Analytics' },
      { id: 'utilities', label: 'Utility Tracking', section: 'Analytics' },
      { id: 'leasing', label: 'Leasing & Documents', section: 'Property Management' }
    );
    
    if (userData.role === 'property_manager' || userData.role === 'admin' || userData.role === 'tenant' || userData.role === 'technician') {
      links.push({ id: 'maintenance', label: 'Maintenance & Ops', section: 'Maintenance' });
    }
    
    if (userData.role === 'property_manager' || userData.role === 'admin') {
      links.push({ id: 'vendors', label: 'Vendor Directory', section: 'Maintenance' });
      links.push({ id: 'bidding', label: 'Vendor Bidding', section: 'Maintenance' });
      links.push({ id: 'directory', label: 'Global Directory', section: 'Property Management' });
      links.push({ id: 'documents', label: 'Document Center', section: 'Property Management' });
      links.push({ id: 'crm', label: 'CRM & Workflows', section: 'Property Management' });
      links.push({ id: 'communications', label: 'Communications', section: 'Property Management' });
    }
    
    if (userData.role === 'technician') {
      links.push({ id: 'invoicing', label: 'Work Order Invoicing', section: 'Maintenance' });
    }

    if (userData.role === 'property_manager' || userData.role === 'admin' || userData.role === 'landlord') {
      links.push({ id: 'prospecting', label: 'Prospecting & Sourcing', section: 'Property Management' });
    }
    
    if (userData.role === 'property_manager' || userData.role === 'admin' || userData.role === 'landlord' || userData.role === 'technician') {
      links.push({ id: 'integrations', label: 'Integrations & AI Agents', section: 'Workspace & AI' });
      links.push({ id: 'workspace', label: 'Google Workspace', section: 'Workspace & AI' });
    }
    
    links.push({ id: 'zillow', label: 'Prop Search', section: 'Property Management' });
    links.push({ id: 'support', label: 'Customer Support', section: 'Administrative' });
    links.push({ id: 'chatbot', label: 'AI Assistant', section: 'Workspace & AI' });

    if (userData.role === 'property_manager' || userData.role === 'admin') {
      links.push(
        { id: 'billing', label: 'Subscription & Billing', section: 'Administrative' },
        { id: 'security', label: 'Security & Access', section: 'Administrative' },
        { id: 'cloud', label: 'Cloud Archives', section: 'Administrative' }
      );
    } else {
      links.push(
        { id: 'security', label: 'Security & Settings', section: 'Administrative' }
      );
    }

    // Filter out duplicates if any
    const uniqueLinks = Array.from(new Map(links.map(item => [item.id, item])).values());
    return uniqueLinks;
  };

  const sidebarLinks = getSidebarLinks();

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden dark:bg-slate-950 dark:text-slate-100">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        links={sidebarLinks} 
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button 
              className="md:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <GlobalSearch />
          </div>
          
          <div className="flex items-center gap-4">
            {/* Quick Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors"
                title="Switch Persona / Portal"
              >
                <span>Role: <strong className="capitalize">{userData.role.replace('_', ' ')}</strong></span>
                <span className="text-[10px] opacity-70">▼</span>
              </button>

              {isRoleMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 text-xs space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Switch Portal View</div>
                  {[
                    { id: 'property_manager', label: '🏢 Property Manager', name: 'Alex Morgan' },
                    { id: 'landlord', label: '🏠 Landlord / Owner', name: 'Sarah Sterling' },
                    { id: 'tenant', label: '🛋️ Tenant Resident', name: 'David Chen' },
                    { id: 'technician', label: '🔧 Contractor / Tech', name: 'Marcus Vance' },
                    { id: 'admin', label: '🛡️ System Admin', name: 'Admin' },
                    { id: 'sales', label: '📈 Sales / Acquisitions', name: 'Jordan Wells' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        switchRole(r.id as any);
                        setIsRoleMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                        userData.role === r.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{r.label}</span>
                      {userData.role === r.id && <span className="text-indigo-600">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Toggle Theme">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationSystem />
            <div className="flex items-center gap-3 border-l pl-4 border-slate-200 dark:border-slate-700 cursor-pointer" onClick={() => setIsLogoutModalOpen(true)}>
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{userData.name}</div>
                <div className="text-xs text-slate-500">{userData.email}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                <UserIcon className="h-4 w-4" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6">
          {renderPortal()}
        </div>
        
        {/* Status Bar */}
        <footer className="h-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between text-[10px] text-slate-400 flex-shrink-0">
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> All Systems Operational</span>
            <span className="hidden sm:inline">Server: us-west-2-prod</span>
          </div>
          <div className="flex gap-4">
            <span className="hidden sm:inline">API Latency: 24ms</span>
            <span className="font-bold text-slate-500">v2.4.12-enterprise</span>
          </div>
        </footer>
      </main>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsLogoutModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                <LogOut className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sign Out</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Are you sure you want to sign out of your account?
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsLogoutModalOpen(false);
                    logout();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Quick Actions Floating Action Menu */}
      <QuickActions />
    </div>
  );
}

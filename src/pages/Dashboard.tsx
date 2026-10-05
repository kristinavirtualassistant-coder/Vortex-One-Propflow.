import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogOut, Menu, Moon, Sun, User as UserIcon, X, Activity, Search, Sparkles } from 'lucide-react';
const TenantPortal = lazy(() => import('./portals/TenantPortal'));
const TechnicianPortal = lazy(() => import('./portals/TechnicianPortal'));
const MyAccount = lazy(() => import('../features/crm/MyAccount'));
import Sidebar from '../components/Sidebar';
const CustomerSupport = lazy(() => import('../components/CustomerSupport'));
const GeminiChatbot = lazy(() => import('../components/GeminiChatbot'));
const MaintenanceDashboard = lazy(() => import('./MaintenanceDashboard'));
const UtilityTracking = lazy(() => import('../components/UtilityTracking'));
import GlobalSearch from '../components/GlobalSearch';
const VendorDirectory = lazy(() => import('../components/VendorDirectory'));
const NotificationSystem = lazy(() => import('../components/NotificationSystem'));
const QuickActions = lazy(() => import('../components/QuickActions'));
import CrmApp, { CRM_NAV } from '../features/crm/CrmApp';
import Notifications from '../features/crm/Notifications';
import { CRM_ROLES } from '../features/crm/permissions';

// Legacy (tenant / technician) portals: URL segment -> tab id. CRM roles use the CRM router instead.
const ROUTE_TO_TAB: Record<string, string> = {
  dashboard: 'dashboard',
  maintenance: 'maintenance',
  utilities: 'utilities',
  vendors: 'vendors',
  documents: 'documents',
  communications: 'communications',
  ai: 'chatbot',
  chatbot: 'chatbot',
  security: 'security',
  support: 'support',
};

const TAB_TO_ROUTE: Record<string, string> = {
  dashboard: '',
  chatbot: 'ai',
};

export default function Dashboard() {
  const { user, userData, loading, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const pathPart = location.pathname.replace(/^\/dashboard\/?/, '') || 'dashboard';
  const isCrm = Boolean(userData && CRM_ROLES.includes(userData.role));
  // CRM roles use the CRM router (first path segment = active nav item); other roles keep the legacy tab map.
  const crmSegment = pathPart.split('/')[0] === 'ai' ? 'chatbot' : pathPart.split('/')[0];
  const activeTab = isCrm ? (crmSegment || 'dashboard') : (ROUTE_TO_TAB[pathPart] || 'dashboard');

  const [backend, setBackend] = useState<'checking' | 'ok' | 'down'>('checking');
  useEffect(() => {
    let cancelled = false;
    const check = () => fetch('/api/ready', { cache: 'no-store' }).then((r) => !cancelled && setBackend(r.ok ? 'ok' : 'down'), () => !cancelled && setBackend('down'));
    void check();
    const t = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-950 dark:text-white">Loading...</div>;
  }

  if (!user || !userData) {
    return <Navigate to="/" />;
  }

  const goToTab = (tab: string) => {
    const routePart = isCrm ? (tab === 'dashboard' ? '' : tab) : (TAB_TO_ROUTE[tab] ?? tab);
    navigate(routePart ? `/dashboard/${routePart}` : '/dashboard');
    setIsSidebarOpen(false);
  };

  const renderPortal = () => {
    if (isCrm) return <CrmApp />;

    if (activeTab === 'security') return <MyAccount />;
    if (activeTab === 'support') return <CustomerSupport />;
    if (activeTab === 'chatbot') return <GeminiChatbot />;
    if (activeTab === 'maintenance') return <MaintenanceDashboard />;
    if (activeTab === 'utilities') return <UtilityTracking />;
    if (activeTab === 'vendors') return <VendorDirectory />;

    switch (userData.role) {
      case 'tenant':
        return <TenantPortal activeTab={activeTab} />;
      case 'technician':
        return <TechnicianPortal activeTab={activeTab} />;
      default:
        return <div className="p-8">No workspace is available for the {userData.role} role.</div>;
    }
  };

  const getSidebarLinks = () => {
    if (isCrm) {
      const perms: string[] = (userData as any).permissions ?? [];
      return CRM_NAV.filter((l) => !l.needs || perms.includes(l.needs)).map(({ id, label, section }) => ({ id, label, section }));
    }
    // Tenants and technicians have no CRM permissions (the API returns 403), so only their portals are offered.
    const links = [
      { id: 'dashboard', label: 'Overview', section: 'Command Center' },
      { id: 'maintenance', label: 'Maintenance & Ops', section: 'Operations' },
      { id: 'utilities', label: 'Utilities', section: 'Operations' },
      { id: 'vendors', label: 'Vendors', section: 'Operations' },
      { id: 'documents', label: 'Documents', section: 'Operations' },
      { id: 'communications', label: 'Communications', section: 'Operations' },
    ];
    if (userData.role === 'technician') links.push({ id: 'chatbot', label: 'AI Assistant', section: 'Automation' });
    links.push(
      { id: 'security', label: 'My account', section: 'Administration' },
      { id: 'support', label: 'Support', section: 'Administration' },
    );
    return links;
  };

  const sidebarLinks = getSidebarLinks();
  const activeLabel = sidebarLinks.find(link => link.id === activeTab)?.label ?? (isCrm ? 'Workspace' : 'Overview');

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
              <span>{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button type="button" onClick={toggleTheme} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg" aria-label="Toggle Theme">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {isCrm ? <Notifications /> : <Suspense fallback={null}><NotificationSystem /></Suspense>}
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
            {!isCrm && (
            <div className="flex items-center justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    Vortex One
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">{activeLabel}</h1>
                    {userData.isDemo && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 border border-violet-200/70 dark:border-violet-400/10">
                        Demo workspace
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                  <span>Search, navigate, act</span>
                </div>
              </div>
            )}
            <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500" role="status">Loading…</div>}>
              {renderPortal()}
            </Suspense>
          </div>
        </div>
        
        {/* Status Bar */}
        <footer className="h-9 bg-white/70 dark:bg-slate-950/70 border-t border-slate-200/60 dark:border-white/10 backdrop-blur-xl px-6 flex items-center justify-between text-[10px] text-slate-400 flex-shrink-0">
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1" role="status">
              <span className={`w-1.5 h-1.5 rounded-full ${backend === 'ok' ? 'bg-emerald-500' : backend === 'down' ? 'bg-red-500' : 'bg-slate-400'}`}></span>
              {backend === 'ok' ? 'Backend and database connected' : backend === 'down' ? 'Backend unavailable' : 'Checking backend…'}
            </span>
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

      {!isCrm && <Suspense fallback={null}><QuickActions /></Suspense>}
    </div>
  );
}

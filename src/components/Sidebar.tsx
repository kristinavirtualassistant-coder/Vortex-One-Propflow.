import React from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Mail,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

interface SidebarLink {
  id: string;
  label: string;
  section: string;
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  links: SidebarLink[];
}

const ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  zillow: Search,
  prospecting: Zap,
  crm: Users,
  leads: Users,
  leasing: FileText,
  maintenance: Wrench,
  messages: MessageSquare,
  utilities: Activity,
  vendors: Building2,
  financials: CircleDollarSign,
  documents: FileText,
  communications: Mail,
  directory: Users,
  bidding: Wrench,
  invoicing: CircleDollarSign,
  integrations: Link2,
  chatbot: Bot,
  workspace: Sparkles,
  billing: CircleDollarSign,
  security: ShieldCheck,
  support: Headphones,
};

const SECTION_META: Record<string, string> = {
  'Command Center': 'See what needs attention',
  Portfolio: 'Properties & money',
  Growth: 'Find and convert',
  Operations: 'Run the day',
  Automation: 'Connect & automate',
  Administration: 'Account & access',
};

export default function Sidebar({ isOpen, setIsOpen, activeTab, setActiveTab, links }: SidebarProps) {
  const sections = Array.from(new Set(links.map((link) => link.section)));

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[272px] bg-[#0b1120] text-slate-300 flex flex-col border-r border-slate-800/80 flex-shrink-0 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        aria-label="Vortex One navigation"
      >
        <div className="h-[72px] px-5 flex items-center justify-between border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-3 min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Go to Vortex One overview"
          >
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-950/40">
              <span className="text-white font-black text-sm">V</span>
              <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0b1120]" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[15px] font-extrabold tracking-tight text-white truncate">Vortex One</div>
              <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">PropFlow</div>
            </div>
          </button>

          <button
            className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 border border-slate-700/70 transition-colors"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <LayoutDashboard className="h-4 w-4 text-indigo-400" />
              Command Center
            </span>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll">
          {sections.map((section) => {
            const sectionLinks = links.filter((link) => link.section === section);
            if (!sectionLinks.length) return null;

            return (
              <section key={section} className="mb-5">
                <div className="px-2.5 mb-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    {section}
                  </div>
                  <div className="text-[10px] text-slate-600/80 mt-0.5">{SECTION_META[section]}</div>
                </div>

                <div className="space-y-0.5">
                  {sectionLinks.map((link) => {
                    const Icon = ICONS[link.id] ?? Menu;
                    const active = activeTab === link.id;

                    return (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => navigate(link.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          active
                            ? 'bg-indigo-500/15 text-white shadow-sm'
                            : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                        }`}
                      >
                        {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-indigo-400" />}
                        <Icon className={`h-4 w-4 flex-shrink-0 transition-colors ${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                        <span className="truncate">{link.label}</span>
                        {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <LifeBuoy className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200">System status</div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  All systems operational
                </div>
              </div>
            </div>
            <div className="mt-3 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500 rounded-full" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

import React from 'react';
import {
  Activity, BarChart3, Bot, Building2, ChevronRight, CircleDollarSign, FileText,
  Headphones, LayoutDashboard, LifeBuoy, Link2, Mail, Menu, MessageSquare,
  Search, ShieldCheck, Sparkles, Users, Wrench, X, Zap,
} from 'lucide-react';

interface SidebarLink { id: string; label: string; section: string; }
interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  links: SidebarLink[];
}

const ICONS: Record<string, React.ElementType> = {
  contacts: Users, campaigns: Zap, dialer: Headphones, properties: Search, owners: Building2, tasks: FileText, workflows: Link2, agents: Bot, team: ShieldCheck, gis: Link2,
  dashboard: LayoutDashboard, analytics: BarChart3, zillow: Search, prospecting: Zap,
  crm: Users, leads: Users, leasing: FileText, maintenance: Wrench, messages: MessageSquare,
  utilities: Activity, vendors: Building2, financials: CircleDollarSign, documents: FileText,
  communications: Mail, directory: Users, bidding: Wrench, invoicing: CircleDollarSign,
  integrations: Link2, chatbot: Bot, workspace: Sparkles, billing: CircleDollarSign,
  security: ShieldCheck, support: Headphones,
};

const SECTION_META: Record<string,string> = {
  CRM:'People, pipeline & outreach', 'Property Intelligence':'Records & ownership',
  'Command Center':'See what needs attention', Portfolio:'Properties & money', Growth:'Find and convert',
  Operations:'Run the day', Automation:'Connect & automate', Administration:'Account & access',
};

export default function Sidebar({isOpen,setIsOpen,activeTab,setActiveTab,links}: SidebarProps) {
  const sections = Array.from(new Set(links.map((link)=>link.section)));
  const navigate = (tab:string)=>{ setActiveTab(tab); setIsOpen(false); };

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-md md:hidden" onClick={()=>setIsOpen(false)} aria-hidden="true"/>}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[268px] flex flex-col flex-shrink-0 overflow-hidden border-r border-white/10 bg-[#080c17] text-slate-300 shadow-[20px_0_80px_rgba(2,6,23,.22)] transform transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${isOpen?'translate-x-0':'-translate-x-full md:translate-x-0'}`}
        aria-label="Vortex One navigation"
      >
        <div className="absolute inset-0 pointer-events-none premium-shimmer opacity-40"/>
        <div className="relative h-[76px] px-4 flex items-center justify-between border-b border-white/10">
          <button type="button" onClick={()=>navigate('dashboard')} className="group flex items-center gap-3 min-w-0 rounded-2xl">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-[0_10px_30px_rgba(124,92,255,.32)]">
              <span className="text-white font-black text-base">V</span>
              <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-[3px] ring-[#080c17] animate-breathe"/>
            </div>
            <div className="text-left min-w-0">
              <div className="text-[15px] font-black tracking-tight text-white">Vortex One</div>
              <div className="text-[10px] font-bold tracking-[.20em] uppercase text-slate-500">PropFlow</div>
            </div>
          </button>
          <button className="md:hidden text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5" onClick={()=>setIsOpen(false)} aria-label="Close navigation"><X className="h-5 w-5"/></button>
        </div>

        <div className="relative px-3 pt-3">
          <button onClick={()=>navigate('dashboard')} className="group w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl bg-gradient-to-r from-violet-500/15 to-cyan-400/5 border border-violet-400/15 text-white shadow-[0_14px_35px_rgba(0,0,0,.15)]">
            <span className="flex items-center gap-2.5 text-sm font-semibold"><LayoutDashboard className="h-4 w-4 text-violet-300"/> Command Center</span>
            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:translate-x-0.5"/>
          </button>
        </div>

        <nav className="relative flex-1 px-3 py-5 overflow-y-auto sidebar-scroll">
          {sections.map(section=>{
            const sectionLinks=links.filter(l=>l.section===section);
            return <section key={section} className="mb-6">
              <div className="px-2.5 mb-2.5">
                <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500/80">{section}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{SECTION_META[section]}</div>
              </div>
              <div className="space-y-1">
                {sectionLinks.map(link=>{
                  const Icon=ICONS[link.id]??Menu; const active=activeTab===link.id;
                  return <button key={link.id} type="button" onClick={()=>navigate(link.id)} aria-current={active?'page':undefined}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.25 rounded-xl text-left text-[13px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${active?'bg-white/[.085] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.05)]':'text-slate-400 hover:bg-white/[.045] hover:text-slate-100'}`}>
                    {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-violet-300 via-violet-400 to-cyan-400"/>}
                    <Icon className={`h-4 w-4 flex-shrink-0 ${active?'text-violet-300':'text-slate-500 group-hover:text-slate-300'}`}/>
                    <span className="truncate">{link.label}</span>
                    {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-violet-300"/>}
                  </button>;
                })}
              </div>
            </section>;
          })}
        </nav>

      </aside>
    </>
  );
}

import React from 'react';
import { X } from 'lucide-react';

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

export default function Sidebar({ isOpen, setIsOpen, activeTab, setActiveTab, links }: SidebarProps) {
  // Group links by section
  const sections = Array.from(new Set(links.map((link) => link.section)));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 flex flex-col border-r border-slate-800 flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-extrabold text-white text-sm">P.</div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">Propflow.</h1>
              <span className="text-[9px] text-slate-400 font-semibold block mt-1 leading-none">by Vortex One</span>
            </div>
          </div>
          <button 
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {sections.map((section) => {
            const sectionLinks = links.filter((link) => link.section === section);
            if (sectionLinks.length === 0) return null;

            return (
              <div key={section} className="mb-6">
                <div className="text-xs font-semibold text-slate-500 uppercase px-2 mb-2 mt-2">
                  {section}
                </div>
                {sectionLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => {
                      setActiveTab(link.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === link.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <div className="bg-indigo-950 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-indigo-300 mb-2">
              <span>Offline Sync Status</span>
              <span className="text-emerald-400 font-bold">Synced</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import CommandCenter from './CommandCenter';
import Contacts, { ContactDetail } from './Contacts';
import Leads, { LeadDetail } from './Leads';
import Properties, { OwnerDetail, Owners, PropertyDetail } from './Properties';
import Tasks from './Tasks';
import Campaigns, { CampaignDetail } from './Campaigns';
import Dialer from './Dialer';
import Workflows, { WorkflowDetail } from './Workflows';
import Agents from './Agents';
import Team from './Team';
import { usePermissions } from './permissions';
import { ToastProvider } from './ui';
import IntegrationCenter from '../../pages/IntegrationCenter';
import GISWorkspace from '../../pages/GISWorkspace';
import GeminiChatbot from '../../components/GeminiChatbot';
import MyAccount from './MyAccount';
import CustomerSupport from '../../components/CustomerSupport';

/** Sidebar entries for CRM roles. `needs` hides entries the role cannot use (the server enforces it regardless). */
export const CRM_NAV: Array<{ id: string; label: string; section: string; needs?: string }> = [
  { id: 'dashboard', label: 'Command Center', section: 'Command Center' },
  { id: 'tasks', label: 'Tasks', section: 'Command Center' },
  { id: 'contacts', label: 'Contacts', section: 'CRM' },
  { id: 'leads', label: 'Leads', section: 'CRM' },
  { id: 'campaigns', label: 'Campaigns', section: 'CRM' },
  { id: 'dialer', label: 'Dialer', section: 'CRM', needs: 'dialer:use' },
  { id: 'properties', label: 'Properties', section: 'Property Intelligence' },
  { id: 'owners', label: 'Owners', section: 'Property Intelligence' },
  { id: 'workflows', label: 'Workflows', section: 'Automation' },
  { id: 'agents', label: 'AI Agents', section: 'Automation' },
  { id: 'chatbot', label: 'AI Assistant', section: 'Automation' },
  { id: 'integrations', label: 'Integrations', section: 'Automation' },
  { id: 'gis', label: 'GIS & Mapping', section: 'Automation' },
  { id: 'team', label: 'Team & workspace', section: 'Administration' },
  { id: 'security', label: 'My account', section: 'Administration' },
  { id: 'support', label: 'Support', section: 'Administration' },
];

export default function CrmApp() {
  const { can, role } = usePermissions();
  return (
    <ToastProvider>
      {!can('crm:write') && (
        <div role="note" className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
          <ShieldAlert className="h-4 w-4" /> Read-only access: the {String(role).replace('_', ' ')} role can view records but not change them.
        </div>
      )}
      <Routes>
        <Route index element={<CommandCenter />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:id" element={<ContactDetail />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="properties" element={<Properties />} />
        <Route path="properties/:id" element={<PropertyDetail />} />
        <Route path="property-search" element={<Navigate to="/dashboard/properties" replace />} />
        <Route path="owners" element={<Owners />} />
        <Route path="owners/:id" element={<OwnerDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="dialer" element={<Dialer />} />
        <Route path="workflows" element={<Workflows />} />
        <Route path="workflows/:id" element={<WorkflowDetail />} />
        <Route path="agents" element={<Agents />} />
        <Route path="team" element={<Team />} />
        <Route path="integrations" element={<IntegrationCenter />} />
        <Route path="gis" element={<GISWorkspace />} />
        <Route path="ai" element={<GeminiChatbot />} />
        <Route path="chatbot" element={<GeminiChatbot />} />
        <Route path="security" element={<MyAccount />} />
        <Route path="support" element={<CustomerSupport />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar as CalendarIcon, 
  Mail, 
  HardDrive, 
  CheckSquare, 
  MessageSquare, 
  Video, 
  FormInput, 
  LayoutTemplate,
  TableProperties,
  ArrowRight
} from 'lucide-react';
import { getAccessToken, googleSignIn } from './src/lib/dataClient';

const integrations = [
  { id: 'drive', name: 'Google Drive', icon: HardDrive, color: 'text-blue-500', desc: 'Manage your property documents securely.' },
  { id: 'sheets', name: 'Google Sheets', icon: TableProperties, color: 'text-emerald-500', desc: 'Sync financials and rent rolls.' },
  { id: 'gmail', name: 'Gmail', icon: Mail, color: 'text-red-500', desc: 'Send and receive tenant communications.' },
  { id: 'calendar', name: 'Google Calendar', icon: CalendarIcon, color: 'text-blue-600', desc: 'Schedule maintenance and viewings.' },
  { id: 'docs', name: 'Google Docs', icon: FileText, color: 'text-blue-500', desc: 'Create and sign lease agreements.' },
  { id: 'slides', name: 'Google Slides', icon: LayoutTemplate, color: 'text-yellow-500', desc: 'Prepare investor presentations.' },
  { id: 'tasks', name: 'Google Tasks', icon: CheckSquare, color: 'text-blue-500', desc: 'Manage daily property tasks.' },
  { id: 'chat', name: 'Google Chat', icon: MessageSquare, color: 'text-green-500', desc: 'Team communication and alerts.' },
  { id: 'forms', name: 'Google Forms', icon: FormInput, color: 'text-purple-500', desc: 'Collect maintenance requests.' },
  { id: 'meet', name: 'Google Meet', icon: Video, color: 'text-green-600', desc: 'Virtual tours and investor meetings.' }
];

export default function WorkspacePortal() {
  const [token, setToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    getAccessToken().then(setToken);
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
      }
    } catch (error) {
      console.error("Failed to connect workspace", error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] max-w-lg mx-auto text-center px-4">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
          <HardDrive className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Connect Workspace</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
          Link your Google Workspace to seamlessly sync documents, calendars, emails, and communications directly into PropFlow.
        </p>
        <button 
          onClick={handleConnect}
          disabled={isConnecting}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isConnecting ? 'Connecting...' : 'Sign in with Google'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace Integrations</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Your Google Workspace account is successfully connected.
          </p>
        </div>
        <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800 text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          Connected
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((app) => (
          <div 
            key={app.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-lg transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 ${app.color}`}>
                <app.icon className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{app.name}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              {app.desc}
            </p>
          </div>
        ))}
      </div>
      
      {/* Example integration view below */}
      <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Documents (Drive)</h3>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-8 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
          <HardDrive className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-3" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Ready to sync files from Google Drive</p>
          <button className="mt-4 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
            Open File Picker
          </button>
        </div>
      </div>
    </div>
  );
}

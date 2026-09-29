import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, updateDoc, getDoc } from '../lib/dataClient';
import { db } from '../lib/dataClient';
import {
  Camera, CheckCircle2, FileText, Moon, Palette, Save, ShieldCheck,
  Sun, Upload, UserRound, Building2, Phone, AlertTriangle
} from 'lucide-react';

type Section = 'profile' | 'business' | 'contact' | 'documents' | 'appearance';

const sections: { id: Section; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', description: 'Personal identity and account details', icon: UserRound },
  { id: 'business', label: 'Business', description: 'Company and work information', icon: Building2 },
  { id: 'contact', label: 'Contact', description: 'Phones, addresses, and emergency contact', icon: Phone },
  { id: 'documents', label: 'Documents', description: 'Identity and business documents', icon: FileText },
  { id: 'appearance', label: 'Appearance', description: 'Theme and interface preferences', icon: Palette },
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.75 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[.04] dark:text-white dark:focus:border-violet-400 dark:focus:bg-white/[.07]';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400';

export default function UserSettings() {
  const { user, userData } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [section, setSection] = useState<Section>('profile');
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', companyName: '', companyAddress: '',
    primaryMobile: '', officeNumber: '', houseNumber: '', personalEmail: '',
    workEmail: '', mailingAddress: '', emergencyContact: '', logoUrl: ''
  });
  const [documentType, setDocumentType] = useState('Driver License');
  const [documents, setDocuments] = useState<{ name: string; type: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        setFormData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          companyName: data.companyName || '',
          companyAddress: data.companyAddress || '',
          primaryMobile: data.primaryMobile || '',
          officeNumber: data.officeNumber || '',
          houseNumber: data.houseNumber || '',
          personalEmail: data.personalEmail || data.email || '',
          workEmail: data.workEmail || '',
          mailingAddress: data.mailingAddress || '',
          emergencyContact: data.emergencyContact || '',
          logoUrl: data.logoUrl || ''
        });
        setDocuments(data.documents || []);
      } catch (e: any) {
        if (!String(e?.message || '').includes('offline')) {
          console.error('Error loading user data', e);
        }
      }
    };
    loadData();
  }, [user]);

  const completion = useMemo(() => {
    const required = [formData.firstName, formData.lastName, formData.personalEmail, formData.primaryMobile];
    return Math.round((required.filter(Boolean).length / required.length) * 100);
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      await updateDoc(doc(db, 'users', user.uid), { ...formData, documents, profileComplete: true });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch (e: any) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const unavailableUpload = (kind: string) => {
    setUploadNotice(`${kind} storage is not configured yet. Nothing was uploaded.`);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[22px] border border-slate-200/70 bg-white/80 shadow-[0_24px_70px_rgba(15,23,42,.07)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65 dark:shadow-none">
        <div className="relative overflow-hidden border-b border-slate-200/70 px-5 py-6 sm:px-7 dark:border-white/10">
          <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-violet-600 dark:text-violet-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Workspace configuration
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Settings</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Manage the identity and preferences PropFlow uses across your workspace.
              </p>
            </div>
            <div className="min-w-[190px]">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>Profile completion</span><span>{completion}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width] duration-500" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[245px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200/70 p-3 lg:border-b-0 lg:border-r dark:border-white/10">
            <nav aria-label="Settings sections" className="space-y-1">
              {sections.map(item => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${active
                      ? 'bg-violet-50 text-violet-900 shadow-sm dark:bg-violet-400/10 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[.04] dark:hover:text-white'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-violet-500 text-white shadow-[0_8px_24px_rgba(124,92,255,.25)]' : 'bg-slate-100 text-slate-500 dark:bg-white/[.05] dark:text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <form onSubmit={handleSave} className="min-w-0">
            <div className="min-h-[560px] p-5 sm:p-7">
              {section === 'appearance' ? (
                <div className="max-w-2xl space-y-5">
                  <SectionHeading title="Appearance" description="Choose how PropFlow looks on this device." />
                  <button type="button" onClick={toggleTheme} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-violet-300 hover:bg-white dark:border-white/10 dark:bg-white/[.03] dark:hover:bg-white/[.06]">
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">{isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}</span>
                      <span><span className="block text-sm font-semibold text-slate-900 dark:text-white">Color theme</span><span className="block text-xs text-slate-500">Currently using {isDark ? 'dark' : 'light'} mode.</span></span>
                    </span>
                    <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">Switch</span>
                  </button>
                </div>
              ) : section === 'documents' ? (
                <div className="space-y-6">
                  <SectionHeading title="Documents" description="Keep optional identity and business documents associated with your account." />
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-400/20 dark:bg-amber-400/5">
                    <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><p className="text-xs leading-5 text-amber-800 dark:text-amber-200">Document storage is not configured yet. The interface will not claim an upload succeeded.</p></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label="Document type"><select value={documentType} onChange={e => setDocumentType(e.target.value)} className={inputClass}><option>Driver License</option><option>Passport</option><option>ID Card</option><option>Business License</option><option>Tax Form</option></select></Field>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.75 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[.04]">
                      <Upload className="h-4 w-4" /> Upload file
                      <input type="file" className="hidden" onChange={() => unavailableUpload('Document')} />
                    </label>
                  </div>
                  {uploadNotice && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{uploadNotice}</p>}
                  {documents.length > 0 && <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 dark:divide-white/10 dark:border-white/10">{documents.map((item, idx) => <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p><p className="text-xs text-slate-500">{item.type}</p></div><button type="button" onClick={() => setDocuments(docs => docs.filter((_, i) => i !== idx))} className="text-xs font-semibold text-rose-600 hover:text-rose-700">Remove</button></div>)}</div>}
                </div>
              ) : (
                <div className="space-y-7">
                  {section === 'profile' && <>
                    <SectionHeading title="Profile" description="Your personal identity and account contact details." />
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center dark:border-white/10 dark:bg-white/[.025]">
                      <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[.06]">
                        {formData.logoUrl ? <img src={formData.logoUrl} alt="Profile or company logo" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Camera className="h-6 w-6 text-slate-400" /></div>}
                        <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-slate-950/60 opacity-0 transition group-hover:opacity-100"><Upload className="h-4 w-4 text-white" /><input type="file" accept="image/*" className="hidden" onChange={() => unavailableUpload('Logo')} /></label>
                      </div>
                      <div><p className="text-sm font-semibold text-slate-900 dark:text-white">Profile photo or company logo</p><p className="text-xs text-slate-500">Storage must be configured before a new image can be uploaded.</p></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="First name" required><input className={inputClass} name="firstName" value={formData.firstName} onChange={handleChange} required /></Field>
                      <Field label="Last name" required><input className={inputClass} name="lastName" value={formData.lastName} onChange={handleChange} required /></Field>
                      <Field label="Personal email" required><input className={inputClass} type="email" name="personalEmail" value={formData.personalEmail} onChange={handleChange} required /></Field>
                      <Field label="Primary mobile" required><input className={inputClass} type="tel" name="primaryMobile" value={formData.primaryMobile} onChange={handleChange} required /></Field>
                    </div>
                  </>}

                  {section === 'business' && <>
                    <SectionHeading title="Business" description="Professional information used across your workspace." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Company name"><input className={inputClass} name="companyName" value={formData.companyName} onChange={handleChange} /></Field>
                      <Field label="Work email"><input className={inputClass} type="email" name="workEmail" value={formData.workEmail} onChange={handleChange} /></Field>
                      <Field label="Company address" wide><input className={inputClass} name="companyAddress" value={formData.companyAddress} onChange={handleChange} /></Field>
                      <Field label="Office number"><input className={inputClass} type="tel" name="officeNumber" value={formData.officeNumber} onChange={handleChange} /></Field>
                    </div>
                  </>}

                  {section === 'contact' && <>
                    <SectionHeading title="Contact" description="Additional ways PropFlow can reach you." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="House number"><input className={inputClass} name="houseNumber" value={formData.houseNumber} onChange={handleChange} /></Field>
                      <Field label="Emergency contact"><input className={inputClass} name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} placeholder="Name — phone number" /></Field>
                      <Field label="Mailing address" wide><input className={inputClass} name="mailingAddress" value={formData.mailingAddress} onChange={handleChange} /></Field>
                    </div>
                  </>}
                </div>
              )}
            </div>

            {section !== 'appearance' && (
              <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200/70 bg-white/90 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-white/10 dark:bg-slate-950/90">
                <div aria-live="polite" className="min-h-5 text-xs">
                  {error && <span className="text-rose-600 dark:text-rose-400">{error}</span>}
                  {saved && <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Changes saved</span>}
                  {!error && !saved && uploadNotice && <span className="text-amber-600 dark:text-amber-300">{uploadNotice}</span>}
                </div>
                <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.75 text-sm font-bold text-white shadow-[0_10px_30px_rgba(124,92,255,.24)] transition hover:-translate-y-0.5 hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60">
                  <Save className="h-4 w-4" /> {loading ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">{title}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p></div>;
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? 'md:col-span-2' : ''}><label className={labelClass}>{label}{required ? ' *' : ''}</label>{children}</div>;
}

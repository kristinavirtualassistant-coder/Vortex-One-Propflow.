import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api, errorMessage } from './api';
import { titleCase } from './format';
import { Badge, Button, Card, ErrorBanner, Field, Input, PageHeader, ToastProvider, useToast } from './ui';

function Profile() {
  const { userData, updateProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: userData?.name ?? '', phone: userData?.phone ?? '', companyName: userData?.companyName ?? '', primaryMarket: userData?.primaryMarket ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setBusy(true); setError(null);
    try {
      await updateProfile({ name: form.name, phone: form.phone || null, companyName: form.companyName || null, primaryMarket: form.primaryMarket || null });
      toast.success('Profile saved');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Card title="Profile">
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4" noValidate>
        <Field label="Name" required>{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Email" help="Email is your sign-in and cannot be changed here.">{(id) => <Input id={id} value={userData?.email ?? ''} disabled />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
        <Field label="Company">{(id) => <Input id={id} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />}</Field>
        <Field label="Primary market">{(id) => <Input id={id} value={form.primaryMarket} onChange={(e) => setForm({ ...form, primaryMarket: e.target.value })} />}</Field>
        <div className="sm:col-span-2 space-y-3">{error && <ErrorBanner message={error} />}<Button type="submit" variant="primary" loading={busy}>Save profile</Button></div>
      </form>
    </Card>
  );
}

function Password() {
  const { userData } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const demo = Boolean(userData?.isDemo);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 10) return setError('New password must be at least 10 characters');
    if (next !== again) return setError('The new passwords do not match');
    setBusy(true); setError(null);
    try { await api.post('/auth/password', { currentPassword: cur, newPassword: next }); setCur(''); setNext(''); setAgain(''); toast.success('Password changed. Your other sessions were signed out.'); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Card title="Password">
      {demo ? <p className="text-sm text-slate-500">Demo accounts have no password.</p> : (
        <form onSubmit={submit} className="grid sm:grid-cols-3 gap-4" noValidate>
          <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />}</Field>
          <Field label="New password" help="At least 10 characters">{(id) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}</Field>
          <Field label="Repeat new password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}</Field>
          <div className="sm:col-span-3 space-y-3">{error && <ErrorBanner message={error} />}<Button type="submit" variant="primary" loading={busy} disabled={!cur || !next}>Change password</Button>
            <p className="text-xs text-slate-500">Forgot your password? Email-based reset is not available until an email provider is configured for this deployment.</p></div>
        </form>)}
    </Card>
  );
}

export default function MyAccount() {
  const { userData } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  return (
    <ToastProvider>
      <PageHeader title="My account" subtitle={<span className="flex items-center gap-2">{userData?.email}<Badge tone="violet">{titleCase(userData?.role)}</Badge>{userData?.isDemo && <Badge tone="amber">Demo</Badge>}</span>} />
      <div className="space-y-5 max-w-4xl">
        <Profile />
        <Password />
        <Card title="Appearance"><Button onClick={toggleTheme}>{isDark ? <><Sun className="h-4 w-4" /> Switch to light mode</> : <><Moon className="h-4 w-4" /> Switch to dark mode</>}</Button></Card>
      </div>
    </ToastProvider>
  );
}

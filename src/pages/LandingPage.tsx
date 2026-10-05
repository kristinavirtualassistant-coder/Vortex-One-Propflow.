import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Menu, X, Moon, Sun, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import MultiStepRegistration from '../components/MultiStepRegistration';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { loginWithEmail, signupWithEmail, loginWithGoogle, loginWithMicrosoft, startDemo } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState('');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('property_manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetError = () => setAuthError('');

  const handleDemo = async () => {
    setDemoError('');
    setDemoLoading(true);
    try {
      await startDemo();
      navigate('/dashboard');
    } catch (error: any) {
      setDemoError(error?.message || 'Unable to start the demo.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetError();
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      setAuthError(error?.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    resetError();
    setLoading(true);
    try {
      await signupWithEmail(email, password, selectedRole, name);
      navigate('/dashboard');
    } catch (error: any) {
      setAuthError(error?.message || 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  const openSignup = () => {
    setIsLoginOpen(false);
    setIsSignupOpen(true);
    resetError();
  };

  const openLogin = () => {
    setIsSignupOpen(false);
    setIsLoginOpen(true);
    resetError();
  };

  const capabilities = [
    { name: 'CRM', description: 'Contacts, leads, tasks, notes and pipeline stages with full activity history.', features: ['Search, filter and sort', 'Assignments and tags', 'Linked properties and owners'] },
    { name: 'Dialer & campaigns', description: 'Power-dial a campaign queue and log every outcome.', features: ['Call states and outcomes', 'Follow-ups created for you', 'Simulated until a phone provider is connected'] },
    { name: 'Property intelligence', description: 'Properties, parcels, owners and motivation signals in one place.', features: ['Owner portfolios', 'Transparent lead scoring', 'Import by APN'] },
    { name: 'Workflows', description: 'Trigger → conditions → actions, with a recorded history of every run.', features: ['New lead, call completed, property identified', 'Tasks, tags, assignments', 'Per-step results'] },
    { name: 'AI agents', description: 'Modular agents that work within your permissions.', features: ['Lead qualification', 'Follow-up and call prep', 'Every run logged'] },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f7fb] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 premium-grid">
      <nav className="sticky top-0 z-40 border-b border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl shadow-[0_12px_40px_rgba(15,23,42,.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 p-2.5 rounded-2xl text-white shadow-[0_12px_35px_rgba(124,92,255,.28)] premium-shimmer"><Building2 className="h-6 w-6" /></div>
            <div>
              <div className="font-extrabold tracking-tight">Vortex One PropFlow</div>
              <div className="text-[10px] text-slate-500">Property operations platform</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <a href="#capabilities" className="text-sm font-medium hover:text-primary-600">Capabilities</a>
            <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500" aria-label="Toggle theme">{isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
            <button onClick={handleDemo} disabled={demoLoading} className="text-sm font-semibold px-3 py-2 text-violet-700 dark:text-violet-300 disabled:opacity-50">{demoLoading ? 'Starting demo…' : 'Try the demo'}</button>
            <button onClick={openLogin} className="text-sm font-semibold px-3 py-2">Log In</button>
            <button onClick={() => { setIsSignupOpen(true); resetError(); }} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Create Account</button>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 text-slate-500">{isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-500" aria-label="Menu">{isMenuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <a href="#capabilities" onClick={() => setIsMenuOpen(false)} className="block">Capabilities</a>
            <button onClick={openLogin} className="block font-semibold">Log In</button>
            <button onClick={() => { setIsSignupOpen(true); setIsMenuOpen(false); resetError(); }} className="block font-semibold text-primary-600">Create Account</button>
          </div>
        )}
      </nav>
      <main>
        <section className="relative max-w-6xl mx-auto px-4 py-28 sm:py-32 text-center animate-float-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-200/60 dark:border-violet-400/10 bg-white/70 dark:bg-white/[.04] text-violet-700 dark:text-violet-200 text-xs font-bold shadow-sm backdrop-blur">Vortex One</div>
          <h1 className="mt-7 text-5xl sm:text-7xl font-black tracking-[-.04em] leading-[.98] bg-gradient-to-r from-slate-950 via-violet-700 to-cyan-600 dark:from-white dark:via-violet-200 dark:to-cyan-200 bg-clip-text text-transparent">One platform for modern property operations.</h1>
          <p className="mt-7 text-lg sm:text-xl leading-8 text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">CRM, dialer, campaigns, property and owner intelligence, workflows and AI agents in one connected workspace.</p>
          <div className="mt-9 flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => { setIsSignupOpen(true); resetError(); }} className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-7 py-3.5 rounded-2xl font-bold shadow-[0_16px_35px_rgba(109,74,255,.28)] hover:shadow-[0_20px_45px_rgba(109,74,255,.36)]">Create your account <ArrowRight className="h-4 w-4" /></button>
            <button onClick={handleDemo} disabled={demoLoading} className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl border border-violet-300 dark:border-violet-400/30 bg-white/60 dark:bg-white/[.04] font-semibold text-violet-700 dark:text-violet-200 backdrop-blur hover:bg-white/90 dark:hover:bg-white/[.08] disabled:opacity-60">{demoLoading && <Loader2 className="h-4 w-4 animate-spin" />}{demoLoading ? 'Preparing your demo…' : 'Try the live demo'}</button>
            <button onClick={openLogin} className="px-7 py-3.5 rounded-2xl border border-slate-300/80 dark:border-white/10 bg-white/60 dark:bg-white/[.04] font-semibold backdrop-blur hover:bg-white/90 dark:hover:bg-white/[.08]">Sign in</button>
          </div>
          {demoError && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{demoError}</p>}
          <p className="mt-4 text-xs text-slate-500">The demo is a private sandbox with fictional data. Calls are simulated; no real calls, texts or emails are sent.</p>
        </section>
        <section id="capabilities" className="border-y border-slate-200/60 dark:border-white/10 bg-white/45 dark:bg-white/[.025] py-24 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Everything connected, nothing duplicated</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">A property, its owner, the lead, the calls and the follow-ups all live in one record graph.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {capabilities.map((tier) => (
                <div key={tier.name} className="premium-card p-6 flex flex-col transition-all duration-300">
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                  <p className="mt-3 text-sm text-slate-500 flex-1">{tier.description}</p>
                  <ul className="mt-6 space-y-3 text-sm">{tier.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary-500 mt-0.5 shrink-0" />{feature}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-7 max-w-md w-full relative border border-slate-100 dark:border-slate-800 shadow-2xl">
            <button onClick={() => setIsLoginOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" aria-label="Close"><X /></button>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Sign In</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use your Vortex One PropFlow credentials to log in.</p>
            {authError && <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">{authError}</div>}
            
            <form onSubmit={handleEmailLogin} className="space-y-3 mt-4">
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email address" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" required />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" required />
              <button disabled={loading} type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50 transition-colors">{loading ? 'Please wait…' : 'Sign In'}</button>
            </form>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <button type="button" disabled={loading} onClick={() => { resetError(); setLoading(true); void loginWithGoogle(false, selectedRole).catch((error: any) => { setAuthError(error?.message || 'Unable to continue with Google.'); setLoading(false); }); }} className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-50 transition-colors">Google</button>
              <button type="button" disabled={loading} onClick={() => { resetError(); setLoading(true); void loginWithMicrosoft(false, selectedRole).catch((error: any) => { setAuthError(error?.message || 'Unable to continue with Microsoft.'); setLoading(false); }); }} className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-50 transition-colors">Microsoft</button>
              
            </div>
            <button onClick={openSignup} className="mt-5 text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Need an account? Create one</button>
          </div>
        </div>
      )}

      {isSignupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="my-8 w-full max-w-lg">
            <MultiStepRegistration 
              onSuccess={() => {
                setIsSignupOpen(false);
                navigate('/dashboard');
              }}
              onCancel={() => setIsSignupOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

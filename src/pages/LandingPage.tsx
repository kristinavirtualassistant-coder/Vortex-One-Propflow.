import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Menu, X, Moon, Sun, ArrowRight } from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { loginWithEmail, signupWithEmail, loginWithGoogle, loginWithMicrosoft } = useAuth();

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

  const handleOAuth = async (provider: 'google' | 'microsoft') => {
    resetError();
    setLoading(true);
    try {
      if (provider === 'google') await loginWithGoogle(false, selectedRole);
      else await loginWithMicrosoft(false, selectedRole);
      navigate('/dashboard');
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        setAuthError(error?.message || 'Unable to complete authentication.');
      }
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

  const pricing = [
    { name: 'Free', price: '$0', description: 'Get started with the core platform.', features: ['Core property workspace', 'Basic tenant and owner records', 'Maintenance tracking', 'Secure account'] },
    { name: 'Starter', price: '$9', description: 'For small portfolios and independent operators.', features: ['Everything in Free', 'Expanded property records', 'Workflow tools', 'Email support'] },
    { name: 'Pro', price: '$19', description: 'For growing property operations.', features: ['Everything in Starter', 'Advanced analytics', 'Automation tools', 'Priority support'] },
    { name: 'Business', price: '$39', description: 'For teams managing larger operations.', features: ['Everything in Pro', 'Team workflows', 'Advanced reporting', 'Role-based access'] },
    { name: 'Enterprise', price: '$79', description: 'For organizations that need the full platform.', features: ['Everything in Business', 'Expanded controls', 'Integrations', 'Dedicated support'] },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-2 rounded-xl text-white"><Building2 className="h-6 w-6" /></div>
            <div>
              <div className="font-extrabold tracking-tight">Vortex One PropFlow</div>
              <div className="text-[10px] text-slate-500">Property operations platform</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <a href="#pricing" className="text-sm font-medium hover:text-primary-600">Pricing</a>
            <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500" aria-label="Toggle theme">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
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
            <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="block">Pricing</a>
            <button onClick={openLogin} className="block font-semibold">Log In</button>
            <button onClick={() => { setIsSignupOpen(true); setIsMenuOpen(false); resetError(); }} className="block font-semibold text-primary-600">Create Account</button>
          </div>
        )}
      </nav>

      <main>
        <section className="max-w-5xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 text-xs font-semibold">
            Vortex One
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight">
            One platform for modern property operations.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
            Manage properties, people, maintenance, workflows, reporting, and operations from one connected workspace.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => { setIsSignupOpen(true); resetError(); }} className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-7 py-3.5 rounded-xl font-bold">
              Create your account <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={openLogin} className="px-7 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">
              Sign in
            </button>
          </div>
        </section>

        <section id="pricing" className="bg-slate-100/70 dark:bg-slate-900/50 py-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Simple, transparent pricing</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">Choose a plan based on the size and needs of your operation.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {pricing.map((tier) => (
                <div key={tier.name} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                  <div className="mt-3 text-4xl font-extrabold">{tier.price}<span className="text-base font-medium text-slate-500">/mo</span></div>
                  <p className="mt-3 text-sm text-slate-500 flex-1">{tier.description}</p>
                  <ul className="mt-6 space-y-3 text-sm">
                    {tier.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary-500 mt-0.5 shrink-0" />{feature}</li>)}
                  </ul>
                  <button onClick={() => { setIsSignupOpen(true); resetError(); }} className="mt-7 w-full py-2.5 rounded-xl bg-primary-600 text-white font-semibold">Get Started</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {(isLoginOpen || isSignupOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-7 max-w-md w-full relative">
            <button onClick={() => { setIsLoginOpen(false); setIsSignupOpen(false); }} className="absolute top-4 right-4 text-slate-500" aria-label="Close"><X /></button>
            <h2 className="text-2xl font-bold">{isLoginOpen ? 'Sign in' : 'Create your account'}</h2>
            <p className="mt-1 text-sm text-slate-500">{isLoginOpen ? 'Use your Vortex One PropFlow account.' : 'Create a real account. No demo accounts are provided.'}</p>
            {authError && <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{authError}</div>}

            {!isLoginOpen && (
              <div className="mt-5">
                <label className="block text-sm font-medium mb-2">Primary role</label>
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as UserRole)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent">
                  <option value="property_manager">Property Manager</option>
                  <option value="landlord">Landlord / Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="technician">Technician</option>
                  <option value="sales">Sales</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {!isLoginOpen && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-3 w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent" required />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email address" className="mt-3 w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent" required />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="mt-3 w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent" required />

            <button disabled={loading} onClick={isLoginOpen ? handleEmailLogin : handleSignup} className="mt-4 w-full py-2.5 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50">
              {loading ? 'Please wait…' : isLoginOpen ? 'Sign In' : 'Create Account'}
            </button>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <button disabled={loading} onClick={() => handleOAuth('google')} className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium">Continue with Google</button>
              <button disabled={loading} onClick={() => handleOAuth('microsoft')} className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium">Continue with Microsoft</button>
            </div>

            <button onClick={isLoginOpen ? openSignup : openLogin} className="mt-5 text-sm text-primary-600 font-semibold">
              {isLoginOpen ? 'Need an account? Create one' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Wrench, BarChart3, Users, CheckCircle2, Menu, X, Moon, Sun, ShieldCheck, UserCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { loginWithEmail, signupWithEmail, loginWithGoogle, loginWithMicrosoft } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('property_manager');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

    const handleOAuthLogin = async (providerName: 'google' | 'microsoft', isSignUp = false) => {
    try {
      setAuthError('');
      setLoading(true);
      if (providerName === 'google') {
        await loginWithGoogle(isSignUp, selectedRole);
      } else {
        await loginWithMicrosoft(isSignUp, selectedRole);
      }
      navigate('/dashboard');
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user' || error.code === 'auth/popup-blocked') {
        return;
      }
      console.warn("Authentication notice:", error);
      // Fallback seamlessly to demo user
      setAuthError('Authentication failed. Please check your credentials or try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthError('');
      setLoading(true);
      await signupWithEmail(email, password, selectedRole, name);
      navigate('/dashboard');
    } catch (error: any) {
      console.warn("Signup error fallback:", error);
      setAuthError('Authentication failed. Please check your credentials or try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthError('');
      setLoading(true);
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      console.warn("Login fallback:", error);
      setAuthError('Authentication failed. Please check your credentials or try again.');
    } finally {
      setLoading(false);
    }
  };

  const pricingTiers = [
    { name: 'Free', price: '$0', description: 'A real free plan for small landlords getting started.', features: ['Up to 5 properties', '2 users', 'Tenant & lease management', 'Maintenance & work orders', 'Basic financial tracking', 'Basic reports', 'Data export'] },
    { name: 'Starter', price: '$9', description: 'Affordable property management for small portfolios.', features: ['Up to 25 properties', '5 users', 'Everything in Free', 'Financial tracking', 'Lease automation', 'Vendor management', 'Automated reminders'] },
    { name: 'Pro', price: '$19', description: 'For independent property managers and growing portfolios.', features: ['Up to 100 properties', '10 users', 'CRM & prospecting', 'Advanced analytics', 'Workflow automation', 'AI assistant', 'Integrations & API'], popular: true },
    { name: 'Business', price: '$39', description: 'For small property management companies.', features: ['Up to 500 properties', '25 users', 'Multi-property operations', 'Advanced permissions', 'Custom workflows', 'Higher AI limits', 'Priority support'] },
    { name: 'Enterprise', price: '$79', description: 'Unlimited property management without enterprise pricing.', features: ['Unlimited properties', 'Unlimited users', 'Custom roles', 'White-label options', 'Custom integrations', 'Advanced AI agents', 'Dedicated support'] }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Navbar */}
      <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2.5">
              <div className="bg-primary-600 p-2 rounded-xl text-white shadow-sm shadow-primary-500/20">
                <Building2 className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">PropFlow</span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <a href="#demo-access" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Pricing</a>
              <button 
                onClick={toggleTheme} 
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 px-3 py-2 transition-colors"
              >
                Log In
              </button>
              <button 
                onClick={() => setIsSignUpModalOpen(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all shadow-sm shadow-primary-600/30"
              >
                Sign Up Free
              </button>
            </div>
            <div className="md:hidden flex items-center space-x-3">
              <button onClick={toggleTheme} className="p-2 text-slate-500">
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-500">
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-3">
            <a href="#demo-access" onClick={() => setIsMenuOpen(false)} className="block py-1 text-slate-600 dark:text-slate-300">Features</a>
            <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="block py-1 text-slate-600 dark:text-slate-300">Pricing</a>
            <div className="pt-2 flex flex-col space-y-2">
              <button onClick={() => { setIsMenuOpen(false); setIsLoginModalOpen(true); }} className="w-full text-center py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium">Log In</button>
              <button onClick={() => { setIsMenuOpen(false); setIsSignUpModalOpen(true); }} className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-semibold text-center">Sign Up</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="h-3.5 w-3.5" /> Next-Gen Property Management Platform
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
          Property Management,<br className="hidden sm:inline" />
          <span className="text-primary-600 dark:text-primary-400"> Unified & Frictionless</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 mt-6 max-w-2xl mx-auto">
          One cohesive dashboard bridging Property Managers, Landlords, Tenants, and Field Contractors with real-time analytics, automated rent, and instant maintenance tracking.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => setIsSignUpModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-7 py-3.5 rounded-xl font-bold text-base shadow-lg shadow-primary-600/25 transition-all"
          >
            <span>Launch Manager Portal</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setIsLoginModalOpen(true)}
            className="w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 px-7 py-3.5 rounded-xl font-semibold text-base transition-all"
          >
            Custom Sign In
          </button>
        </div>
      </div>

      {/* Quick Interactive Role Showcase / 1-Click Launch */}
      <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                <UserCheck className="h-4 w-4" /> 
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                Built for every property role
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Click any role to test and preview all integrated capabilities instantly with zero setup.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              All 5 Portals Ready
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {demoRoles.map((role) => (
              <button
                key={role.id}
                onClick={() => setIsSignUpModalOpen(true)}
                className="group text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary-500 dark:hover:border-primary-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="text-3xl mb-2.5">{role.icon}</div>
                  <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm">
                    {role.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {role.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-primary-600 dark:text-primary-400">
                  <span>Launch {role.name.split(' ')[0]}</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-slate-100/60 dark:bg-slate-900/40 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Simple, transparent pricing</h2>
            <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">Choose the perfect plan for your property portfolio.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <div key={tier.name} className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border ${tier.popular ? 'border-primary-500 ring-2 ring-primary-500 ring-opacity-50' : 'border-slate-200 dark:border-slate-800'} p-8 relative flex flex-col`}>
                {tier.popular && (
                  <div className="absolute top-0 right-6 transform -translate-y-1/2">
                    <span className="bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</span>
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{tier.name}</h3>
                <div className="mt-4 flex items-baseline text-4xl font-extrabold text-slate-900 dark:text-white">
                  {tier.price}
                  {true && <span className="ml-1 text-lg font-medium text-slate-500 dark:text-slate-400">/mo</span>}
                </div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 flex-1">{tier.description}</p>
                <ul className="mt-6 space-y-3 mb-8 text-sm">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 text-primary-500 mr-2.5 flex-shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => setIsSignUpModalOpen(true)} 
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-colors ${tier.popular ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-7 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-1">Welcome Back</h2>
            <p className="text-xs text-slate-500 text-center mb-6">Sign in to your PropFlow portal account</p>
            
            {authError && <div className="mb-4 p-3 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-xs">{authError}</div>}
            
            {/* Quick Demo Selector inside Modal */}
            <div className="mb-6 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                ⚡ 1-Click 
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'property_manager', label: '🏢 Manager' },
                  { id: 'landlord', label: '🏠 Landlord' },
                  { id: 'tenant', label: '🛋️ Tenant' },
                  { id: 'technician', label: '🔧 Tech' },
                  { id: 'admin', label: '🛡️ Admin' },
                  { id: 'sales', label: '📈 Sales' },
                ].map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setIsSignUpModalOpen(true)}
                    className="py-1.5 px-2 bg-white dark:bg-slate-750 hover:bg-primary-50 dark:hover:bg-primary-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-center"
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white dark:bg-slate-900 text-slate-500">Or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-3.5 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  placeholder="your@email.com"
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input 
                  type="password" 
                  required 
                  value={password} 
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="grid grid-cols-2 gap-2.5">
              <button 
                type="button"
                onClick={() => handleOAuthLogin('google', false)}
                className="flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                <span>Google</span>
              </button>
              <button 
                type="button"
                onClick={() => handleOAuthLogin('microsoft', false)}
                className="flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/microsoft.svg" alt="Microsoft" className="w-4 h-4" />
                <span>Microsoft</span>
              </button>
            </div>

            <div className="mt-5 text-center text-xs text-slate-500">
              Need an account? <button onClick={() => { setIsLoginModalOpen(false); setIsSignUpModalOpen(true); }} className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Create one</button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Up Modal */}
      {isSignUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-7 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button 
              onClick={() => setIsSignUpModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-1">Create Account</h2>
            <p className="text-xs text-slate-500 text-center mb-5">Select your primary role to get started</p>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Your Role</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'property_manager', label: '🏢 Manager' },
                  { id: 'landlord', label: '🏠 Landlord' },
                  { id: 'tenant', label: '🛋️ Tenant' },
                  { id: 'technician', label: '🔧 Tech' },
                  { id: 'admin', label: '🛡️ Admin' },
                  { id: 'sales', label: '📈 Sales' }
                ].map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id as UserRole)}
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      selectedRole === role.id 
                        ? 'bg-primary-50 border-primary-500 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300 dark:border-primary-500 ring-2 ring-primary-500/20' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {authError && <div className="mb-4 p-3 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-xs">{authError}</div>}

            <form onSubmit={handleEmailSignUp} className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={name} 
                  placeholder="e.g. Alex Morgan"
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  placeholder="alex@propflow.io"
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input 
                  type="password" 
                  required 
                  value={password} 
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Account & Enter'}
              </button>
            </form>

            <div className="grid grid-cols-2 gap-2.5">
              <button 
                type="button"
                onClick={() => handleOAuthLogin('google', true)}
                className="flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                <span>Google</span>
              </button>
              <button 
                type="button"
                onClick={() => handleOAuthLogin('microsoft', true)}
                className="flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/microsoft.svg" alt="Microsoft" className="w-4 h-4" />
                <span>Microsoft</span>
              </button>
            </div>

            <div className="mt-5 text-center text-xs text-slate-500">
              Already have an account? <button onClick={() => { setIsSignUpModalOpen(false); setIsLoginModalOpen(true); }} className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Log in</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


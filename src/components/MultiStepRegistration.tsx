import React, { useState } from 'react';
import { z } from 'zod';
import { 
  User, Mail, Lock, Phone, Building2, Briefcase, Calendar, 
  DollarSign, Users, CheckCircle2, ArrowRight, ArrowLeft, 
  ShieldCheck, Home, PawPrint, Check, Sparkles, Wrench
} from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import OpenMultiSelect from './OpenMultiSelect';

// Zod Validation Schemas
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character (e.g. !, @, #, $, %, ^, &, *)');

const step2Schema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  phone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/, 'Invalid phone number format')
});

const landlordSchema = z.object({
  companyName: z.string().min(2, 'Company/Business name must be at least 2 characters'),
  portfolioSize: z.string().min(1, 'Please select your portfolio size'),
  primaryMarket: z.string().min(2, 'Primary market must be at least 2 characters')
});

const tenantSchema = z.object({
  currentAddress: z.string().min(5, 'Current address must be at least 5 characters'),
  employmentStatus: z.string().min(1, 'Please select your employment status'),
  monthlyIncome: z.string().min(1, 'Please specify your monthly income')
});

const propertyManagerSchema = z.object({
  companyName: z.string().min(2, 'Property Management company name must be at least 2 characters'),
  portfolioSize: z.string().min(1, 'Please select your portfolio size'),
  propertyTypes: z.string().min(1, 'Please select property types managed'),
  managementFee: z.string().min(1, 'Please specify your standard management fee (e.g. 8%)')
});

const technicianSchema = z.object({
  tradeSpecialty: z.string().min(1, 'Please select your primary trade specialty'),
  hourlyRate: z.string().min(1, 'Please specify your standard hourly rate (e.g. $85)'),
  serviceRadius: z.string().min(1, 'Please specify your service radius (e.g. 25 miles)')
});

const tenantPrefsSchema = z.object({
  moveInDate: z.string().min(1, 'Preferred move-in date is required'),
  occupantsCount: z.number().min(1, 'Must have at least 1 occupant'),
  hasPets: z.string().min(1, 'Please specify pet status')
});

interface MultiStepRegistrationProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MultiStepRegistration({ onSuccess, onCancel }: MultiStepRegistrationProps) {
  const { signupWithEmail } = useAuth();
  
  // Steps: 1 = Role, 2 = Account Details, 3 = Role Specific Details, 4 = Final Preferences/Summary
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>('landlord'); 
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    
    // Landlord exclusive
    companyName: '',
    portfolioSize: '1-5 units',
    primaryMarket: '',
    interestedFeatures: [] as string[],
    
    // Tenant exclusive
    currentAddress: '',
    employmentStatus: 'Employed',
    monthlyIncome: '',
    moveInDate: '',
    occupantsCount: 1,
    hasPets: 'no',

    // Property Manager exclusive
    propertyTypes: 'Residential',
    managementFee: '',

    // Technician exclusive
    tradeSpecialty: 'Plumbing',
    hourlyRate: '',
    serviceRadius: '',
    emergencyDispatch: 'no'
  });

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  // Field update handler
  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Feature selection helper
  const toggleFeature = (feature: string) => {
    const current = [...formData.interestedFeatures];
    if (current.includes(feature)) {
      updateField('interestedFeatures', current.filter(f => f !== feature));
    } else {
      updateField('interestedFeatures', [...current, feature]);
    }
  };

  // Validate step transitions
  const handleNextStep = () => {
    setErrors({});
    setApiError('');

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      // Validate Step 2 (Account Details) and submit directly
      const result = step2Schema.safeParse({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone
      });

      if (!result.success) {
        const formattedErrors: Record<string, string> = {};
        result.error.issues.forEach(issue => {
          if (issue.path[0]) {
            formattedErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(formattedErrors);
        return;
      }
      handleSubmit();
      return;
    }
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
    setApiError('');
  };

  // Final submit
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrors({});
    setApiError('');

    // Re-verify account details are valid
    const result = step2Schema.safeParse({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone
    });

    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        if (issue.path[0]) {
          formattedErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(formattedErrors);
      return;
    }

    setLoading(true);

    try {
      // Collect onboarding payload
      let onboardingPayload: Record<string, any> = {};

      if (role === 'landlord') {
        onboardingPayload = {
          phone: formData.phone,
          companyName: formData.companyName,
          portfolioSize: formData.portfolioSize,
          primaryMarket: formData.primaryMarket,
          interestedFeatures: formData.interestedFeatures.join(', ')
        };
      } else if (role === 'property_manager') {
        onboardingPayload = {
          phone: formData.phone,
          companyName: formData.companyName,
          portfolioSize: formData.portfolioSize,
          propertyTypes: formData.propertyTypes,
          managementFee: formData.managementFee,
          interestedFeatures: formData.interestedFeatures.join(', ')
        };
      } else if (role === 'technician') {
        onboardingPayload = {
          phone: formData.phone,
          tradeSpecialty: formData.tradeSpecialty,
          hourlyRate: formData.hourlyRate,
          serviceRadius: formData.serviceRadius,
          emergencyDispatch: formData.emergencyDispatch
        };
      } else {
        onboardingPayload = {
          phone: formData.phone,
          currentAddress: formData.currentAddress,
          employmentStatus: formData.employmentStatus,
          monthlyIncome: formData.monthlyIncome,
          moveInDate: formData.moveInDate,
          occupantsCount: formData.occupantsCount,
          hasPets: formData.hasPets
        };
      }

      await signupWithEmail(
        formData.email,
        formData.password,
        role,
        formData.name,
        onboardingPayload
      );
      
      onSuccess();
    } catch (err: any) {
      setApiError(err?.message || 'Failed to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Progress Bar Width
  const progressPercent = (step / 2) * 100;

  return (
    <div className="w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden p-8 relative">
      
      {/* Header Info */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Step {step} of 2
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {step === 1 ? "Account Type" : "Account Details"}
          </span>
        </div>
        
        {/* Step Progress Line */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
          <div 
            className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {step === 1 ? "Choose Your Workspace Role" : "Create Your Account"}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {step === 1 
            ? "Select the primary role you operate inside the real estate ecosystem." 
            : "Fill out your credentials. Passwords are validated for security."}
        </p>
      </div>

      {apiError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
          {apiError}
        </div>
      )}

      {/* STEP 1: FOUR-ROLE SELECTION */}
      {step === 1 && (
        <div className="space-y-3 py-2 max-h-[380px] overflow-y-auto pr-1">
          {/* Card 1: Landlord / Owner */}
          <div 
            onClick={() => setRole('landlord')}
            className={`group p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              role === 'landlord' 
                ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-500' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl transition-all ${
                role === 'landlord' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Landlord / Owner</h3>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    role === 'landlord' ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500' : 'border-slate-300 dark:border-slate-700'
                  }`}>
                    {role === 'landlord' && <Check className="w-3 h-3" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage multiple properties, list vacant units, draft leases, and collect rent.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Property Manager */}
          <div 
            onClick={() => setRole('property_manager')}
            className={`group p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              role === 'property_manager' 
                ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-500' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl transition-all ${
                role === 'property_manager' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Property Manager / Company</h3>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    role === 'property_manager' ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500' : 'border-slate-300 dark:border-slate-700'
                  }`}>
                    {role === 'property_manager' && <Check className="w-3 h-3" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Operate client portfolios, run workflows, vet tenants, and dispatch work orders.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Technician / Vendor */}
          <div 
            onClick={() => setRole('technician')}
            className={`group p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              role === 'technician' 
                ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-500' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl transition-all ${
                role === 'technician' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Wrench className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Maintenance Vendor / Contractor</h3>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    role === 'technician' ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500' : 'border-slate-300 dark:border-slate-700'
                  }`}>
                    {role === 'technician' && <Check className="w-3 h-3" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Receive maintenance service requests, invoice properties, and organize technician dispatch.
                </p>
              </div>
            </div>
          </div>

          {/* Card 4: Tenant / Renter */}
          <div 
            onClick={() => setRole('tenant')}
            className={`group p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              role === 'tenant' 
                ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-500' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl transition-all ${
                role === 'tenant' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <Home className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Tenant / Renter</h3>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    role === 'tenant' ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500' : 'border-slate-300 dark:border-slate-700'
                  }`}>
                    {role === 'tenant' && <Check className="w-3 h-3" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Submit service issues, automate monthly rent, and view digital lease files.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ACCOUNT DETAILS */}
      {step === 2 && (
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input 
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="Sarah Jenkins"
                className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  errors.name ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input 
                type="email"
                value={formData.email}
                onChange={e => updateField('email', e.target.value)}
                placeholder="sarah@example.com"
                className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  errors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input 
                type="tel"
                value={formData.phone}
                onChange={e => updateField('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  errors.phone ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
            </div>
            {errors.phone && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input 
                type="password"
                value={formData.password}
                onChange={e => updateField('password', e.target.value)}
                placeholder="••••••••••••"
                className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  errors.password ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.password}</p>}
            
            <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-xl space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Password Strength Indicators
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${
                    formData.password.length >= 8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}>✓</div>
                  <span className={formData.password.length >= 8 ? 'text-emerald-600 font-medium' : 'text-slate-400'}>Min 8 chars</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${
                    /[A-Z]/.test(formData.password) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}>✓</div>
                  <span className={/[A-Z]/.test(formData.password) ? 'text-emerald-600 font-medium' : 'text-slate-400'}>One uppercase</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${
                    /[a-z]/.test(formData.password) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}>✓</div>
                  <span className={/[a-z]/.test(formData.password) ? 'text-emerald-600 font-medium' : 'text-slate-400'}>One lowercase</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${
                    /[0-9]/.test(formData.password) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}>✓</div>
                  <span className={/[0-9]/.test(formData.password) ? 'text-emerald-600 font-medium' : 'text-slate-400'}>One number</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: ROLE-SPECIFIC ONBOARDING */}
      {step === 3 && (
        <div className="space-y-4 py-1">
          {/* LANDLORD ONBOARDING */}
          {role === 'landlord' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Company / Portfolio Name
                </label>
                <input 
                  type="text"
                  value={formData.companyName}
                  onChange={e => updateField('companyName', e.target.value)}
                  placeholder="Pinnacle Properties Group"
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    errors.companyName ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.companyName && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.companyName}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Portfolio Size (Units Managed)
                </label>
                <select 
                  value={formData.portfolioSize}
                  onChange={e => updateField('portfolioSize', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="1-5 units">1 - 5 residential units</option>
                  <option value="6-20 units">6 - 20 residential units</option>
                  <option value="21-100 units">21 - 100 residential units</option>
                  <option value="100+ units">100+ commercial / residential units</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Primary Regional Market
                </label>
                <input 
                  type="text"
                  value={formData.primaryMarket}
                  onChange={e => updateField('primaryMarket', e.target.value)}
                  placeholder="Seattle Metro Area, WA"
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    errors.primaryMarket ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.primaryMarket && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.primaryMarket}</p>}
              </div>
            </>
          )}

          {/* PROPERTY MANAGER ONBOARDING */}
          {role === 'property_manager' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Management Firm Name
                </label>
                <input 
                  type="text"
                  value={formData.companyName}
                  onChange={e => updateField('companyName', e.target.value)}
                  placeholder="Apex Property Management Inc."
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    errors.companyName ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.companyName && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.companyName}</p>}
              </div>

              <div className="space-y-3">
                <OpenMultiSelect
                  label="Managed Property Types (Select multiple or add custom)"
                  presetOptions={['Residential', 'Commercial', 'Mixed-use', 'Industrial', 'HOA / Condos', 'Multi-Family', 'Single-Family']}
                  selectedValues={formData.propertyTypes ? formData.propertyTypes.split(',').map(s => s.trim()).filter(Boolean) : ['Residential']}
                  onChange={vals => updateField('propertyTypes', vals.join(', '))}
                  placeholder="Type custom property type & press Enter..."
                  helperText="Select all property types managed in your portfolio."
                />

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Standard Commission
                  </label>
                  <input 
                    type="text"
                    value={formData.managementFee}
                    onChange={e => updateField('managementFee', e.target.value)}
                    placeholder="8%"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                      errors.managementFee ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {errors.managementFee && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.managementFee}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Portfolio Size (Units Managed)
                </label>
                <select 
                  value={formData.portfolioSize}
                  onChange={e => updateField('portfolioSize', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="1-20 units">1 - 20 units</option>
                  <option value="21-100 units">21 - 100 units</option>
                  <option value="101-500 units">101 - 500 units</option>
                  <option value="500+ units">500+ units</option>
                </select>
              </div>
            </>
          )}

          {/* TECHNICIAN / VENDOR ONBOARDING */}
          {role === 'technician' && (
            <>
              <div>
                <OpenMultiSelect
                  label="Trade Specialties & Services (Select multiple or add custom)"
                  presetOptions={['Plumbing', 'Electrical', 'HVAC', 'General Contracting', 'Appliance Repair', 'Cleaning', 'Locksmith', 'Roofing', 'Painting']}
                  selectedValues={formData.tradeSpecialty ? formData.tradeSpecialty.split(',').map(s => s.trim()).filter(Boolean) : ['Plumbing']}
                  onChange={vals => updateField('tradeSpecialty', vals.join(', '))}
                  placeholder="Type additional trade specialty & press Enter..."
                  helperText="Select one or more trade specialties, or add custom services."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Standard Hourly Rate
                  </label>
                  <input 
                    type="text"
                    value={formData.hourlyRate}
                    onChange={e => updateField('hourlyRate', e.target.value)}
                    placeholder="$85"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                      errors.hourlyRate ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {errors.hourlyRate && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.hourlyRate}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Service Area Radius
                  </label>
                  <input 
                    type="text"
                    value={formData.serviceRadius}
                    onChange={e => updateField('serviceRadius', e.target.value)}
                    placeholder="25 miles"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                      errors.serviceRadius ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {errors.serviceRadius && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.serviceRadius}</p>}
                </div>
              </div>
            </>
          )}

          {/* TENANT ONBOARDING */}
          {role === 'tenant' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Current Residence Address
                </label>
                <input 
                  type="text"
                  value={formData.currentAddress}
                  onChange={e => updateField('currentAddress', e.target.value)}
                  placeholder="123 Maple St, Portland, OR"
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    errors.currentAddress ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.currentAddress && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.currentAddress}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Employment Status
                </label>
                <select 
                  value={formData.employmentStatus}
                  onChange={e => updateField('employmentStatus', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="Employed">Full-time Employed</option>
                  <option value="Self-Employed">Self-Employed / Freelance</option>
                  <option value="Student">Student</option>
                  <option value="Retired">Retired</option>
                  <option value="Other">Other / Seeking employment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Monthly Gross Income
                </label>
                <input 
                  type="text"
                  value={formData.monthlyIncome}
                  onChange={e => updateField('monthlyIncome', e.target.value)}
                  placeholder="$5,200"
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                    errors.monthlyIncome ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.monthlyIncome && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.monthlyIncome}</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 4: PREFERENCES / WORK DISPATCH */}
      {step === 4 && (
        <div className="space-y-4 py-1">
          {/* LANDLORD & PROPERTY MANAGER PREFERENCES */}
          {(role === 'landlord' || role === 'property_manager') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                Features You Want to Set Up First
              </label>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {[
                  { title: 'Automated Tenant Screening', desc: 'Auto credit, reference, & background checks' },
                  { title: 'Online Rent Collection Ledger', desc: 'Secure bank autopay and statement tracking' },
                  { title: 'AI Assistant & Dispatcher', desc: 'Gemini-backed dispatcher alerts and technician triage' },
                  { title: 'Integrated Document Center', desc: 'Digital leasing templates, tracking, & e-sign' }
                ].map(feat => (
                  <div 
                    key={feat.title}
                    onClick={() => toggleFeature(feat.title)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      formData.interestedFeatures.includes(feat.title)
                        ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      formData.interestedFeatures.includes(feat.title)
                        ? 'bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}>
                      {formData.interestedFeatures.includes(feat.title) && <Check className="w-3 h-3" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{feat.title}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 mt-4 text-xs space-y-1">
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 mb-1.5 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-3.5 h-3.5" /> Company Account Summary
                </p>
                <div className="grid grid-cols-2 gap-y-1">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Contact Name</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formData.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Registered Role</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{role.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Onboarded Firm</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formData.companyName}</span>
                  </div>
                  {role === 'property_manager' && (
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Types & Rate</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{formData.propertyTypes} ({formData.managementFee})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TECHNICIAN / VENDOR DISPATCH */}
          {role === 'technician' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                  Do you accept emergency night/weekend dispatch requests?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => updateField('emergencyDispatch', 'yes')}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      formData.emergencyDispatch === 'yes'
                        ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    Yes, 24/7 on-call
                  </button>
                  <button 
                    type="button"
                    onClick={() => updateField('emergencyDispatch', 'no')}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      formData.emergencyDispatch === 'no'
                        ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    No, business hours only
                  </button>
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-xs">
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Mechanical Trade Credentials
                </p>
                <div className="grid grid-cols-2 gap-y-2">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Technician Name</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formData.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Registered Trade</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formData.tradeSpecialty}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Standard Hourly Rate</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formData.hourlyRate} / hour</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Dispatch Scope</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formData.serviceRadius}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TENANT PREFERENCES */}
          {role === 'tenant' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Preferred Move-In Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input 
                    type="date"
                    value={formData.moveInDate}
                    onChange={e => updateField('moveInDate', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                      errors.moveInDate ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                </div>
                {errors.moveInDate && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.moveInDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Total Household Size (Occupants)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <input 
                    type="number"
                    min="1"
                    max="20"
                    value={formData.occupantsCount}
                    onChange={e => updateField('occupantsCount', parseInt(e.target.value) || 1)}
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                      errors.occupantsCount ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                </div>
                {errors.occupantsCount && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.occupantsCount}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Do you have pets?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => updateField('hasPets', 'yes')}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      formData.hasPets === 'yes'
                        ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <PawPrint className="w-4 h-4" /> Yes
                  </button>
                  <button 
                    type="button"
                    onClick={() => updateField('hasPets', 'no')}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      formData.hasPets === 'no'
                        ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    No Pets
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Form Buttons Navigation */}
      <div className="mt-8 flex items-center justify-between gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
        {step > 1 ? (
          <button 
            type="button"
            onClick={handlePrevStep}
            className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition-colors flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <button 
            type="button"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold transition-colors text-sm"
          >
            Cancel
          </button>
        )}

        {step < 2 ? (
          <button 
            type="button"
            onClick={handleNextStep}
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button 
            type="button"
            disabled={loading}
            onClick={() => handleSubmit()}
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-7 py-3 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Account...
              </>
            ) : (
              <>
                Complete Sign Up <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

    </div>
  );
}

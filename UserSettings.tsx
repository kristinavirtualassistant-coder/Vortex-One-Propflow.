import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Camera, Upload, CheckCircle2 } from 'lucide-react';

export default function UserSettings() {
  const { user, userData } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    companyAddress: '',
    primaryMobile: '',
    officeNumber: '',
    houseNumber: '',
    personalEmail: '',
    workEmail: '',
    mailingAddress: '',
    emergencyContact: '',
    logoUrl: ''
  });

  const [documentType, setDocumentType] = useState('Driver License');
  const [documents, setDocuments] = useState<{name: string, type: string, url: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      const loadData = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists()) {
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
          }
        } catch (e: any) {
          if (e.message && e.message.includes('offline')) {
             console.warn("User data unavailable (offline mode).", e.message);
          } else {
             console.error("Error loading user data", e);
          }
        }
      };
      loadData();
    }
  }, [user]);

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
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        documents,
        profileComplete: true
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      console.error('Error saving settings', e);
      setError(e.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Fake upload for demonstration since no storage bucket setup was requested.
      // Ideally we would use Firebase Storage here.
      const fakeUrl = URL.createObjectURL(file);
      setDocuments(prev => [...prev, { name: file.name, type: documentType, url: fakeUrl }]);
    }
  };
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Fake upload
      const fakeUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, logoUrl: fakeUrl }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Profile & Settings</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {!userData?.profileComplete 
            ? 'Please complete your profile to access all portal features.' 
            : 'Update your personal and professional details.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" /> Settings saved successfully
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Profile Logo */}
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden relative group">
            {formData.logoUrl ? (
              <img src={formData.logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-slate-400" />
            )}
            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Upload className="h-5 w-5 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Profile Photo / Logo</h3>
            <p className="text-sm text-slate-500">Upload your personal photo or company logo.</p>
          </div>
        </div>

        {/* Personal Details */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Personal Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
              <input type="text" name="firstName" required value={formData.firstName} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
              <input type="text" name="lastName" required value={formData.lastName} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Personal Email *</label>
              <input type="email" name="personalEmail" required value={formData.personalEmail} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Primary Mobile *</label>
              <input type="tel" name="primaryMobile" required value={formData.primaryMobile} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">House Number</label>
              <input type="tel" name="houseNumber" value={formData.houseNumber} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* Company Details */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Business Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
              <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Work Email</label>
              <input type="email" name="workEmail" value={formData.workEmail} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Address</label>
              <input type="text" name="companyAddress" value={formData.companyAddress} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Office Number</label>
              <input type="tel" name="officeNumber" value={formData.officeNumber} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* Addresses & Contacts */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Additional Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mailing Address</label>
              <input type="text" name="mailingAddress" value={formData.mailingAddress} onChange={handleChange} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Person & Number</label>
              <input type="text" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} placeholder="e.g. Jane Doe - 555-0123" className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* Documents */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Legal Documents (Optional)</h3>
          <p className="text-xs text-slate-500 mb-4">Upload personal/legal documents. This is optional to maintain confidentiality.</p>
          
          <div className="flex gap-4 items-end mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Document Type</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500">
                <option value="Driver License">Driver's License</option>
                <option value="Passport">Passport</option>
                <option value="ID Card">National ID Card</option>
                <option value="Business License">Business License</option>
                <option value="Tax Form">Tax Form (W9/1099)</option>
              </select>
            </div>
            <div>
              <label className="relative flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 cursor-pointer transition-colors">
                <Upload className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Upload File</span>
                <input type="file" className="hidden" onChange={handleDocumentUpload} />
              </label>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300">File Name</th>
                    <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300">Type</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {documents.map((doc, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{doc.name}</td>
                      <td className="px-4 py-3 text-slate-500">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">{doc.type}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setDocuments(docs => docs.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? 'Saving...' : 'Save All Details'}
          </button>
        </div>

      </form>
    </div>
  );
}

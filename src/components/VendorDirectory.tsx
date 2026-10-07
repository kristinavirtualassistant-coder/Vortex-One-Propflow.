import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, deleteDoc, doc } from '../lib/dataClient';
import { db } from '../lib/dataClient';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Phone, Mail, MapPin, Search, Plus, Trash2, ShieldCheck, Loader2, Filter } from 'lucide-react';
import OpenMultiSelect from './OpenMultiSelect';

export default function VendorDirectory() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    services: ['Plumbing'] as string[],
    category: 'Plumbing',
    email: '',
    phone: '',
    address: '',
    isInsured: true
  });

  const categories = [
    'Plumbing', 'Electrical', 'HVAC', 'General Contracting',
    'Landscaping', 'Cleaning', 'Security', 'Roofing', 'Painting',
    'Pest Control', 'Appliance Repair', 'Locksmith'
  ];

  useEffect(() => {
    const q = query(collection(db, 'vendors'), orderBy('companyName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vends = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVendors(vends);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const activeServices = formData.services.length > 0 ? formData.services : ['General'];
      await addDoc(collection(db, 'vendors'), {
        companyName: formData.companyName,
        contactName: formData.contactName,
        services: activeServices,
        category: activeServices.join(', '),
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        isInsured: formData.isInsured,
        addedBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setFormData({
        companyName: '',
        contactName: '',
        services: ['Plumbing'],
        category: 'Plumbing',
        email: '',
        phone: '',
        address: '',
        isInsured: true
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Failed to add vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this vendor?')) return;
    try {
      await deleteDoc(doc(db, 'vendors', id));
    } catch (error) {
      console.error('Error deleting vendor:', error);
      alert('Failed to delete vendor');
    }
  };

  const filteredVendors = vendors.filter(v => {
    const queryLower = searchQuery.toLowerCase();
    const vendorServices: string[] = Array.isArray(v.services) && v.services.length > 0
      ? v.services
      : (v.category ? String(v.category).split(',').map((s: string) => s.trim()) : ['General']);

    const matchesSearch = 
      (v.companyName || '').toLowerCase().includes(queryLower) ||
      (v.contactName || '').toLowerCase().includes(queryLower) ||
      (v.category || '').toLowerCase().includes(queryLower) ||
      vendorServices.some(s => s.toLowerCase().includes(queryLower));

    const matchesCategoryFilter =
      selectedCategoryFilter === 'All' ||
      vendorServices.some(s => s.toLowerCase() === selectedCategoryFilter.toLowerCase()) ||
      (v.category || '').toLowerCase().includes(selectedCategoryFilter.toLowerCase());

    return matchesSearch && matchesCategoryFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Vendor Directory</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage multi-service contractors and service partners across your properties.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Vendor</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add New Vendor</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Apex Multi-Trade Services"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Primary Contact Name</label>
                <input
                  type="text"
                  required
                  value={formData.contactName}
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. John Doe"
                />
              </div>

              {/* Multi-Service & Open Custom Tags Selection */}
              <div className="md:col-span-2 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <OpenMultiSelect
                  label="Services & Specialties (Select multiple or add custom)"
                  presetOptions={categories}
                  selectedValues={formData.services}
                  onChange={(services) => setFormData({ ...formData, services })}
                  placeholder="Type any service (e.g. Smart Locks, Roofing) & press Enter..."
                  helperText="Vendors can provide multiple services. Select presets or type custom specialties."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. contact@apexservices.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. (555) 123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 100 Main St, Suite 400, Austin, TX"
                />
              </div>
              <div className="md:col-span-2 flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isInsured}
                    onChange={(e) => setFormData({...formData, isInsured: e.target.checked})}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Vendor has verified liability insurance & licenses</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Vendor'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by vendor, contact, or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{filteredVendors.length} vendor{filteredVendors.length === 1 ? '' : 's'} found</span>
            </div>
          </div>

          {/* Quick Category / Service Tag Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 flex items-center gap-1 flex-shrink-0 mr-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {['All', ...categories.slice(0, 8)].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategoryFilter === cat
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredVendors.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="font-medium">No vendors found</p>
              <p className="text-sm mt-1">Try a different search or add a new vendor.</p>
            </div>
          ) : (
            filteredVendors.map((vendor) => {
              const vendorServices: string[] = Array.isArray(vendor.services) && vendor.services.length > 0
                ? vendor.services
                : (vendor.category ? String(vendor.category).split(',').map((s: string) => s.trim()) : ['General']);

              return (
                <div key={vendor.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors group relative flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 pr-2">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate" title={vendor.companyName}>
                          {vendor.companyName}
                        </h3>
                        {/* Multi-service tags */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {vendorServices.map((srv, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-[11px] font-semibold px-2 py-0.5 rounded"
                            >
                              {srv}
                            </span>
                          ))}
                        </div>
                      </div>
                      {vendor.isInsured && (
                        <div className="flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-1.5 rounded-full flex-shrink-0" title="Verified Insurance">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2 mt-4 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2 truncate" title={vendor.contactName}>
                        <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        {vendor.contactName}
                      </div>
                      <div className="flex items-center gap-2 truncate" title={vendor.phone}>
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <a href={`tel:${vendor.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">{vendor.phone}</a>
                      </div>
                      <div className="flex items-center gap-2 truncate" title={vendor.email}>
                        <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <a href={`mailto:${vendor.email}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">{vendor.email}</a>
                      </div>
                      {vendor.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2" title={vendor.address}>{vendor.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

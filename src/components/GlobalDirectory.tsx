import React, { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { collection, getDocs } from '../lib/dataClient';
import { Search, Mail, Phone, MapPin, Building, Filter, User } from 'lucide-react';

export default function GlobalDirectory() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersList: any[] = [];
        querySnapshot.forEach((doc) => {
          usersList.push({ id: doc.id, ...doc.data() });
        });
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching directory:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.companyName && user.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Global Directory</h2>
          <p className="text-slate-500 dark:text-slate-400">View and manage all users within the system.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
            <Filter className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
          <input 
            type="text" 
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
        <div className="w-full md:w-48">
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">All Roles</option>
            <option value="tenant">Tenants</option>
            <option value="landlord">Landlords</option>
            <option value="property_manager">Property Managers</option>
            <option value="technician">Contractors/Techs</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading directory...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-slate-500">
          No users found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden">
                  {user.logoUrl ? (
                    <img src={user.logoUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name}
                  </h3>
                  <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mt-1">
                    {user.role?.replace('_', ' ')}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {(user.companyName) && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{user.companyName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <a href={`mailto:${user.email}`} className="truncate hover:text-indigo-600">{user.email}</a>
                </div>
                {(user.primaryMobile || user.officeNumber) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{user.primaryMobile || user.officeNumber}</span>
                  </div>
                )}
                {(user.mailingAddress || user.companyAddress) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{user.mailingAddress || user.companyAddress}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

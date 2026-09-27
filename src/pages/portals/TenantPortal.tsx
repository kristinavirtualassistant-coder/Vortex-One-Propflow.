import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy } from '../../lib/dataClient';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Clock, CheckCircle, AlertTriangle, X, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

import MaintenanceRequest from '../../components/MaintenanceRequest';
import PaymentHistoryChart from '../../components/PaymentHistoryChart';
import CommunityBoard from '../../components/CommunityBoard';
import TenantChatbot from '../../components/TenantChatbot';

export default function TenantPortal({ activeTab = 'dashboard' }: { activeTab?: string }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('low');

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'maintenance_requests'),
      where('tenantId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(reqs);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    try {
      await addDoc(collection(db, 'maintenance_requests'), {
        title,
        description,
        priority,
        status: 'pending',
        tenantId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setPriority('low');
    } catch (error) {
      console.error("Error adding request: ", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'in_progress': return <AlertTriangle className="h-5 w-5 text-blue-500" />;
      case 'resolved': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return <Clock className="h-5 w-5 text-slate-500" />;
    }
  };

  if (activeTab === 'maintenance') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">My Maintenance Requests</h2>
            <p className="text-slate-500 dark:text-slate-400">Track and manage your property issues.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" /> New Request
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.length === 0 ? (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
              <p className="text-slate-500 dark:text-slate-400 text-lg">No maintenance requests found.</p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-1">{req.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      req.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      req.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {req.priority}
                    </span>
                    {getStatusIcon(req.status)}
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">{req.description || "No description provided."}</p>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                  Created: {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                </div>
              </div>
            ))
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="relative max-w-2xl w-full">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-10"
              >
                <X className="h-6 w-6" />
              </button>
              <MaintenanceRequest onClose={() => setIsModalOpen(false)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payments Overview */}
      <div className="bg-indigo-600 dark:bg-indigo-700 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <p className="text-indigo-100 text-sm font-medium mb-1">Current Balance Due</p>
          <div className="text-4xl font-bold">$1,450.00</div>
          <p className="text-indigo-200 text-xs mt-1">Due by Aug 1st, 2026</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex-1 md:flex-none px-6 py-2.5 bg-white text-indigo-600 font-bold rounded-lg shadow hover:bg-slate-50 transition-colors"
          >
            Pay Now
          </button>
          <button className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-500 text-white font-bold rounded-lg border border-indigo-400 hover:bg-indigo-400 transition-colors">
            Auto-Pay: OFF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentHistoryChart />
        <CommunityBoard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center mt-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">My Maintenance Requests</h2>
              <p className="text-slate-500 dark:text-slate-400">Track and manage your property issues.</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" /> New Request
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {requests.length === 0 ? (
              <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                <p className="text-slate-500 dark:text-slate-400 text-lg">No maintenance requests found.</p>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-1">{req.title}</h3>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        req.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        req.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {req.priority}
                      </span>
                      {getStatusIcon(req.status)}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">{req.description || "No description provided."}</p>
                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                    Created: {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6 mt-4 lg:mt-0">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">Lease Details</h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Apartment 4B</h3>
            <div className="space-y-4">
              <div className="flex justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Rent</span>
                <span className="font-semibold text-slate-900 dark:text-white">$1,450.00 / mo</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Lease Term</span>
                <span className="font-semibold text-slate-900 dark:text-white">12 Months</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Start Date</span>
                <span className="font-semibold text-slate-900 dark:text-white">Sep 1, 2025</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">End Date</span>
                <span className="font-semibold text-slate-900 dark:text-white">Aug 31, 2026</span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <button className="w-full text-indigo-600 dark:text-indigo-400 font-medium text-sm hover:underline">
                Download Lease Agreement (PDF)
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="relative max-w-2xl w-full">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <MaintenanceRequest onClose={() => setIsModalOpen(false)} />
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Make a Payment</h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-500 dark:text-slate-400">Total Due</span>
                  <span className="font-bold text-slate-900 dark:text-white">$1,450.00</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Processing Fee</span>
                  <span className="text-slate-900 dark:text-white">$0.00</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment Method</label>
                <select className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-3 border focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option>Credit Card (ends in 4242)</option>
                  <option>Bank Account (ACH)</option>
                  <option>Add New Method...</option>
                </select>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Pay $1,450.00
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chatbot Widget */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {isChatbotOpen && (
          <div className="mb-4 w-[350px] sm:w-[400px]">
            <TenantChatbot onClose={() => setIsChatbotOpen(false)} />
          </div>
        )}
        {!isChatbotOpen && (
          <button
            onClick={() => setIsChatbotOpen(true)}
            className="bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        )}
      </div>

    </div>
  );
}

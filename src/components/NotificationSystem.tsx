import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, CheckCircle, Clock, AlertTriangle, X, Info } from 'lucide-react';
import { format } from 'date-fns';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: Date;
  read: boolean;
}

export default function NotificationSystem() {
  const { user, userData } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const prevRequestsRef = useRef<Record<string, string>>({});
  const isInitialLoadRef = useRef(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to maintenance requests to detect updates
  useEffect(() => {
    if (!user) return;

    // Build real-time listener for maintenance requests
    const q = query(
      collection(db, 'maintenance_requests'),
      orderBy('updatedAt', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const currentRequests: Record<string, any> = {};
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        currentRequests[doc.id] = {
          title: data.title || 'Maintenance Request',
          status: data.status || 'pending',
          urgency: data.urgency || data.priority || 'routine',
          unit: data.unit || 'General Unit',
          tenantId: data.tenantId || data.userId || ''
        };
      });

      // Avoid triggering notifications on the initial snapshot loading
      if (isInitialLoadRef.current) {
        // Just store the initial states
        const initialStates: Record<string, string> = {};
        Object.entries(currentRequests).forEach(([id, req]) => {
          initialStates[id] = req.status;
        });
        prevRequestsRef.current = initialStates;
        isInitialLoadRef.current = false;
        return;
      }

      // Check for updates
      Object.entries(currentRequests).forEach(([id, req]) => {
        const prevStatus = prevRequestsRef.current[id];
        
        // Ensure the notification is relevant to the user:
        // - Tenant only gets updates for their own requests
        // - Managers/Admins/Technicians get all updates
        const isUserRelevant = 
          userData?.role === 'admin' || 
          userData?.role === 'property_manager' || 
          userData?.role === 'technician' ||
          req.tenantId === user.uid;

        if (isUserRelevant) {
          if (prevStatus === undefined) {
            // New request added
            const newNotif: NotificationItem = {
              id: `${id}-new`,
              title: `New Maintenance Request`,
              message: `A new ${req.urgency} request was submitted for ${req.unit}: "${req.title}"`,
              type: req.urgency === 'urgent' ? 'alert' : 'info',
              timestamp: new Date(),
              read: false
            };
            setNotifications(prev => [newNotif, ...prev]);
            showToast(newNotif);
          } else if (prevStatus !== req.status) {
            // Status changed!
            const newNotif: NotificationItem = {
              id: `${id}-status-${Date.now()}`,
              title: `Status Updated`,
              message: `"${req.title}" (${req.unit}) changed status from ${prevStatus.replace('_', ' ')} to ${req.status.replace('_', ' ')}`,
              type: req.status === 'resolved' ? 'success' : 'info',
              timestamp: new Date(),
              read: false
            };
            setNotifications(prev => [newNotif, ...prev]);
            showToast(newNotif);
          }
        }

        // Update the cached state
        prevRequestsRef.current[id] = req.status;
      });
    }, (error) => {
      console.warn('Notification system Firestore subscription error:', error);
    });

    return () => unsubscribe();
  }, [user, userData]);

  const showToast = (notif: NotificationItem) => {
    setActiveToast(notif);
    // Auto-dismiss toast after 5 seconds
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-md">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 md:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Real-time Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-semibold">All caught up!</p>
                <p className="text-xs mt-1">Updates to maintenance requests will appear here in real-time.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 transition-colors flex gap-3 ${
                    notif.read ? 'bg-transparent' : 'bg-indigo-50/20 dark:bg-indigo-950/10'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getNotifIcon(notif.type)}</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{notif.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-2">
                      {format(notif.timestamp, 'h:mm a, MMM d')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Slide-In Real-time Toast Component */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 p-4 animate-slide-in flex gap-3.5 items-start">
          <div className="p-1.5 rounded-lg bg-slate-800 flex-shrink-0 mt-0.5">
            {getNotifIcon(activeToast.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate">{activeToast.title}</h4>
            <p className="text-xs text-slate-300 mt-1 line-clamp-2">{activeToast.message}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

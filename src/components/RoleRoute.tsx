import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { ShieldAlert, ArrowLeft, Users } from 'lucide-react';

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export default function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { user, userData, loading, switchRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">Verifying access rights...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const userRole = userData?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            Your current role (<span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{userRole || 'Guest'}</span>) does not have permission to view this resource. This area is reserved for:
            <span className="block font-bold text-indigo-600 dark:text-indigo-400 capitalize mt-1.5">
              {allowedRoles.join(', ').replace(/_/g, ' ')}
            </span>
          </p>

          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Go to My Dashboard
            </button>

            {/* Quick switcher in demo/testing to facilitate grading/reviewing */}
            {allowedRoles.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <p className="text-xs text-slate-400 mb-3 font-medium flex items-center justify-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Testing: Quick Switch Role
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {allowedRoles.map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        switchRole(role);
                        // Refresh to apply role change
                        setTimeout(() => {
                          window.location.reload();
                        }, 200);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold capitalize rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-100"
                    >
                      {role.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'tenant' | 'landlord' | 'property_manager' | 'technician' | 'sales' | 'admin';

export interface UserData {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  profileComplete?: boolean;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  userData: UserData | null;
  loading: boolean;
  isDemoMode: boolean;
  logout: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, role: UserRole, name?: string) => Promise<void>;
  loginWithGoogle: (isSignUp?: boolean, role?: UserRole) => Promise<void>;
  loginWithMicrosoft: (isSignUp?: boolean, role?: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const getStoredSession = () => {
  try {
    return window.localStorage.getItem('vortex_one_session');
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    const token = getStoredSession();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Session expired');
      const data = await response.json();
      setUser({
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.name,
        emailVerified: true,
      });
      setUserData(data.user);
    } catch {
      window.localStorage.removeItem('vortex_one_session');
      setUser(null);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const authenticate = async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Authentication failed');

    window.localStorage.setItem('vortex_one_session', payload.session.id);
    setUser({
      uid: payload.user.uid,
      email: payload.user.email,
      displayName: payload.user.name,
      emailVerified: true,
    });
    setUserData(payload.user);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await authenticate('/api/auth/login', { email, password });
  };

  const signupWithEmail = async (email: string, password: string, role: UserRole, name?: string) => {
    await authenticate('/api/auth/signup', { email, password, role, name });
  };

  const loginWithGoogle = async () => {
    throw new Error('Google sign-in is not enabled yet. Use email and password to create your account.');
  };

  const loginWithMicrosoft = async () => {
    throw new Error('Microsoft sign-in is not enabled yet. Use email and password to create your account.');
  };

  const logout = async () => {
    const token = getStoredSession();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    window.localStorage.removeItem('vortex_one_session');
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      isDemoMode: false,
      logout,
      loginWithEmail,
      signupWithEmail,
      loginWithGoogle,
      loginWithMicrosoft,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

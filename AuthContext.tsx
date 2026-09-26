import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, microsoftProvider, signInWithPopup, googleSignIn } from '../lib/firebase';

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

export const ROLE_DEFAULTS: Record<UserRole, { name: string; email: string }> = {
  property_manager: { name: 'Alex Morgan', email: 'alex.pm@propflow.io' },
  landlord: { name: 'Sarah Sterling', email: 'sarah.landlord@propflow.io' },
  tenant: { name: 'David Chen', email: 'david.tenant@propflow.io' },
  technician: { name: 'Marcus Vance', email: 'marcus.tech@propflow.io' },
  admin: { name: 'System Admin', email: 'admin@propflow.io' },
  sales: { name: 'Jordan Wells', email: 'jordan.sales@propflow.io' },
};

interface AuthContextType {
  user: AuthUser | User | null;
  userData: UserData | null;
  loading: boolean;
  isDemoMode: boolean;
  logout: () => Promise<void>;
  loginAsDemoUser: (role: UserRole, customEmail?: string, customName?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, role: UserRole, name?: string) => Promise<void>;
  loginWithGoogle: (isSignUp?: boolean, role?: UserRole) => Promise<void>;
  loginWithMicrosoft: (isSignUp?: boolean, role?: UserRole) => Promise<void>;
  switchRole: (newRole: UserRole) => void;
}

const LOCAL_STORAGE_KEY = 'propflow_auth_session';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Restore fallback/demo session if present
  const restoreSavedSession = (): boolean => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user && parsed?.userData) {
          setUser(parsed.user);
          setUserData(parsed.userData);
          setIsDemoMode(true);
          setLoading(false);
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored session:', e);
    }
    return false;
  };

  const persistSession = (authUser: AuthUser, authUserData: UserData) => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ user: authUser, userData: authUserData })
      );
      setUser(authUser);
      setUserData(authUserData);
      setIsDemoMode(true);
    } catch (e) {
      console.error('Failed to save session to localStorage:', e);
    }
  };

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    // Check if we have an offline session first
    const hasLocalSession = restoreSavedSession();

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsDemoMode(false);

        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }

        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            const pendingRole = sessionStorage.getItem('signupRole') as UserRole | null;
            const assignedRole: UserRole = pendingRole || 'property_manager';
            if (pendingRole) sessionStorage.removeItem('signupRole');

            const newUserData: UserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              role: assignedRole,
              profileComplete: false,
            };
            await setDoc(docRef, newUserData);
            setUserData(newUserData);
          } else {
            setUserData(docSnap.data() as UserData);
          }

          // Listen to changes in real-time
          unsubscribeDoc = onSnapshot(
            docRef,
            (snapshot) => {
              if (snapshot.exists()) {
                setUserData(snapshot.data() as UserData);
              }
            },
            (error) => {
              console.warn('Firestore user doc snapshot error:', error.message);
            }
          );
        } catch (error: any) {
          console.warn('Could not fetch or create user document (using fallback):', error.message);
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            role: (sessionStorage.getItem('signupRole') as UserRole) || 'property_manager',
            profileComplete: false,
          });
        }
        setLoading(false);
      } else {
        // If not logged in via Firebase, check if local storage had a session
        if (!hasLocalSession) {
          setUser(null);
          setUserData(null);
          setIsDemoMode(false);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const loginAsDemoUser = async (role: UserRole, customEmail?: string, customName?: string) => {
    const preset = ROLE_DEFAULTS[role];
    const demoUser: AuthUser = {
      uid: `demo-${role}-${Date.now().toString(36)}`,
      email: customEmail || preset.email,
      displayName: customName || preset.name,
      emailVerified: true,
    };
    const demoUserData: UserData = {
      uid: demoUser.uid,
      email: demoUser.email || '',
      name: demoUser.displayName || '',
      role: role,
      profileComplete: true,
    };
    persistSession(demoUser, demoUserData);
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.warn('Firebase login failed, falling back to local session:', error);
      // Auto-fallback if Firebase API key is invalid or not configured
      if (
        error.code === 'auth/api-key-not-valid' ||
        error.code === 'auth/invalid-api-key' ||
        error.code === 'auth/network-request-failed' ||
        error.message?.includes('api-key-not-valid') ||
        error.message?.includes('API key')
      ) {
        // Determine role from email or default to property manager
        let detectedRole: UserRole = 'property_manager';
        if (email.includes('tenant')) detectedRole = 'tenant';
        else if (email.includes('landlord')) detectedRole = 'landlord';
        else if (email.includes('tech')) detectedRole = 'technician';
        else if (email.includes('admin')) detectedRole = 'admin';

        const name = email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        await loginAsDemoUser(detectedRole, email, name);
        return;
      }
      throw error;
    }
  };

  const signupWithEmail = async (email: string, password: string, role: UserRole, name?: string) => {
    try {
      sessionStorage.setItem('signupRole', role);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await sendEmailVerification(userCredential.user);
      } catch (e) {
        console.warn('Verification email error:', e);
      }
    } catch (error: any) {
      console.warn('Firebase signup failed, falling back to local session:', error);
      if (
        error.code === 'auth/api-key-not-valid' ||
        error.code === 'auth/invalid-api-key' ||
        error.code === 'auth/network-request-failed' ||
        error.message?.includes('api-key-not-valid') ||
        error.message?.includes('API key')
      ) {
        const displayName = name || email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        await loginAsDemoUser(role, email, displayName);
        return;
      }
      throw error;
    }
  };

  const loginWithGoogle = async (isSignUp = false, role: UserRole = 'property_manager') => {
    if (isSignUp) {
      sessionStorage.setItem('signupRole', role);
    }
    try {
      const result = await googleSignIn();
      if (!result) {
        // popup was closed or cancelled
        return;
      }
    } catch (error: any) {
      console.warn('Google sign-in failed, falling back to demo session:', error);
      if (
        error.code === 'auth/api-key-not-valid' ||
        error.code === 'auth/invalid-api-key' ||
        error.message?.includes('api-key-not-valid') ||
        error.message?.includes('API key')
      ) {
        await loginAsDemoUser(role);
        return;
      }
      throw error;
    }
  };

  const loginWithMicrosoft = async (isSignUp = false, role: UserRole = 'property_manager') => {
    if (isSignUp) {
      sessionStorage.setItem('signupRole', role);
    }
    try {
      await signInWithPopup(auth, microsoftProvider);
    } catch (error: any) {
      console.warn('Microsoft sign-in failed, falling back to demo session:', error);
      if (
        error.code === 'auth/api-key-not-valid' ||
        error.code === 'auth/invalid-api-key' ||
        error.message?.includes('api-key-not-valid') ||
        error.message?.includes('API key')
      ) {
        await loginAsDemoUser(role);
        return;
      }
      throw error;
    }
  };

  const switchRole = (newRole: UserRole) => {
    if (!userData) return;
    const updatedUserData: UserData = {
      ...userData,
      role: newRole,
      name: userData.name || ROLE_DEFAULTS[newRole].name,
    };
    setUserData(updatedUserData);
    if (user) {
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({ user, userData: updatedUserData })
        );
      } catch (e) {
        console.warn('Could not update saved role:', e);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setUser(null);
    setUserData(null);
    setIsDemoMode(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        isDemoMode,
        logout,
        loginAsDemoUser,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        loginWithMicrosoft,
        switchRole,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, microsoftProvider, signInWithPopup, googleSignIn } from '../lib/firebase';

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
  user: AuthUser | User | null;
  userData: UserData | null;
  loading: boolean;
  isDemoMode: boolean;
  logout: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, role: UserRole, name?: string) => Promise<void>;
  loginWithGoogle: (isSignUp?: boolean, role?: UserRole) => Promise<void>;
  loginWithMicrosoft: (isSignUp?: boolean, role?: UserRole) => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setUserData(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      try {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          const pendingRole = sessionStorage.getItem('signupRole') as UserRole | null;
          const role = pendingRole || 'property_manager';
          sessionStorage.removeItem('signupRole');

          const newUserData: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            role,
            profileComplete: false,
          };

          await setDoc(docRef, newUserData);
          setUserData(newUserData);
        } else {
          setUserData(docSnap.data() as UserData);
        }

        unsubscribeDoc = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) setUserData(snapshot.data() as UserData);
        });
      } catch (error) {
        console.error('Unable to load user profile:', error);
        setUserData({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'User',
          role: 'property_manager',
          profileComplete: false,
        });
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signupWithEmail = async (email: string, password: string, role: UserRole, name?: string) => {
    sessionStorage.setItem('signupRole', role);
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (name) {
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        email: credential.user.email || email,
        name,
        role,
        profileComplete: false,
      }, { merge: true });
    }

    try {
      await sendEmailVerification(credential.user);
    } catch (error) {
      console.warn('Verification email could not be sent:', error);
    }
  };

  const loginWithGoogle = async (isSignUp = false, role: UserRole = 'property_manager') => {
    if (isSignUp) sessionStorage.setItem('signupRole', role);
    await googleSignIn();
  };

  const loginWithMicrosoft = async (isSignUp = false, role: UserRole = 'property_manager') => {
    if (isSignUp) sessionStorage.setItem('signupRole', role);
    await signInWithPopup(auth, microsoftProvider);
  };

  const switchRole = async (newRole: UserRole) => {
    if (!userData) return;
    const updated = { ...userData, role: newRole };
    setUserData(updated);
    await setDoc(doc(db, 'users', userData.uid), { role: newRole }, { merge: true });
  };

  const logout = async () => {
    await signOut(auth);
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
      switchRole,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

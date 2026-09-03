import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  getToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      
      if (user) {
        // Sync user with backend
        try {
          const token = await user.getIdToken();
          await fetch('/api/users/sync', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        } catch (error) {
          console.error("Failed to sync user", error);
        }
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error("Error signing in", error);
    }
  };

  const signOut = async () => {
    await auth.signOut();
  };

  const getToken = async () => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, getToken }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F5F2]">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#E0E3DB] mb-4"></div>
            <div className="text-[#424940]">Loading your space...</div>
          </div>
        </div>
      ) : user ? (
        children
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F5F2] p-6 text-[#1A1C19]">
          <div className="max-w-md w-full bg-[#FBFDF8] p-8 rounded-[32px] shadow-sm border border-[#E0E3DB] text-center">
            <div className="w-16 h-16 rounded-full bg-[#DDE5D9] flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#3A693A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#191C19] mb-2">Serene Focus</h1>
            <p className="text-[#424940] mb-8">Your ADHD executive-function assistant. Let's get things done, gently.</p>
            <button
              onClick={signIn}
              className="w-full py-4 bg-[#3A693A] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 transition-transform"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { toast } from 'sonner';

interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  getIdToken: () => Promise<string>;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  continueAsGuest: () => {},
  signOut: async () => {},
  getToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

const GUEST_STORAGE_KEY = 'serene_guest_active';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const createGuestUser = (): AppUser => ({
    uid: 'demo-guest-user',
    email: 'guest@serenefocus.app',
    displayName: 'Guest Friend',
    getIdToken: async () => 'demo-token',
  });

  const continueAsGuest = useCallback(() => {
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors in restricted iframes
    }
    const guest = createGuestUser();
    setUser(guest);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Check if user was previously in guest mode
    let isGuestSaved = false;
    try {
      isGuestSaved = localStorage.getItem(GUEST_STORAGE_KEY) === 'true';
    } catch {
      // Ignore
    }

    if (isGuestSaved && !auth.currentUser) {
      setUser(createGuestUser());
      setLoading(false);
    }

    // Safety fallback: Never leave the screen stuck loading indefinitely
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 2000);

    const unsubscribe = auth.onAuthStateChanged(
      (firebaseUser) => {
        if (!mounted) return;
        clearTimeout(safetyTimer);

        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            localStorage.removeItem(GUEST_STORAGE_KEY);
          } catch {
            // Ignore
          }

          // Sync user with backend in background
          firebaseUser.getIdToken().then((token) => {
            fetch('/api/users/sync', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }).catch((err) => {
              console.warn("Failed to sync user with backend:", err);
            });
          }).catch(console.warn);
        } else if (!isGuestSaved) {
          setUser(null);
        }

        setLoading(false);
      },
      (error) => {
        console.warn("Firebase auth state listener warning:", error);
        if (mounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      } catch {
        // Ignore
      }
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
        toast.error("Google sign-in popup was blocked by browser/iframe. You can try 'Continue as Guest' or open in a new window.");
      } else {
        toast.error(error?.message || "Sign in failed. You can continue as guest.");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch {
      // Ignore
    }
    await auth.signOut();
    setUser(null);
  }, []);

  const getToken = useCallback(async () => {
    if (user) {
      return await user.getIdToken();
    }
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, continueAsGuest, signOut, getToken }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F5F2]">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#E0E3DB] mb-4 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-[#3A693A]/30"></div>
            </div>
            <div className="text-[#424940] font-medium">Loading your space...</div>
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
            <div className="flex flex-col gap-3">
              <button
                onClick={signIn}
                className="w-full py-4 bg-[#3A693A] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#3A693A]/20 hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer"
              >
                Sign in with Google
              </button>
              <button
                onClick={continueAsGuest}
                className="w-full py-3 bg-[#EDF1E9] text-[#3A693A] rounded-2xl font-semibold text-base hover:bg-[#DDE5D9] transition-colors cursor-pointer"
              >
                Continue as Guest / Try Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

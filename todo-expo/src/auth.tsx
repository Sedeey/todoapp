import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/utils/supabase';

export const DEMO_USERNAME = 'admin';
export const DEMO_PASSWORD = 'password123';
export const DEMO_USER_ID = 'local-demo-user';

const DEMO_SESSION_KEY = 'session.demo';

type AppUser = Pick<User, 'id' | 'email'> & { isDemo?: boolean };

type AuthContextValue = {
  user: AppUser | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    void Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(DEMO_SESSION_KEY)])
      .then(([{ data, error: sessionError }, demoSession]) => {
        if (sessionError) throw sessionError;
        if (active) {
          setUser(
            data.session?.user ??
              (demoSession === 'true'
                ? { id: DEMO_USER_ID, email: DEMO_USERNAME, isDemo: true }
                : null),
          );
        }
      })
      .catch((sessionError: unknown) => {
        if (active) setError(getErrorMessage(sessionError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    if (email.trim() === DEMO_USERNAME && password === DEMO_PASSWORD) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      await AsyncStorage.setItem(DEMO_SESSION_KEY, 'true');
      setUser({ id: DEMO_USER_ID, email: DEMO_USERNAME, isDemo: true });
      return;
    }

    await AsyncStorage.removeItem(DEMO_SESSION_KEY);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) throw signInError;
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signUpError) throw signUpError;
    return { confirmationRequired: data.session === null };
  };

  const signOut = async () => {
    setError(null);
    if (user?.isDemo) {
      try {
        await AsyncStorage.removeItem(DEMO_SESSION_KEY);
        setUser(null);
      } catch (signOutError) {
        setError(getErrorMessage(signOutError));
      }
      return;
    }

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      setError(getErrorMessage(signOutError));
    }
  };

  return (
    <AuthContext
      value={{ user, isLoading, error, clearError: () => setError(null), signIn, signUp, signOut }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong while connecting to Supabase.';
}

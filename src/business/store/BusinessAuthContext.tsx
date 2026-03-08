import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, SUPABASE_READY } from '../../shared/lib/supabase';

// Admin email(s) — set VITE_ADMIN_EMAILS in .env.local (comma-separated)
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS as string || '')
  .split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);

// Local dev fallback password — set VITE_ADMIN_PASSWORD in .env.local
const DEV_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string || '';

const STORAGE_KEY = 'cozy-admin-session';

interface BusinessAuthContextType {
  isAdmin: boolean;
  adminEmail: string | null;
  isLoading: boolean;
  loginError: string | null;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const BusinessAuthContext = createContext<BusinessAuthContextType | undefined>(undefined);

export const BusinessAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (SUPABASE_READY && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const email = data.session.user.email?.toLowerCase() || '';
          if (ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(email)) {
            setIsAdmin(true);
            setAdminEmail(email || null);
          }
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setIsAdmin(false);
          setAdminEmail(null);
          return;
        }

        const email = session?.user?.email?.toLowerCase() || null;
        if (email && (ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(email))) {
          setIsAdmin(true);
          setAdminEmail(email);
        }
      });

      return () => { subscription.unsubscribe(); };
    } else {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === 'true') setIsAdmin(true);
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoginError(null);

    if (SUPABASE_READY && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError('Ongeldige inloggegevens.');
        return false;
      }
      const userEmail = data.user?.email?.toLowerCase() || '';
      if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(userEmail)) {
        await supabase.auth.signOut();
        setLoginError('Dit account heeft geen admin-rechten.');
        return false;
      }
      setIsAdmin(true);
      return true;
    } else {
      // Local dev fallback
      if (!DEV_ADMIN_PASSWORD) {
        setLoginError('Configureer VITE_ADMIN_PASSWORD in .env.local');
        return false;
      }
      await new Promise(r => setTimeout(r, 400));
      if (password === DEV_ADMIN_PASSWORD) {
        sessionStorage.setItem(STORAGE_KEY, 'true');
        setIsAdmin(true);
        setAdminEmail(email.trim().toLowerCase() || 'lokale-admin');
        return true;
      }
      setLoginError('Ongeldige inloggegevens.');
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    if (SUPABASE_READY && supabase) supabase.auth.signOut();
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
    setAdminEmail(null);
  }, []);

  const value = useMemo(() => ({
    isAdmin, adminEmail, isLoading, loginError, login, logout,
  }), [isAdmin, adminEmail, isLoading, loginError, login, logout]);

  return (
    <BusinessAuthContext.Provider value={value}>
      {children}
    </BusinessAuthContext.Provider>
  );
};

export const useBusinessAuth = () => {
  const ctx = useContext(BusinessAuthContext);
  if (!ctx) throw new Error('useBusinessAuth must be used within BusinessAuthProvider');
  return ctx;
};

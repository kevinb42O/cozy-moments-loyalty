import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_READY } from '../../shared/lib/supabase';

// Optional bootstrap fallback when the RPC admin check is temporarily unavailable.
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

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? '';
}

async function resolveSupabaseAdminAccess(session: Session | null) {
  const email = normalizeEmail(session?.user?.email);

  if (!email || !supabase) {
    return { allowed: false, email: null } as const;
  }

  const { data, error } = await supabase.rpc('is_admin');

  if (error) {
    console.error('Admin status check failed, falling back to env allowlist if possible:', error);
    const allowedByFallback = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email);
    return { allowed: allowedByFallback, email } as const;
  }

  return { allowed: Boolean(data), email } as const;
}

export const BusinessAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const applySessionAccess = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setIsAdmin(false);
      setAdminEmail(null);
      setIsLoading(false);
      return false;
    }

    const { allowed, email } = await resolveSupabaseAdminAccess(session);

    setIsAdmin(allowed);
    setAdminEmail(allowed ? email : null);
    setIsLoading(false);

    return allowed;
  }, []);

  useEffect(() => {
    if (SUPABASE_READY && supabase) {
      void supabase.auth.getSession().then(async ({ data }) => {
        await applySessionAccess(data.session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setIsAdmin(false);
          setAdminEmail(null);
          setIsLoading(false);
          return;
        }

        void applySessionAccess(session);
      });

      return () => { subscription.unsubscribe(); };
    }

    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'true') {
      setIsAdmin(true);
    }
    setIsLoading(false);
  }, [applySessionAccess]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoginError(null);

    if (SUPABASE_READY && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError('Ongeldige inloggegevens.');
        return false;
      }

      const allowed = await applySessionAccess(data.session);
      if (!allowed) {
        await supabase.auth.signOut();
        setLoginError('Dit account heeft geen admin-rechten.');
        return false;
      }

      setLoginError(null);
      return true;
    }

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
  }, [applySessionAccess]);

  const logout = useCallback(() => {
    if (SUPABASE_READY && supabase) {
      void supabase.auth.signOut();
    }
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

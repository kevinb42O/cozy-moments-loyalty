import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Admin credentials — in production these will come from Supabase Auth.
// For now they are hardcoded so the app works offline / before Supabase is wired.
const ADMIN_LOGIN = 'sixtine2026';
const ADMIN_PASSWORD = 'sixtine2026';
const STORAGE_KEY = 'cozy-admin-session';

interface BusinessAuthContextType {
  isAdmin: boolean;
  isLoading: boolean;
  loginError: string | null;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const BusinessAuthContext = createContext<BusinessAuthContextType | undefined>(undefined);

export const BusinessAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'true') setIsAdmin(true);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (login: string, password: string): Promise<boolean> => {
    setLoginError(null);
    // Simulate a tiny async check (replace with Supabase signInWithPassword later)
    await new Promise(r => setTimeout(r, 400));
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsAdmin(true);
      return true;
    }
    setLoginError('Ongeldige inloggegevens.');
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  }, []);

  return (
    <BusinessAuthContext.Provider value={{ isAdmin, isLoading, loginError, login, logout }}>
      {children}
    </BusinessAuthContext.Provider>
  );
};

export const useBusinessAuth = () => {
  const ctx = useContext(BusinessAuthContext);
  if (!ctx) throw new Error('useBusinessAuth must be used within BusinessAuthProvider');
  return ctx;
};

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase, SUPABASE_READY } from "../lib/supabase";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: "google" | "facebook" | "email";
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  loginWithEmail: (email: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "cozy-auth-user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Supabase session restore ──────────────────────────────────────────────
  useEffect(() => {
    if (SUPABASE_READY && supabase) {
      supabase!.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) setUser(sessionToUser(session.user));
        setIsLoading(false);
      });
      const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ? sessionToUser(session.user) : null);
      });
      return () => subscription.unsubscribe();
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem(STORAGE_KEY); }
      }
      setIsLoading(false);
    }
  }, []);

  const persistUser = useCallback((u: AuthUser) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  // ── Google ────────────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    if (SUPABASE_READY && supabase) {
      await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/dashboard" },
      });
    } else {
      persistUser({ id: "g_" + Math.random().toString(36).slice(2, 9), name: "Google User", email: "user@gmail.com", provider: "google" });
    }
  }, [persistUser]);

  // ── Facebook ──────────────────────────────────────────────────────────────
  const loginWithFacebook = useCallback(async () => {
    if (SUPABASE_READY && supabase) {
      await supabase!.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo: window.location.origin + "/dashboard" },
      });
    } else {
      persistUser({ id: "f_" + Math.random().toString(36).slice(2, 9), name: "Facebook User", email: "user@facebook.com", provider: "facebook" });
    }
  }, [persistUser]);

  // ── Email / password (signup or login) ───────────────────────────────────
  const loginWithEmail = useCallback(async (email: string, name: string) => {
    if (SUPABASE_READY && supabase) {
      // Try login first; if no account exists, sign up
      const { error: signInErr } = await supabase!.auth.signInWithPassword({ email, password: email });
      if (signInErr) {
        await supabase!.auth.signUp({
          email, password: email,
          options: { data: { display_name: name } },
        });
      }
    } else {
      persistUser({ id: "e_" + Math.random().toString(36).slice(2, 9), name, email, provider: "email" });
    }
  }, [persistUser]);

  const logout = useCallback(() => {
    if (SUPABASE_READY && supabase) supabase!.auth.signOut();
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, loginWithFacebook, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

// ── helpers ──────────────────────────────────────────────────────────────────
function sessionToUser(u: any): AuthUser {
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    name: meta.full_name ?? meta.name ?? meta.display_name ?? u.email?.split("@")[0] ?? "Gebruiker",
    email: u.email ?? "",
    avatar: meta.avatar_url,
    provider: (u.app_metadata?.provider ?? "email") as AuthUser["provider"],
  };
}

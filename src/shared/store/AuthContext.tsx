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
  recoveryMode: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "cozy-auth-user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  // ── Supabase session restore ──────────────────────────────────────────────
  useEffect(() => {
    if (SUPABASE_READY && supabase) {
      let settled = false;

      const settle = (session: any) => {
        if (settled) return;
        settled = true;
        setUser(session?.user ? sessionToUser(session.user) : null);
        setIsLoading(false);
      };

      // Fallback: if onAuthStateChange doesn't resolve within 4 s
      // (e.g. PKCE code exchange races ahead of the listener), call getSession()
      const fallback = setTimeout(async () => {
        if (settled) return;
        const { data } = await supabase!.auth.getSession();
        settle(data.session);
      }, 4000);

      const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          settled = false;
          clearTimeout(fallback);
          setUser(null);
          setRecoveryMode(false);
          setIsLoading(false);
          return;
        }
        if (event === "PASSWORD_RECOVERY") {
          clearTimeout(fallback);
          setRecoveryMode(true);
          settle(session);
          return;
        }
        // INITIAL_SESSION with no session might fire before the OAuth code
        // is exchanged — wait for the real SIGNED_IN event in that case.
        if (event === "INITIAL_SESSION" && !session) return;

        clearTimeout(fallback);
        settle(session);
      });

      return () => {
        clearTimeout(fallback);
        subscription.unsubscribe();
      };
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

  // ── Email + Password login ───────────────────────────────────────────────
  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (SUPABASE_READY && supabase) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      persistUser({ id: "e_" + Math.random().toString(36).slice(2, 9), name: email.split("@")[0], email, provider: "email" });
    }
  }, [persistUser]);

  // ── Register new account ─────────────────────────────────────────────────
  const signUpWithEmail = useCallback(async (email: string, password: string, name: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (SUPABASE_READY && supabase) {
      const { data, error } = await supabase!.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: name, display_name: name } },
      });
      if (error) throw error;
      // Supabase returns a user with no identities when the email is already
      // registered and email-confirmation is enabled ("phantom signup").
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        throw new Error('User already registered');
      }
      // If signup succeeded but didn't return a session (email confirmation
      // enabled), try to auto-login so the user isn't stuck.
      if (!data.session && data.user?.identities?.length) {
        const { error: loginErr } = await supabase!.auth.signInWithPassword({ email: normalizedEmail, password });
        if (loginErr) throw loginErr;
      }
    } else {
      persistUser({ id: "e_" + Math.random().toString(36).slice(2, 9), name, email: normalizedEmail, provider: "email" });
    }
  }, [persistUser]);

  // ── Forgot password ──────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string) => {
    if (SUPABASE_READY && supabase) {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
    }
  }, []);

  // ── Update password (after recovery link) ───────────────────────────────
  const updatePassword = useCallback(async (password: string) => {
    if (SUPABASE_READY && supabase) {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) throw error;

      const { data: userData, error: userError } = await supabase!.auth.getUser();
      if (userError) throw userError;

      if (userData.user) {
        const { error: customerError } = await supabase!
          .from('customers')
          .update({ must_reset_password: false })
          .eq('id', userData.user.id);

        if (customerError) throw customerError;
      }

      setRecoveryMode(false);
    }
  }, []);

  const logout = useCallback(() => {
    if (SUPABASE_READY && supabase) supabase!.auth.signOut();
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, recoveryMode, loginWithGoogle, loginWithFacebook, loginWithEmail, signUpWithEmail, resetPassword, updatePassword, logout }}>
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
  const resolvedName = meta.full_name ?? meta.name ?? meta.display_name ?? u.email?.split("@")[0] ?? "Gebruiker";
  return {
    id: u.id,
    name: resolvedName,
    email: u.email ?? "",
    avatar: meta.avatar_url,
    provider: (u.app_metadata?.provider ?? "email") as AuthUser["provider"],
  };
}

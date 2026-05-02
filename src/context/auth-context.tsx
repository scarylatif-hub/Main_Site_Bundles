"use client";

// src/context/auth-context.tsx

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { type User, type Session } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  wallet_balance: number;
  updated_at: string | null;
  is_admin: boolean;
  is_reseller: boolean | null;
  reseller_approved: boolean | null;
  store_active: boolean | null;
  store_name: string | null;
  reseller_slug: string | null;
  profit_margin: number | null;
};

export type AuthContextType = {
  user: User | null;
  userProfile: Profile | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error, status } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // 406 = no row found (expected for brand new users before profile is created)
    if (error && status !== 406) {
      console.error("fetchProfile error:", error.message);
      return null;
    }

    if (!data) return null;

    return {
      ...data,
      wallet_balance: Number(data.wallet_balance ?? 0),
      is_admin: Boolean(data.is_admin),
    } as Profile;
  } catch (e) {
    console.error("fetchProfile unexpected error:", e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(true);

  const applySession = useCallback(async (s: Session | null) => {
    setSession(s);
    const u = s?.user ?? null;
    setUser(u);
    if (u) {
      const profile = await fetchProfile(u.id);
      setUserProfile(profile);
    } else {
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Use getUser() — authenticates with Supabase Auth server (secure).
    // getSession() reads from storage and is NOT authenticated — never use
    // getSession() to make security decisions.
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!mounted) return;
      if (u) {
        // Also grab the session for the session state value
        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);
        setUser(u);
        const profile = await fetchProfile(u.id);
        if (mounted) setUserProfile(profile);
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;
        await applySession(s);
        if (event === "SIGNED_OUT") {
          setUserProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshUser = useCallback(() => {
    if (user) {
      fetchProfile(user.id).then((profile) => {
        if (profile) setUserProfile(profile);
      });
    }
  }, [user]);

  const logout = async () => {
    setLoading(true);
    try {
      try {
        await fetch("/api/auth/signout", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        await supabase.auth.signOut();
      }
      window.location.assign("/login");
    } catch (e) {
      console.error("logout error:", e);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, userProfile, loading, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
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
import type { Profile } from "@/lib/definitions";
import { useRouter } from "next/navigation";

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}


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
      // Handle lock broken errors gracefully - these are temporary Supabase session conflicts
      if (error.message.includes("Lock broken") || error.message.includes("steal") || error.message.includes("orphaned lock")) {
        console.warn("fetchProfile: Temporary session conflict, retrying...");
        await new Promise(resolve => setTimeout(resolve, 200));
        return fetchProfile(userId);
      }
      console.error("fetchProfile error:", error);
      return null;
    }

    if (!data) return null;

    return {
      ...data,
      wallet_balance: Number(data.wallet_balance ?? 0),
      is_admin: Boolean(data.is_admin),
    } as Profile;
  } catch (e) {
    // Handle lock broken errors at the catch level too
    if (e instanceof Error && (e.message.includes("Lock broken") || e.message.includes("steal") || e.message.includes("orphaned lock"))) {
      console.warn("fetchProfile: Temporary session conflict in catch, retrying...");
      await new Promise(resolve => setTimeout(resolve, 200));
      return fetchProfile(userId);
    }
    console.error("fetchProfile unexpected error:", e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
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

  // Debounced version to prevent rapid successive calls
  const debouncedApplySession = useCallback(
    debounce(async (s: Session | null) => {
      await applySession(s);
    }, 200),
    [applySession]
  );

  useEffect(() => {
    let mounted = true;

    // Initialize auth state - use getSession() for initial load to avoid server calls
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      await applySession(s);
      if (mounted) setLoading(false);
    });

    // Listen for auth state changes with better session handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;
        console.log("Auth state change:", event, s?.user?.email);
        await applySession(s);
        if (event === "SIGNED_OUT") {
          setUserProfile(null);
          // Clear any local storage data if needed
          localStorage.removeItem('supabase.auth.token');
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Session refreshed or new sign in - ensure profile is loaded
          if (s?.user) {
            const profile = await fetchProfile(s.user.id);
            if (profile) setUserProfile(profile);
          }
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
      router.push("/login");
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
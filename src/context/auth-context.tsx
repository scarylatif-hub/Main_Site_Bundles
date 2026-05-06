"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/definitions";
import { usePathname, useRouter } from "next/navigation";
import { type Session, type User } from "@supabase/supabase-js";

export type AuthContextType = {
  user: User | null;
  userProfile: Profile | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeProfile(data: any): Profile {
  return {
    ...data,
    wallet_balance: Number(data?.wallet_balance ?? 0),
    is_admin: Boolean(data?.is_admin),
  } as Profile;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const response = await fetch("/api/auth/profile", {
      credentials: "include",
      cache: "no-store",
      headers: {
        "x-profile-user-id": userId,
      },
    });

    if (response.status === 401 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      console.error("fetchProfile API error:", response.status, message);
      return null;
    }

    const profile = await response.json();
    if (!profile) {
      return null;
    }

    return normalizeProfile(profile);
  } catch (error) {
    console.error("fetchProfile unexpected error:", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestIdRef = useRef(0);

  const syncSession = useCallback(
    async (nextSession: Session | null, options?: { keepLoading?: boolean }) => {
      const keepLoading = options?.keepLoading ?? false;
      const nextUser = nextSession?.user ?? null;

      setSession(nextSession);
      setUser(nextUser);

      if (!keepLoading) {
        setLoading(true);
      }

      const requestId = ++profileRequestIdRef.current;

      if (!nextUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const profile = await fetchProfile(nextUser.id);
      if (profileRequestIdRef.current !== requestId) {
        return;
      }

      setUserProfile(profile);
      setLoading(false);
    },
    []
  );

  const refreshUser = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) {
      setUserProfile(null);
      return;
    }

    const requestId = ++profileRequestIdRef.current;
    const profile = await fetchProfile(currentUserId);
    if (profileRequestIdRef.current !== requestId) {
      return;
    }

    setUserProfile(profile);
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) {
        return;
      }
      await syncSession(initialSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) {
        return;
      }
      await syncSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncSession]);

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    void refreshUser();
  }, [pathname, session?.user?.id, refreshUser]);

  const logout = useCallback(async () => {
    setLoading(true);

    try {
      try {
        await fetch("/api/auth/signout", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
      } finally {
        await supabase.auth.signOut();
      }

      setUser(null);
      setUserProfile(null);
      setSession(null);
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("logout error:", error);
      setLoading(false);
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      session,
      userProfile,
      loading,
      logout,
      refreshUser,
    }),
    [user, session, userProfile, loading, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

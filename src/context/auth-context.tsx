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
import { useRouter } from "next/navigation";
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
const PROFILE_CACHE_PREFIX = "profile-cache:";

function profileStorageKey(userId: string): string {
  return `${PROFILE_CACHE_PREFIX}${userId}`;
}

function normalizeProfile(data: any): Profile {
  return {
    ...data,
    wallet_balance: Number(data?.wallet_balance ?? 0),
    is_admin: Boolean(data?.is_admin),
  } as Profile;
}

// Simple in-memory cache to prevent duplicate fetches within 5 seconds
const profileCache = new Map<string, { profile: Profile | null; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds

function getPersistedProfile(userId: string): Profile | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(profileStorageKey(userId));
    if (!raw) return null;
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistProfile(userId: string, profile: Profile | null): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!profile) {
      window.localStorage.removeItem(profileStorageKey(userId));
      return;
    }
    window.localStorage.setItem(profileStorageKey(userId), JSON.stringify(profile));
  } catch {
    // Ignore localStorage failures.
  }
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  // Check cache first
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.profile;
  }

  try {
    const response = await fetch("/api/auth/profile", {
      credentials: "include",
      cache: "no-cache",
      headers: {
        "x-profile-user-id": userId,
      },
    });

    if (response.status === 401 || response.status === 404) {
      profileCache.set(userId, { profile: null, timestamp: Date.now() });
      return null;
    }

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      console.error("fetchProfile API error:", response.status, message);
      profileCache.set(userId, { profile: null, timestamp: Date.now() });
      return null;
    }

    const profile = await response.json();
    if (!profile) {
      profileCache.set(userId, { profile: null, timestamp: Date.now() });
      return null;
    }

    const normalizedProfile = normalizeProfile(profile);
    profileCache.set(userId, { profile: normalizedProfile, timestamp: Date.now() });
    return normalizedProfile;
  } catch (error) {
    console.error("fetchProfile unexpected error:", error);
    profileCache.set(userId, { profile: null, timestamp: Date.now() });
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestIdRef = useRef(0);

  const syncSession = useCallback(
    async (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null;

      setSession(nextSession);
      setUser(nextUser);
      setLoading(false);

      const requestId = ++profileRequestIdRef.current;

      if (!nextUser) {
        setUserProfile(null);
        return;
      }

      const persisted = getPersistedProfile(nextUser.id);
      if (persisted) {
        setUserProfile(persisted);
      } else {
        setUserProfile((current) => (current?.id === nextUser.id ? current : null));
      }

      const profile = await fetchProfile(nextUser.id);
      if (profileRequestIdRef.current !== requestId) {
        return;
      }

      setUserProfile(profile);
      persistProfile(nextUser.id, profile);
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
    persistProfile(currentUserId, profile);
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession } }) => {
        if (!mounted) {
          return;
        }
        await syncSession(initialSession);
      })
      .catch((error) => {
        console.error("getSession error:", error);
        if (!mounted) {
          return;
        }
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
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
    let disposed = false;

    const refreshSession = async () => {
      if (disposed) return;
      const { data, error } = await supabase.auth.getSession();
      if (disposed || error) return;
      await syncSession(data.session ?? null);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    };

    // Keep session fresh for long-lived tabs.
    const intervalId = window.setInterval(() => {
      void refreshSession();
    }, 1000 * 60 * 10);

    const onWindowFocus = () => {
      void refreshSession();
    };

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [syncSession]);

  const logout = useCallback(async () => {
    setLoading(false);
    setUser(null);
    setUserProfile(null);
    setSession(null);
    profileCache.clear();
    router.replace("/login");

    try {
      await Promise.allSettled([
        supabase.auth.signOut(),
        fetch("/api/auth/signout", {
          method: "POST",
          credentials: "include",
        }),
      ]);
      router.refresh();
    } catch (error) {
      console.error("logout error:", error);
      router.refresh();
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

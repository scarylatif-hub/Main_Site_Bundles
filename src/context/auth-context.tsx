
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { type User, type Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  wallet_balance: number;
  updated_at: string;
  is_admin: boolean;
}

export type AuthContextType = {
  user: User | null;
  userProfile: Profile | null;
  session: Session | null;
  loading: boolean;
  logout: () => void;
  refreshUser: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUserProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error && status !== 406) {
        // A 406 status from .single() means no row was found, which is expected for new users.
        // We only want to throw for other, unexpected errors.
        throw error;
      }
      
      if (data) {
        setUserProfile({
          ...data,
          wallet_balance: Number(data.wallet_balance),
          is_admin: Boolean(data.is_admin),
        } as Profile);
      }
    } catch (error: any) {
      console.error("Error fetching user profile:", error.message || error);
    }
  }, []);


  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      await fetchUserProfile(currentUser);
      setLoading(false);
    };
    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        await fetchUserProfile(currentUser);
        if (event === "SIGNED_IN") {
          // You can add logic here for when a user signs in
        }
        if (event === "SIGNED_OUT") {
           setUserProfile(null);
        }
      }
    );


    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserProfile]);
  
  const refreshUser = useCallback(() => {
    if (user) {
      fetchUserProfile(user);
    }
  }, [user, fetchUserProfile]);


  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
        setLoading(false);
    }
  };

  const value = { user, session, userProfile, loading, logout, refreshUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

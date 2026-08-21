'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client'; // seu createBrowserClient
import { withTimeout } from '@/lib/with-timeout';

export interface AuthProfile {
  role: string | null;
  subscription_status: string | null;
  tenant_id: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isProfileLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const profileUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string) => {
      if (profileUserIdRef.current === userId) return;
      profileUserIdRef.current = userId;
      if (mounted) setIsProfileLoading(true);
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('role, subscription_status, tenant_id')
            .eq('id', userId)
            .maybeSingle(),
          8_000,
          'Tempo limite ao consultar o perfil.',
        );
        if (error) throw error;
        if (mounted && profileUserIdRef.current === userId) setProfile(data);
      } catch (error) {
        console.warn('[Autenticação] Não foi possível carregar o perfil.', error);
        if (profileUserIdRef.current === userId) profileUserIdRef.current = null;
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setIsProfileLoading(false);
      }
    };

    const getSession = async () => {
      try {
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          4_000,
          'Tempo limite ao restaurar a sessão.',
        );
        if (error) throw error;
        const sessionUser = session?.user ?? null;
        if (mounted) {
          setUser(sessionUser);
          setIsLoading(false);
        }
        if (sessionUser) void loadProfile(sessionUser.id);
      } catch (error) {
        console.warn('[Autenticação] Supabase indisponível; sessão tratada como desconectada.', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setIsLoading(false);
      if (sessionUser) {
        void loadProfile(sessionUser.id);
      } else {
        profileUserIdRef.current = null;
        setProfile(null);
        setIsProfileLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const login = async (email: string, password: string) => {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      }),
      12_000,
      'Tempo limite ao fazer login.',
    );
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isAuthenticated: !!user,
      isLoading,
      isProfileLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type AuthMode = 'demo' | 'authenticated';

interface AuthContextType {
  mode: AuthMode;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  usarModoDemo: () => void;
}

const AuthContext = createContext({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('demo');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar se já está logado
    const auth = localStorage.getItem('capacitor_auth');
    const expires = localStorage.getItem('capacitor_expires');
    
    if (auth === 'true' && expires && new Date().getTime() < parseInt(expires)) {
      setMode('authenticated');
    } else {
      // Limpar dados expirados
      localStorage.removeItem('capacitor_auth');
      localStorage.removeItem('capacitor_user');
      localStorage.removeItem('capacitor_expires');
      setMode('demo');
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Aqui você vai integrar com seu backend/Supabase
    // Por enquanto, credenciais de exemplo
    if (email === 'admin@capacitormanager.com' && password === 'admin123') {
      const expires = new Date().getTime() + 30 * 24 * 60 * 60 * 1000; // 30 dias
      localStorage.setItem('capacitor_auth', 'true');
      localStorage.setItem('capacitor_user', email);
      localStorage.setItem('capacitor_expires', expires.toString());
      setMode('authenticated');
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('capacitor_auth');
    localStorage.removeItem('capacitor_user');
    localStorage.removeItem('capacitor_expires');
    setMode('demo');
  };

  const usarModoDemo = () => {
    setMode('demo');
  };

  return (
    <AuthContext.Provider value={{ mode, isAuthenticated: mode === 'authenticated', isLoading, login, logout, usarModoDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
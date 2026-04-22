'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type AuthMode = 'demo' | 'authenticated';

interface AuthContextType {
  mode: AuthMode;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext({} as AuthContextType);

const VALID_EMAIL = 'suporte@jmeletroservice.com.br';
const VALID_PASSWORD = 'Suporte@1677#';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('demo');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = localStorage.getItem('capacitor_auth');
    const expires = localStorage.getItem('capacitor_expires');
    
    if (auth === 'true' && expires && new Date().getTime() < parseInt(expires)) {
      setMode('authenticated');
    } else {
      setMode('demo');
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (email === VALID_EMAIL && password === VALID_PASSWORD) {
      const expires = new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
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

  return (
    <AuthContext.Provider value={{ mode, isAuthenticated: mode === 'authenticated', isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

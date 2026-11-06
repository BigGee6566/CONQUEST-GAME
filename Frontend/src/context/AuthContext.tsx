import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import type { User } from '../types';

const TOKEN_KEY = 'conquest.token';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setStatus('signedOut');
    await AsyncStorage.removeItem(TOKEN_KEY);
  }, []);

  const startSession = useCallback(async (token: string, nextUser: User) => {
    setAuthToken(token);
    setUser(nextUser);
    setStatus('signedIn');
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }, []);

  // Restore a saved session on launch.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession();
    });
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        setStatus('signedOut');
        return;
      }
      setAuthToken(token);
      try {
        setUser(await authApi.me());
        setStatus('signedIn');
      } catch {
        await clearSession();
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Stable callbacks: screens list these as effect dependencies, and a new identity on every
  // user update would re-run those effects (refreshUser -> setUser -> refreshUser ...).
  const login = useCallback(async (identifier: string, password: string) => {
    const { token, user: signedIn } = await authApi.login({ identifier, password });
    await startSession(token, signedIn);
  }, [startSession]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { token, user: created } = await authApi.register({ username, email, password });
    await startSession(token, created);
  }, [startSession]);

  const refreshUser = useCallback(async () => {
    if (status === 'signedIn') setUser(await authApi.me());
  }, [status]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout: clearSession, refreshUser }),
    [user, status, login, register, clearSession, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

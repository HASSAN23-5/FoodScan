import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import api from '../services/api';
import { saveToken, removeToken, saveUser, getToken } from '../services/storage';
import { User } from '../types';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function formatError(detail: any): string {
  if (!detail) return "Une erreur s'est produite.";
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e: any) => e?.msg || JSON.stringify(e)).join(' ');
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data } = await api.get('/auth/me');
      setUser(data);
      await saveUser(data);
    } catch {
      setUser(null);
      await removeToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Exposed so the auth-callback route can trigger a re-check after writing the token
  const refreshUser = useCallback(async () => {
    setLoading(true);
    await checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.access_token) {
        await saveToken(data.access_token, data.refresh_token);
      }
      const userData: User = {
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        role: data.role,
        picture: data.picture,
      };
      setUser(userData);
      await saveUser(userData);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: formatError(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const { data } = await api.post('/auth/register', { email, password, name });
      if (data.access_token) {
        await saveToken(data.access_token, data.refresh_token);
      }
      const userData: User = {
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        role: data.role,
        picture: data.picture,
      };
      setUser(userData);
      await saveUser(userData);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: formatError(e.response?.data?.detail) || e.message };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // IMPORTANT: do NOT hardcode the redirect URL. Linking.createURL builds the right one
      // (foodscan://auth-callback on native, http://localhost:8081/auth-callback on web).
      const redirectUrl = Linking.createURL('auth-callback');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      // On web, navigate the current tab. The auth-callback route picks up #session_id=...
      // and completes the exchange there — nothing else to do in this function.
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.location.href = authUrl;
        }
        return { success: true };
      }

      // Native flow: openAuthSessionAsync resolves once the system browser closes,
      // returning the redirected URL we can parse here.
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type !== 'success' || !result.url) {
        return { success: false, error: 'Connexion Google annulée.' };
      }

      const hash = result.url.split('#')[1] || '';
      const match = hash.match(/session_id=([^&]+)/);
      if (!match) return { success: false, error: 'Réponse Google invalide.' };

      const sessionId = decodeURIComponent(match[1]);
      const { data } = await api.post('/auth/session', { session_id: sessionId });

      if (data.access_token) {
        await saveToken(data.access_token, data.refresh_token);
      }
      const userData: User = {
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        role: data.role,
        picture: data.picture,
      };
      setUser(userData);
      await saveUser(userData);
      return { success: true };
    } catch (e: any) {
      console.error('Google OAuth error:', e);
      return { success: false, error: formatError(e.response?.data?.detail) || e.message || 'Erreur Google' };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

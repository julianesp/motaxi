'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from './types';
import { authAPI, removeAuthToken } from './api-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    phone: string;
    full_name: string;
    role: 'passenger' | 'driver';
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar si hay usuario autenticado al cargar
  const checkAuth = useCallback(async () => {
    try {
      // Solo intentar obtener el usuario si hay un token
      if (typeof window !== 'undefined') {
        const cookies = document.cookie.split(';');
        const authCookie = cookies.find(cookie => cookie.trim().startsWith('authToken='));

        if (authCookie && authCookie.split('=')[1]) {
          try {
            const userData = await authAPI.getCurrentUser();
            setUser(userData);
          } catch (apiError) {
            // Si falla la llamada API, solo establecer null si no hay usuario previo
            console.error('Error getting current user:', apiError);
            // No establecer null aquí para evitar perder el usuario temporalmente
          }
        } else {
          // No hay token, definitivamente no hay usuario
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      // No establecer null aquí para evitar perder el usuario temporalmente
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      setUser(response.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    phone: string;
    full_name: string;
    role: 'passenger' | 'driver';
  }) => {
    try {
      const response = await authAPI.register(data);
      setUser(response.user);
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      removeAuthToken();
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
      // No establecer null aquí, solo loguear el error
      // El usuario puede seguir siendo válido aunque falle el refresh
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../config/api';
import { User } from '../types';
import { NotificationService } from '../services/notifications.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@motaxi_token';
const USER_KEY = '@motaxi_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const userData = await AsyncStorage.getItem(USER_KEY);

      if (token && userData) {
        apiClient.setToken(token);
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<User>
  ): Promise<boolean> => {
    try {
      console.log('Attempting signup with:', { email, role: userData.role });

      const response = await apiClient.post('/auth/register', {
        email,
        password,
        ...userData,
      });

      console.log('Signup response received:', response ? 'Success' : 'No response');

      if (response.user && response.token) {
        await AsyncStorage.setItem(TOKEN_KEY, response.token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
        apiClient.setToken(response.token);
        setUser(response.user);

        console.log('User stored, role:', response.user.role);

        // Registrar para push notifications (no bloquear si falla)
        try {
          await NotificationService.registerForPushNotifications();
        } catch (notifError) {
          console.log('Push notification registration failed (non-critical):', notifError);
        }

        return true;
      }

      console.error('Signup failed: Invalid response format');
      return false;
    } catch (error: any) {
      console.error('Error signing up:', error);
      console.error('Error details:', error.response?.data || error.message);
      return false;
    }
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      if (response.user && response.token) {
        await AsyncStorage.setItem(TOKEN_KEY, response.token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
        apiClient.setToken(response.token);
        setUser(response.user);

        // Registrar para push notifications (no bloquear si falla)
        try {
          await NotificationService.registerForPushNotifications();
        } catch (notifError) {
          console.log('Push notification registration failed (non-critical):', notifError);
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error signing in:', error);
      return false;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // Intentar remover push token del backend (no crítico si falla)
      try {
        await NotificationService.removePushToken();
      } catch (error) {
        // Silenciar error - es normal si no hay conexión
      }

      // Intentar llamar al endpoint de logout (no crítico si falla)
      try {
        await apiClient.post('/auth/logout', {});
      } catch (error) {
        // Silenciar error - es normal si no hay conexión
      }

      // Limpiar datos locales (esto siempre debe ejecutarse)
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      apiClient.setToken(null);
      setUser(null);
    } catch (error) {
      // Silenciar error - pero asegurar que se limpie el usuario
      setUser(null);
    }
  };

  const updateUser = async (userData: Partial<User>): Promise<boolean> => {
    try {
      if (!user) return false;

      const response = await apiClient.put('/users/profile', userData);

      if (response.user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
        setUser(response.user);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { AuthResponse, LoginCredentials, RegisterData } from './types';

// URL del API - usar variable de entorno
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// Crear instancia de axios
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials: true solo es necesario si usamos cookies HttpOnly desde el backend
  // Para desarrollo, usaremos cookies del navegador sin withCredentials
});

// Función para obtener el token desde cookies
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const authCookie = cookies.find(cookie => cookie.trim().startsWith('authToken='));

  if (authCookie) {
    return authCookie.split('=')[1];
  }

  return null;
}

// Función para guardar el token en cookies
export function setAuthToken(token: string) {
  if (typeof window === 'undefined') return;

  // Guardar en cookie con expiración de 7 días
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  document.cookie = `authToken=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
}

// Función para remover el token
export function removeAuthToken() {
  if (typeof window === 'undefined') return;

  document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

// Interceptor para agregar el token de autenticación a todas las peticiones
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      removeAuthToken();

      // Redirigir al login solo si estamos en el cliente Y no estamos en una página pública
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const publicPaths = [
          '/', // Página de inicio (landing page)
          '/auth/login',
          '/auth/register',
          '/auth/role-selection',
          '/auth/forgot-password'
        ];

        // Solo redirigir si NO estamos en una página pública
        if (!publicPaths.some(path => currentPath === path || currentPath.startsWith(path + '/'))) {
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// API de autenticación
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    if (response.data.token) {
      setAuthToken(response.data.token);
    }
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    if (response.data.token) {
      setAuthToken(response.data.token);
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      removeAuthToken();
    }
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

export default apiClient;

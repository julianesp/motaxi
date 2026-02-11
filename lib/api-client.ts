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
      // Verificar si es un checkAuth fallido (no debería remover token ni redirigir)
      const isCheckingAuth = error.config?.url === '/auth/me';

      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const publicPaths = [
          '/', // Página de inicio (landing page)
          '/auth/login',
          '/auth/register',
          '/auth/role-selection',
          '/auth/forgot-password',
          '/auth/reset-password'
        ];

        const isPublicPath = publicPaths.some(path => currentPath === path || currentPath.startsWith(path + '/'));

        // Solo remover token y redirigir si NO es checkAuth y NO estamos en página pública
        if (!isCheckingAuth && !isPublicPath) {
          // Token expirado o inválido en una página protegida
          removeAuthToken();
          window.location.href = '/auth/login';
        } else if (isCheckingAuth && !isPublicPath) {
          // checkAuth falló en página protegida, solo remover token (no redirigir aquí)
          removeAuthToken();
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
    return response.data.user; // Retornar solo el user, no todo response.data
  },
};

// API de viajes
export const tripsAPI = {
  createTrip: async (tripData: {
    pickup_latitude: number;
    pickup_longitude: number;
    pickup_address: string;
    dropoff_latitude: number;
    dropoff_longitude: number;
    dropoff_address: string;
    fare: number;
    distance_km: number;
  }) => {
    const response = await apiClient.post('/trips', tripData);
    return response.data;
  },

  getActiveTrips: async () => {
    const response = await apiClient.get('/trips/active');
    return response.data;
  },

  getTripHistory: async () => {
    const response = await apiClient.get('/trips/history');
    return response.data;
  },

  acceptTrip: async (tripId: string) => {
    const response = await apiClient.put(`/trips/${tripId}/accept`);
    return response.data;
  },

  updateTripStatus: async (tripId: string, status: string) => {
    const response = await apiClient.put(`/trips/${tripId}/status`, { status });
    return response.data;
  },

  getTrip: async (tripId: string) => {
    const response = await apiClient.get(`/trips/${tripId}`);
    return response.data;
  },

  rateTrip: async (tripId: string, rating: number, comment?: string) => {
    const response = await apiClient.put(`/trips/${tripId}/rate`, { rating, comment });
    return response.data;
  },

  getCurrentTrip: async () => {
    const response = await apiClient.get('/trips/current');
    return response.data;
  },
};

// API de conductores
export const driversAPI = {
  getProfile: async () => {
    const response = await apiClient.get('/drivers/profile');
    return response.data;
  },

  updateProfile: async (data: {
    municipality?: string;
    accepts_intercity_trips?: boolean;
    accepts_rural_trips?: boolean;
    vehicle_model?: string;
    vehicle_color?: string;
    vehicle_plate?: string;
    license_number?: string;
    base_fare?: number;
    intercity_fare?: number;
    rural_fare?: number;
    per_km_fare?: number;
  }) => {
    const response = await apiClient.put('/drivers/profile', data);
    return response.data;
  },

  updateLocation: async (latitude: number, longitude: number) => {
    const response = await apiClient.put('/drivers/location', { latitude, longitude });
    return response.data;
  },

  updateAvailability: async (isAvailable: boolean) => {
    const response = await apiClient.put('/drivers/availability', { isAvailable });
    return response.data;
  },

  getNearbyDrivers: async (lat: number, lng: number) => {
    const response = await apiClient.get('/drivers/nearby', {
      params: { lat, lng }
    });
    return response.data;
  },

  getEarnings: async () => {
    const response = await apiClient.get('/drivers/earnings');
    return response.data;
  },
};

export default apiClient;

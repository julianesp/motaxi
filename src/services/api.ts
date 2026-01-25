import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Obtener la URL del API desde las variables de entorno
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8787';

// Crear instancia de axios
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación a todas las peticiones
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
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
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      // Aquí podrías redirigir al login si tuvieras acceso al navigation
      console.log('Session expired, please login again');
    }
    return Promise.reject(error);
  }
);

export default apiClient;

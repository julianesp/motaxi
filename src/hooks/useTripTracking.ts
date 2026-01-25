import { useState, useEffect, useRef } from 'react';
import { DatabaseService } from '../services/database.service';
import { Trip } from '../types';

interface UseTripTrackingOptions {
  tripId: string | null;
  pollingInterval?: number; // milisegundos
  enabled?: boolean;
}

/**
 * Hook personalizado para rastrear un viaje en tiempo real
 * Actualiza automáticamente el estado del viaje cada X segundos
 */
export const useTripTracking = ({
  tripId,
  pollingInterval = 5000, // 5 segundos por defecto
  enabled = true,
}: UseTripTrackingOptions) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTrip = async () => {
    if (!tripId) return;

    try {
      setLoading(true);
      setError(null);

      // Aquí llamaríamos a un endpoint GET /trips/:id
      // Por ahora usamos el servicio que ya existe
      const response = await fetch(`${process.env.API_URL || 'http://localhost:8787'}/trips/${tripId}`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`, // Implementar getToken
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTrip(data.trip);
      } else {
        setError('Error al obtener el viaje');
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
      console.error('Error fetching trip:', err);
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para obtener el token (simplificada)
  const getToken = async (): Promise<string> => {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    return await AsyncStorage.default.getItem('@motaxi_token') || '';
  };

  useEffect(() => {
    if (!enabled || !tripId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch inicial
    fetchTrip();

    // Configurar polling
    intervalRef.current = setInterval(fetchTrip, pollingInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tripId, pollingInterval, enabled]);

  const refresh = () => {
    fetchTrip();
  };

  return {
    trip,
    loading,
    error,
    refresh,
  };
};

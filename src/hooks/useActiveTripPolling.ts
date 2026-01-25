import { useState, useEffect, useRef } from 'react';
import { DatabaseService } from '../services/database.service';
import { Trip } from '../types';

interface UseActiveTripPollingOptions {
  enabled: boolean; // Solo polling cuando el conductor está disponible
  pollingInterval?: number;
  onNewTrip?: (trip: Trip) => void; // Callback cuando hay un nuevo viaje
}

/**
 * Hook para conductores: obtiene viajes activos en tiempo real
 */
export const useActiveTripPolling = ({
  enabled,
  pollingInterval = 10000, // 10 segundos por defecto
  onNewTrip,
}: UseActiveTripPollingOptions) => {
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousTripIdsRef = useRef<Set<string>>(new Set());

  const fetchActiveTrips = async () => {
    try {
      setLoading(true);
      const trips = await DatabaseService.getActiveTrips();

      // Detectar nuevos viajes
      if (onNewTrip && trips.length > 0) {
        trips.forEach((trip) => {
          if (!previousTripIdsRef.current.has(trip.id)) {
            onNewTrip(trip);
          }
        });
      }

      // Actualizar referencia de IDs
      previousTripIdsRef.current = new Set(trips.map((t) => t.id));

      setActiveTrips(trips);
    } catch (error) {
      console.error('Error fetching active trips:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setActiveTrips([]);
      previousTripIdsRef.current.clear();
      return;
    }

    // Fetch inicial
    fetchActiveTrips();

    // Configurar polling
    intervalRef.current = setInterval(fetchActiveTrips, pollingInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollingInterval]);

  const refresh = () => {
    fetchActiveTrips();
  };

  return {
    activeTrips,
    loading,
    refresh,
  };
};

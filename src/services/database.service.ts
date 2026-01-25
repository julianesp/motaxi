import { apiClient } from '../config/api';
import { Trip, TripStatus } from '../types';

export class DatabaseService {
  /**
   * Actualiza la disponibilidad del conductor
   */
  static async updateDriverAvailability(
    driverId: string,
    isAvailable: boolean
  ): Promise<boolean> {
    try {
      await apiClient.put('/drivers/availability', { isAvailable });
      return true;
    } catch (error) {
      console.error('Error updating driver availability:', error);
      return false;
    }
  }

  /**
   * Actualiza la ubicación del conductor
   */
  static async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    try {
      await apiClient.put('/drivers/location', { latitude, longitude });
      return true;
    } catch (error) {
      console.error('Error updating driver location:', error);
      return false;
    }
  }

  /**
   * Obtiene conductores disponibles cercanos
   */
  static async getNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<any[]> {
    try {
      const response = await apiClient.get(
        `/drivers/nearby?lat=${latitude}&lng=${longitude}`
      );
      return response.drivers || [];
    } catch (error) {
      console.error('Error getting nearby drivers:', error);
      return [];
    }
  }

  /**
   * Crea un nuevo viaje
   */
  static async createTrip(tripData: Partial<Trip>): Promise<Trip | null> {
    try {
      const response = await apiClient.post('/trips', {
        pickup_latitude: tripData.pickup_location?.latitude,
        pickup_longitude: tripData.pickup_location?.longitude,
        pickup_address: tripData.pickup_location?.address,
        dropoff_latitude: tripData.dropoff_location?.latitude,
        dropoff_longitude: tripData.dropoff_location?.longitude,
        dropoff_address: tripData.dropoff_location?.address,
        fare: tripData.fare,
        distance_km: tripData.distance_km,
      });

      // Verificar si response.data existe y tiene el viaje
      if (response?.data?.trip) {
        return response.data.trip;
      } else if (response?.trip) {
        return response.trip;
      } else if (response?.data) {
        return response.data;
      }

      console.error('Unexpected response format:', response);
      return null;
    } catch (error: any) {
      console.error('Error creating trip:', error);
      console.error('Error details:', error.response?.data || error.message);
      throw error; // Lanzar el error para que pueda ser manejado en el componente
    }
  }

  /**
   * Actualiza el estado de un viaje
   */
  static async updateTripStatus(
    tripId: string,
    status: TripStatus,
    additionalData?: Partial<Trip>
  ): Promise<boolean> {
    try {
      await apiClient.put(`/trips/${tripId}/status`, {
        status,
        ...additionalData,
      });
      return true;
    } catch (error) {
      console.error('Error updating trip status:', error);
      return false;
    }
  }

  /**
   * Obtiene los viajes de un usuario
   */
  static async getUserTrips(userId: string, role: 'passenger' | 'driver'): Promise<Trip[]> {
    try {
      const response = await apiClient.get('/trips/history');
      return response.trips || [];
    } catch (error) {
      console.error('Error getting user trips:', error);
      return [];
    }
  }

  /**
   * Obtiene viajes activos (solicitados) para conductores
   */
  static async getActiveTrips(): Promise<Trip[]> {
    try {
      const response = await apiClient.get('/trips/active');
      return response.trips || [];
    } catch (error) {
      console.error('Error getting active trips:', error);
      return [];
    }
  }

  /**
   * Acepta un viaje (conductor)
   */
  static async acceptTrip(tripId: string): Promise<boolean> {
    try {
      await apiClient.put(`/trips/${tripId}/accept`, {});
      return true;
    } catch (error) {
      console.error('Error accepting trip:', error);
      return false;
    }
  }

  /**
   * Crea una notificación
   */
  static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
    data?: any
  ): Promise<boolean> {
    try {
      // Las notificaciones se crean automáticamente en el backend
      return true;
    } catch (error) {
      console.error('Error creating notification:', error);
      return false;
    }
  }

  /**
   * Obtiene un usuario por ID (se obtiene del contexto de auth)
   */
  static async getUser(userId: string): Promise<any | null> {
    try {
      const response = await apiClient.get('/users/profile');
      return response.user || null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Obtiene ganancias del conductor
   */
  static async getDriverEarnings(): Promise<Trip[]> {
    try {
      const response = await apiClient.get('/drivers/earnings');
      return response.trips || [];
    } catch (error) {
      console.error('Error getting driver earnings:', error);
      return [];
    }
  }
}

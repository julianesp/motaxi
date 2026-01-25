import * as Location from 'expo-location';
import { Location as LocationType } from '../types';

export class LocationService {
  /**
   * Solicita permisos de ubicación al usuario
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Solicita permisos de ubicación en segundo plano (para conductores)
   */
  static async requestBackgroundPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting background location permissions:', error);
      return false;
    }
  }

  /**
   * Obtiene la ubicación actual del dispositivo
   */
  static async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('No location permissions');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Obtiene la dirección a partir de coordenadas (geocodificación inversa)
   */
  static async getAddressFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<string | null> {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (result && result.length > 0) {
        const address = result[0];
        const parts = [
          address.street,
          address.streetNumber,
          address.district,
          address.city,
          address.region,
        ].filter(Boolean);

        return parts.join(', ');
      }

      return null;
    } catch (error) {
      console.error('Error getting address:', error);
      return null;
    }
  }

  /**
   * Calcula la distancia entre dos puntos en kilómetros
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return parseFloat(distance.toFixed(2));
  }

  /**
   * Convierte grados a radianes
   */
  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calcula la tarifa estimada basada en la distancia
   * Ajustar según tarifas locales
   */
  static calculateFare(distanceKm: number): number {
    const BASE_FARE = 2000; // Tarifa base en pesos/moneda local
    const COST_PER_KM = 1500; // Costo por kilómetro
    const MIN_FARE = 3000; // Tarifa mínima

    const calculatedFare = BASE_FARE + (distanceKm * COST_PER_KM);
    return Math.max(calculatedFare, MIN_FARE);
  }

  /**
   * Inicia el seguimiento de ubicación en tiempo real
   * Útil para actualizar la posición del conductor
   */
  static async startLocationTracking(
    callback: (location: LocationType) => void,
    intervalMs: number = 5000
  ): Promise<Location.LocationSubscription | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('No location permissions');
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: intervalMs,
          distanceInterval: 10, // Actualizar cada 10 metros
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
          });
        }
      );

      return subscription;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return null;
    }
  }

  /**
   * Detiene el seguimiento de ubicación
   */
  static stopLocationTracking(subscription: Location.LocationSubscription): void {
    subscription.remove();
  }
}

import Constants from 'expo-constants';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || '';

export interface RouteInfo {
  distance: number; // en kilómetros
  duration: number; // en minutos
  polyline: string; // encoded polyline para dibujar ruta
}

export class MapsService {
  /**
   * Calcula la ruta y distancia real entre dos puntos usando Google Directions API
   */
  static async getRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteInfo | null> {
    try {
      const origin = `${originLat},${originLng}`;
      const destination = `${destLat},${destLng}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=es`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        console.error('Google Directions API error:', data.status);
        return null;
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance.value / 1000, // convertir de metros a km
        duration: leg.duration.value / 60, // convertir de segundos a minutos
        polyline: route.overview_polyline.points,
      };
    } catch (error) {
      console.error('Error getting route:', error);
      return null;
    }
  }

  /**
   * Obtiene la dirección legible desde coordenadas (Geocoding reverso)
   */
  static async getAddressFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<string | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=es`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        return null;
      }

      return data.results[0].formatted_address;
    } catch (error) {
      console.error('Error getting address:', error);
      return null;
    }
  }

  /**
   * Autocomplete de lugares usando Google Places Autocomplete API
   * Retorna sugerencias de direcciones mientras el usuario escribe
   */
  static async getPlaceAutocomplete(
    input: string,
    latitude?: number,
    longitude?: number
  ): Promise<Array<{ description: string; place_id: string }>> {
    try {
      if (!input || input.length < 3) {
        return [];
      }

      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&language=es&components=country:co`;

      // Si tenemos ubicación, priorizar resultados cercanos
      if (latitude && longitude) {
        url += `&location=${latitude},${longitude}&radius=50000`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places Autocomplete error:', data.status);
        return [];
      }

      return data.predictions || [];
    } catch (error) {
      console.error('Error in place autocomplete:', error);
      return [];
    }
  }

  /**
   * Obtiene los detalles de un lugar (coordenadas) usando su place_id
   */
  static async getPlaceDetails(placeId: string): Promise<{
    latitude: number;
    longitude: number;
    address: string;
  } | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}&language=es`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.result) {
        console.error('Google Place Details error:', data.status);
        return null;
      }

      const result = data.result;
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        address: result.formatted_address,
      };
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Busca lugares por texto (para búsquedas generales)
   * @deprecated Usar getPlaceAutocomplete para autocompletado
   */
  static async searchPlaces(query: string, latitude?: number, longitude?: number): Promise<any[]> {
    try {
      let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=es`;

      // Si tenemos ubicación, priorizar resultados cercanos
      if (latitude && longitude) {
        url += `&location=${latitude},${longitude}&radius=10000`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return [];
      }

      return data.results || [];
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  }

  /**
   * Calcula la distancia en línea recta entre dos puntos (Haversine)
   * Útil para estimaciones rápidas sin llamar a la API
   */
  static calculateStraightLineDistance(
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

    return distance;
  }

  private static toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface NearbyDriverMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  vehicle: string;
  rating: number;
}

interface GoogleMapComponentProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pickup?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  driverLocation?: { lat: number; lng: number } | null;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  clickMode?: 'pickup' | 'destination' | null;
  disableAutoFit?: boolean;
  nearbyDrivers?: NearbyDriverMarker[]; // Conductores disponibles para mostrar en el mapa
  onDriverClick?: (driverId: string) => void; // Callback al hacer clic en un conductor
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

function GoogleMapComponent({
  center,
  zoom = 13,
  pickup,
  destination,
  driverLocation,
  onLocationChange,
  onMapClick,
  clickMode = null,
  disableAutoFit = false,
  nearbyDrivers = [],
  onDriverClick,
}: GoogleMapComponentProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [initialCenter] = useState(center);
  const [directionsToPickup, setDirectionsToPickup] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsToDestination, setDirectionsToDestination] = useState<google.maps.DirectionsResult | null>(null);

  // Referencias para evitar recalcular rutas innecesariamente
  const lastPickupRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDestinationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDriverLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && onMapClick) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      onMapClick({ lat, lng });
    }
  }, [onMapClick]);

  // Función para centrar el mapa en la ubicación del usuario
  const handleCenterToUserLocation = () => {
    setIsGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLocation);
          if (map) {
            map.panTo(newLocation);
            map.setZoom(15);
          }
          if (onLocationChange) {
            onLocationChange(newLocation);
          }
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      console.warn('Tu navegador no soporta geolocalización.');
      setIsGettingLocation(false);
    }
  };

  // Calcular ruta desde conductor hasta punto de recogida
  useEffect(() => {
    if (!isLoaded || !driverLocation || !pickup) {
      setDirectionsToPickup(null);
      lastDriverLocationRef.current = null;
      lastPickupRef.current = null;
      return;
    }

    // Solo recalcular si las coordenadas cambiaron significativamente (más de ~10 metros)
    const hasDriverMoved = !lastDriverLocationRef.current ||
      Math.abs(lastDriverLocationRef.current.lat - driverLocation.lat) > 0.0001 ||
      Math.abs(lastDriverLocationRef.current.lng - driverLocation.lng) > 0.0001;

    const hasPickupChanged = !lastPickupRef.current ||
      Math.abs(lastPickupRef.current.lat - pickup.lat) > 0.0001 ||
      Math.abs(lastPickupRef.current.lng - pickup.lng) > 0.0001;

    if (!hasDriverMoved && !hasPickupChanged) {
      return; // No recalcular si no hay cambios significativos
    }

    lastDriverLocationRef.current = driverLocation;
    lastPickupRef.current = pickup;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: driverLocation,
        destination: pickup,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirectionsToPickup(result);
        } else {
          console.error('Error calculating route to pickup:', status);
        }
      }
    );
  }, [isLoaded, driverLocation, pickup]);

  // Calcular ruta desde punto de recogida hasta destino
  useEffect(() => {
    if (!isLoaded || !pickup || !destination) {
      setDirectionsToDestination(null);
      lastDestinationRef.current = null;
      return;
    }

    // Solo recalcular si las coordenadas cambiaron (pickup o destination)
    const hasPickupChanged = !lastPickupRef.current ||
      Math.abs(lastPickupRef.current.lat - pickup.lat) > 0.0001 ||
      Math.abs(lastPickupRef.current.lng - pickup.lng) > 0.0001;

    const hasDestinationChanged = !lastDestinationRef.current ||
      Math.abs(lastDestinationRef.current.lat - destination.lat) > 0.0001 ||
      Math.abs(lastDestinationRef.current.lng - destination.lng) > 0.0001;

    if (!hasPickupChanged && !hasDestinationChanged) {
      return; // No recalcular si no hay cambios
    }

    lastPickupRef.current = pickup;
    lastDestinationRef.current = destination;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: pickup,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirectionsToDestination(result);
        } else {
          console.error('Error calculating route to destination:', status);
        }
      }
    );
  }, [isLoaded, pickup, destination]);

  // Ajustar el mapa para mostrar ambos marcadores (solo si no está desactivado)
  // IMPORTANTE: Solo ajustar cuando pickup o destination cambien, NO cuando driverLocation cambie
  // para evitar el auto-refresh constante
  useEffect(() => {
    if (disableAutoFit) return; // No auto-ajustar si está desactivado

    if (map && pickup && destination) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(destination);
      if (driverLocation) {
        bounds.extend(driverLocation);
      }
      map.fitBounds(bounds, { top: 100, bottom: 100, left: 100, right: 100 });
    }
  }, [map, pickup, destination, disableAutoFit]); // Removido driverLocation de las dependencias

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="text-center p-6 max-w-md bg-white rounded-2xl shadow-xl">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-red-600 font-semibold text-lg mb-2">Google Maps requiere configuración</p>
          <p className="text-sm text-gray-600 mb-4">
            Necesitas activar las APIs de Google Maps en Google Cloud Console.
          </p>
          <details className="text-left text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <summary className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-700">
              Ver instrucciones rápidas
            </summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>Ir a: console.cloud.google.com</li>
              <li>Activar: Maps JavaScript API</li>
              <li>Activar: Places API</li>
              <li>Activar: Geocoding API</li>
              <li>Configurar billing (gratis hasta $200/mes)</li>
              <li>Esperar 2-5 minutos</li>
            </ol>
          </details>
          <p className="text-xs text-gray-400 mt-3">
            Archivo: CONFIGURACION_GOOGLE_MAPS.md
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={initialCenter}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          ...defaultOptions,
          gestureHandling: 'greedy',
        }}
        onClick={clickMode ? handleMapClick : undefined}
      >
        {/* Marcador de pickup (verde) */}
        {pickup && (
          <Marker
            position={pickup}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
            title="Punto de recogida"
          />
        )}

        {/* Marcador de destino (rojo) */}
        {destination && (
          <Marker
            position={destination}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
            title="Destino"
          />
        )}

        {/* Marcador de ubicación del usuario (azul) */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            title="Tu ubicación"
          />
        )}

        {/* Marcador del conductor (morado/naranja) */}
        {driverLocation && (
          <Marker
            position={driverLocation}
            icon={{
              url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23f97316'%3E%3Cpath d='M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z'/%3E%3C/svg%3E",
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
            title="Tu conductor"
          />
        )}

        {/* Marcadores de conductores disponibles cercanos (mototaxi naranja) */}
        {nearbyDrivers.map((driver) => (
          <Marker
            key={`nearby-${driver.id}`}
            position={{ lat: driver.lat, lng: driver.lng }}
            icon={{
              url: "data:image/svg+xml," + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#f97316">
                  <circle cx="12" cy="12" r="11" fill="white" stroke="#f97316" stroke-width="1.5"/>
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(36, 36),
              anchor: new google.maps.Point(18, 18),
            }}
            title={`${driver.name} — ${driver.vehicle} ⭐ ${driver.rating}`}
            onClick={() => onDriverClick && onDriverClick(driver.id)}
          />
        ))}

        {/* Ruta desde el conductor hasta el punto de recogida (azul) */}
        {directionsToPickup && (
          <DirectionsRenderer
            directions={directionsToPickup}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#3b82f6',
                strokeOpacity: 0.8,
                strokeWeight: 5,
              },
            }}
          />
        )}

        {/* Ruta desde el punto de recogida hasta el destino (verde) */}
        {directionsToDestination && (
          <DirectionsRenderer
            directions={directionsToDestination}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#10b981',
                strokeOpacity: 0.8,
                strokeWeight: 5,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* Botón de centrar ubicación */}
      <button
        onClick={handleCenterToUserLocation}
        disabled={isGettingLocation}
        className="absolute bottom-24 right-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
        title="Centrar en mi ubicación"
      >
        {isGettingLocation ? (
          <svg
            className="w-6 h-6 text-indigo-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

// Memoizar el componente para evitar re-renders innecesarios
export default memo(GoogleMapComponent, (prevProps, nextProps) => {
  // Solo re-renderizar si hay cambios significativos en las props
  const driversUnchanged =
    prevProps.nearbyDrivers?.length === nextProps.nearbyDrivers?.length &&
    (nextProps.nearbyDrivers || []).every((d, i) => {
      const p = (prevProps.nearbyDrivers || [])[i];
      return p?.id === d.id && p?.lat === d.lat && p?.lng === d.lng;
    });

  return (
    prevProps.zoom === nextProps.zoom &&
    prevProps.clickMode === nextProps.clickMode &&
    prevProps.disableAutoFit === nextProps.disableAutoFit &&
    prevProps.center?.lat === nextProps.center?.lat &&
    prevProps.center?.lng === nextProps.center?.lng &&
    prevProps.pickup?.lat === nextProps.pickup?.lat &&
    prevProps.pickup?.lng === nextProps.pickup?.lng &&
    prevProps.destination?.lat === nextProps.destination?.lat &&
    prevProps.destination?.lng === nextProps.destination?.lng &&
    prevProps.driverLocation?.lat === nextProps.driverLocation?.lat &&
    prevProps.driverLocation?.lng === nextProps.driverLocation?.lng &&
    driversUnchanged
  );
});

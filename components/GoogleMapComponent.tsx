'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface GoogleMapComponentProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pickup?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  driverLocation?: { lat: number; lng: number } | null;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  clickMode?: 'pickup' | 'destination' | null;
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

export default function GoogleMapComponent({
  center,
  zoom = 13,
  pickup,
  destination,
  driverLocation,
  onLocationChange,
  onMapClick,
  clickMode = null,
}: GoogleMapComponentProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

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
          alert('No se pudo obtener tu ubicación. Por favor, verifica los permisos del navegador.');
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      alert('Tu navegador no soporta geolocalización.');
      setIsGettingLocation(false);
    }
  };

  // Ajustar el mapa para mostrar ambos marcadores
  useEffect(() => {
    if (map && pickup && destination) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(destination);
      map.fitBounds(bounds, { top: 100, bottom: 100, left: 100, right: 100 });
    }
  }, [map, pickup, destination]);

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
        center={center}
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

        {/* Línea desde el conductor hasta el punto de recogida (azul) */}
        {driverLocation && pickup && (
          <Polyline
            path={[driverLocation, pickup]}
            options={{
              strokeColor: '#3b82f6',
              strokeOpacity: 0.8,
              strokeWeight: 4,
              geodesic: true,
            }}
          />
        )}

        {/* Línea desde el punto de recogida hasta el destino (verde) */}
        {pickup && destination && (
          <Polyline
            path={[pickup, destination]}
            options={{
              strokeColor: '#10b981',
              strokeOpacity: 0.6,
              strokeWeight: 4,
              geodesic: true,
              icons: [{
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 3,
                  strokeColor: '#10b981',
                },
                offset: '100%',
              }],
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

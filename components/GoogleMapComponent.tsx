"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  GoogleMap,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { useGoogleMaps } from "@/lib/google-maps-provider";

interface NearbyDriverMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  vehicle: string;
  rating: number;
}

interface RequestingPassengerMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  gender?: "male" | "female" | "other";
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
}

interface GoogleMapComponentProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pickup?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  driverLocation?: { lat: number; lng: number } | null;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  clickMode?: "pickup" | "destination" | null;
  disableAutoFit?: boolean;
  followDriver?: boolean; // Seguir al conductor en tiempo real con panTo
  nearbyDrivers?: NearbyDriverMarker[]; // Conductores disponibles para mostrar en el mapa
  onDriverClick?: (driverId: string) => void; // Callback al hacer clic en un conductor
  requestingPassengers?: RequestingPassengerMarker[]; // Pasajeros solicitando viaje
  onPassengerClick?: (passengerId: string) => void; // Callback al hacer clic en un pasajero
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultOptions = {
  disableDefaultUI: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  rotateControl: false,
  mapId: 'motaxi_map',
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
  followDriver = false,
  nearbyDrivers = [],
  onDriverClick,
  requestingPassengers = [],
  onPassengerClick,
}: GoogleMapComponentProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [initialCenter] = useState(center);
  const [directionsToPickup, setDirectionsToPickup] =
    useState<google.maps.DirectionsResult | null>(null);
  const [directionsToDestination, setDirectionsToDestination] =
    useState<google.maps.DirectionsResult | null>(null);

  // Referencias para evitar recalcular rutas innecesariamente
  const lastPickupRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDestinationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDriverLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Referencias para AdvancedMarkerElements
  const pickupMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const destinationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const nearbyMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const passengerMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng && onMapClick) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        onMapClick({ lat, lng });
      }
    },
    [onMapClick],
  );

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
          console.error("Error getting location:", error);
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      );
    } else {
      console.warn("Tu navegador no soporta geolocalización.");
      setIsGettingLocation(false);
    }
  };

  // Seguir al conductor en tiempo real cuando followDriver está activo
  useEffect(() => {
    if (!followDriver || !map || !driverLocation) return;
    const hasMovedSignificantly =
      !lastDriverLocationRef.current ||
      Math.abs(lastDriverLocationRef.current.lat - driverLocation.lat) >
        0.00005 ||
      Math.abs(lastDriverLocationRef.current.lng - driverLocation.lng) >
        0.00005;
    if (hasMovedSignificantly) {
      map.panTo({ lat: driverLocation.lat, lng: driverLocation.lng });
    }
  }, [followDriver, map, driverLocation]);

  // Calcular ruta desde conductor hasta punto de recogida
  useEffect(() => {
    if (!isLoaded || !driverLocation || !pickup) {
      setDirectionsToPickup(null);
      lastDriverLocationRef.current = null;
      lastPickupRef.current = null;
      return;
    }

    // Solo recalcular si las coordenadas cambiaron significativamente (más de ~10 metros)
    const hasDriverMoved =
      !lastDriverLocationRef.current ||
      Math.abs(lastDriverLocationRef.current.lat - driverLocation.lat) >
        0.0001 ||
      Math.abs(lastDriverLocationRef.current.lng - driverLocation.lng) > 0.0001;

    const hasPickupChanged =
      !lastPickupRef.current ||
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
          console.error("Error calculating route to pickup:", status);
        }
      },
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
    const hasPickupChanged =
      !lastPickupRef.current ||
      Math.abs(lastPickupRef.current.lat - pickup.lat) > 0.0001 ||
      Math.abs(lastPickupRef.current.lng - pickup.lng) > 0.0001;

    const hasDestinationChanged =
      !lastDestinationRef.current ||
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
          console.error("Error calculating route to destination:", status);
        }
      },
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

  // Helpers para crear pin SVG circular de color sólido
  const makeDotPin = (color: string, size = 20) => {
    const el = document.createElement('div');
    el.innerHTML = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
    return el;
  };

  // Marcador pickup (verde)
  useEffect(() => {
    if (!map) { pickupMarkerRef.current && (pickupMarkerRef.current.map = null); return; }
    if (!pickup) { pickupMarkerRef.current && (pickupMarkerRef.current.map = null); pickupMarkerRef.current = null; return; }
    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({ map, position: pickup, content: makeDotPin('#10b981'), title: 'Punto de recogida' });
    } else {
      pickupMarkerRef.current.position = pickup;
      pickupMarkerRef.current.map = map;
    }
  }, [map, pickup]);

  // Marcador destino (rojo)
  useEffect(() => {
    if (!map) { destinationMarkerRef.current && (destinationMarkerRef.current.map = null); return; }
    if (!destination) { destinationMarkerRef.current && (destinationMarkerRef.current.map = null); destinationMarkerRef.current = null; return; }
    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({ map, position: destination, content: makeDotPin('#ef4444'), title: 'Destino' });
    } else {
      destinationMarkerRef.current.position = destination;
      destinationMarkerRef.current.map = map;
    }
  }, [map, destination]);

  // Marcador usuario (azul)
  useEffect(() => {
    if (!map) return;
    if (!userLocation) { userMarkerRef.current && (userMarkerRef.current.map = null); userMarkerRef.current = null; return; }
    if (!userMarkerRef.current) {
      userMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({ map, position: userLocation, content: makeDotPin('#3b82f6', 16), title: 'Tu ubicación' });
    } else {
      userMarkerRef.current.position = userLocation;
      userMarkerRef.current.map = map;
    }
  }, [map, userLocation]);

  // Marcador conductor (moto naranja)
  useEffect(() => {
    if (!map) return;
    if (!driverLocation) { driverMarkerRef.current && (driverMarkerRef.current.map = null); driverMarkerRef.current = null; return; }
    const el = document.createElement('div');
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11.5" fill="white" stroke="#f97316" stroke-width="2"/><g transform="translate(4,6)"><circle cx="3" cy="9" r="2" fill="#374151"/><circle cx="13" cy="9" r="2" fill="#374151"/><path d="M5 9L7 4H9L11 9" stroke="#f97316" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M7 4H8C8.5 4 9 4.3 9.3 4.7L11 7" stroke="#f97316" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="8" cy="2" r="1.2" fill="#f97316"/></g></svg>`;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({ map, position: driverLocation, content: el, title: 'Tu conductor' });
    } else {
      driverMarkerRef.current.position = driverLocation;
      driverMarkerRef.current.content = el;
      driverMarkerRef.current.map = map;
    }
  }, [map, driverLocation]);

  // Marcadores conductores cercanos — ícono de moto con pulso animado estilo InDrive
  useEffect(() => {
    if (!map) return;
    nearbyMarkersRef.current.forEach((m) => (m.map = null));
    nearbyMarkersRef.current = [];
    nearbyDrivers.forEach((driver) => {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:48px;height:48px;';
      el.innerHTML = `
        <style>
          @keyframes moto-pulse {
            0%,100%{transform:scale(1);opacity:0.6}
            50%{transform:scale(1.6);opacity:0}
          }
        </style>
        <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(249,115,22,0.15);animation:moto-pulse 2s ease-in-out infinite;"></div>
        <div style="position:absolute;inset:-3px;border-radius:50%;background:rgba(249,115,22,0.1);animation:moto-pulse 2s ease-in-out infinite 0.4s;"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" style="position:relative;z-index:1;">
          <circle cx="24" cy="24" r="22" fill="white" stroke="#f97316" stroke-width="2.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"/>
          <g transform="translate(9,13)">
            <circle cx="4.5" cy="15" r="3.5" fill="#1f2937" stroke="#f97316" stroke-width="1"/>
            <circle cx="25.5" cy="15" r="3.5" fill="#1f2937" stroke="#f97316" stroke-width="1"/>
            <path d="M8 15 L11 6 H16 L20 15" stroke="#f97316" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 6 H15C16 6 17 6.6 17.6 7.4L21 12" stroke="#f97316" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M8 15 H22" stroke="#6b7280" stroke-width="1.5" fill="none"/>
            <circle cx="15" cy="3" r="2.2" fill="#f97316"/>
            <circle cx="15" cy="3" r="1" fill="white"/>
          </g>
        </svg>`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: driver.lat, lng: driver.lng },
        content: el,
        title: `${driver.name} — ${driver.vehicle} ⭐ ${driver.rating}`,
      });
      marker.addListener('click', () => onDriverClick && onDriverClick(driver.id));
      nearbyMarkersRef.current.push(marker);
    });
  }, [map, nearbyDrivers]);

  // Marcadores pasajeros solicitando
  useEffect(() => {
    if (!map) return;
    passengerMarkersRef.current.forEach((m) => (m.map = null));
    passengerMarkersRef.current = [];
    requestingPassengers.forEach((passenger) => {
      const genderIcon = passenger.gender === 'male' ? '🙋🏻‍♂️' : passenger.gender === 'female' ? '🙋🏻‍♀️' : '🙋';
      const el = document.createElement('div');
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="#dc2626" opacity="0.3"><animate attributeName="r" values="18;24;18" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite"/></circle><circle cx="25" cy="25" r="16" fill="#ef4444" opacity="0.5"><animate attributeName="r" values="16;20;16" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite"/></circle><circle cx="25" cy="25" r="14" fill="#dc2626" stroke="white" stroke-width="2"/><text x="25" y="33" font-size="18" text-anchor="middle" fill="white">${genderIcon}</text></svg>`;
      const marker = new google.maps.marker.AdvancedMarkerElement({ map, position: { lat: passenger.lat, lng: passenger.lng }, content: el, title: `${passenger.name} solicita viaje · ${passenger.distance_km.toFixed(1)} km` });
      marker.addListener('click', () => onPassengerClick && onPassengerClick(passenger.id));
      passengerMarkersRef.current.push(marker);
    });
  }, [map, requestingPassengers]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center p-6 max-w-md bg-white rounded-2xl shadow-xl">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-[#008000]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <p className="text-red-600 font-semibold text-lg mb-2">
            Google Maps requiere configuración
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Necesitas activar las APIs de Google Maps en Google Cloud Console.
          </p>
          <details className="text-left text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <summary className="cursor-pointer font-medium text-[#008000] hover:text-[#006600]">
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
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
          gestureHandling: "greedy",
        }}
        onClick={clickMode ? handleMapClick : undefined}
      >
        {/* Marcadores gestionados imperativamente via useEffect con AdvancedMarkerElement */}

        {/* Ruta desde el conductor hasta el punto de recogida (azul) */}
        {directionsToPickup && (
          <DirectionsRenderer
            directions={directionsToPickup}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#3b82f6",
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
                strokeColor: "#10b981",
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
        className="absolute  top-28 right-2 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
        title="Centrar en mi ubicación"
      >
        {isGettingLocation ? (
          <svg
            className="w-6 h-6 text-[#008000] animate-spin"
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
            className="w-6 h-6 text-[#008000]"
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

  const passengersUnchanged =
    prevProps.requestingPassengers?.length ===
      nextProps.requestingPassengers?.length &&
    (nextProps.requestingPassengers || []).every((p, i) => {
      const prev = (prevProps.requestingPassengers || [])[i];
      return prev?.id === p.id && prev?.lat === p.lat && prev?.lng === p.lng;
    });

  return (
    prevProps.zoom === nextProps.zoom &&
    prevProps.clickMode === nextProps.clickMode &&
    prevProps.disableAutoFit === nextProps.disableAutoFit &&
    prevProps.followDriver === nextProps.followDriver &&
    prevProps.center?.lat === nextProps.center?.lat &&
    prevProps.center?.lng === nextProps.center?.lng &&
    prevProps.pickup?.lat === nextProps.pickup?.lat &&
    prevProps.pickup?.lng === nextProps.pickup?.lng &&
    prevProps.destination?.lat === nextProps.destination?.lat &&
    prevProps.destination?.lng === nextProps.destination?.lng &&
    prevProps.driverLocation?.lat === nextProps.driverLocation?.lat &&
    prevProps.driverLocation?.lng === nextProps.driverLocation?.lng &&
    driversUnchanged &&
    passengersUnchanged
  );
});

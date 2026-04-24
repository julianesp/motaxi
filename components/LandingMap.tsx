'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, Circle } from '@react-google-maps/api';
import { MUNICIPALITIES, VALLE_SIBUNDOY_CENTER } from '@/lib/constants/municipalities';
import { useGoogleMaps } from '@/lib/google-maps-provider';

interface ActiveDriver {
  id: string;
  current_latitude: number;
  current_longitude: number;
  vehicle_types?: string;
  full_name?: string;
  rating?: number;
}


const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1rem',
};

const defaultOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  mapId: 'motaxi_landing_map',
};

export default function LandingMap() {
  const { isLoaded, loadError } = useGoogleMaps();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [totalActiveDrivers, setTotalActiveDrivers] = useState(0);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const driverMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    driverMarkersRef.current.forEach((m) => (m.map = null));
    driverMarkersRef.current = [];
    setMap(null);
  }, []);

  // Fetch conductores activos cada 30s
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    const fetchDrivers = () => {
      fetch(`${API_URL}/drivers/nearby?lat=${VALLE_SIBUNDOY_CENTER.lat}&lng=${VALLE_SIBUNDOY_CENTER.lng}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data) return;
          const all = data.drivers || [];
          setTotalActiveDrivers(all.length);
          setActiveDrivers(all.filter((d: any) => d.current_latitude && d.current_longitude));
        })
        .catch(() => {});
    };
    fetchDrivers();
    const interval = setInterval(fetchDrivers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Crear marcadores de conductores activos
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Limpiar marcadores anteriores
    driverMarkersRef.current.forEach((m) => (m.map = null));
    driverMarkersRef.current = [];

    const vehicleIcons: Record<string, string> = {
      moto: '🏍️', taxi: '🚕', carro: '🚐', piaggio: '🛻', ambos: '🏍️',
    };

    activeDrivers.forEach((driver) => {
      const icon = vehicleIcons[driver.vehicle_types || 'moto'] ?? '🏍️';
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 28px; height: 28px;
        background: #22c55e;
        border: 2.5px solid #fff;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        cursor: default;
      `;
      dot.textContent = icon;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: driver.current_latitude, lng: driver.current_longitude },
        content: dot,
        title: driver.full_name || 'Conductor activo',
      });

      driverMarkersRef.current.push(marker);
    });
  }, [map, isLoaded, activeDrivers]);

  // Crear AdvancedMarkerElement para cada municipio cuando el mapa esté listo
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    MUNICIPALITIES.forEach((municipality) => {
      const pin = document.createElement('div');
      pin.innerHTML = `
        <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad${municipality.id}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="18" fill="url(#grad${municipality.id})" stroke="white" stroke-width="3"/>
          <text x="20" y="26" text-anchor="middle" font-size="16" font-weight="bold" fill="white" font-family="system-ui, -apple-system, sans-serif">
            ${municipality.name[0]}
          </text>
        </svg>`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: municipality.coordinates,
        content: pin,
        title: municipality.name,
      });

      marker.addListener('click', () => setSelectedMunicipality(municipality.id));
      markersRef.current.push(marker);
    });
  }, [map, isLoaded]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-purple-50 rounded-2xl">
        <div className="text-center p-6">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-[#008000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-red-600 font-semibold mb-2">Error al cargar Google Maps</p>
          <p className="text-sm text-gray-600">Por favor, verifica la configuración de la API</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-purple-100 rounded-2xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
          <p className="mt-4 text-[#008000]">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
      {/* Badge conductores activos */}
      {totalActiveDrivers > 0 && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow text-sm font-semibold text-gray-800">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          {totalActiveDrivers} {totalActiveDrivers === 1 ? 'conductor activo' : 'conductores activos'}
        </div>
      )}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={VALLE_SIBUNDOY_CENTER}
        zoom={11}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={defaultOptions}
      >
        {/* Círculo para resaltar el área del Valle */}
        <Circle
          center={VALLE_SIBUNDOY_CENTER}
          radius={15000} // 15 km de radio
          options={{
            strokeColor: '#667eea',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#667eea',
            fillOpacity: 0.1,
          }}
        />

        {/* Marcadores creados imperativamente via useEffect con AdvancedMarkerElement */}
      </GoogleMap>

      {/* Info card para municipio seleccionado */}
      {selectedMunicipality && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-2xl p-4 animate-slide-up">
          {(() => {
            const municipality = MUNICIPALITIES.find((m) => m.id === selectedMunicipality);
            if (!municipality) return null;

            return (
              <>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-bold text-[#008000]">
                    {municipality.name}
                  </h3>
                  <button
                    onClick={() => setSelectedMunicipality(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-600 text-sm mb-2">
                  {municipality.description}
                </p>
                {municipality.population && (
                  <div className="flex items-center text-sm text-gray-500">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    {municipality.population.toLocaleString()} habitantes
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

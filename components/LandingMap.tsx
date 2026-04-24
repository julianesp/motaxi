'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, Circle } from '@react-google-maps/api';
import { MUNICIPALITIES, VALLE_SIBUNDOY_CENTER } from '@/lib/constants/municipalities';
import { useGoogleMaps } from '@/lib/google-maps-provider';

interface Hotspot {
  latitude: number;
  longitude: number;
  address: string;
  trip_count: number;
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
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const hotspotMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    fetch(`${API_URL}/analytics/heatmap?days=30`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        const pickups: Hotspot[] = (data.pickup_hotspots || []).map((h: any) => ({
          latitude: h.pickup_latitude,
          longitude: h.pickup_longitude,
          address: h.pickup_address,
          trip_count: h.trip_count,
        }));
        setHotspots(pickups);
      })
      .catch(() => {});
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    hotspotMarkersRef.current.forEach((m) => (m.map = null));
    hotspotMarkersRef.current = [];
    setMap(null);
  }, []);

  // Crear marcadores de hotspots cuando el mapa y los datos estén listos
  useEffect(() => {
    if (!map || !isLoaded || hotspots.length === 0) return;

    // Limpiar marcadores anteriores de hotspots
    hotspotMarkersRef.current.forEach((m) => (m.map = null));
    hotspotMarkersRef.current = [];

    const maxCount = Math.max(...hotspots.map((h) => h.trip_count), 1);

    hotspots.slice(0, 10).forEach((hotspot) => {
      const intensity = Math.max(0.3, hotspot.trip_count / maxCount);
      const size = Math.round(20 + intensity * 20); // 20–40px
      const alpha = Math.round(intensity * 220);
      const alphaHex = alpha.toString(16).padStart(2, '0');

      const pin = document.createElement('div');
      pin.style.cursor = 'pointer';
      pin.innerHTML = `
        <div style="position:relative;width:${size}px;height:${size}px;">
          <div style="
            position:absolute;inset:0;border-radius:50%;
            background:#FF5722${alphaHex};
            border:2px solid #FF5722;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 ${Math.round(intensity * 12)}px #FF572288;
          ">
            <span style="color:white;font-size:${Math.round(8 + intensity * 6)}px;font-weight:bold;line-height:1;">
              ${hotspot.trip_count}
            </span>
          </div>
        </div>`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: hotspot.latitude, lng: hotspot.longitude },
        content: pin,
        title: hotspot.address,
      });

      marker.addListener('click', () => {
        setSelectedMunicipality(null);
        setSelectedHotspot(hotspot);
      });
      hotspotMarkersRef.current.push(marker);
    });
  }, [map, isLoaded, hotspots]);

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

      {/* Leyenda de hotspots */}
      {hotspots.length > 0 && (
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5722] shadow-lg shadow-orange-500/50" />
          <span className="text-white text-xs font-medium">Lugares frecuentes</span>
        </div>
      )}

      {/* Info card para hotspot seleccionado */}
      {selectedHotspot && !selectedMunicipality && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-2xl p-4 animate-slide-up">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">{selectedHotspot.address}</h3>
            </div>
            <button
              onClick={() => setSelectedHotspot(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-2 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-orange-600 font-semibold text-sm ml-10">
            {selectedHotspot.trip_count} {selectedHotspot.trip_count === 1 ? 'viaje' : 'viajes'} solicitados aquí
          </p>
        </div>
      )}

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

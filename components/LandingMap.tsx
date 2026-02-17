'use client';

import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import { MUNICIPALITIES, VALLE_SIBUNDOY_CENTER } from '@/lib/constants/municipalities';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

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
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

export default function LandingMap() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl">
        <div className="text-center p-6">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-indigo-600">Cargando mapa...</p>
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

        {/* Marcadores para cada municipio */}
        {MUNICIPALITIES.map((municipality) => (
          <Marker
            key={municipality.id}
            position={municipality.coordinates}
            icon={{
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
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
                </svg>
              `)}`,
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
            onClick={() => setSelectedMunicipality(municipality.id)}
            title={municipality.name}
          />
        ))}
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
                  <h3 className="text-xl font-bold text-indigo-600">
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

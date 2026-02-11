'use client';

import { useEffect, useRef, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { MUNICIPALITIES } from '@/lib/constants/municipalities';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectPlace: (place: {
    address: string;
    latitude: number;
    longitude: number;
    place_id?: string;
  }) => void;
  placeholder: string;
  icon: 'pickup' | 'destination';
  className?: string;
  favorites?: Array<{
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    place_id?: string | null;
  }>;
  onSelectFavorite?: (favorite: any) => void;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onSelectPlace,
  placeholder,
  icon,
  className = '',
  favorites = [],
  onSelectFavorite,
}: PlacesAutocompleteProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    if (isLoaded && inputRef.current && !autocompleteRef.current) {
      try {
        // Configurar autocomplete con restricción de región (Colombia)
        autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'co' }, // Restringir a Colombia
          fields: ['address_components', 'geometry', 'name', 'formatted_address', 'place_id'],
          types: ['geocode', 'establishment'], // Permitir direcciones y lugares
        });

        // Agregar bias de ubicación para el Valle de Sibundoy
        const valleCenter = new google.maps.LatLng(1.1656, -77.0);
        const circle = new google.maps.Circle({
          center: valleCenter,
          radius: 50000, // 50 km alrededor del Valle
        });
        autocompleteRef.current.setBounds(circle.getBounds()!);

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place?.geometry?.location) {
            onSelectPlace({
              address: place.formatted_address || place.name || '',
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
              place_id: place.place_id,
            });
            setShowSuggestions(false);
          }
        });
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
      }
    }
  }, [isLoaded, onSelectPlace]);

  const handleFocus = () => {
    // No mostrar sugerencias automáticas, solo usar Google Places Autocomplete
    // Si hay favoritos, mostrarlos
    if (favorites && favorites.length > 0) {
      setShowFavorites(true);
    }
  };

  const handleBlur = () => {
    // Delay para permitir clicks en las sugerencias
    setTimeout(() => {
      setShowSuggestions(false);
      setShowFavorites(false);
    }, 200);
  };

  const handleSelectMunicipality = (municipality: typeof MUNICIPALITIES[0]) => {
    onSelectPlace({
      address: municipality.name + ', Valle de Sibundoy',
      latitude: municipality.coordinates.lat,
      longitude: municipality.coordinates.lng,
    });
    onChange(municipality.name + ', Valle de Sibundoy');
    setShowSuggestions(false);
  };

  const handleSelectFavorite = (favorite: any) => {
    onSelectPlace({
      address: favorite.address,
      latitude: favorite.latitude,
      longitude: favorite.longitude,
      place_id: favorite.place_id || undefined,
    });
    onChange(favorite.address);
    setShowFavorites(false);
    if (onSelectFavorite) {
      onSelectFavorite(favorite);
    }
  };

  const iconColor = icon === 'pickup' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="relative suggestions-container">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full pl-10 pr-12 py-3.5 md:py-4 border-2 ${
          icon === 'pickup' ? 'border-green-200 focus:ring-green-500 focus:border-green-500' : 'border-red-200 focus:ring-red-500 focus:border-red-500'
        } rounded-xl focus:outline-none focus:ring-2 bg-white shadow-sm hover:shadow-md transition-shadow ${className}`}
        style={{ touchAction: 'manipulation' }}
      />
      <div className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      {/* Favoritos */}
      {showFavorites && favorites.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 max-h-80 overflow-y-auto z-40 backdrop-blur-sm">
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <div className="text-xs font-semibold text-gray-700">Favoritos</div>
              </div>
              <button
                onClick={() => {
                  setShowFavorites(false);
                  setShowSuggestions(true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Ver municipios
              </button>
            </div>
            {favorites.map((favorite) => (
              <button
                key={favorite.id}
                onClick={() => handleSelectFavorite(favorite)}
                className="w-full text-left px-3 py-2.5 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-xl transition-all flex items-center space-x-3 group"
              >
                <div
                  className={`w-10 h-10 md:w-11 md:h-11 ${icon === 'pickup' ? 'bg-gradient-to-br from-green-100 to-green-200' : 'bg-gradient-to-br from-red-100 to-red-200'} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow`}
                >
                  <svg
                    className={`w-5 h-5 ${icon === 'pickup' ? 'text-green-600' : 'text-red-600'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm md:text-base">{favorite.name}</div>
                  <div className="text-xs md:text-sm text-gray-500 truncate">{favorite.address}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sugerencias de Municipios */}
      {showSuggestions && !showFavorites && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-40 backdrop-blur-sm">
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="text-xs font-semibold text-gray-700">Municipios del Valle</div>
              </div>
              {favorites.length > 0 && (
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    setShowFavorites(true);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Ver favoritos
                </button>
              )}
            </div>
            {MUNICIPALITIES.map((municipality) => (
              <button
                key={municipality.id}
                onClick={() => handleSelectMunicipality(municipality)}
                className="w-full text-left px-3 py-2.5 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-xl transition-all flex items-center space-x-3 group"
              >
                <div
                  className={`w-10 h-10 md:w-11 md:h-11 ${icon === 'pickup' ? 'bg-gradient-to-br from-green-100 to-green-200' : 'bg-gradient-to-br from-red-100 to-red-200'} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow`}
                >
                  <span className={`${icon === 'pickup' ? 'text-green-600' : 'text-red-600'} font-bold text-lg`}>
                    {municipality.name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm md:text-base">{municipality.name}</div>
                  <div className="text-xs md:text-sm text-gray-500 truncate">{municipality.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

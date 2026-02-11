'use client';

import { useState, useRef, useEffect } from 'react';
import { MUNICIPALITIES } from '@/lib/constants/municipalities';

interface SimpleLocationPickerProps {
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

export default function SimpleLocationPicker({
  value,
  onChange,
  onSelectPlace,
  placeholder,
  icon,
  className = '',
  favorites = [],
  onSelectFavorite,
}: SimpleLocationPickerProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowFavorites(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    if (favorites && favorites.length > 0) {
      setShowFavorites(true);
    } else {
      setShowSuggestions(true);
    }
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
    <div ref={containerRef} className="relative">
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
        <div className={`w-3 h-3 ${iconColor} rounded-full border-2 border-white shadow-md`}></div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={`w-full px-12 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-${icon === 'pickup' ? 'green' : 'red'}-500 focus:border-transparent bg-white shadow-sm ${className}`}
        style={{ touchAction: 'manipulation' }}
      />
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-40">
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="text-xs font-semibold text-gray-500">Favoritos</div>
              <button
                onClick={() => {
                  setShowFavorites(false);
                  setShowSuggestions(true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                Ver municipios
              </button>
            </div>
            {favorites.map((favorite) => (
              <button
                key={favorite.id}
                onClick={() => handleSelectFavorite(favorite)}
                className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center space-x-3"
              >
                <div
                  className={`w-10 h-10 ${icon === 'pickup' ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center flex-shrink-0`}
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
                  <div className="font-medium text-gray-900">{favorite.name}</div>
                  <div className="text-sm text-gray-500 truncate">{favorite.address}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sugerencias de Municipios */}
      {showSuggestions && !showFavorites && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-40">
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="text-xs font-semibold text-gray-500">Municipios del Valle</div>
              {favorites.length > 0 && (
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    setShowFavorites(true);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  Ver favoritos
                </button>
              )}
            </div>
            {MUNICIPALITIES.map((municipality) => (
              <button
                key={municipality.id}
                onClick={() => handleSelectMunicipality(municipality)}
                className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center space-x-3"
              >
                <div
                  className={`w-10 h-10 ${icon === 'pickup' ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center flex-shrink-0`}
                >
                  <span className={`${icon === 'pickup' ? 'text-green-600' : 'text-red-600'} font-bold`}>
                    {municipality.name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{municipality.name}</div>
                  <div className="text-sm text-gray-500 truncate">{municipality.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

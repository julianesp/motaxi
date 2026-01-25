'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { MUNICIPALITIES } from '@/lib/constants/municipalities';
import dynamic from 'next/dynamic';

// Importar el mapa dinámicamente para evitar problemas con SSR
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando mapa...</p>
      </div>
    </div>
  ),
});

interface LocationInput {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export default function PassengerHomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [pickup, setPickup] = useState<LocationInput>({
    address: '',
    latitude: null,
    longitude: null,
  });

  const [destination, setDestination] = useState<LocationInput>({
    address: '',
    latitude: null,
    longitude: null,
  });

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showTripRequest, setShowTripRequest] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'passenger')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Obtener ubicación actual del usuario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setPickup({
            ...pickup,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Si no se puede obtener la ubicación, usar el centro del Valle de Sibundoy
          setCurrentLocation({ lat: 1.1656, lng: -77.0 });
        }
      );
    }
  }, []);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.suggestions-container')) {
        setShowPickupSuggestions(false);
        setShowDestinationSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelectLocation = (type: 'pickup' | 'destination', municipality: typeof MUNICIPALITIES[0]) => {
    if (type === 'pickup') {
      setPickup({
        address: municipality.name + ', Valle de Sibundoy',
        latitude: municipality.coordinates.lat,
        longitude: municipality.coordinates.lng,
      });
      setShowPickupSuggestions(false);
    } else {
      setDestination({
        address: municipality.name + ', Valle de Sibundoy',
        latitude: municipality.coordinates.lat,
        longitude: municipality.coordinates.lng,
      });
      setShowDestinationSuggestions(false);
    }
  };

  const handleRequestTrip = () => {
    if (pickup.latitude && pickup.longitude && destination.latitude && destination.longitude) {
      setShowTripRequest(true);
      // Aquí calcularías la tarifa estimada basada en la distancia
      const distance = calculateDistance(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude
      );
      setEstimatedFare(Math.round(5000 + distance * 2000)); // Tarifa base + 2000 por km
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-indigo-600">MoTaxi</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Hola, {user?.full_name?.split(' ')[0] || 'Usuario'}</span>
              <button
                onClick={() => router.push('/passenger/profile')}
                className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"
              >
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map */}
        <div className="absolute inset-0" style={{ paddingBottom: '320px' }}>
          <MapComponent
            center={currentLocation || { lat: 1.1656, lng: -77.0 }}
            zoom={13}
            pickup={pickup.latitude && pickup.longitude ? { lat: pickup.latitude, lng: pickup.longitude } : null}
            destination={
              destination.latitude && destination.longitude
                ? { lat: destination.latitude, lng: destination.longitude }
                : null
            }
          />
        </div>

        {/* Trip Request Card - Fija en la parte inferior */}
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-30 pointer-events-auto">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">¿A dónde vas?</h2>

            {/* Pickup Input */}
            <div className="relative suggestions-container">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
                <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
              </div>
              <input
                type="text"
                value={pickup.address}
                onChange={(e) => setPickup({ ...pickup, address: e.target.value })}
                onFocus={() => setShowPickupSuggestions(true)}
                placeholder="Ubicación de recogida"
                className="w-full px-12 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
                style={{ touchAction: 'manipulation' }}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>

              {/* Pickup Suggestions */}
              {showPickupSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-40">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-500 px-3 py-2">Municipios del Valle</div>
                    {MUNICIPALITIES.map((municipality) => (
                      <button
                        key={municipality.id}
                        onClick={() => handleSelectLocation('pickup', municipality)}
                        className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center space-x-3"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-green-600 font-bold">{municipality.name[0]}</span>
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

            {/* Destination Input */}
            <div className="relative suggestions-container">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
                <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md"></div>
              </div>
              <input
                type="text"
                value={destination.address}
                onChange={(e) => setDestination({ ...destination, address: e.target.value })}
                onFocus={() => setShowDestinationSuggestions(true)}
                placeholder="¿A dónde vas?"
                className="w-full px-12 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white shadow-sm"
                style={{ touchAction: 'manipulation' }}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>

              {/* Destination Suggestions */}
              {showDestinationSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-40">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-500 px-3 py-2">Municipios del Valle</div>
                    {MUNICIPALITIES.map((municipality) => (
                      <button
                        key={municipality.id}
                        onClick={() => handleSelectLocation('destination', municipality)}
                        className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center space-x-3"
                      >
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-red-600 font-bold">{municipality.name[0]}</span>
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

            {/* Estimated Fare */}
            {estimatedFare && (
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Tarifa estimada:</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    ${estimatedFare.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Request Button */}
            <button
              onClick={handleRequestTrip}
              disabled={!pickup.latitude || !destination.latitude}
              className="btn btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Solicitar MoTaxi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

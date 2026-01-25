'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
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
        }
      );
    }
  }, []);

  const handleRequestTrip = () => {
    if (pickup.latitude && pickup.longitude && destination.latitude && destination.longitude) {
      setShowTripRequest(true);
      // Aquí calcularías la tarifa estimada
      setEstimatedFare(15000); // Ejemplo
    }
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
              <span className="text-gray-700">Hola, {user?.full_name.split(' ')[0]}</span>
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
      <div className="flex-1 relative">
        {/* Map */}
        <div className="absolute inset-0">
          <MapComponent
            center={currentLocation || { lat: 4.6097, lng: -74.0817 }}
            zoom={15}
            pickup={pickup.latitude && pickup.longitude ? { lat: pickup.latitude, lng: pickup.longitude } : null}
            destination={
              destination.latitude && destination.longitude
                ? { lat: destination.latitude, lng: destination.longitude }
                : null
            }
          />
        </div>

        {/* Trip Request Card */}
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-20">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">¿A dónde vas?</h2>

            {/* Pickup Input */}
            <div className="relative">
              <div className="absolute left-3 top-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <input
                type="text"
                value={pickup.address}
                onChange={(e) => setPickup({ ...pickup, address: e.target.value })}
                placeholder="Ubicación de recogida"
                className="input pl-10"
              />
            </div>

            {/* Destination Input */}
            <div className="relative">
              <div className="absolute left-3 top-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <input
                type="text"
                value={destination.address}
                onChange={(e) => setDestination({ ...destination, address: e.target.value })}
                placeholder="¿A dónde vas?"
                className="input pl-10"
              />
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

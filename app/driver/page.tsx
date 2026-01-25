'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';

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

export default function DriverHomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [isAvailable, setIsAvailable] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    month: 0,
  });

  useEffect(() => {
    if (!loading && (!user || user.role !== 'driver')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Obtener ubicación actual del conductor
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, []);

  const toggleAvailability = () => {
    setIsAvailable(!isAvailable);
    // Aquí llamarías al API para actualizar la disponibilidad
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
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-indigo-600">MoTaxi</h1>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isAvailable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {isAvailable ? 'Disponible' : 'No disponible'}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/driver/earnings')}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200"
              >
                Ganancias
              </button>
              <button
                onClick={() => router.push('/driver/profile')}
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
            pickup={currentLocation}
          />
        </div>

        {/* Status Card */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-lg p-4 z-20">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleAvailability}
              className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${
                isAvailable ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform ${
                  isAvailable ? 'translate-x-11' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-gray-700 font-medium">
              {isAvailable ? 'Conectado - Esperando viajes' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Earnings Summary */}
        {!activeTrip && (
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-20">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen de Ganancias</h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Hoy</p>
                <p className="text-2xl font-bold text-indigo-600">${earnings.today.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Semana</p>
                <p className="text-2xl font-bold text-indigo-600">${earnings.week.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Mes</p>
                <p className="text-2xl font-bold text-indigo-600">${earnings.month.toLocaleString()}</p>
              </div>
            </div>

            {!isAvailable && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800">
                  Activa tu disponibilidad para empezar a recibir solicitudes de viaje
                </p>
              </div>
            )}

            {isAvailable && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-medium">Esperando solicitudes de viaje...</p>
                <div className="flex items-center justify-center mt-2">
                  <div className="animate-pulse flex space-x-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

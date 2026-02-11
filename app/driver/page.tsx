'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';

const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), {
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
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<any[]>([]);
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
    // Cargar estado de disponibilidad desde el backend
    const loadDriverStatus = async () => {
      try {
        const { driversAPI } = await import('@/lib/api-client');
        const response = await driversAPI.getProfile();
        if (response.driver) {
          setIsAvailable(response.driver.is_available === 1);
        }
      } catch (error) {
        console.error('Error loading driver status:', error);
      }
    };

    if (user?.role === 'driver') {
      loadDriverStatus();
    }
  }, [user]);

  useEffect(() => {
    // Obtener ubicación actual del conductor y enviarla al backend
    if (navigator.geolocation && user?.role === 'driver') {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(newLocation);

          // Actualizar ubicación en el backend
          try {
            const { driversAPI } = await import('@/lib/api-client');
            await driversAPI.updateLocation(newLocation.lat, newLocation.lng);
          } catch (error) {
            console.error('Error updating location:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          // Usar ubicación por defecto (Valle de Sibundoy)
          setCurrentLocation({ lat: 1.1656, lng: -77.0 });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000, // Cachear por 30 segundos
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [user]);

  useEffect(() => {
    // Consultar viajes disponibles cada 5 segundos cuando el conductor esté disponible
    if (!isAvailable || user?.role !== 'driver') {
      setAvailableTrips([]);
      return;
    }

    const fetchAvailableTrips = async () => {
      try {
        const { tripsAPI } = await import('@/lib/api-client');
        const data = await tripsAPI.getActiveTrips();
        setAvailableTrips(data.trips || []);
      } catch (error) {
        console.error('Error fetching available trips:', error);
      }
    };

    // Consultar inmediatamente
    fetchAvailableTrips();

    // Consultar cada 5 segundos
    const interval = setInterval(fetchAvailableTrips, 5000);

    return () => clearInterval(interval);
  }, [isAvailable, user]);

  const toggleAvailability = async () => {
    setIsUpdatingAvailability(true);
    const newAvailability = !isAvailable;

    try {
      const { driversAPI } = await import('@/lib/api-client');
      await driversAPI.updateAvailability(newAvailability);
      setIsAvailable(newAvailability);
    } catch (error) {
      console.error('Error updating availability:', error);
      alert('Error al actualizar disponibilidad. Intenta nuevamente.');
    } finally {
      setIsUpdatingAvailability(false);
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
          <GoogleMapComponent
            center={currentLocation || { lat: 1.1656, lng: -77.0 }}
            zoom={15}
            pickup={currentLocation}
            onLocationChange={setCurrentLocation}
          />
        </div>

        {/* Status Card */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 z-20">
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleAvailability}
              disabled={isUpdatingAvailability}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                isAvailable ? 'bg-green-500' : 'bg-gray-300'
              } ${isUpdatingAvailability ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  isAvailable ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-gray-700 text-sm">
              {isUpdatingAvailability
                ? 'Actualizando...'
                : isAvailable
                ? 'Conectado'
                : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Earnings Summary */}
        {!activeTrip && (
          <div className={`absolute bottom-0 left-0 right-0 md:left-4 md:bottom-4 md:right-auto md:w-96 bg-white/95 backdrop-blur-sm rounded-t-3xl md:rounded-3xl shadow-2xl z-20 pointer-events-auto overflow-y-auto transition-all duration-300 ${
            isPanelMinimized
              ? 'max-h-[60px] md:max-h-[70px]'
              : 'max-h-[85vh] md:max-h-[calc(100vh-2rem)]'
          }`}>
            <div className="p-4 md:p-6 space-y-3 md:space-y-4">
              {/* Handle para arrastrar en móvil y botón de toggle */}
              <div className="flex items-center justify-between -mt-2 mb-2">
                {isPanelMinimized ? (
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-600">
                        {isAvailable ? '🟢 Conectado' : '⚫ Desconectado'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        Hoy: <span className="font-bold text-indigo-600">${earnings.today.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="md:hidden flex justify-center flex-1">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
                  </div>
                )}
                <button
                  onClick={() => setIsPanelMinimized(!isPanelMinimized)}
                  className="ml-auto p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  title={isPanelMinimized ? "Expandir panel" : "Minimizar panel"}
                >
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
                      isPanelMinimized ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {!isPanelMinimized && (
                <>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">Resumen de Ganancias</h2>

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

                  {isAvailable && availableTrips.length === 0 && (
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

                  {isAvailable && availableTrips.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-800">Solicitudes Disponibles</h3>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                          {availableTrips.length} {availableTrips.length === 1 ? 'viaje' : 'viajes'}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {availableTrips.map((trip: any) => (
                          <div key={trip.id} className="bg-white border-2 border-indigo-200 rounded-xl p-4 hover:border-indigo-400 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center mb-2">
                                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                  <p className="text-sm text-gray-600 line-clamp-1">{trip.pickup_address}</p>
                                </div>
                                <div className="flex items-center">
                                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                  <p className="text-sm text-gray-600 line-clamp-1">{trip.dropoff_address}</p>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-2xl font-bold text-green-600">${trip.fare.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">{trip.distance_km.toFixed(1)} km</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={async () => {
                                  try {
                                    const { tripsAPI } = await import('@/lib/api-client');
                                    await tripsAPI.acceptTrip(trip.id);
                                    alert('¡Viaje aceptado! Dirígete al punto de recogida.');
                                    // Recargar viajes disponibles
                                    const data = await tripsAPI.getActiveTrips();
                                    setAvailableTrips(data.trips || []);
                                  } catch (error) {
                                    console.error('Error accepting trip:', error);
                                    alert('Error al aceptar el viaje. Intenta nuevamente.');
                                  }
                                }}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                Aceptar Viaje
                              </button>
                              <button
                                onClick={() => {
                                  // Remover el viaje de la lista local
                                  setAvailableTrips(availableTrips.filter(t => t.id !== trip.id));
                                }}
                                className="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                                title="Cancelar este viaje"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

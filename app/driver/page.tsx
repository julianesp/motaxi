'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';

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
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<any[]>([]);
  const [rejectedTripIds, setRejectedTripIds] = useState<Set<string>>(new Set());
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    month: 0,
  });

  // Estados para el modal de completar perfil
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    vehicle_model: '',
    vehicle_color: '',
    vehicle_plate: '',
    license_number: '',
    municipality: '',
  });
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

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

          // Verificar si el perfil está completo
          if (!response.driver.profile_completed) {
            // Mostrar modal para completar perfil
            setShowProfileModal(true);

            // Pre-cargar datos existentes si los hay
            setProfileData({
              vehicle_model: response.driver.vehicle_model || '',
              vehicle_color: response.driver.vehicle_color || '',
              vehicle_plate: response.driver.vehicle_plate || '',
              license_number: response.driver.license_number || '',
              municipality: response.driver.municipality || '',
            });
          }
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
        // Filtrar viajes rechazados localmente
        const filteredTrips = (data.trips || []).filter((trip: any) => !rejectedTripIds.has(trip.id));
        setAvailableTrips(filteredTrips);
      } catch (error) {
        console.error('Error fetching available trips:', error);
      }
    };

    // Consultar inmediatamente
    fetchAvailableTrips();

    // Consultar cada 5 segundos
    const interval = setInterval(fetchAvailableTrips, 5000);

    return () => clearInterval(interval);
  }, [isAvailable, user, rejectedTripIds]);

  const handleCompleteProfile = async () => {
    // Validar campos obligatorios
    if (!profileData.vehicle_model || !profileData.vehicle_color ||
        !profileData.vehicle_plate || !profileData.license_number) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor completa todos los campos obligatorios.',
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    setIsSubmittingProfile(true);

    try {
      const { driversAPI } = await import('@/lib/api-client');
      await driversAPI.updateProfile(profileData);

      await Swal.fire({
        icon: 'success',
        title: '¡Perfil completado!',
        text: 'Ahora puedes activarte como conductor.',
        confirmButtonColor: '#4f46e5',
        timer: 3000,
        timerProgressBar: true,
      });
      setShowProfileModal(false);

      // Recargar el perfil
      const response = await driversAPI.getProfile();
      if (response.driver) {
        setIsAvailable(response.driver.is_available === 1);
      }
    } catch (error) {
      console.error('Error completing profile:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar el perfil. Intenta nuevamente.',
        confirmButtonColor: '#4f46e5',
      });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const toggleAvailability = async () => {
    setIsUpdatingAvailability(true);
    const newAvailability = !isAvailable;

    try {
      const { driversAPI } = await import('@/lib/api-client');
      await driversAPI.updateAvailability(newAvailability);
      setIsAvailable(newAvailability);
    } catch (error: any) {
      console.error('Error updating availability:', error);

      // Verificar si el error es por perfil incompleto
      if (error.response?.data?.profileIncomplete) {
        await Swal.fire({
          icon: 'warning',
          title: 'Perfil incompleto',
          text: 'Debes completar tu perfil antes de activarte como conductor.',
          confirmButtonColor: '#4f46e5',
        });
        setShowProfileModal(true);
      } else if (error.response?.data?.notVerified) {
        Swal.fire({
          icon: 'warning',
          title: 'Cuenta no verificada',
          text: 'Tu cuenta debe estar verificada antes de poder prestar servicio.',
          confirmButtonColor: '#4f46e5',
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo actualizar la disponibilidad. Intenta nuevamente.',
          confirmButtonColor: '#4f46e5',
        });
      }
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
      <header className="bg-white shadow-sm z-50 fixed top-0 left-0 right-0">
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
      <div className="flex-1 relative pt-16 md:pt-20">
        {/* Map */}
        <div className="absolute inset-0">
          <GoogleMapComponent
            center={currentLocation || { lat: 1.1656, lng: -77.0 }}
            zoom={15}
            pickup={activeTrip ? activeTrip.pickup : null}
            destination={activeTrip ? activeTrip.destination : null}
            driverLocation={currentLocation}
            onLocationChange={setCurrentLocation}
            disableAutoFit={!!activeTrip}
          />
        </div>

        {/* Status Card */}
        <div className="absolute top-1 left-20 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 z-20">
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
                            {/* Mostrar pasajero y distancia al pickup */}
                            {trip.passenger_name && (
                              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                                <div className="flex items-center text-sm text-gray-600">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="font-medium">{trip.passenger_name}</span>
                                </div>
                                {trip.distance_to_pickup && (
                                  <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                    📍 {trip.distance_to_pickup} km de ti
                                  </div>
                                )}
                              </div>
                            )}

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
                                <p className="text-xs text-gray-500">Recorrido: {trip.distance_km.toFixed(1)} km</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={async () => {
                                  try {
                                    const { tripsAPI } = await import('@/lib/api-client');
                                    await tripsAPI.acceptTrip(trip.id);

                                    // Obtener información completa del viaje incluyendo datos del pasajero
                                    const tripData = await tripsAPI.getTrip(trip.id);

                                    // Actualizar el viaje activo con los datos completos del viaje aceptado
                                    setActiveTrip({
                                      id: trip.id,
                                      pickup: {
                                        lat: trip.pickup_latitude,
                                        lng: trip.pickup_longitude,
                                        address: trip.pickup_address,
                                      },
                                      destination: {
                                        lat: trip.dropoff_latitude,
                                        lng: trip.dropoff_longitude,
                                        address: trip.dropoff_address,
                                      },
                                      fare: trip.fare,
                                      distance: trip.distance_km,
                                      passengerName: trip.passenger_name,
                                      passengerPhone: trip.passenger_phone,
                                      status: 'accepted',
                                    });

                                    // Limpiar lista de viajes disponibles
                                    setAvailableTrips([]);

                                    Swal.fire({
                                      icon: 'success',
                                      title: '¡Viaje aceptado!',
                                      text: 'Dirígete al punto de recogida.',
                                      confirmButtonColor: '#4f46e5',
                                      timer: 3000,
                                      timerProgressBar: true,
                                    });
                                  } catch (error) {
                                    console.error('Error accepting trip:', error);
                                    Swal.fire({
                                      icon: 'error',
                                      title: 'Error',
                                      text: 'No se pudo aceptar el viaje. Intenta nuevamente.',
                                      confirmButtonColor: '#4f46e5',
                                    });
                                  }
                                }}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                Aceptar Viaje
                              </button>
                              <button
                                onClick={() => {
                                  // Agregar a la lista de rechazados
                                  setRejectedTripIds(prev => new Set([...prev, trip.id]));
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

        {/* Active Trip Panel - Mostrar cuando hay un viaje activo */}
        {activeTrip && (
          <div className="absolute bottom-0 left-0 right-0 md:left-4 md:bottom-4 md:right-auto md:w-96 bg-white/95 backdrop-blur-sm rounded-t-3xl md:rounded-3xl shadow-2xl z-20 pointer-events-auto overflow-y-auto max-h-[85vh] md:max-h-[calc(100vh-2rem)]">
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Viaje Activo</h2>
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  En curso
                </div>
              </div>

              {/* Información del Pasajero */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="font-bold text-indigo-900">Información del Pasajero</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Nombre:</span>
                    <span className="font-semibold text-gray-900">{activeTrip.passengerName || 'N/A'}</span>
                  </div>

                  {activeTrip.passengerPhone && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Teléfono:</span>
                        <span className="font-semibold text-gray-900">{activeTrip.passengerPhone}</span>
                      </div>

                      <div className="pt-3 mt-3 border-t border-indigo-200">
                        <p className="text-sm text-indigo-700 mb-3">
                          Contacta al pasajero para coordinar mejor el viaje
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {/* Llamada de Voz */}
                          <a
                            href={`tel:${activeTrip.passengerPhone}`}
                            className="flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="font-semibold">Llamar al Pasajero</span>
                          </a>

                          {/* WhatsApp */}
                          <a
                            href={`https://wa.me/${activeTrip.passengerPhone.replace(/\D/g, '')}?text=Hola,%20soy%20tu%20conductor%20en%20MoTaxi.%20Ya%20voy%20en%20camino.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            <span className="font-semibold">WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Detalles del Viaje */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-xs text-gray-500">Punto de Recogida</span>
                  </div>
                  <p className="text-sm text-gray-900 ml-5">{activeTrip.pickup.address}</p>
                </div>
                <div>
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span className="text-xs text-gray-500">Destino</span>
                  </div>
                  <p className="text-sm text-gray-900 ml-5">{activeTrip.destination.address}</p>
                </div>
              </div>

              {/* Tarifa y Distancia */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tarifa del Viaje</p>
                    <p className="text-2xl font-bold text-green-600">${activeTrip.fare?.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Distancia</p>
                    <p className="text-lg font-semibold text-gray-900">{activeTrip.distance?.toFixed(1)} km</p>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={async () => {
                    try {
                      const { tripsAPI } = await import('@/lib/api-client');
                      await tripsAPI.updateTripStatus(activeTrip.id, 'in_progress');
                      setActiveTrip({ ...activeTrip, status: 'in_progress' });
                      Swal.fire({
                        icon: 'success',
                        title: 'Viaje iniciado',
                        text: '¡Buen viaje! Lleva al pasajero a su destino.',
                        confirmButtonColor: '#4f46e5',
                        timer: 3000,
                        timerProgressBar: true,
                      });
                    } catch (error) {
                      console.error('Error starting trip:', error);
                      Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo iniciar el viaje. Intenta nuevamente.',
                        confirmButtonColor: '#4f46e5',
                      });
                    }
                  }}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span>Iniciar Viaje</span>
                </button>

                {activeTrip.status === 'in_progress' && (
                  <button
                    onClick={async () => {
                      const result = await Swal.fire({
                        icon: 'question',
                        title: '¿Finalizar viaje?',
                        text: '¿Confirmas que has llegado al destino?',
                        showCancelButton: true,
                        confirmButtonColor: '#16a34a',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: 'Sí, finalizar',
                        cancelButtonText: 'Cancelar',
                      });
                      if (!result.isConfirmed) return;

                      try {
                        const { tripsAPI } = await import('@/lib/api-client');
                        await tripsAPI.updateTripStatus(activeTrip.id, 'completed');
                        await Swal.fire({
                          icon: 'success',
                          title: '¡Viaje completado!',
                          text: 'Gracias por usar MoTaxi.',
                          confirmButtonColor: '#4f46e5',
                          timer: 3000,
                          timerProgressBar: true,
                        });
                        setActiveTrip(null);
                      } catch (error) {
                        console.error('Error completing trip:', error);
                        Swal.fire({
                          icon: 'error',
                          title: 'Error',
                          text: 'No se pudo completar el viaje. Intenta nuevamente.',
                          confirmButtonColor: '#4f46e5',
                        });
                      }
                    }}
                    className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Finalizar Viaje</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Obligatorio para Completar Perfil */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="mb-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
                  ¡Bienvenido a MoTaxi!
                </h2>
                <p className="text-gray-600 text-center">
                  Para comenzar a prestar servicio, necesitamos que completes tu perfil de conductor.
                  Esta información es importante para la seguridad de los pasajeros.
                </p>
              </div>

              <div className="space-y-4">
                {/* Modelo del Vehículo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modelo del Vehículo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileData.vehicle_model}
                    onChange={(e) => setProfileData({ ...profileData, vehicle_model: e.target.value })}
                    placeholder="Ej: Boxer 100, Discover 125, etc."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                    required
                  />
                </div>

                {/* Color del Vehículo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color del Vehículo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileData.vehicle_color}
                    onChange={(e) => setProfileData({ ...profileData, vehicle_color: e.target.value })}
                    placeholder="Ej: Rojo, Negro, Azul, etc."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                    required
                  />
                </div>

                {/* Placa del Vehículo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Placa del Vehículo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileData.vehicle_plate}
                    onChange={(e) => setProfileData({ ...profileData, vehicle_plate: e.target.value.toUpperCase() })}
                    placeholder="Ej: ABC123"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 uppercase"
                    maxLength={6}
                    required
                  />
                </div>

                {/* Número de Licencia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número de Licencia de Conducción <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileData.license_number}
                    onChange={(e) => setProfileData({ ...profileData, license_number: e.target.value })}
                    placeholder="Ej: 12345678"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                    required
                  />
                </div>

                {/* Municipio (Opcional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Municipio donde operas (Opcional)
                  </label>
                  <select
                    value={profileData.municipality}
                    onChange={(e) => setProfileData({ ...profileData, municipality: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  >
                    <option value="">Selecciona un municipio</option>
                    <option value="colon">Colón</option>
                    <option value="sibundoy">Sibundoy</option>
                    <option value="san_francisco">San Francisco</option>
                    <option value="santiago">Santiago</option>
                  </select>
                </div>

                {/* Aviso de Verificación */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                        Verificación Pendiente
                      </h4>
                      <p className="text-sm text-yellow-700">
                        Una vez completes tu perfil, un administrador verificará tu información antes de que puedas prestar servicio.
                        Recibirás una notificación cuando tu cuenta sea aprobada.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón de Guardar */}
              <div className="mt-6">
                <button
                  onClick={handleCompleteProfile}
                  disabled={isSubmittingProfile}
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmittingProfile ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Completar Perfil</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  * Campos obligatorios
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

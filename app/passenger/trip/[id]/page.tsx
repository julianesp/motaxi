'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

interface TripData {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  fare: number;
  distance_km: number;
  driver_name?: string;
  driver_phone?: string;
  driver_rating?: number;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_plate?: string;
  driver_latitude?: number;
  driver_longitude?: number;
}

export default function TripTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading } = useAuth();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const initialMapCenter = useRef<{ lat: number; lng: number } | null>(null);

  // Establecer el centro inicial del mapa solo una vez (ANTES de cualquier return)
  if (!initialMapCenter.current && trip) {
    initialMapCenter.current = trip.driver_latitude && trip.driver_longitude
      ? { lat: trip.driver_latitude, lng: trip.driver_longitude }
      : { lat: trip.pickup_latitude, lng: trip.pickup_longitude };
  }

  // TODOS LOS HOOKS DEBEN IR AQUÍ, ANTES DE CUALQUIER RETURN
  // Memoizar los props del mapa para evitar re-renders innecesarios
  const mapCenter = useMemo(() => {
    return initialMapCenter.current || { lat: 1.1656, lng: -77.0 };
  }, []); // Solo calcular una vez

  const pickupLocation = useMemo(() => {
    if (!trip) return null;
    return trip.pickup_latitude && trip.pickup_longitude
      ? { lat: trip.pickup_latitude, lng: trip.pickup_longitude }
      : null;
  }, [trip?.pickup_latitude, trip?.pickup_longitude]);

  const destinationLocation = useMemo(() => {
    if (!trip) return null;
    return trip.dropoff_latitude && trip.dropoff_longitude
      ? { lat: trip.dropoff_latitude, lng: trip.dropoff_longitude }
      : null;
  }, [trip?.dropoff_latitude, trip?.dropoff_longitude]);

  const driverLocation = useMemo(() => {
    if (!trip) return null;
    return trip.driver_latitude && trip.driver_longitude
      ? { lat: trip.driver_latitude, lng: trip.driver_longitude }
      : null;
  }, [trip?.driver_latitude, trip?.driver_longitude]);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'passenger')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchTripData = async () => {
      if (!params.id) return;

      try {
        const { tripsAPI } = await import('@/lib/api-client');
        const data = await tripsAPI.getTrip(params.id as string);

        if (data.trip) {
          setTrip(data.trip);

          // Si el viaje se completó o canceló, redirigir después de 3 segundos
          if (data.trip.status === 'completed' || data.trip.status === 'cancelled') {
            setTimeout(() => {
              router.push('/passenger');
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Error fetching trip:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchTripData();

    // Poll every 2 seconds for real-time updates
    const interval = setInterval(fetchTripData, 2000);

    return () => clearInterval(interval);
  }, [params.id, router]);

  // AHORA SÍ PODEMOS HACER RETURNS CONDICIONALES
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando viaje...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Viaje no encontrado</p>
          <button
            onClick={() => router.push('/passenger')}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const getStatusInfo = () => {
    switch (trip.status) {
      case 'requested':
        return {
          color: 'yellow',
          title: 'Buscando conductor...',
          message: 'Estamos notificando a los conductores cercanos',
          icon: '🔍',
        };
      case 'accepted':
        return {
          color: 'blue',
          title: '¡Conductor en camino!',
          message: `${trip.driver_name} se dirige a tu ubicación`,
          icon: '🚗',
        };
      case 'in_progress':
        return {
          color: 'green',
          title: 'Viaje en curso',
          message: 'Disfruta tu viaje',
          icon: '✅',
        };
      case 'completed':
        return {
          color: 'green',
          title: '¡Viaje completado!',
          message: 'Gracias por usar MoTaxi',
          icon: '🎉',
        };
      case 'cancelled':
        return {
          color: 'red',
          title: 'Viaje cancelado',
          message: 'El viaje ha sido cancelado',
          icon: '❌',
        };
      default:
        return {
          color: 'gray',
          title: 'Estado desconocido',
          message: '',
          icon: '❓',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg md:text-xl">M</span>
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-indigo-600">MoTaxi</h1>
                <p className="text-xs text-gray-500">Viaje #{trip.id.slice(0, 8)}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/passenger/profile')}
              className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full flex items-center justify-center hover:shadow-md transition-shadow"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative">
        {/* Map */}
        <div className="absolute inset-0">
          <GoogleMapComponent
            center={mapCenter}
            zoom={15}
            pickup={pickupLocation}
            destination={destinationLocation}
            driverLocation={driverLocation}
            disableAutoFit={true}
          />
        </div>

        {/* Trip Info Card */}
        <div className={`absolute bottom-0 left-0 right-0 md:left-4 md:bottom-4 md:right-auto md:w-96 bg-white/95 backdrop-blur-sm rounded-t-3xl md:rounded-3xl shadow-2xl z-20 pointer-events-auto overflow-y-auto transition-all duration-300 ${
          isPanelMinimized ? 'max-h-[80px]' : 'max-h-[70vh]'
        }`}>
          <div className="p-4 md:p-6 space-y-4">
            {/* Botón de minimizar/expandir y Status compacto */}
            <div className="flex items-center justify-between">
              <div className={`flex-1 bg-gradient-to-r from-${statusInfo.color}-50 to-${statusInfo.color}-100 border border-${statusInfo.color}-200 rounded-xl p-3 flex items-center space-x-3`}>
                <span className="text-2xl">{statusInfo.icon}</span>
                <div className="flex-1 min-w-0">
                  <h2 className={`text-base font-bold text-${statusInfo.color}-900 truncate`}>{statusInfo.title}</h2>
                  {!isPanelMinimized && (
                    <p className={`text-sm text-${statusInfo.color}-700`}>{statusInfo.message}</p>
                  )}
                </div>
              </div>

              {/* Botón minimizar/expandir */}
              <button
                onClick={() => setIsPanelMinimized(!isPanelMinimized)}
                className="ml-3 p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                title={isPanelMinimized ? "Expandir panel" : "Minimizar panel"}
              >
                <svg
                  className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${
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

            {/* Contenido completo (oculto cuando está minimizado) */}
            {!isPanelMinimized && (
              <>

            {/* Driver Info */}
            {trip.driver_name && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Tu Conductor
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Nombre:</span>
                    <span className="font-semibold text-gray-900">{trip.driver_name}</span>
                  </div>
                  {trip.vehicle_model && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Vehículo:</span>
                      <span className="font-semibold text-gray-900">
                        {trip.vehicle_color} {trip.vehicle_model}
                      </span>
                    </div>
                  )}
                  {trip.vehicle_plate && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Placa:</span>
                      <span className="font-semibold text-gray-900">{trip.vehicle_plate}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Calificación:</span>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="font-semibold text-gray-900">
                        {trip.driver_rating ? trip.driver_rating.toFixed(1) : 'Sin calificar'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Details */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-xs text-gray-500">Origen</span>
                </div>
                <p className="text-sm text-gray-900 ml-5">{trip.pickup_address}</p>
              </div>
              <div>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-xs text-gray-500">Destino</span>
                </div>
                <p className="text-sm text-gray-900 ml-5">{trip.dropoff_address}</p>
              </div>
            </div>

            {/* Fare */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tarifa</p>
                  <p className="text-2xl font-bold text-green-600">${trip.fare.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Distancia</p>
                  <p className="text-lg font-semibold text-gray-900">{trip.distance_km.toFixed(1)} km</p>
                </div>
              </div>
            </div>

            {/* Communication Buttons */}
            {trip.driver_phone && (trip.status === 'accepted' || trip.status === 'in_progress') && (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-4">
                  <div className="flex items-center mb-3">
                    <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <h3 className="font-bold text-indigo-900">Comunicación con el Conductor</h3>
                  </div>
                  <p className="text-sm text-indigo-700 mb-4">
                    Mantente en contacto con tu conductor para mayor seguridad y coordinación
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Llamada de Voz */}
                    <a
                      href={`tel:${trip.driver_phone}`}
                      className="flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="font-semibold">Llamar por Voz</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Recomendado</span>
                    </a>

                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/${trip.driver_phone.replace(/\D/g, '')}?text=Hola,%20soy%20tu%20pasajero%20en%20MoTaxi.%20Viaje%20%23${trip.id.slice(0, 8)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      <span className="font-semibold">WhatsApp</span>
                    </a>

                    {/* SMS */}
                    <a
                      href={`sms:${trip.driver_phone}?body=Hola,%20soy%20tu%20pasajero%20en%20MoTaxi.%20Viaje%20%23${trip.id.slice(0, 8)}`}
                      className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-5 5v-5z" />
                      </svg>
                      <span>Enviar SMS</span>
                    </a>
                  </div>
                  <div className="mt-3 flex items-center justify-center text-xs text-indigo-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Tu seguridad es importante. Mantente en contacto.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción según el estado del viaje */}
            {trip.status === 'accepted' && (
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={async () => {
                    try {
                      const { tripsAPI } = await import('@/lib/api-client');
                      await tripsAPI.updateTripStatus(trip.id, 'in_progress');
                      // Actualizar estado local
                      setTrip({ ...trip, status: 'in_progress' });
                      alert('✅ Viaje iniciado. ¡Disfruta tu viaje!');
                    } catch (error) {
                      console.error('Error starting trip:', error);
                      alert('Error al iniciar el viaje. Intenta nuevamente.');
                    }
                  }}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>El conductor ya llegó - Iniciar viaje</span>
                </button>
              </div>
            )}

            {trip.status === 'in_progress' && (
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={async () => {
                    const confirmed = confirm('¿Confirmas que has llegado a tu destino?');
                    if (!confirmed) return;

                    try {
                      const { tripsAPI } = await import('@/lib/api-client');
                      await tripsAPI.updateTripStatus(trip.id, 'completed');
                      // Actualizar estado local
                      setTrip({ ...trip, status: 'completed' });
                      alert('✅ ¡Viaje completado! Gracias por usar MoTaxi.');
                    } catch (error) {
                      console.error('Error completing trip:', error);
                      alert('Error al completar el viaje. Intenta nuevamente.');
                    }
                  }}
                  className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Llegué a mi destino - Finalizar viaje</span>
                </button>
              </div>
            )}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

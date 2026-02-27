'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_rating?: number; // Rating promedio del conductor
  passenger_rating?: number; // Calificación que el conductor le dio al pasajero
  driver_comment?: string; // Comentario del pasajero sobre el conductor
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
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isRated, setIsRated] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [driverOffers, setDriverOffers] = useState<any[]>([]);
  const [showFavoriteOption, setShowFavoriteOption] = useState(false);
  const [isAddingToFavorites, setIsAddingToFavorites] = useState(false);
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

          // Si el viaje está en estado 'requested', cargar ofertas de conductores
          if (data.trip.status === 'requested') {
            try {
              const offersData = await tripsAPI.getTripOffers(params.id as string);
              if (offersData.offers) {
                setDriverOffers(offersData.offers);
              }
            } catch (error) {
              console.error('Error fetching offers:', error);
            }
          } else {
            // Si ya no está en 'requested', limpiar las ofertas
            setDriverOffers([]);
          }

          // Si el viaje fue cancelado, redirigir después de 3 segundos
          if (data.trip.status === 'cancelled') {
            setTimeout(() => {
              router.push('/passenger');
            }, 3000);
          }

          // Si el viaje fue completado y ya fue calificado, redirigir inmediatamente
          if (data.trip.status === 'completed' && data.trip.driver_comment !== null && data.trip.driver_comment !== undefined) {
            // Ya fue calificado, redirigir
            router.push('/passenger');
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
                  <h2 className={`text-base font-bold truncate text-black`}>{statusInfo.title}</h2>
                  {!isPanelMinimized && (
                    <p className={`text-sm text-${statusInfo.color}-700 text-black`}>{statusInfo.message}</p>
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
                  <p className="text-sm text-gray-600">
                    Tarifa {trip.status === 'requested' ? 'estimada' : ''}
                  </p>
                  <p className="text-2xl font-bold text-green-600">${trip.fare.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Distancia</p>
                  <p className="text-lg font-semibold text-gray-900">{trip.distance_km.toFixed(1)} km</p>
                </div>
              </div>
              {trip.status === 'requested' && (
                <p className="text-xs text-gray-500 mt-2">
                  💡 El precio puede ajustarse según las tarifas del conductor que acepte
                </p>
              )}
            </div>

            {/* Ofertas de conductores - solo cuando está buscando conductor */}
            {trip.status === 'requested' && driverOffers.length > 0 && (
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  Ofertas de Conductores ({driverOffers.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {driverOffers.map((offer: any) => (
                    <div
                      key={offer.id}
                      className="bg-white border border-indigo-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 flex items-center">
                            {offer.driver_name}
                            {offer.driver_rating && (
                              <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                ⭐ {offer.driver_rating.toFixed(1)}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {offer.vehicle_model} {offer.vehicle_color} • {offer.vehicle_plate}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            ${offer.offered_price.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const result = await Swal.fire({
                            title: '¿Aceptar esta oferta?',
                            html: `
                              <div class="text-left">
                                <p class="mb-2"><strong>Conductor:</strong> ${offer.driver_name}</p>
                                <p class="mb-2"><strong>Vehículo:</strong> ${offer.vehicle_model} ${offer.vehicle_color}</p>
                                <p class="mb-2"><strong>Placa:</strong> ${offer.vehicle_plate}</p>
                                <p class="mb-2"><strong>Precio:</strong> <span class="text-green-600 text-xl font-bold">$${offer.offered_price.toLocaleString()}</span></p>
                              </div>
                            `,
                            icon: 'question',
                            showCancelButton: true,
                            confirmButtonColor: '#4f46e5',
                            cancelButtonColor: '#6b7280',
                            confirmButtonText: 'Sí, aceptar',
                            cancelButtonText: 'Cancelar',
                          });

                          if (result.isConfirmed) {
                            try {
                              const { tripsAPI } = await import('@/lib/api-client');

                              // Aceptar la oferta del conductor
                              await tripsAPI.acceptOffer(trip.id, offer.driver_id);

                              await Swal.fire({
                                icon: 'success',
                                title: '¡Oferta aceptada!',
                                text: `${offer.driver_name} ha sido notificado. Se dirige al punto de recogida.`,
                                confirmButtonColor: '#4f46e5',
                                timer: 3000,
                                timerProgressBar: true,
                              });

                              // Recargar datos del viaje para ver el conductor asignado
                              window.location.reload();
                            } catch (error: any) {
                              console.error('Error accepting offer:', error);
                              const errorMessage = error?.response?.data?.error || error?.message || 'No se pudo aceptar la oferta. Intenta nuevamente.';
                              Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: errorMessage,
                                confirmButtonColor: '#4f46e5',
                              });
                            }
                          }
                        }}
                        className="w-full mt-2 py-2 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-indigo-800 transition-all"
                      >
                        Aceptar oferta
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-indigo-700 mt-3">
                  💡 Los conductores pueden enviar ofertas personalizadas. Puedes esperar más ofertas o aceptar una ahora.
                </p>
              </div>
            )}

            {/* Cancelar viaje - solo disponible cuando está buscando conductor */}
            {trip.status === 'requested' && (
              <div className="pt-2">
                <button
                  onClick={async () => {
                    const result = await Swal.fire({
                      icon: 'warning',
                      title: '¿Cancelar viaje?',
                      text: 'Si cancelas, el viaje será eliminado y deberás solicitar uno nuevo.',
                      showCancelButton: true,
                      confirmButtonColor: '#dc2626',
                      cancelButtonColor: '#6b7280',
                      confirmButtonText: 'Sí, cancelar',
                      cancelButtonText: 'No, continuar',
                    });

                    if (!result.isConfirmed) return;

                    setIsCancelling(true);
                    try {
                      const { tripsAPI } = await import('@/lib/api-client');
                      await tripsAPI.updateTripStatus(trip.id, 'cancelled');
                      await Swal.fire({
                        icon: 'success',
                        title: 'Viaje cancelado',
                        text: 'Tu viaje ha sido cancelado exitosamente.',
                        confirmButtonColor: '#4f46e5',
                        timer: 2000,
                        showConfirmButton: false,
                      });
                      router.push('/passenger');
                    } catch (error) {
                      console.error('Error cancelling trip:', error);
                      Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo cancelar el viaje. Intenta nuevamente.',
                        confirmButtonColor: '#4f46e5',
                      });
                    } finally {
                      setIsCancelling(false);
                    }
                  }}
                  disabled={isCancelling}
                  className={`w-full py-3 px-6 bg-red-100 text-red-700 border border-red-300 rounded-xl font-semibold hover:bg-red-200 transition-all duration-200 flex items-center justify-center space-x-2 ${isCancelling ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>{isCancelling ? 'Cancelando...' : 'Cancelar viaje'}</span>
                </button>
              </div>
            )}

            {/* Nota de cancelación cuando conductor ya aceptó */}
            {trip.status === 'accepted' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">¿Necesitas cancelar?</p>
                    <p className="text-sm text-amber-700 mt-1">
                      El conductor ya aceptó tu viaje. Para cancelar, comunícate directamente con él por llamada o WhatsApp y lleguen a un acuerdo.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                      alert('✅ ¡Viaje completado! Por favor califica tu experiencia.');
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

            {/* Calificación del conductor */}
            {trip.status === 'completed' && !isRated && (
              <div className="pt-4 border-t border-gray-200">
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-6">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">¡Viaje Completado!</h3>
                    <p className="text-gray-700">¿Cómo fue tu experiencia con {trip.driver_name}?</p>
                  </div>

                  {/* Estrellas de calificación */}
                  <div className="flex justify-center space-x-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="transition-all transform hover:scale-110 focus:outline-none"
                      >
                        <svg
                          className={`w-10 h-10 ${
                            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                          }`}
                          fill={star <= rating ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth={1.5}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          />
                        </svg>
                      </button>
                    ))}
                  </div>

                  {/* Texto de la calificación */}
                  {rating > 0 && (
                    <p className="text-center text-sm font-semibold text-gray-700 mb-4">
                      {rating === 5 && '⭐ ¡Excelente!'}
                      {rating === 4 && '⭐ Muy bueno'}
                      {rating === 3 && '⭐ Bueno'}
                      {rating === 2 && '⭐ Regular'}
                      {rating === 1 && '⭐ Necesita mejorar'}
                    </p>
                  )}

                  {/* Comentario opcional */}
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Cuéntanos sobre tu experiencia (opcional)"
                    className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent mb-4"
                    rows={3}
                  />

                  {/* Botones */}
                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        if (rating === 0) {
                          alert('Por favor selecciona una calificación');
                          return;
                        }

                        setIsSubmittingRating(true);
                        try {
                          const { tripsAPI } = await import('@/lib/api-client');
                          await tripsAPI.rateTrip(trip.id, rating, comment || undefined);
                          setIsRated(true);

                          // Mostrar opción de favoritos si hay driver_id
                          if (trip.driver_id) {
                            setShowFavoriteOption(true);
                          } else {
                            // Si no hay driver_id, redirigir inmediatamente
                            await Swal.fire({
                              title: '¡Gracias!',
                              text: 'Tu calificación ha sido enviada',
                              icon: 'success',
                              confirmButtonText: 'OK',
                            });
                            router.push('/passenger?justCompleted=true');
                          }
                        } catch (error) {
                          console.error('Error rating trip:', error);
                          alert('Error al enviar la calificación. Intenta nuevamente.');
                        } finally {
                          setIsSubmittingRating(false);
                        }
                      }}
                      disabled={rating === 0 || isSubmittingRating}
                      className={`w-full py-3 px-6 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl font-bold hover:from-yellow-600 hover:to-amber-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2 ${
                        (rating === 0 || isSubmittingRating) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{isSubmittingRating ? 'Enviando...' : 'Enviar Calificación'}</span>
                    </button>

                    <button
                      onClick={() => {
                        router.push('/passenger?justCompleted=true');
                      }}
                      className="w-full py-2 px-6 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200"
                    >
                      Omitir por ahora
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Opción de agregar a favoritos después de calificar */}
            {showFavoriteOption && trip.driver_id && (
              <div className="pt-4 border-t border-gray-200">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
                  <div className="text-center mb-4">
                    <div className="flex justify-center mb-3">
                      <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">¡Calificación enviada!</h3>
                    <p className="text-gray-700">¿Te gustaría agregar a {trip.driver_name || 'este conductor'} a tus favoritos?</p>
                    <p className="text-sm text-gray-600 mt-2">Podrás llamarlo directamente para futuros viajes</p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        setIsAddingToFavorites(true);
                        try {
                          const { apiClient } = await import('@/lib/api-client');
                          await apiClient.post('/favorites/drivers', {
                            driver_id: trip.driver_id,
                            nickname: null,
                          });

                          await Swal.fire({
                            title: '¡Agregado!',
                            text: `${trip.driver_name} ha sido agregado a tus conductores favoritos`,
                            icon: 'success',
                            confirmButtonText: 'Genial',
                          });

                          router.push('/passenger?justCompleted=true');
                        } catch (error: any) {
                          console.error('Error adding to favorites:', error);

                          const errorMessage = error.response?.data?.error || error.message;
                          if (errorMessage?.includes('ya está en tus favoritos')) {
                            await Swal.fire({
                              title: 'Información',
                              text: 'Este conductor ya está en tus favoritos',
                              icon: 'info',
                              confirmButtonText: 'OK',
                            });
                            router.push('/passenger?justCompleted=true');
                          } else {
                            await Swal.fire({
                              title: 'Error',
                              text: 'No se pudo agregar a favoritos. Intenta nuevamente.',
                              icon: 'error',
                              confirmButtonText: 'OK',
                            });
                          }
                        } finally {
                          setIsAddingToFavorites(false);
                        }
                      }}
                      disabled={isAddingToFavorites}
                      className={`w-full py-3 px-6 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl font-bold hover:from-yellow-600 hover:to-amber-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2 ${
                        isAddingToFavorites ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <span>{isAddingToFavorites ? 'Agregando...' : 'Agregar a Favoritos'}</span>
                    </button>

                    <button
                      onClick={() => {
                        router.push('/passenger?justCompleted=true');
                      }}
                      disabled={isAddingToFavorites}
                      className="w-full py-2 px-6 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200"
                    >
                      No, gracias
                    </button>
                  </div>
                </div>
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

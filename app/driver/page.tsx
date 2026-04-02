'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import EpaycoSubscriptionCheckout from '@/components/EpaycoSubscriptionCheckout';

const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function DriverHomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status: subStatus, loading: subLoading, refetch: refetchSub } = useSubscription();
  const { permission, isSubscribed, isLoading: pushLoading, isSupported: pushSupported, subscribe: subscribePush } = usePushNotifications();
  const [showCheckout, setShowCheckout] = useState(false);
  const [dismissedPushBanner, setDismissedPushBanner] = useState(false);

  const [isAvailable, setIsAvailable] = useState(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const activeTripRef = useRef<any>(null);
  const consecutiveErrorsRef = useRef(0);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isActiveTripPanelMinimized, setIsActiveTripPanelMinimized] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<any[]>([]);
  const [rejectedTripIds, setRejectedTripIds] = useState<Set<string>>(new Set());
  const [pendingOfferTrip, setPendingOfferTrip] = useState<any>(null); // Viaje con oferta enviada esperando respuesta del pasajero
  const pendingOfferTripRef = useRef<any>(null);
  const pendingOfferErrorsRef = useRef(0);

  // Estado para ver la ruta de un viaje disponible
  const [selectedTripForMap, setSelectedTripForMap] = useState<any>(null);

  // Estados para notificaciones
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Estados para el onboarding de conductor (en pasos)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: bienvenida, 2: vehículo, 3: licencia, 4: municipio
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
      if (user?.role === 'passenger') {
        router.push('/passenger');
      } else {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  // Mantener refs actualizados para usarlos en closures
  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  useEffect(() => {
    pendingOfferTripRef.current = pendingOfferTrip;
  }, [pendingOfferTrip]);

  // Verificar si el conductor tiene un viaje activo asignado
  useEffect(() => {
    const checkActiveTrip = async () => {
      if (!user || user.role !== 'driver') return;

      try {
        const { tripsAPI } = await import('@/lib/api-client');

        // Siempre consultar primero el viaje activo del conductor — es la fuente de verdad
        const data = await tripsAPI.getCurrentDriverTrip();
        consecutiveErrorsRef.current = 0;

        if (data.trip) {
          const trip = data.trip;
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
            status: trip.status,
          });
          setAvailableTrips([]);
          // Si había oferta pendiente y ya hay viaje activo, limpiar
          if (pendingOfferTripRef.current) {
            setPendingOfferTrip(null);
          }
        } else {
          // No hay viaje activo
          if (activeTripRef.current) {
            setActiveTrip(null);
          }
          // Si hay oferta pendiente, verificar si fue cancelada o rechazada
          if (pendingOfferTripRef.current) {
            try {
              const tripData = await tripsAPI.getTrip(pendingOfferTripRef.current.id);
              const tripStatus = tripData.trip?.status;
              if (tripStatus === 'cancelled' || tripStatus === 'completed' || tripStatus === 'requested' && tripData.trip?.driver_id) {
                // Fue tomado por otro conductor o cancelado
                setPendingOfferTrip(null);
              }
            } catch (err: any) {
              const httpStatus = err?.response?.status;
              if (httpStatus === 403 || httpStatus === 404) {
                setPendingOfferTrip(null);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('checkActiveTrip error:', error?.response?.data || error?.message || error);
        if (activeTripRef.current && (activeTripRef.current.status === 'accepted' || activeTripRef.current.status === 'in_progress')) {
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current >= 5) {
            consecutiveErrorsRef.current = 0;
            try {
              const { tripsAPI } = await import('@/lib/api-client');
              await tripsAPI.updateTripStatus(activeTripRef.current.id, 'cancelled');
            } catch (cancelErr) {
              console.error('Error auto-cancelling trip:', cancelErr);
            }
            setActiveTrip(null);
          }
        }
      }
    };

    checkActiveTrip();
    const interval = setInterval(checkActiveTrip, 2000);
    return () => clearInterval(interval);
  }, [user]);

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
            // Mostrar onboarding para completar perfil
            setOnboardingStep(1);
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
          maximumAge: 0, // Siempre pedir posición fresca al GPS
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [user]);

  useEffect(() => {
    // Consultar viajes disponibles cada 5 segundos cuando el conductor esté disponible
    // Detener polling si no está disponible, no es conductor, o tiene un viaje activo
    if (!isAvailable || activeTrip || user?.role !== 'driver') {
      setAvailableTrips([]);
      return;
    }

    const fetchAvailableTrips = async () => {
      try {
        const { tripsAPI } = await import('@/lib/api-client');
        const data = await tripsAPI.getActiveTrips();
        // Filtrar viajes rechazados localmente
        const filteredTrips = (data.trips || []).filter((trip: any) => !rejectedTripIds.has(trip.id));
        setAvailableTrips(prev => {
          // Si llega una solicitud nueva, expandir el panel automáticamente
          if (filteredTrips.length > prev.length) {
            setIsPanelMinimized(false);
          }
          return filteredTrips;
        });
      } catch (error) {
        console.error('Error fetching available trips:', error);
      }
    };

    // Consultar inmediatamente
    fetchAvailableTrips();

    // Consultar cada 5 segundos
    const interval = setInterval(fetchAvailableTrips, 5000);

    return () => clearInterval(interval);
  }, [isAvailable, user, rejectedTripIds, activeTrip]);

  // Cargar notificaciones
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;

      try {
        const { notificationsAPI } = await import('@/lib/api-client');
        const data = await notificationsAPI.getAll();
        const notifs = data.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: any) => !n.is_read).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    if (user) {
      fetchNotifications();
      // Actualizar notificaciones cada 30 segundos
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const { notificationsAPI } = await import('@/lib/api-client');
      await notificationsAPI.markAsRead(notificationId);

      // Actualizar estado local
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: 1 } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Cerrar dropdown de notificaciones al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotifications) {
        const target = event.target as HTMLElement;
        if (!target.closest('.notifications-dropdown')) {
          setShowNotifications(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleCompleteProfile = async () => {
    // Validar campos obligatorios
    if (!profileData.vehicle_model || !profileData.vehicle_color ||
        !profileData.vehicle_plate || !profileData.license_number) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor completa todos los campos obligatorios.',
        confirmButtonColor: '#008000',
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
        confirmButtonColor: '#008000',
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
        confirmButtonColor: '#008000',
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
          confirmButtonColor: '#008000',
        });
        setOnboardingStep(1);
        setShowProfileModal(true);
      } else if (error.response?.data?.notVerified) {
        Swal.fire({
          icon: 'warning',
          title: 'Cuenta no verificada',
          text: 'Tu cuenta debe estar verificada antes de poder prestar servicio.',
          confirmButtonColor: '#008000',
        });
      } else {
        const msg = error.response?.data?.message || error.response?.data?.error || 'No se pudo actualizar la disponibilidad. Intenta nuevamente.';
        const isSubscription = error.response?.status === 403 || error.response?.data?.code === 'SUBSCRIPTION_REQUIRED';
        Swal.fire({
          icon: isSubscription ? 'warning' : 'error',
          title: isSubscription ? 'Suscripción requerida' : 'Error',
          text: msg,
          confirmButtonColor: '#42CE1D',
          ...(isSubscription ? { confirmButtonText: 'Ver mi perfil', showCancelButton: true, cancelButtonText: 'Cancelar' } : {}),
        }).then((result) => {
          if (isSubscription && result.isConfirmed) {
            router.push('/driver/profile');
          }
        });
      }
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Bloquear acceso si la suscripción expiró, pero NO si hay un viaje activo en curso
  if (subStatus && !subStatus.has_access && !activeTrip) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.538-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Suscripción requerida</h2>
          <p className="text-gray-500 mb-6">
            Tu período de prueba ha vencido. Suscríbete para continuar usando MoTaxi y recibir viajes.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-3xl font-bold text-[#42CE1D]">$14.900 COP</p>
            <p className="text-gray-500 text-sm">por mes</p>
          </div>
          {!showCheckout ? (
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-3 px-6 bg-[#42CE1D] text-white font-semibold rounded-xl hover:bg-[#38b018] transition-colors"
            >
              Suscribirme ahora
            </button>
          ) : (
            <div className="mt-2">
              <EpaycoSubscriptionCheckout
                user={{
                  id: user!.id,
                  full_name: user!.full_name,
                  email: user!.email,
                  phone: user!.phone,
                }}
                onClose={() => setShowCheckout(false)}
                onSuccess={() => {
                  setShowCheckout(false);
                  refetchSub();
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mostrar banner si: soporta push, no está suscrito, permiso no denegado, y no fue descartado
  const showPushBanner = pushSupported && !isSubscribed && permission !== 'denied' && !dismissedPushBanner;

  return (
    <div className="h-screen flex flex-col">
      {/* Banner para activar notificaciones push */}
      {showPushBanner && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-[#42CE1D] text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm font-medium truncate">Activa las notificaciones para recibir nuevos viajes</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                const ok = await subscribePush();
                if (ok) setDismissedPushBanner(true);
              }}
              disabled={pushLoading}
              className="bg-white text-[#42CE1D] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60"
            >
              {pushLoading ? 'Activando...' : 'Activar'}
            </button>
            <button
              onClick={() => setDismissedPushBanner(true)}
              className="text-white opacity-70 hover:opacity-100 p-1"
              aria-label="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`bg-white shadow-sm z-50 fixed left-0 right-0 ${showPushBanner ? 'top-[52px]' : 'top-0'}`}>
        <div className="container-app py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-[#008000]">MoTaxi</h1>
              {/* Toggle disponibilidad */}
              <button
                onClick={toggleAvailability}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${
                  isAvailable ? 'bg-[#42CE1D]' : 'bg-red-500'
                }`}
                title={isAvailable ? 'Disponible' : 'No disponible'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    isAvailable ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center space-x-4">
              {/* Botón ganancias con icono de moneda */}
              <button
                onClick={() => router.push('/driver/earnings')}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80"
                title="Ganancias"
              >
                <svg viewBox="0 0 40 40" className="w-10 h-10">
                  <circle cx="20" cy="20" r="19" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5"/>
                  <circle cx="20" cy="20" r="15" fill="#FCD34D"/>
                  <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="900" fill="#92400E" fontFamily="serif">$</text>
                </svg>
              </button>
              {/* Botón de notificaciones */}
              <div className="relative notifications-dropdown">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 relative"
                >
                  <svg className="w-6 h-6 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown de notificaciones */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-lg font-bold text-gray-900">Notificaciones</h3>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        No tienes notificaciones
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {notifications.map((notification: any) => (
                          <div
                            key={notification.id}
                            onClick={() => handleMarkAsRead(notification.id)}
                            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                              !notification.is_read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                {notification.type === 'general' || notification.type === 'rating_received' ? (
                                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(notification.created_at * 1000).toLocaleString('es-ES', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="flex-shrink-0">
                                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push('/driver/profile')}
                className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"
              >
                <svg className="w-6 h-6 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className={`flex-1 relative ${showPushBanner ? 'pt-28 md:pt-32' : 'pt-16 md:pt-20'}`}>
        {/* Map - ocupa todo el espacio */}
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

        {/* Earnings Summary - flotante sobre el mapa */}
        {!activeTrip && (
          <div className={`absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-2xl z-20 transition-all duration-300 ${
            isPanelMinimized ? 'h-[60px]' : 'max-h-[60vh] overflow-y-auto'
          }`}>
            <div className="p-4 space-y-3">
              {/* Handle y barra de estado siempre visible */}
              <div className="flex items-center justify-between -mt-1 mb-1">
                {isPanelMinimized ? (
                  <div className="flex items-center space-x-4 flex-1">
                    <span className="text-sm font-medium text-gray-600">
                      {isAvailable ? '🟢 Conectado' : '⚫ Desconectado'}
                    </span>
                    {isAvailable && availableTrips.length > 0 && (
                      <span className="text-sm font-medium text-[#008000]">
                        {availableTrips.length} {availableTrips.length === 1 ? 'solicitud' : 'solicitudes'}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center flex-1">
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
                  {!isAvailable && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                      <p className="text-yellow-800">
                        Activa tu disponibilidad para empezar a recibir solicitudes de viaje
                      </p>
                    </div>
                  )}

                  {isAvailable && availableTrips.length === 0 && pendingOfferTrip && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-800 font-medium text-center mb-2">Oferta enviada — esperando respuesta del pasajero</p>
                      <div className="text-sm text-blue-700 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full shrink-0"></div>
                          <p className="line-clamp-1">{pendingOfferTrip.pickup_address}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full shrink-0"></div>
                          <p className="line-clamp-1">{pendingOfferTrip.dropoff_address}</p>
                        </div>
                        <p className="text-center font-bold text-blue-900 mt-2">Tu oferta: ${pendingOfferTrip.offeredPrice?.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center justify-center mt-3">
                        <div className="animate-pulse flex space-x-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isAvailable && availableTrips.length === 0 && !pendingOfferTrip && (
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
                        <span className="bg-green-100 text-[#006600] px-3 py-1 rounded-full text-sm font-medium">
                          {availableTrips.length} {availableTrips.length === 1 ? 'viaje' : 'viajes'}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {availableTrips.map((trip: any) => (
                          <div key={trip.id} className="bg-white border-2 border-green-200 rounded-xl p-4 hover:border-green-400 transition-colors">
                            {/* Mostrar pasajero y distancia al pickup */}
                            {trip.passenger_name && (
                              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                                <div className="flex items-center text-sm text-gray-600">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="font-medium">{trip.passenger_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedTripForMap(trip)}
                                    className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                                    title="Ver ruta en mapa"
                                  >
                                    <svg className="w-4 h-4 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                    </svg>
                                  </button>
                                  {trip.distance_to_pickup && (
                                    <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                      📍 {trip.distance_to_pickup} km de ti
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Badge de envío de paquete */}
                            {trip.trip_type === 'delivery' && (
                              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-3">
                                <span className="text-lg">📦</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Envío de paquete</span>
                                  {trip.delivery_note && (
                                    <p className="text-xs text-orange-600 mt-0.5 line-clamp-2">{trip.delivery_note}</p>
                                  )}
                                </div>
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
                            <div className="flex flex-col gap-3">
                              <div className="flex gap-3">
                                <button
                                  onClick={async () => {
                                    try {
                                      const { tripsAPI } = await import('@/lib/api-client');
                                      await tripsAPI.acceptTrip(trip.id);

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

                                      // Remover solo el viaje aceptado de la lista de disponibles
                                      setAvailableTrips(prev => prev.filter(t => t.id !== trip.id));

                                      Swal.fire({
                                        icon: 'success',
                                        title: '¡Viaje aceptado!',
                                        text: 'Dirígete al punto de recogida.',
                                        confirmButtonColor: '#008000',
                                        timer: 3000,
                                        timerProgressBar: true,
                                      });
                                    } catch (error) {
                                      console.error('Error accepting trip:', error);
                                      Swal.fire({
                                        icon: 'error',
                                        title: 'Error',
                                        text: 'No se pudo aceptar el viaje. Intenta nuevamente.',
                                        confirmButtonColor: '#008000',
                                      });
                                    }
                                  }}
                                  className="flex-1 py-3 px-4 bg-gradient-to-r from-[#008000] to-[#006600] text-white rounded-xl font-medium hover:from-[#006600] hover:to-[#004d00] transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
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
                              <button
                                onClick={async () => {
                                  const result = await Swal.fire({
                                    title: 'Modificar precio',
                                    html: `
                                      <p class="text-gray-600 mb-4">Precio actual: <span class="font-bold text-green-600">$${trip.fare.toLocaleString()}</span></p>
                                      <p class="text-sm text-gray-500 mb-2">Ingresa tu oferta personalizada:</p>
                                    `,
                                    input: 'number',
                                    inputValue: trip.fare,
                                    inputPlaceholder: 'Precio en pesos',
                                    showCancelButton: true,
                                    confirmButtonText: 'Enviar oferta',
                                    cancelButtonText: 'Cancelar',
                                    confirmButtonColor: '#10b981',
                                    cancelButtonColor: '#6b7280',
                                    inputValidator: (value) => {
                                      if (!value || parseFloat(value) <= 0) {
                                        return 'Debes ingresar un precio válido';
                                      }
                                      if (parseFloat(value) < 1000) {
                                        return 'El precio mínimo es $1,000';
                                      }
                                    }
                                  });

                                  if (result.isConfirmed) {
                                    try {
                                      const customPrice = parseFloat(result.value);
                                      const { tripsAPI } = await import('@/lib/api-client');
                                      await tripsAPI.offerCustomPrice(trip.id, customPrice);

                                      await Swal.fire({
                                        icon: 'success',
                                        title: 'Oferta enviada',
                                        text: `Tu oferta de $${customPrice.toLocaleString()} ha sido enviada al pasajero. Esperando respuesta...`,
                                        confirmButtonColor: '#10b981',
                                        timer: 3000,
                                        timerProgressBar: true,
                                      });

                                      // Mover el viaje a "pendiente de respuesta" y quitarlo de disponibles
                                      // Cuando el pasajero acepte, el polling lo convertirá en activeTrip
                                      setPendingOfferTrip({ ...trip, offeredPrice: customPrice });
                                      setAvailableTrips(prev => prev.filter(t => t.id !== trip.id));
                                    } catch (error: any) {
                                      console.error('Error sending custom price:', error);
                                      const errorMessage = error?.response?.data?.error || error?.message || 'No se pudo enviar la oferta. Intenta nuevamente.';
                                      Swal.fire({
                                        icon: 'error',
                                        title: 'Error',
                                        text: errorMessage,
                                        confirmButtonColor: '#008000',
                                      });
                                    }
                                  }
                                }}
                                className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Modificar precio
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
          <div className={`absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-2xl z-20 transition-all duration-300 ${
            isActiveTripPanelMinimized ? 'h-[60px]' : 'max-h-[60vh] overflow-y-auto'
          }`}>
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Viaje Activo</h2>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {activeTrip.status === 'in_progress' ? 'En curso' : 'Aceptado'}
                  </div>
                  <button
                    onClick={() => setIsActiveTripPanelMinimized(!isActiveTripPanelMinimized)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={isActiveTripPanelMinimized ? "Expandir panel" : "Minimizar panel"}
                  >
                    <svg
                      className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
                        isActiveTripPanelMinimized ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {!isActiveTripPanelMinimized && (<>
              {/* Información del Pasajero */}
              <div className="bg-gradient-to-r from-green-50 to-purple-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-[#008000] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="font-bold text-[#003300]">Información del Pasajero</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Nombre:</span>
                    <span className="font-semibold text-gray-900">{activeTrip.passengerName || 'Pasajero'}</span>
                  </div>

                  {activeTrip.passengerPhone ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Teléfono:</span>
                        <span className="font-semibold text-gray-900">{activeTrip.passengerPhone}</span>
                      </div>

                      <div className="pt-3 mt-3 border-t border-green-200">
                        <p className="text-sm text-[#006600] mb-3">
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
                  ) : (
                    <p className="text-sm text-gray-500 italic pt-1">
                      El pasajero no registró número de teléfono
                    </p>
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
                        confirmButtonColor: '#008000',
                        timer: 3000,
                        timerProgressBar: true,
                      });
                    } catch (error) {
                      console.error('Error starting trip:', error);
                      Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo iniciar el viaje. Intenta nuevamente.',
                        confirmButtonColor: '#008000',
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
                          confirmButtonColor: '#008000',
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
                          confirmButtonColor: '#008000',
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
              </>)}
            </div>
          </div>
        )}

        {/* Onboarding en pasos para completar perfil */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">

              {/* Barra de progreso */}
              <div className="px-6 pt-5 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#008000]">Paso {onboardingStep} de 4</span>
                  <span className="text-xs text-gray-400">{Math.round((onboardingStep / 4) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#42CE1D] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(onboardingStep / 4) * 100}%` }}
                  />
                </div>
              </div>

              <div className="px-6 pb-6 pt-4">

                {/* PASO 1: Bienvenida */}
                {onboardingStep === 1 && (
                  <div className="text-center space-y-5">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#42CE1D] to-[#008000] rounded-full flex items-center justify-center mx-auto shadow-lg">
                      <span className="text-4xl">🏍️</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Bienvenido, {user?.full_name?.split(' ')[0]}!</h2>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        Configura tu perfil en 3 pasos rápidos. Solo te tomará 2 minutos y podrás empezar a recibir viajes.
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                      {[
                        { icon: '🏍️', text: 'Datos de tu moto' },
                        { icon: '📋', text: 'Número de licencia' },
                        { icon: '📍', text: 'Tu municipio' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xl">{item.icon}</span>
                          <span className="text-sm text-gray-700">{item.text}</span>
                          <span className="ml-auto text-xs bg-green-100 text-[#008000] px-2 py-0.5 rounded-full">~30 seg</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-left">
                      <p className="text-xs text-blue-700">
                        💡 <strong>Puedes completarlo después</strong> desde tu perfil. Pero necesitas tenerlo completo para activarte como conductor.
                      </p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowProfileModal(false)}
                        className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                      >
                        Después
                      </button>
                      <button
                        onClick={() => setOnboardingStep(2)}
                        className="flex-1 py-3 px-4 bg-[#42CE1D] text-white rounded-xl font-bold hover:bg-[#38b018] transition-colors shadow-md text-sm"
                      >
                        Empezar →
                      </button>
                    </div>
                  </div>
                )}

                {/* PASO 2: Datos del vehículo */}
                {onboardingStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <div className="text-3xl mb-2">🏍️</div>
                      <h2 className="text-xl font-bold text-gray-900">Datos de tu moto</h2>
                      <p className="text-gray-500 text-sm">Esta información aparece a los pasajeros para identificarte.</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Modelo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profileData.vehicle_model}
                          onChange={(e) => setProfileData({ ...profileData, vehicle_model: e.target.value })}
                          placeholder="Ej: Boxer 100, Discover 125..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#42CE1D] text-gray-900 transition-colors"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Color <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profileData.vehicle_color}
                          onChange={(e) => setProfileData({ ...profileData, vehicle_color: e.target.value })}
                          placeholder="Ej: Rojo, Negro, Azul..."
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#42CE1D] text-gray-900 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Placa <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profileData.vehicle_plate}
                          onChange={(e) => setProfileData({ ...profileData, vehicle_plate: e.target.value.toUpperCase() })}
                          placeholder="Ej: ABC123"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#42CE1D] text-gray-900 uppercase tracking-widest transition-colors"
                          maxLength={6}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setOnboardingStep(1)}
                        className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                      >
                        ← Atrás
                      </button>
                      <button
                        onClick={() => {
                          if (!profileData.vehicle_model || !profileData.vehicle_color || !profileData.vehicle_plate) {
                            Swal.fire({ icon: 'warning', title: 'Completa los campos', text: 'Todos los campos de este paso son obligatorios.', confirmButtonColor: '#008000' });
                            return;
                          }
                          setOnboardingStep(3);
                        }}
                        className="flex-1 py-3 px-4 bg-[#42CE1D] text-white rounded-xl font-bold hover:bg-[#38b018] transition-colors shadow-md text-sm"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                )}

                {/* PASO 3: Licencia */}
                {onboardingStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <div className="text-3xl mb-2">📋</div>
                      <h2 className="text-xl font-bold text-gray-900">Número de licencia</h2>
                      <p className="text-gray-500 text-sm">Requerida para verificar que estás habilitado para conducir.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Número de licencia <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={profileData.license_number}
                        onChange={(e) => setProfileData({ ...profileData, license_number: e.target.value })}
                        placeholder="Ej: 12345678"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#42CE1D] text-gray-900 transition-colors"
                        autoFocus
                      />
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <p className="text-xs text-yellow-700">
                        ⚠️ Un administrador verificará tu licencia antes de activar tu cuenta. Recibirás una notificación cuando sea aprobada.
                      </p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setOnboardingStep(2)}
                        className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                      >
                        ← Atrás
                      </button>
                      <button
                        onClick={() => {
                          if (!profileData.license_number) {
                            Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Ingresa tu número de licencia.', confirmButtonColor: '#008000' });
                            return;
                          }
                          setOnboardingStep(4);
                        }}
                        className="flex-1 py-3 px-4 bg-[#42CE1D] text-white rounded-xl font-bold hover:bg-[#38b018] transition-colors shadow-md text-sm"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                )}

                {/* PASO 4: Municipio y finalizar */}
                {onboardingStep === 4 && (
                  <div className="space-y-5">
                    <div>
                      <div className="text-3xl mb-2">📍</div>
                      <h2 className="text-xl font-bold text-gray-900">¿Dónde operas?</h2>
                      <p className="text-gray-500 text-sm">Esto nos ayuda a mostrarte los viajes más cercanos a ti.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Municipio principal</label>
                      <select
                        value={profileData.municipality}
                        onChange={(e) => setProfileData({ ...profileData, municipality: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#42CE1D] text-gray-900 transition-colors"
                      >
                        <option value="">Selecciona un municipio</option>
                        <option value="colon">Colón</option>
                        <option value="sibundoy">Sibundoy</option>
                        <option value="san_francisco">San Francisco</option>
                        <option value="santiago">Santiago</option>
                      </select>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-[#003300] mb-2">Resumen de tu perfil</h3>
                      <div className="space-y-1 text-sm text-gray-700">
                        <div className="flex justify-between"><span className="text-gray-500">Modelo:</span><span className="font-medium">{profileData.vehicle_model}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Color:</span><span className="font-medium">{profileData.vehicle_color}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Placa:</span><span className="font-medium uppercase">{profileData.vehicle_plate}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Licencia:</span><span className="font-medium">{profileData.license_number}</span></div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setOnboardingStep(3)}
                        className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                      >
                        ← Atrás
                      </button>
                      <button
                        onClick={handleCompleteProfile}
                        disabled={isSubmittingProfile}
                        className="flex-1 py-3 px-4 bg-[#42CE1D] text-white rounded-xl font-bold hover:bg-[#38b018] transition-colors shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmittingProfile ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Guardando...
                          </>
                        ) : (
                          '¡Listo! ✓'
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Modal para ver la ruta del viaje */}
        {selectedTripForMap && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-0 md:p-4">
            <div className="bg-white md:rounded-2xl w-full h-full md:max-w-6xl md:h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Header del modal */}
              <div className="bg-gradient-to-r from-[#008000] to-[#006600] p-3 md:p-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-white">Ruta del Viaje</h2>
                  <p className="text-green-100 text-xs md:text-sm">
                    {selectedTripForMap.passenger_name} • {selectedTripForMap.distance_km?.toFixed(1)} km
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTripForMap(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido: Mapa y detalles */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Mapa - Ocupa 60% en móvil, flex-1 en desktop */}
                <div className="h-[60vh] md:h-auto md:flex-1 relative flex-shrink-0">
                  <GoogleMapComponent
                    center={{
                      lat: selectedTripForMap.pickup_latitude,
                      lng: selectedTripForMap.pickup_longitude,
                    }}
                    zoom={13}
                    pickup={{
                      lat: selectedTripForMap.pickup_latitude,
                      lng: selectedTripForMap.pickup_longitude,
                    }}
                    destination={{
                      lat: selectedTripForMap.dropoff_latitude,
                      lng: selectedTripForMap.dropoff_longitude,
                    }}
                    driverLocation={currentLocation}
                  />
                </div>

                {/* Panel de información - Scroll vertical en móvil */}
                <div className="flex-1 md:w-96 md:flex-none bg-gray-50 overflow-y-auto">
                  <div className="p-4 md:p-6 space-y-4">
                  {/* Información del viaje */}
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-3">Detalles del viaje</h3>

                    {/* Origen */}
                    <div className="mb-3">
                      <div className="flex items-center mb-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-xs text-gray-500 font-medium">Origen</span>
                      </div>
                      <p className="text-sm text-gray-700 ml-5">{selectedTripForMap.pickup_address}</p>
                    </div>

                    {/* Destino */}
                    <div className="mb-3">
                      <div className="flex items-center mb-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span className="text-xs text-gray-500 font-medium">Destino</span>
                      </div>
                      <p className="text-sm text-gray-700 ml-5">{selectedTripForMap.dropoff_address}</p>
                    </div>

                    {/* Distancia y precio */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Distancia</p>
                        <p className="text-lg font-semibold text-gray-900">{selectedTripForMap.distance_km?.toFixed(1)} km</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Precio estimado</p>
                        <p className="text-2xl font-bold text-green-600">${selectedTripForMap.fare?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Distancia al pickup */}
                  {selectedTripForMap.distance_to_pickup && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <div className="flex items-center text-blue-800">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div>
                          <p className="text-xs font-medium">Distancia al punto de recogida</p>
                          <p className="text-lg font-bold">{selectedTripForMap.distance_to_pickup} km</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="space-y-2">
                    {/* Modificar precio */}
                    <button
                      onClick={async () => {
                        const result = await Swal.fire({
                          title: 'Modificar precio',
                          html: `
                            <p class="text-gray-600 mb-4">Precio actual: <span class="font-bold text-green-600">$${selectedTripForMap.fare?.toLocaleString()}</span></p>
                            <p class="text-sm text-gray-500 mb-2">Ingresa tu oferta personalizada:</p>
                          `,
                          input: 'number',
                          inputValue: selectedTripForMap.fare,
                          inputPlaceholder: 'Precio en pesos',
                          showCancelButton: true,
                          confirmButtonText: 'Enviar oferta',
                          cancelButtonText: 'Cancelar',
                          confirmButtonColor: '#10b981',
                          cancelButtonColor: '#6b7280',
                          inputValidator: (value) => {
                            if (!value || parseFloat(value) <= 0) {
                              return 'Debes ingresar un precio válido';
                            }
                            if (parseFloat(value) < 1000) {
                              return 'El precio mínimo es $1,000';
                            }
                          }
                        });

                        if (result.isConfirmed) {
                          try {
                            const customPrice = parseFloat(result.value);
                            const { tripsAPI } = await import('@/lib/api-client');
                            await tripsAPI.offerCustomPrice(selectedTripForMap.id, customPrice);

                            await Swal.fire({
                              icon: 'success',
                              title: 'Oferta enviada',
                              text: `Tu oferta de $${customPrice.toLocaleString()} ha sido enviada al pasajero.`,
                              confirmButtonColor: '#10b981',
                              timer: 3000,
                              timerProgressBar: true,
                            });

                            // Cerrar modal
                            setSelectedTripForMap(null);
                          } catch (error: any) {
                            console.error('Error sending custom price:', error);
                            const errorMessage = error?.response?.data?.error || error?.message || 'No se pudo enviar la oferta. Intenta nuevamente.';
                            Swal.fire({
                              icon: 'error',
                              title: 'Error',
                              text: errorMessage,
                              confirmButtonColor: '#008000',
                            });
                          }
                        }
                      }}
                      className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Modificar precio
                    </button>

                    {/* Aceptar viaje */}
                    <button
                      onClick={async () => {
                        const result = await Swal.fire({
                          title: '¿Aceptar este viaje?',
                          html: `
                            <div class="text-left space-y-2">
                              <p><strong>Pasajero:</strong> ${selectedTripForMap.passenger_name}</p>
                              <p><strong>Distancia:</strong> ${selectedTripForMap.distance_km?.toFixed(1)} km</p>
                              <p><strong>Precio:</strong> <span class="text-green-600 text-xl font-bold">$${selectedTripForMap.fare?.toLocaleString()}</span></p>
                            </div>
                          `,
                          icon: 'question',
                          showCancelButton: true,
                          confirmButtonText: 'Sí, aceptar',
                          cancelButtonText: 'Cancelar',
                          confirmButtonColor: '#008000',
                          cancelButtonColor: '#6b7280',
                        });

                        if (result.isConfirmed) {
                          try {
                            const { tripsAPI } = await import('@/lib/api-client');
                            await tripsAPI.acceptTrip(selectedTripForMap.id);

                            setActiveTrip({
                              id: selectedTripForMap.id,
                              pickup: {
                                lat: selectedTripForMap.pickup_latitude,
                                lng: selectedTripForMap.pickup_longitude,
                                address: selectedTripForMap.pickup_address,
                              },
                              destination: {
                                lat: selectedTripForMap.dropoff_latitude,
                                lng: selectedTripForMap.dropoff_longitude,
                                address: selectedTripForMap.dropoff_address,
                              },
                              fare: selectedTripForMap.fare,
                              distance: selectedTripForMap.distance_km,
                              passengerName: selectedTripForMap.passenger_name,
                              passengerPhone: selectedTripForMap.passenger_phone,
                              status: 'accepted',
                            });

                            setAvailableTrips([]);
                            setSelectedTripForMap(null);

                            Swal.fire({
                              icon: 'success',
                              title: '¡Viaje aceptado!',
                              text: 'Dirígete al punto de recogida.',
                              confirmButtonColor: '#008000',
                              timer: 3000,
                              timerProgressBar: true,
                            });
                          } catch (error) {
                            console.error('Error accepting trip:', error);
                            Swal.fire({
                              icon: 'error',
                              title: 'Error',
                              text: 'No se pudo aceptar el viaje. Intenta nuevamente.',
                              confirmButtonColor: '#008000',
                            });
                          }
                        }
                      }}
                      className="w-full py-3 px-4 bg-gradient-to-r from-[#008000] to-[#006600] text-white rounded-xl font-medium hover:from-[#006600] hover:to-[#004d00] transition-all duration-200"
                    >
                      Aceptar Viaje
                    </button>

                    {/* Cerrar */}
                    <button
                      onClick={() => setSelectedTripForMap(null)}
                      className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200"
                    >
                      Cerrar
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

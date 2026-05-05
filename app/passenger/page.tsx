"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { playNotificationSound } from "@/lib/useSound";

const RECENT_PLACES_KEY = "motaxi_recent_places";
const MAX_RECENT_PLACES = 5;

interface RecentPlace {
  address: string;
  latitude: number;
  longitude: number;
}

function loadRecentPlaces(): RecentPlace[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_PLACES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentPlace(place: RecentPlace) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadRecentPlaces().filter(
      (p) => p.address !== place.address
    );
    const updated = [place, ...existing].slice(0, MAX_RECENT_PLACES);
    localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(updated));
  } catch {
    // silencioso
  }
}

// Tipos para conductores
interface NearbyDriver {
  id: string;
  full_name: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate?: string;
  vehicle_types?: string;
  phone?: string;
  rating: number;
  total_trips: number;
  current_latitude: number;
  current_longitude: number;
  is_available: number;
  base_fare: number;
  per_km_fare: number;
  distance_km?: number;
  municipality?: string;
  night_only?: number;
  whatsapp?: string | null;
  profile_image?: string | null;
}

// Importar componentes dinámicamente para evitar problemas con SSR
const GoogleMapComponent = dynamic(
  () => import("@/components/GoogleMapComponent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    ),
  },
);

// Componente de selección de ubicación con Google Places API
const LocationPicker = dynamic(
  () => import("@/components/PlacesAutocomplete"),
  {
    ssr: false,
  },
);

interface LocationInput {
  address: string;
  latitude: number | null;
  longitude: number | null;
  place_id?: string;
}

// Componente separado que maneja el polling de viajes activos
function ActiveTripChecker({ user, router }: { user: any; router: any }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Verificar si acabamos de completar un viaje
    const justCompleted = searchParams.get("justCompleted") === "true";

    // Verificar si hay un viaje activo y redirigir a la vista de tracking
    const checkActiveTrip = async () => {
      if (!user || user.role !== "passenger") return;

      try {
        const { tripsAPI } = await import("@/lib/api-client");
        const data = await tripsAPI.getCurrentTrip();

        if (data.trip) {
          // Hay un viaje activo, redirigir a tracking
          router.push(`/passenger/trip/${data.trip.id}`);
        }
      } catch (error) {
        console.error("Error checking active trip:", error);
      }
    };

    if (user?.role === "passenger") {
      let interval: NodeJS.Timeout | null = null;
      let initialDelay: NodeJS.Timeout | null = null;

      // Si acabamos de completar un viaje, esperar 3 segundos antes de iniciar polling
      // Esto da tiempo a que la BD se actualice completamente
      if (justCompleted) {
        // Limpiar el parámetro de la URL
        router.replace("/passenger");

        // Esperar 3 segundos antes de iniciar el polling
        initialDelay = setTimeout(() => {
          checkActiveTrip();
          // Después de la primera verificación, continuar cada 5 segundos
          interval = setInterval(checkActiveTrip, 5000);
        }, 3000);
      } else {
        // Comportamiento normal: verificar inmediatamente
        checkActiveTrip();

        // Verificar cada 5 segundos
        interval = setInterval(checkActiveTrip, 5000);
      }

      // Cleanup function
      return () => {
        if (interval) clearInterval(interval);
        if (initialDelay) clearTimeout(initialDelay);
      };
    }
  }, [user, router, searchParams]);

  return null;
}

export default function PassengerHomePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  const [pickup, setPickup] = useState<LocationInput>({
    address: "",
    latitude: null,
    longitude: null,
  });

  const [destination, setDestination] = useState<LocationInput>({
    address: "",
    latitude: null,
    longitude: null,
  });

  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [showTripRequest, setShowTripRequest] = useState(false);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(
    null,
  );
  const [mapClickMode, setMapClickMode] = useState<
    "pickup" | "destination" | null
  >(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isCheckingActiveTrip, setIsCheckingActiveTrip] = useState(false);

  // Tipo de vehículo preferido por el pasajero
  const [vehicleType, setVehicleType] = useState<"moto" | "taxi" | "carro" | "piaggio" | "particular" | null>(null);
  const [vehicleCarouselIndex, setVehicleCarouselIndex] = useState(0);
  const vehicleTouchStartX = useRef<number | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);

  // Modo de solicitud: viaje normal o envío de paquete
  const [tripMode, setTripMode] = useState<"ride" | "delivery">("ride");
  const [deliveryNote, setDeliveryNote] = useState("");

  // Estado para conductores disponibles y favoritos
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<NearbyDriver | null>(
    null,
  );

  // Ordenar conductores: primero los del municipio más cercano al pasajero
  const sortedNearbyDrivers = useMemo(() => {
    if (nearbyDrivers.length === 0) return nearbyDrivers;
    // Inferir municipio del pasajero: usar el del conductor más cercano (≤1.5km)
    const closestWithMunicipality = nearbyDrivers.find(
      (d) => d.municipality && (d.distance_km ?? 99) <= 1.5,
    );
    const passengerMunicipality = closestWithMunicipality?.municipality;
    if (!passengerMunicipality) return nearbyDrivers;
    return [...nearbyDrivers].sort((a, b) => {
      const aLocal = a.municipality === passengerMunicipality ? 0 : 1;
      const bLocal = b.municipality === passengerMunicipality ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
      return (a.distance_km ?? 99) - (b.distance_km ?? 99);
    });
  }, [nearbyDrivers]);
  const [driverDetailDriver, setDriverDetailDriver] =
    useState<NearbyDriver | null>(null);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [passengerCustomPrice, setPassengerCustomPrice] = useState<
    number | null
  >(null);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [showRecentPlaces, setShowRecentPlaces] = useState(false);

  // Cargar historial al montar
  useEffect(() => {
    setRecentPlaces(loadRecentPlaces());
  }, []);

  // Mostrar historial cuando el destino está vacío
  useEffect(() => {
    if (!destination.address) {
      setShowRecentPlaces(recentPlaces.length > 0);
    } else {
      setShowRecentPlaces(false);
    }
  }, [destination.address, recentPlaces.length]);

  // Calcula el precio justo para un conductor dado una distancia
  // Lógica: base_fare cubre el primer km urbano.
  // Por cada km adicional se suma per_km_fare.
  // Mínimo: base_fare.
  const calcFare = (baseFare: number, perKm: number, distKm: number) => {
    const base = baseFare ?? 5000;
    const rate = perKm ?? 1500;
    const extraKm = Math.max(0, distKm - 1);
    return Math.round(base + extraKm * rate);
  };

  // Precio recomendado calculado automáticamente
  const recommendedPrice = useMemo(() => {
    if (!estimatedDistance) return null;
    if (selectedDriver) {
      return calcFare(selectedDriver.base_fare, selectedDriver.per_km_fare, estimatedDistance);
    }
    if (nearbyDrivers.length > 0) {
      // Promedio de los conductores cercanos para un precio justo
      const fares = sortedNearbyDrivers.map(d =>
        calcFare(d.base_fare, d.per_km_fare, estimatedDistance)
      );
      return Math.round(fares.reduce((s, f) => s + f, 0) / fares.length);
    }
    return calcFare(5000, 1500, estimatedDistance);
  }, [estimatedDistance, selectedDriver, nearbyDrivers, sortedNearbyDrivers]);

  useEffect(() => {
    // Solo verificar autenticación una vez que termine de cargar
    if (!loading && !hasCheckedAuth) {
      setHasCheckedAuth(true);

      if (!user) {
        router.push("/auth/login");
      } else if (user.email === "admin@neurai.dev") {
        router.push("/admin");
      } else if (user.role === "driver") {
        router.push("/driver");
      } else if (user.role !== "passenger") {
        router.push("/");
      }
    }
  }, [user, loading, router, hasCheckedAuth]);

  // Mostrar advertencia de seguridad nocturna al cargar (solo una vez por sesión, desde las 7pm)
  useEffect(() => {
    if (!user) return;
    const hour = new Date().getHours();
    const isNight = hour >= 19 || hour < 6;
    if (!isNight) return;
    const shownKey = "motaxi_night_warning_shown";
    const today = new Date().toDateString();
    const lastShown = sessionStorage.getItem(shownKey);
    if (lastShown === today) return;
    sessionStorage.setItem(shownKey, today);
    setShowSafetyWarning(true);
  }, [user]);

  useEffect(() => {
    // Obtener ubicación actual del usuario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(newLocation);

          // Establecer automáticamente el pickup con la ubicación actual
          // Esperar a que Google Maps esté cargado
          if (
            typeof window !== "undefined" &&
            window.google &&
            window.google.maps
          ) {
            try {
              const geocoder = new google.maps.Geocoder();
              const result = await geocoder.geocode({ location: newLocation });
              const address =
                result.results[0]?.formatted_address ||
                `${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)}`;

              setPickup({
                address,
                latitude: newLocation.lat,
                longitude: newLocation.lng,
              });
            } catch (error) {
              console.error("Error geocoding current location:", error);
              setPickup({
                address: `Mi ubicación actual`,
                latitude: newLocation.lat,
                longitude: newLocation.lng,
              });
            }
          } else {
            // Si Google Maps no está cargado aún, usar coordenadas
            setPickup({
              address: `Mi ubicación actual`,
              latitude: newLocation.lat,
              longitude: newLocation.lng,
            });
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          // Si no se puede obtener la ubicación, usar el centro del Valle de Sibundoy
          setCurrentLocation({ lat: 1.1656, lng: -77.0 });
          Swal.fire({
            icon: "warning",
            title: "GPS no disponible",
            text: "No se pudo obtener tu ubicación. Por favor, activa el GPS o selecciona manualmente tu ubicación de recogida.",
            confirmButtonColor: "#008000",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    } else {
      // Si no hay geolocalización, usar el centro del Valle de Sibundoy
      setCurrentLocation({ lat: 1.1656, lng: -77.0 });
      Swal.fire({
        icon: "info",
        title: "Geolocalización no soportada",
        text: "Tu navegador no soporta geolocalización. Por favor, selecciona manualmente tu ubicación de recogida.",
        confirmButtonColor: "#008000",
      });
    }
  }, []);

  // Cargar conductores cercanos disponibles cada 10 segundos
  useEffect(() => {
    if (!user || user.role !== "passenger") return;

    const fetchNearbyDrivers = async () => {
      try {
        const { driversAPI } = await import("@/lib/api-client");
        const lat = currentLocation?.lat || 1.1656;
        const lng = currentLocation?.lng || -77.0;
        const data = await driversAPI.getNearbyDrivers(lat, lng, vehicleType || undefined);
        setNearbyDrivers(data.drivers || []);
      } catch (error) {
        // Silencioso - no interrumpir la experiencia
      }
    };

    fetchNearbyDrivers();
    const interval = setInterval(fetchNearbyDrivers, 10000);
    return () => clearInterval(interval);
  }, [user, currentLocation?.lat, currentLocation?.lng, vehicleType]);

  const handleLocationChange = (newLocation: { lat: number; lng: number }) => {
    setCurrentLocation(newLocation);
  };

  const handleMapClick = async (location: { lat: number; lng: number }) => {
    if (!mapClickMode) return;

    // Obtener dirección usando Geocoding API
    const geocoder = new google.maps.Geocoder();
    try {
      const result = await geocoder.geocode({ location });
      const address =
        result.results[0]?.formatted_address ||
        `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;

      if (mapClickMode === "pickup") {
        setPickup({
          address,
          latitude: location.lat,
          longitude: location.lng,
        });
      } else if (mapClickMode === "destination") {
        setDestination({
          address,
          latitude: location.lat,
          longitude: location.lng,
        });
      }
    } catch (error) {
      console.error("Error geocoding:", error);
      // Si falla el geocoding, usar las coordenadas
      const address = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
      if (mapClickMode === "pickup") {
        setPickup({
          address,
          latitude: location.lat,
          longitude: location.lng,
        });
      } else {
        setDestination({
          address,
          latitude: location.lat,
          longitude: location.lng,
        });
      }
    }

    // Desactivar el modo de clic y expandir el panel
    setMapClickMode(null);
    setIsPanelMinimized(false);
  };

  // Actualizar distancia estimada cada vez que cambien pickup/destination
  useEffect(() => {
    if (
      pickup.latitude &&
      pickup.longitude &&
      destination.latitude &&
      destination.longitude
    ) {
      const dist = calculateDistance(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude,
      );
      setEstimatedDistance(dist);
      setPassengerCustomPrice(null); // Resetear precio personalizado al cambiar la ruta
    } else {
      setEstimatedDistance(null);
      setPassengerCustomPrice(null);
    }
  }, [
    pickup.latitude,
    pickup.longitude,
    destination.latitude,
    destination.longitude,
  ]);

  const adjustCustomPrice = (delta: number) => {
    const base = passengerCustomPrice ?? recommendedPrice ?? 5000;
    const next = Math.max(1000, base + delta);
    setPassengerCustomPrice(next);
  };

  const handleRequestTrip = async () => {
    if (
      !pickup.latitude ||
      !pickup.longitude ||
      !destination.latitude ||
      !destination.longitude
    ) {
      Swal.fire({
        icon: "warning",
        title: "Faltan datos",
        text: "Por favor, selecciona la ubicación de recogida y el destino.",
        confirmButtonColor: "#008000",
      });
      return;
    }

    if (!vehicleType) {
      Swal.fire({
        icon: "info",
        title: "Elige tu vehículo",
        text: "Selecciona si quieres viajar en mototaxi o en carro antes de solicitar.",
        confirmButtonColor: "#008000",
      });
      return;
    }

    // Calcular distancia
    const distance = calculateDistance(
      pickup.latitude,
      pickup.longitude,
      destination.latitude,
      destination.longitude,
    );
    setEstimatedDistance(distance);

    // Calcular tarifa estimada basada en conductores disponibles
    let estimatedFare = 5000; // Valor por defecto si no hay conductores
    if (passengerCustomPrice) {
      estimatedFare = passengerCustomPrice;
    } else if (selectedDriver) {
      estimatedFare = calcFare(selectedDriver.base_fare, selectedDriver.per_km_fare, distance);
    } else if (nearbyDrivers.length > 0) {
      const nearestDriver = nearbyDrivers[0];
      estimatedFare = calcFare(nearestDriver.base_fare, nearestDriver.per_km_fare, distance);
    } else {
      estimatedFare = calcFare(5000, 1500, distance);
    }

    try {
      setShowTripRequest(true);

      // Importar dinámicamente tripsAPI
      const { tripsAPI } = await import("@/lib/api-client");

      const response = await tripsAPI.createTrip({
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        pickup_address: pickup.address,
        dropoff_latitude: destination.latitude,
        dropoff_longitude: destination.longitude,
        dropoff_address: destination.address,
        distance_km: parseFloat(distance.toFixed(2)),
        estimated_fare: estimatedFare,
        trip_type: tripMode,
        ...(tripMode === "delivery" && deliveryNote.trim() ? { delivery_note: deliveryNote.trim() } : {}),
        ...(selectedDriver ? { preferred_driver_id: selectedDriver.id } : {}),
      });

      // Éxito: solicitud creada
      await Swal.fire({
        icon: "success",
        title: tripMode === "delivery" ? "¡Envío solicitado!" : "¡Solicitud enviada!",
        text: tripMode === "delivery"
          ? "Tu solicitud de envío está visible en el tablero de conductores. Un conductor irá a recoger el paquete."
          : "Tu solicitud está ahora visible en el tablero de conductores. Espera mientras un conductor acepta tu viaje.",
        confirmButtonColor: "#008000",
        confirmButtonText: tripMode === "delivery" ? "Seguir envío" : "Seguir viaje",
        timer: 3000,
        timerProgressBar: true,
      });

      // Guardar destino en historial reciente
      if (destination.latitude && destination.longitude && destination.address) {
        saveRecentPlace({
          address: destination.address,
          latitude: destination.latitude,
          longitude: destination.longitude,
        });
      }

      // Redirigir a la página de tracking del viaje
      router.push(`/passenger/trip/${response.trip.id}`);
    } catch (error: any) {
      console.error("Error requesting trip:", error);
      setShowTripRequest(false);

      if (error.response?.status === 401) {
        await Swal.fire({
          icon: "error",
          title: "Sesión expirada",
          text: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          confirmButtonColor: "#008000",
        });
        router.push("/auth/login");
      } else if (error.response?.data?.error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response.data.error,
          confirmButtonColor: "#008000",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error al solicitar el viaje",
          text: "No se pudo crear la solicitud. Por favor, intenta nuevamente.",
          confirmButtonColor: "#008000",
        });
      }
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
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

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      Swal.fire({
        icon: "info",
        title: "No disponible",
        text: "Tu navegador no soporta geolocalización.",
        confirmButtonColor: "#008000",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(newLocation);

          // Geocodificar la ubicación
          if (
            typeof window !== "undefined" &&
            window.google &&
            window.google.maps
          ) {
            const geocoder = new google.maps.Geocoder();
            const result = await geocoder.geocode({ location: newLocation });
            const address =
              result.results[0]?.formatted_address ||
              `${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)}`;

            setPickup({
              address,
              latitude: newLocation.lat,
              longitude: newLocation.lng,
            });
          } else {
            setPickup({
              address: "Mi ubicación actual",
              latitude: newLocation.lat,
              longitude: newLocation.lng,
            });
          }
        } catch (error) {
          console.error("Error geocoding location:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "Error al obtener la dirección de tu ubicación.",
            confirmButtonColor: "#008000",
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsLocating(false);

        let errorMessage = "No se pudo obtener tu ubicación. ";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage +=
            "Por favor, activa los permisos de ubicación en tu navegador.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage += "La información de ubicación no está disponible.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage += "La solicitud de ubicación ha caducado.";
        }
        Swal.fire({
          icon: "warning",
          title: "GPS no disponible",
          text: errorMessage,
          confirmButtonColor: "#008000",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Componente para verificar viajes activos con Suspense */}
      <Suspense fallback={null}>
        <ActiveTripChecker user={user} router={router} />
      </Suspense>

      {/* Header */}
      <header className="bg-white shadow-sm z-50 fixed top-0 left-0 right-0">
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#008000] to-[#006600] rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg md:text-xl">
                  M
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-[#008000]">
                MoTaxi
              </h1>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <span className="text-sm md:text-base text-gray-700 hidden sm:inline">
                Hola, {user?.full_name?.split(" ")[0] || "Usuario"}
              </span>
              {/* Botón de conductores disponibles */}
              {nearbyDrivers.length > 0 && (
                <div className="flex items-center space-x-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span>
                    {nearbyDrivers.length} disponible
                    {nearbyDrivers.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu((v) => !v)}
                  className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center hover:shadow-md transition-shadow"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-semibold text-gray-900 text-sm truncate">{user?.full_name}</p>
                        <p className="text-xs text-gray-400">Pasajero</p>
                      </div>
                      <button onClick={() => { setShowProfileMenu(false); router.push("/passenger/profile"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                        <svg className="w-4 h-4 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="text-sm text-gray-700">Ver perfil</span>
                      </button>
                      <button onClick={() => { setShowProfileMenu(false); router.push("/passenger/profile#settings"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-sm text-gray-700">Ajustes</span>
                      </button>
                      <button onClick={() => { setShowProfileMenu(false); router.push("/help"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-sm text-gray-700">Ayuda</span>
                      </button>
                      <div className="border-t border-gray-100" />
                      <button onClick={async () => { setShowProfileMenu(false); await logout(); router.push("/"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span className="text-sm text-red-600 font-medium">Cerrar sesión</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden pt-16 md:pt-20">
        {/* Map */}
        <div className="absolute inset-0">
          <GoogleMapComponent
            center={currentLocation || { lat: 1.1656, lng: -77.0 }}
            zoom={13}
            pickup={
              pickup.latitude && pickup.longitude
                ? { lat: pickup.latitude, lng: pickup.longitude }
                : null
            }
            destination={
              destination.latitude && destination.longitude
                ? { lat: destination.latitude, lng: destination.longitude }
                : null
            }
            onLocationChange={handleLocationChange}
            onMapClick={handleMapClick}
            clickMode={mapClickMode}
            nearbyDrivers={nearbyDrivers
              .filter((d) => d.current_latitude && d.current_longitude)
              .map((d) => ({
                id: d.id,
                lat: d.current_latitude,
                lng: d.current_longitude,
                name: d.full_name,
                vehicle: `${d.vehicle_color} ${d.vehicle_model}`,
                rating: d.rating,
              }))}
            onDriverClick={(driverId) => {
              const driver = nearbyDrivers.find((d) => d.id === driverId);
              if (driver) setDriverDetailDriver(driver);
            }}
          />
        </div>

        {/* Trip Request Card - Fija en la parte inferior con scroll */}
        <div
          className={`absolute bottom-0 left-0 right-0 md:left-4 md:bottom-4 md:right-auto md:w-96  bg-white/95 backdrop-blur-sm rounded-t-3xl md:rounded-3xl shadow-2xl z-30 pointer-events-auto overflow-y-auto transition-all duration-300 ${
            isPanelMinimized
              ? "max-h-[60px] md:max-h-[70px]"
              : "max-h-[85vh] md:max-h-[calc(100vh-2rem)]"
          }`}
        >
          <div className="p-3 md:p-4 space-y-2">
            {/* Handle para arrastrar en móvil y botón de toggle */}
            <div className="flex items-center justify-between -mt-1 mb-1">
              {isPanelMinimized ? (
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 truncate max-w-[120px] md:max-w-[200px]">
                      {pickup.address || "Origen"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 truncate max-w-[120px] md:max-w-[200px]">
                      {destination.address
                        ? destination.address.split(",")[0]
                        : "Destino"}
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
                    isPanelMinimized ? "rotate-180" : ""
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
                {/* Acceso a rutas compartidas */}
                <button
                  onClick={() => router.push('/passenger/shared-routes')}
                  className="w-full flex items-center justify-between bg-[#008000]/5 border border-[#008000]/20 rounded-xl px-4 py-2.5 hover:bg-[#008000]/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚕</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#008000]">Taxis con puestos disponibles</p>
                      <p className="text-xs text-gray-500">Ver rutas hacia otros pueblos</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Toggle: Viaje normal vs Envío de paquete */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTripMode("ride")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      tripMode === "ride"
                        ? "bg-white text-[#008000] shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>🏍️</span>
                    <span>Viaje</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripMode("delivery")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      tripMode === "delivery"
                        ? "bg-white text-[#008000] shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>📦</span>
                    <span>Envío</span>
                  </button>
                </div>

                {/* Explicación del modo envío */}
                {tripMode === "delivery" && (
                  <div className="flex items-start gap-2 bg-[#008000]/10 border border-[#008000]/30 rounded-xl px-3 py-2 text-xs text-[#008000]">
                    <span className="shrink-0 mt-0.5">ℹ️</span>
                    <span>
                      El conductor <strong>no lleva pasajero</strong>. Irá a recoger tu paquete y lo entregará en el destino indicado.
                    </span>
                  </div>
                )}

                <h2 className="text-lg font-bold text-gray-800 mb-1">
                  {tripMode === "delivery" ? "¿A dónde va el paquete?" : "¿A dónde vas?"}
                </h2>

                {/* Selector de tipo de vehículo */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-600">
                    ¿Cuál vehículo necesitas?
                  </p>
                  {(() => {
                    const vehicleOpts = [
                      { value: "moto" as const, icon: "🏍️", label: "Mototaxi", sub: "Rápido · económico" },
                      { value: "taxi" as const, icon: "🚕", label: "Taxi", sub: "Formal · seguro" },
                      { value: "particular" as const, icon: "🚗", label: "Particular", sub: "Carro personal" },
                      { value: "carro" as const, icon: "🚐", label: "Carro / Van", sub: "Cómodo · espacioso" },
                      { value: "piaggio" as const, icon: "🛻", label: "Piaggio", sub: "Mudanzas · carga" },
                    ];
                    return (
                      <div className="space-y-1">
                      <div className="relative flex items-center" style={{ height: '90px' }}>
                        {/* Flecha izquierda */}
                        <button
                          type="button"
                          onClick={() => setVehicleCarouselIndex((i) => (i - 1 + vehicleOpts.length) % vehicleOpts.length)}
                          className="absolute left-0 z-20 h-full w-8 flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-200 rounded-l-2xl shadow-sm transition-colors"
                          aria-label="Anterior"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        {/* Carrusel */}
                        <div
                          className="flex-1 overflow-hidden mx-8 relative"
                          style={{ height: '90px' }}
                          onTouchStart={(e) => { vehicleTouchStartX.current = e.touches[0].clientX; }}
                          onTouchEnd={(e) => {
                            if (vehicleTouchStartX.current === null) return;
                            const diff = vehicleTouchStartX.current - e.changedTouches[0].clientX;
                            if (Math.abs(diff) > 30) {
                              setShowSwipeHint(false);
                              if (diff > 0) {
                                setVehicleCarouselIndex((i) => (i + 1) % vehicleOpts.length);
                              } else {
                                setVehicleCarouselIndex((i) => (i - 1 + vehicleOpts.length) % vehicleOpts.length);
                              }
                            }
                            vehicleTouchStartX.current = null;
                          }}
                        >
                          {vehicleOpts.map((opt, i) => {
                            const total = vehicleOpts.length;
                            let norm = i - vehicleCarouselIndex;
                            if (norm > total / 2) norm -= total;
                            if (norm < -total / 2) norm += total;
                            const isActive = norm === 0;
                            const isVisible = Math.abs(norm) <= 1;
                            const translateX = norm * 110;
                            const scale = isActive ? 1 : 0.75;
                            const opacity = isActive ? 1 : 0.4;
                            const isSelected = vehicleType === opt.value;
                            return (
                              <div
                                key={opt.value}
                                onClick={() => {
                                  if (!isActive) {
                                    setVehicleCarouselIndex(i);
                                    setVehicleType(opt.value);
                                  } else {
                                    setVehicleType(isSelected ? null : opt.value);
                                  }
                                }}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: '50%',
                                  width: '120px',
                                  marginLeft: '-60px',
                                  height: '86px',
                                  transform: `translateX(${translateX}%) scale(${scale})`,
                                  transition: 'transform 0.3s ease, opacity 0.3s ease',
                                  opacity,
                                  zIndex: isActive ? 10 : 5,
                                  cursor: 'pointer',
                                  pointerEvents: isVisible ? 'auto' : 'none',
                                }}
                                className={`flex flex-col items-center justify-center rounded-2xl border-2 transition-colors ${
                                  isSelected
                                    ? "border-[#008000] bg-green-50 shadow-md"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <span className="text-2xl mb-0.5">{opt.icon}</span>
                                <span className={`text-xs font-bold ${isSelected ? "text-[#008000]" : "text-gray-700"}`}>
                                  {opt.label}
                                </span>
                                <span className="text-xs text-gray-400">{opt.sub}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Flecha derecha */}
                        <button
                          type="button"
                          onClick={() => setVehicleCarouselIndex((i) => (i + 1) % vehicleOpts.length)}
                          className="absolute right-0 z-20 h-full w-8 flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-200 rounded-r-2xl shadow-sm transition-colors"
                          aria-label="Siguiente"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>

                      {/* Hint swipe */}
                      {showSwipeHint && (
                        <>
                          <style>{`
                            @keyframes swipe-hint {
                              0%   { transform: translateX(18px); opacity: 0; }
                              15%  { opacity: 1; }
                              85%  { opacity: 1; }
                              100% { transform: translateX(-18px); opacity: 0; }
                            }
                            .swipe-hint-finger {
                              animation: swipe-hint 1.4s ease-in-out 2;
                              animation-fill-mode: forwards;
                            }
                          `}</style>
                          <div
                            className="flex items-center justify-center gap-1.5 mt-1"
                            onAnimationEnd={() => setShowSwipeHint(false)}
                          >
                            <span
                              className="swipe-hint-finger text-lg select-none"
                              style={{ display: 'inline-block' }}
                            >
                              👆
                            </span>
                            <span className="text-xs text-gray-400">desliza para ver más</span>
                          </div>
                        </>
                      )}
                      </div>
                    );
                  })()}
                </div>

                {/* Pickup Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full ring-2 ring-green-200 z-10"></div>
                    <LocationPicker
                      value={pickup.address}
                      onChange={(value) =>
                        setPickup({ ...pickup, address: value })
                      }
                      onSelectPlace={(place) =>
                        setPickup({
                          address: place.address,
                          latitude: place.latitude,
                          longitude: place.longitude,
                          place_id: place.place_id,
                        })
                      }
                      placeholder="Ubicación de recogida"
                      className="text-black"
                      icon="pickup"
                      favorites={[]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setMapClickMode("pickup");
                        setIsPanelMinimized(true);
                      }}
                      className={`py-2 px-3 md:px-4 rounded-xl text-xs font-medium transition-all duration-200 ${
                        mapClickMode === "pickup"
                          ? "bg-[#008000] text-white shadow-lg shadow-[#008000]/30"
                          : "bg-[#008000]/10 text-[#008000] hover:bg-[#008000]/20 border border-[#008000]/30"
                      }`}
                    >
                      {mapClickMode === "pickup"
                        ? "📍 Toca el mapa"
                        : "🗺️ Usar mapa"}
                    </button>
                    <button
                      onClick={handleGetCurrentLocation}
                      disabled={isLocating}
                      className="py-2 px-3 md:px-4 rounded-xl text-xs font-medium transition-all duration-200 bg-[#008000]/10 text-[#008000] hover:bg-[#008000]/20 border border-[#008000]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                    >
                      {isLocating ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span>Ubicando...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span>Mi ubicación</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Destination Input */}
                <div className="space-y-2">
                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#008000] rounded-full ring-2 ring-[#008000]/30 z-10"></div>
                      <LocationPicker
                        value={destination.address}
                        onChange={(value) => {
                          setDestination({ ...destination, address: value });
                          setShowRecentPlaces(value === "");
                        }}
                        onSelectPlace={(place) => {
                          setDestination({
                            address: place.address,
                            latitude: place.latitude,
                            longitude: place.longitude,
                            place_id: place.place_id,
                          });
                          setShowRecentPlaces(false);
                        }}
                        placeholder="¿A dónde vas?"
                        className="text-black"
                        icon="destination"
                        favorites={[]}
                      />
                      {destination.address && (
                        <button
                          onClick={() => {
                            setDestination({ address: "", latitude: 0, longitude: 0 });
                            setShowRecentPlaces(true);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors z-10"
                          title="Limpiar destino"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {destination.address && (
                      <button
                        onClick={() => {
                          setDestination({ address: "", latitude: 0, longitude: 0 });
                          setShowRecentPlaces(true);
                        }}
                        className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[#008000] text-white hover:bg-[#006800] transition-colors shadow-md"
                        title="Cambiar destino"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMapClickMode("destination");
                        setIsPanelMinimized(true);
                        setShowRecentPlaces(false);
                      }}
                      className={`flex-shrink-0 px-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                        mapClickMode === "destination"
                          ? "bg-[#008000] text-white shadow-lg shadow-[#008000]/30"
                          : "bg-[#008000]/10 text-[#008000] hover:bg-[#008000]/20 border border-[#008000]/30"
                      }`}
                    >
                      {mapClickMode === "destination" ? "📍" : "🗺️ Mapa"}
                    </button>
                  </div>

                  {/* Historial de lugares recientes - estilo InDrive */}
                  {showRecentPlaces && recentPlaces.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recientes</span>
                      </div>
                      {recentPlaces.map((place, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setDestination({
                              address: place.address,
                              latitude: place.latitude,
                              longitude: place.longitude,
                            });
                            setShowRecentPlaces(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700 truncate">{place.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Campo de nota para envío de paquete */}
                {tripMode === "delivery" && (
                  <div className="bg-[#008000]/10 border border-[#008000]/30 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span>📦</span>
                      <span className="text-sm font-semibold text-[#008000]">Detalles del paquete</span>
                    </div>
                    <textarea
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Ej: Caja pequeña de ropa, llama al llegar · Nombre del destinatario: Juan · Frágil"
                      rows={3}
                      maxLength={300}
                      className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-[#008000]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008000]/30 resize-none placeholder-gray-400"
                    />
                    <p className="text-xs text-gray-400 text-right">{deliveryNote.length}/300</p>
                  </div>
                )}

                {/* Panel de tarifa estilo InDrive - solo cuando hay origen y destino */}
                {!!(pickup.latitude && destination.latitude && estimatedDistance && recommendedPrice) && (
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {/* Lista de conductores */}
                    {nearbyDrivers.length > 0 && (
                      <div className="divide-y divide-gray-50">
                        {sortedNearbyDrivers.slice(0, 4).map((driver) => {
                          const driverFare = calcFare(driver.base_fare, driver.per_km_fare, estimatedDistance!);
                          const isSelected = selectedDriver?.id === driver.id;
                          return (
                            <div
                              key={driver.id}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 ${
                                isSelected ? "bg-green-50" : "hover:bg-gray-50"
                              }`}
                            >
                              {/* Foto — abre detalle */}
                              <button
                                onClick={() => setDriverDetailDriver(driver)}
                                className="flex-shrink-0 focus:outline-none"
                              >
                                {driver.profile_image ? (
                                  <img
                                    src={driver.profile_image}
                                    alt={driver.full_name}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                )}
                              </button>
                              {/* Info — selecciona conductor */}
                              <button
                                onClick={() => setSelectedDriver(isSelected ? null : driver)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <div className="flex items-center gap-1.5">
                                  {driver.vehicle_types && (
                                    <span className="text-base flex-shrink-0">
                                      {({ moto: '🏍️', taxi: '🚕', carro: '🚐', piaggio: '🛻', particular: '🚗' } as Record<string, string>)[driver.vehicle_types] ?? '🚗'}
                                    </span>
                                  )}
                                  <span className="text-sm font-semibold text-gray-800 truncate">{driver.full_name}</span>
                                  {isSelected && <span className="text-xs text-[#008000] font-bold flex-shrink-0">✓</span>}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                  <span>⭐ {driver.rating != null ? driver.rating.toFixed(1) : 'Nuevo'}</span>
                                  <span>·</span>
                                  <span>{driver.total_trips ?? 0} viajes</span>
                                  {driver.distance_km && (
                                    <>
                                      <span>·</span>
                                      <span>{driver.distance_km.toFixed(1)} km</span>
                                    </>
                                  )}
                                  {driver.night_only === 1 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-[#008000] font-medium">🌙 Solo nocturno</span>
                                    </>
                                  )}
                                </div>
                              </button>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                  <div className="text-base font-bold text-[#006600]">
                                    ${driverFare.toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-gray-400 leading-tight">
                                    Precio estimado
                                  </div>
                                </div>
                                <button
                                  onClick={() => setDriverDetailDriver(driver)}
                                  className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors flex-shrink-0"
                                >
                                  Ver
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {nearbyDrivers.length > 4 && (
                          <p className="text-xs text-center text-gray-400 py-1.5">
                            +{nearbyDrivers.length - 4} más disponibles
                          </p>
                        )}
                      </div>
                    )}

                    {/* Sin conductores */}
                    {nearbyDrivers.length === 0 && (
                      <div className="px-3 py-3 text-center text-sm text-[#008000] bg-[#008000]/10">
                        No hay conductores disponibles en tu zona ahora
                      </div>
                    )}

                    {/* Panel de precio */}
                    <div className="border-t border-gray-100 px-3 py-3">
                      <p className="text-xs text-gray-400 mb-2">Tu oferta al conductor</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustCustomPrice(-500)}
                          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 text-xl font-bold transition-colors flex-shrink-0"
                        >
                          −
                        </button>
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#008000] font-bold text-lg pointer-events-none">$</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={passengerCustomPrice ?? recommendedPrice ?? ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                              if (!isNaN(val) && val > 0) setPassengerCustomPrice(val);
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 text-lg font-bold text-center text-[#008000] border-2 border-[#008000]/30 rounded-xl focus:outline-none focus:border-[#008000] bg-[#008000]/5"
                          />
                        </div>
                        <button
                          onClick={() => adjustCustomPrice(500)}
                          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 text-xl font-bold transition-colors flex-shrink-0"
                        >
                          +
                        </button>
                      </div>
                      {passengerCustomPrice && passengerCustomPrice !== recommendedPrice && (
                        <button
                          onClick={() => setPassengerCustomPrice(null)}
                          className="mt-1.5 text-[10px] text-gray-400 underline hover:text-gray-600 w-full text-center"
                        >
                          Restablecer precio sugerido
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Request Button */}
                <button
                  onClick={handleRequestTrip}
                  disabled={
                    !pickup.latitude || !destination.latitude || showTripRequest
                  }
                  className="btn btn-primary w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed sticky bottom-0 bg-gradient-to-r from-[#008000] to-[#006600] hover:from-[#006600] hover:to-[#004d00] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {showTripRequest ? (
                    <span className="flex items-center justify-center space-x-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Solicitando...</span>
                    </span>
                  ) : tripMode === "delivery" ? (
                    "📦 Solicitar envío"
                  ) : vehicleType === "moto" ? (
                    "🏍️ Solicitar mototaxi"
                  ) : vehicleType === "taxi" ? (
                    "🚕 Solicitar taxi"
                  ) : vehicleType === "particular" ? (
                    "🚗 Solicitar particular"
                  ) : vehicleType === "carro" ? (
                    "🚐 Solicitar carro / van"
                  ) : vehicleType === "piaggio" ? (
                    "🛻 Solicitar piaggio"
                  ) : (
                    "Solicitar viaje"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Popup de conductor — se abre desde la lista o el mapa */}
      {driverDetailDriver && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={() => { setDriverDetailDriver(null); setPhotoExpanded(false); }}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-md shadow-2xl pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Encabezado con foto grande */}
            <div className="flex items-center gap-4 px-5 py-4">
              {driverDetailDriver.profile_image ? (
                <button
                  onClick={() => setPhotoExpanded(true)}
                  className="relative flex-shrink-0 group focus:outline-none"
                >
                  <img
                    src={driverDetailDriver.profile_image}
                    alt={driverDetailDriver.full_name}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                    <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </button>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">
                    {driverDetailDriver.full_name}
                  </h3>
                  {driverDetailDriver.rating >= 4.5 && driverDetailDriver.total_trips >= 20 && (
                    <span className="inline-flex items-center gap-0.5 bg-[#008000] text-white px-1.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0">
                      ⭐ Destacado
                    </span>
                  )}
                </div>
                {/* Tipo de vehículo y horario */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {driverDetailDriver.vehicle_types && (
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      <span>{({ moto: '🏍️', taxi: '🚕', carro: '🚐', piaggio: '🛻', particular: '🚗' } as Record<string, string>)[driverDetailDriver.vehicle_types] ?? '🚗'}</span>
                      <span>{({ moto: 'Mototaxi', taxi: 'Taxi', carro: 'Carro / Van', piaggio: 'Piaggio', particular: 'Particular' } as Record<string, string>)[driverDetailDriver.vehicle_types] ?? driverDetailDriver.vehicle_types}</span>
                    </span>
                  )}
                  {driverDetailDriver.night_only === 1 && (
                    <span className="inline-flex items-center gap-1 bg-[#008000]/10 text-[#008000] px-2 py-0.5 rounded-full text-xs font-medium">
                      🌙 Solo nocturno (6pm–6am)
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {driverDetailDriver.vehicle_color} {driverDetailDriver.vehicle_model}
                </p>
              </div>
              <button
                onClick={() => { setDriverDetailDriver(null); setPhotoExpanded(false); }}
                className="self-start text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 px-5 mb-4">
              <div className="bg-[#008000]/10 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">Calificación</p>
                <p className="font-bold text-[#008000] text-base">
                  ⭐ {driverDetailDriver.rating != null ? driverDetailDriver.rating.toFixed(1) : 'Nuevo'}
                </p>
              </div>
              <div className="bg-[#008000]/10 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">Viajes</p>
                <p className="font-bold text-[#008000] text-base">
                  {driverDetailDriver.total_trips || 0}
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">Distancia</p>
                <p className="font-bold text-green-600 text-base">
                  {driverDetailDriver.distance_km ? `${driverDetailDriver.distance_km.toFixed(1)} km` : '—'}
                </p>
              </div>
            </div>

            {/* Detalles adicionales */}
            <div className="px-5 mb-4 space-y-2">
              {driverDetailDriver.vehicle_plate && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400 w-4">🪪</span>
                  <span>Placa: <span className="font-semibold text-gray-800">{driverDetailDriver.vehicle_plate}</span></span>
                </div>
              )}
              {driverDetailDriver.municipality && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400 w-4">📍</span>
                  <span>Zona: <span className="font-semibold text-gray-800">{driverDetailDriver.municipality}</span></span>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex gap-3 px-5 pb-6">
              {driverDetailDriver.phone && (
                <a
                  href={`tel:${driverDetailDriver.phone}`}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm text-center hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Llamar
                </a>
              )}
              {(driverDetailDriver.whatsapp || driverDetailDriver.phone) && (
                <a
                  href={`https://wa.me/57${(driverDetailDriver.whatsapp || driverDetailDriver.phone)!.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-[#25D366] text-white rounded-xl font-semibold text-sm text-center hover:bg-[#1ebe5d] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.882l6.19-1.624A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.214-3.727.977.995-3.645-.234-.374A9.818 9.818 0 1112 21.818z"/>
                  </svg>
                  WhatsApp
                </a>
              )}
              <button
                onClick={() => {
                  setSelectedDriver(driverDetailDriver);
                  setDriverDetailDriver(null); setPhotoExpanded(false);
                }}
                className="flex-1 py-3 bg-[#008000] text-white rounded-xl font-semibold text-sm hover:bg-[#38b018] transition-colors"
              >
                Seleccionar conductor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox foto del conductor */}
      {photoExpanded && driverDetailDriver?.profile_image && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[200] p-4"
          onClick={() => setPhotoExpanded(false)}
        >
          <img
            src={driverDetailDriver.profile_image}
            alt={driverDetailDriver.full_name}
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
          />
          <button
            onClick={() => setPhotoExpanded(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Modal de advertencia nocturna */}
      {showSafetyWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Header nocturno */}
            <div className="bg-gradient-to-br from-black to-[#008000] px-6 pt-6 pb-4 text-center">
              <div className="text-5xl mb-3">🌙</div>
              <h2 className="text-xl font-bold text-white mb-1">
                Viaje nocturno
              </h2>
              <p className="text-green-100 text-sm">
                Son las {new Date().getHours()}:
                {String(new Date().getMinutes()).padStart(2, "0")} — ten
                precaución
              </p>
            </div>
            {/* Contenido */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Recomendaciones de seguridad:
              </p>
              {[
                {
                  icon: "⭐",
                  text: "Viaja preferiblemente con conductores de tu lista de favoritos",
                },
                {
                  icon: "📍",
                  text: "Comparte tu ubicación en tiempo real con alguien de confianza",
                },
                {
                  icon: "🔍",
                  text: "Verifica la placa y el vehículo antes de subir",
                },
                {
                  icon: "❌",
                  text: "Si algo te genera desconfianza, cancela sin dudarlo",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-gray-50 rounded-xl p-2.5"
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  <span className="text-sm text-gray-700 leading-snug">
                    {item.text}
                  </span>
                </div>
              ))}
              <div className="bg-[#008000]/10 border border-[#008000]/30 rounded-xl p-3 mt-1">
                <p className="text-xs text-[#008000] font-medium">
                  💡 En la noche, los viajes en <strong>carro</strong> son una
                  opción más cómoda y segura. Selecciónalo abajo.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowSafetyWarning(false)}
                className="w-full py-3 bg-[#008000] text-white rounded-xl font-bold hover:bg-[#006600] transition-colors"
              >
                Entendido, proceder con precaución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

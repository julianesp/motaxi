"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useNamedPlaces } from "@/lib/hooks/useNamedPlaces";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";

// Tipos para conductores
interface NearbyDriver {
  id: string;
  full_name: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate?: string;
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
  profile_image?: string | null;
}

interface FavoriteDriver {
  id: string;
  driver_id: string;
  nickname: string | null;
  full_name: string;
  phone: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  rating: number;
  total_trips: number;
  is_available: number;
  current_latitude: number | null;
  current_longitude: number | null;
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
  const { user, loading } = useAuth();
  const { favorites, addFavorite, deleteFavorite } = useFavorites();
  const { searchResults: namedPlaceResults, search: searchNamedPlaces, createPlace } = useNamedPlaces();
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
  const [showSaveFavoriteDialog, setShowSaveFavoriteDialog] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [mapClickMode, setMapClickMode] = useState<
    "pickup" | "destination" | null
  >(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isCheckingActiveTrip, setIsCheckingActiveTrip] = useState(false);

  // Tipo de vehículo preferido por el pasajero
  const [vehicleType, setVehicleType] = useState<"moto" | "carro" | null>(null);
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
  const [favoriteDrivers, setFavoriteDrivers] = useState<FavoriteDriver[]>([]);
  const [showFavoriteDriversPanel, setShowFavoriteDriversPanel] =
    useState(false);
  const [loadingFavoriteDrivers, setLoadingFavoriteDrivers] = useState(false);
  const [passengerCustomPrice, setPassengerCustomPrice] = useState<
    number | null
  >(null);

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

  // Cargar conductores favoritos
  const loadFavoriteDrivers = async () => {
    setLoadingFavoriteDrivers(true);
    try {
      const { favoriteDriversAPI } = await import("@/lib/api-client");
      const data = await favoriteDriversAPI.getAll();
      setFavoriteDrivers(data.favoriteDrivers || []);
    } catch (error) {
      console.error("Error loading favorite drivers:", error);
    } finally {
      setLoadingFavoriteDrivers(false);
    }
  };

  const handleAddFavoriteDriver = async (driver: NearbyDriver) => {
    const { value: nickname } = await Swal.fire({
      title: `Agregar a ${driver.full_name}`,
      text: "¿Quieres darle un apodo a este conductor? (opcional)",
      input: "text",
      inputPlaceholder: "Ej: El de la Boxer roja",
      inputAttributes: { maxlength: "40" },
      showCancelButton: true,
      confirmButtonColor: "#008000",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Agregar",
      cancelButtonText: "Cancelar",
    });

    if (nickname === undefined) return; // Canceló

    try {
      const { favoriteDriversAPI } = await import("@/lib/api-client");
      await favoriteDriversAPI.add(driver.id, nickname || undefined);
      await loadFavoriteDrivers();
      Swal.fire({
        icon: "success",
        title: "¡Agregado!",
        text: `${driver.full_name} es ahora un conductor favorito.`,
        confirmButtonColor: "#008000",
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } catch (error: any) {
      const msg =
        error.response?.data?.error || "No se pudo agregar el favorito.";
      Swal.fire({
        icon: "error",
        title: "Error",
        text: msg,
        confirmButtonColor: "#008000",
      });
    }
  };

  const handleRemoveFavoriteDriver = async (driverId: string, name: string) => {
    const result = await Swal.fire({
      icon: "question",
      title: "¿Eliminar favorito?",
      text: `¿Quieres quitar a ${name} de tus conductores favoritos?`,
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      const { favoriteDriversAPI } = await import("@/lib/api-client");
      await favoriteDriversAPI.remove(driverId);
      setFavoriteDrivers((prev) =>
        prev.filter((d) => d.driver_id !== driverId),
      );
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar.",
        confirmButtonColor: "#008000",
      });
    }
  };

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

  const handleModifyPrice = async () => {
    // Calcular precio estimado actual para mostrarlo como referencia
    let currentEstimate = 5000;
    if (estimatedDistance && nearbyDrivers.length > 0) {
      const nearestDriver = nearbyDrivers[0];
      currentEstimate = Math.round(
        (nearestDriver.base_fare ?? 5000) +
          estimatedDistance * (nearestDriver.per_km_fare ?? 2000),
      );
    } else if (estimatedDistance) {
      currentEstimate = Math.round(5000 + estimatedDistance * 2000);
    }

    const displayPrice = passengerCustomPrice ?? currentEstimate;

    const { value: newPrice } = await Swal.fire({
      title: "Proponer precio",
      html: `
        <p style="color:#6b7280;font-size:14px;margin-bottom:12px;">
          Precio estimado: <strong style="color:#008000;">$${currentEstimate.toLocaleString()}</strong>
        </p>
        <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">
          Puedes proponer un precio diferente. Los conductores verán tu oferta y decidirán si aceptarla.
        </p>
        <input id="swal-price-input" type="number" min="1000" step="100"
          value="${displayPrice}"
          style="width:100%;padding:10px 12px;border:2px solid #d1fae5;border-radius:12px;font-size:18px;font-weight:bold;color:#008000;text-align:center;outline:none;"
          placeholder="Ingresa el precio"
        />
      `,
      confirmButtonText: "Confirmar precio",
      confirmButtonColor: "#008000",
      showCancelButton: true,
      cancelButtonText: passengerCustomPrice
        ? "Usar precio estimado"
        : "Cancelar",
      cancelButtonColor: "#6b7280",
      preConfirm: () => {
        const input = document.getElementById(
          "swal-price-input",
        ) as HTMLInputElement;
        const val = parseInt(input.value);
        if (!val || val < 1000) {
          Swal.showValidationMessage("El precio mínimo es $1,000");
          return false;
        }
        return val;
      },
    });

    if (newPrice) {
      setPassengerCustomPrice(newPrice);
    } else if (passengerCustomPrice && !newPrice) {
      // Si canceló con "Usar precio estimado"
      setPassengerCustomPrice(null);
    }
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
      // El pasajero propuso un precio personalizado
      estimatedFare = passengerCustomPrice;
    } else if (selectedDriver) {
      // Usar tarifa del conductor seleccionado
      estimatedFare = Math.round(
        (selectedDriver.base_fare ?? 5000) +
          distance * (selectedDriver.per_km_fare ?? 2000),
      );
    } else if (nearbyDrivers.length > 0) {
      // Usar tarifa del conductor más cercano
      const nearestDriver = nearbyDrivers[0];
      const baseFare = nearestDriver.base_fare ?? 5000;
      const perKmFare = nearestDriver.per_km_fare ?? 2000;
      estimatedFare = Math.round(baseFare + distance * perKmFare);
    } else {
      // Si no hay conductores, usar tarifa estándar del sistema
      estimatedFare = Math.round(5000 + distance * 2000);
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

  const handleSaveDestinationAsFavorite = async () => {
    if (
      !destination.latitude ||
      !destination.longitude ||
      !favoriteName.trim()
    ) {
      return;
    }

    setIsSavingFavorite(true);
    try {
      await addFavorite({
        name: favoriteName.trim(),
        address: destination.address,
        latitude: destination.latitude,
        longitude: destination.longitude,
        place_id: destination.place_id,
      });
      setShowSaveFavoriteDialog(false);
      setFavoriteName("");
      Swal.fire({
        icon: "success",
        title: "¡Guardado!",
        text: "Ubicación guardada en favoritos.",
        confirmButtonColor: "#008000",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error saving favorite:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo guardar en favoritos. Intenta nuevamente.",
        confirmButtonColor: "#008000",
      });
    } finally {
      setIsSavingFavorite(false);
    }
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
              {/* Botón de conductores favoritos */}
              <button
                onClick={() => {
                  setShowFavoriteDriversPanel(true);
                  loadFavoriteDrivers();
                }}
                className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-full flex items-center justify-center hover:shadow-md transition-shadow"
                title="Mis conductores favoritos"
              >
                <svg
                  className="w-5 h-5 text-yellow-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
              <button
                onClick={() => router.push("/passenger/profile")}
                className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center hover:shadow-md transition-shadow"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6 text-[#008000]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>📦</span>
                    <span>Envío</span>
                  </button>
                </div>

                {/* Explicación del modo envío */}
                {tripMode === "delivery" && (
                  <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-700">
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
                    ¿En qué quieres viajar?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setVehicleType("moto")}
                      className={`flex flex-col items-center justify-center py-2 px-2 rounded-2xl border-2 transition-all duration-200 ${
                        vehicleType === "moto"
                          ? "border-[#008000] bg-green-50 shadow-md"
                          : "border-gray-200 hover:border-green-300 bg-white"
                      }`}
                    >
                      <span className="text-xl mb-0.5">🏍️</span>
                      <span
                        className={`text-sm font-bold ${vehicleType === "moto" ? "text-[#008000]" : "text-gray-700"}`}
                      >
                        Mototaxi
                      </span>
                      <span className="text-xs text-gray-400">
                        Rápido · económico
                      </span>
                    </button>
                    <button
                      onClick={() => setVehicleType("carro")}
                      className={`flex flex-col items-center justify-center py-2 px-2 rounded-2xl border-2 transition-all duration-200 ${
                        vehicleType === "carro"
                          ? "border-blue-600 bg-blue-50 shadow-md"
                          : "border-gray-200 hover:border-blue-300 bg-white"
                      }`}
                    >
                      <span className="text-xl mb-0.5">🚗</span>
                      <span
                        className={`text-sm font-bold ${vehicleType === "carro" ? "text-blue-700" : "text-gray-700"}`}
                      >
                        Carro
                      </span>
                      <span className="text-xs text-gray-400">
                        Cómodo · nocturno
                      </span>
                    </button>
                  </div>
                  {vehicleType === "carro" && (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-700">
                      <span className="shrink-0 mt-0.5">🌙</span>
                      <span>
                        Los viajes en carro son ideales para la noche. Los
                        conductores disponibles en carro aparecerán en el mapa.
                      </span>
                    </div>
                  )}
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
                      namedPlaces={namedPlaceResults}
                      onNamedPlaceSearch={searchNamedPlaces}
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
                          ? "bg-green-600 text-white shadow-lg shadow-green-200"
                          : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                      }`}
                    >
                      {mapClickMode === "pickup"
                        ? "📍 Toca el mapa"
                        : "🗺️ Usar mapa"}
                    </button>
                    <button
                      onClick={handleGetCurrentLocation}
                      disabled={isLocating}
                      className="py-2 px-3 md:px-4 rounded-xl text-xs font-medium transition-all duration-200 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
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
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full ring-2 ring-red-200 z-10"></div>
                    <LocationPicker
                      value={destination.address}
                      onChange={(value) =>
                        setDestination({ ...destination, address: value })
                      }
                      onSelectPlace={(place) =>
                        setDestination({
                          address: place.address,
                          latitude: place.latitude,
                          longitude: place.longitude,
                          place_id: place.place_id,
                        })
                      }
                      placeholder="¿A dónde vas?"
                      className="text-black"
                      icon="destination"
                      favorites={favorites}
                      onSelectFavorite={(favorite) => {
                        setDestination({
                          address: favorite.address,
                          latitude: favorite.latitude,
                          longitude: favorite.longitude,
                          place_id: favorite.place_id,
                        });
                      }}
                      namedPlaces={namedPlaceResults}
                      onNamedPlaceSearch={searchNamedPlaces}
                    />
                  </div>
                  <button
                    onClick={() => {
                      setMapClickMode("destination");
                      setIsPanelMinimized(true);
                    }}
                    className={`w-full py-2 px-4 rounded-xl text-xs font-medium transition-all duration-200 ${
                      mapClickMode === "destination"
                        ? "bg-red-600 text-white shadow-lg shadow-red-200"
                        : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    }`}
                  >
                    {mapClickMode === "destination"
                      ? "📍 Toca el mapa para seleccionar"
                      : "🗺️ Seleccionar en el mapa"}
                  </button>
                </div>

                {/* Campo de nota para envío de paquete */}
                {tripMode === "delivery" && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-500">📦</span>
                      <span className="text-sm font-semibold text-orange-700">Detalles del paquete</span>
                    </div>
                    <textarea
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Ej: Caja pequeña de ropa, llama al llegar · Nombre del destinatario: Juan · Frágil"
                      rows={3}
                      maxLength={300}
                      className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none placeholder-gray-400"
                    />
                    <p className="text-xs text-gray-400 text-right">{deliveryNote.length}/300</p>
                  </div>
                )}

                {/* Botón para guardar destino como favorito */}
                {destination.latitude && destination.longitude && (
                  <button
                    onClick={() => setShowSaveFavoriteDialog(true)}
                    className="w-full py-2 px-4 text-xs text-[#008000] hover:text-[#006600] font-medium flex items-center justify-center space-x-2 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-200"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>Guardar como favorito</span>
                  </button>
                )}

                {/* Tarifas de conductores disponibles */}
                {pickup.latitude &&
                  destination.latitude &&
                  nearbyDrivers.length > 0 &&
                  estimatedDistance && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border border-green-200 shadow-sm space-y-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <svg
                          className="w-5 h-5 text-[#008000]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-gray-700 font-semibold text-sm">
                          Tarifas de conductores disponibles
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Toca un conductor para elegirlo ·{" "}
                        {estimatedDistance.toFixed(1)} km estimados
                      </p>
                      <div className="space-y-1">
                        {sortedNearbyDrivers.slice(0, 4).map((driver) => {
                          const driverFare = Math.round(
                            (driver.base_fare ?? 5000) +
                              estimatedDistance * (driver.per_km_fare ?? 2000),
                          );
                          const isSelected = selectedDriver?.id === driver.id;
                          return (
                            <button
                              key={driver.id}
                              onClick={() =>
                                setSelectedDriver(isSelected ? null : driver)
                              }
                              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 border transition-all duration-150 text-left ${
                                isSelected
                                  ? "bg-green-50 border-[#42CE1D] ring-1 ring-[#42CE1D]"
                                  : "bg-white border-green-100 hover:border-green-300 hover:bg-green-50"
                              }`}
                            >
                              {/* Foto del conductor */}
                              <div className="flex-shrink-0">
                                {driver.profile_image ? (
                                  <img
                                    src={driver.profile_image}
                                    alt={driver.full_name}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-green-200"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-green-100 border-2 border-green-200 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-800">
                                  {driver.full_name}
                                </span>
                                {isSelected && (
                                  <span className="ml-2 text-xs text-[#008000] font-semibold">
                                    ✓ Seleccionado
                                  </span>
                                )}
                                <div className="text-xs text-gray-400">
                                  {driver.distance_km?.toFixed(1)} km de ti
                                  {driver.municipality && (
                                    <span className="ml-1.5 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                      📍{" "}
                                      {driver.municipality
                                        .charAt(0)
                                        .toUpperCase() +
                                        driver.municipality
                                          .slice(1)
                                          .replace("_", " ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-base font-bold text-[#006600] flex-shrink-0">
                                ${driverFare.toLocaleString()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {nearbyDrivers.length > 4 && (
                        <p className="text-xs text-center text-gray-400">
                          +{nearbyDrivers.length - 4} conductores más
                          disponibles
                        </p>
                      )}
                      {/* Botón modificar precio */}
                      <button
                        onClick={handleModifyPrice}
                        className="w-full mt-1 py-2 px-3 text-sm font-medium text-[#008000] bg-white hover:bg-green-50 border border-green-300 rounded-xl transition-colors flex items-center justify-center space-x-2"
                      >
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        <span>
                          {passengerCustomPrice
                            ? `Tu precio: $${passengerCustomPrice.toLocaleString()} · Modificar`
                            : "Proponer mi precio"}
                        </span>
                      </button>
                    </div>
                  )}

                {/* Sin conductores disponibles */}
                {pickup.latitude &&
                  destination.latitude &&
                  nearbyDrivers.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-amber-800 text-center">
                        No hay conductores disponibles en tu zona en este
                        momento.
                      </p>
                      {/* Proponer precio sin conductores visibles */}
                      <button
                        onClick={handleModifyPrice}
                        className="w-full py-2 px-3 text-sm font-medium text-[#008000] bg-white hover:bg-green-50 border border-green-300 rounded-xl transition-colors flex items-center justify-center space-x-2"
                      >
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        <span>
                          {passengerCustomPrice
                            ? `Tu precio: $${passengerCustomPrice.toLocaleString()} · Modificar`
                            : "Proponer mi precio"}
                        </span>
                      </button>
                    </div>
                  )}

                {/* Indicador de precio propuesto por el pasajero */}
                {passengerCustomPrice && (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <span className="text-sm text-gray-600">
                      Tu precio propuesto:
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-[#008000]">
                        ${passengerCustomPrice.toLocaleString()}
                      </span>
                      <button
                        onClick={handleModifyPrice}
                        className="text-xs text-gray-400 hover:text-[#008000] underline"
                      >
                        Cambiar
                      </button>
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
                  ) : vehicleType === "carro" ? (
                    "🚗 Solicitar carro"
                  ) : vehicleType === "moto" ? (
                    "🏍️ Solicitar mototaxi"
                  ) : (
                    "Solicitar viaje"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Popup de conductor seleccionado en el mapa */}
      {driverDetailDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 p-4 sm:items-center">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-orange-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">
                      {driverDetailDriver.full_name}
                    </h3>
                    {driverDetailDriver.rating >= 4.5 &&
                      driverDetailDriver.total_trips >= 20 && (
                        <span className="inline-flex items-center gap-0.5 bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full text-xs font-bold">
                          ⭐ Destacado
                        </span>
                      )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {driverDetailDriver.vehicle_color}{" "}
                    {driverDetailDriver.vehicle_model}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDriverDetailDriver(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-center">
              <div className="bg-yellow-50 rounded-xl p-2">
                <p className="text-xs text-gray-500">Calificación</p>
                <p className="font-bold text-yellow-600">
                  ⭐ {driverDetailDriver.rating?.toFixed(1) || "5.0"}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-2">
                <p className="text-xs text-gray-500">Viajes</p>
                <p className="font-bold text-blue-600">
                  {driverDetailDriver.total_trips || 0}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {driverDetailDriver.phone && (
                <a
                  href={`tel:${driverDetailDriver.phone}`}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm text-center hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                >
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
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <span>Llamar</span>
                </a>
              )}
              <button
                onClick={() => {
                  handleAddFavoriteDriver(driverDetailDriver);
                  setDriverDetailDriver(null);
                }}
                className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl font-medium text-sm hover:bg-yellow-600 transition-colors flex items-center justify-center space-x-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>Favorito</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel lateral de conductores favoritos */}
      {showFavoriteDriversPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <svg
                  className="w-6 h-6 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <h2 className="text-xl font-bold text-gray-800">
                  Mis conductores favoritos
                </h2>
              </div>
              <button
                onClick={() => setShowFavoriteDriversPanel(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingFavoriteDrivers ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000] mx-auto"></div>
                  <p className="mt-3 text-gray-500 text-sm">Cargando...</p>
                </div>
              ) : favoriteDrivers.length === 0 ? (
                <div className="text-center py-10">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-300 mb-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <p className="text-gray-500 font-medium">
                    Aún no tienes conductores favoritos
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Toca un conductor en el mapa para agregarlo
                  </p>
                </div>
              ) : (
                favoriteDrivers.map((driver) => (
                  <div
                    key={driver.driver_id}
                    className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            driver.is_available ? "bg-green-100" : "bg-gray-100"
                          }`}
                        >
                          <svg
                            className={`w-6 h-6 ${driver.is_available ? "text-orange-500" : "text-gray-400"}`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {driver.full_name}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                driver.is_available
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {driver.is_available
                                ? "🟢 Disponible"
                                : "⚫ No disponible"}
                            </span>
                          </div>
                          {driver.nickname && (
                            <p className="text-xs text-[#008000] font-medium">
                              "{driver.nickname}"
                            </p>
                          )}
                          <p className="text-xs text-gray-500 truncate">
                            {driver.vehicle_color} {driver.vehicle_model}
                          </p>
                          <p className="text-xs text-yellow-600">
                            ⭐ {driver.rating?.toFixed(1)} ·{" "}
                            {driver.total_trips} viajes
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      {driver.phone && (
                        <>
                          <a
                            href={`tel:${driver.phone}`}
                            className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium text-xs text-center hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            <span>Llamar</span>
                          </a>
                          <a
                            href={`https://wa.me/${driver.phone.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(driver.full_name)},%20quiero%20un%20servicio%20de%20MoTaxi`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-medium text-xs text-center hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-1"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <span>WhatsApp</span>
                          </a>
                        </>
                      )}
                      <button
                        onClick={() =>
                          handleRemoveFavoriteDriver(
                            driver.driver_id,
                            driver.full_name,
                          )
                        }
                        className="w-9 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center"
                        title="Quitar de favoritos"
                      >
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dialog para guardar favorito */}
      {showSaveFavoriteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Guardar ubicación favorita
            </h3>
            <p className="text-gray-600 mb-4">{destination.address}</p>
            <input
              type="text"
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              placeholder="Ej: Casa, Trabajo, Gimnasio"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4 text-black"
              maxLength={50}
            />
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowSaveFavoriteDialog(false);
                  setFavoriteName("");
                }}
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                disabled={isSavingFavorite}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDestinationAsFavorite}
                disabled={!favoriteName.trim() || isSavingFavorite}
                className="flex-1 py-3 px-4 bg-[#008000] text-white rounded-xl font-medium hover:bg-[#006600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingFavorite ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de advertencia nocturna */}
      {showSafetyWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Header nocturno */}
            <div className="bg-gradient-to-br from-gray-900 to-blue-950 px-6 pt-6 pb-4 text-center">
              <div className="text-5xl mb-3">🌙</div>
              <h2 className="text-xl font-bold text-white mb-1">
                Viaje nocturno
              </h2>
              <p className="text-blue-200 text-sm">
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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">
                <p className="text-xs text-amber-800 font-medium">
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

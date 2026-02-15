"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/hooks/useFavorites";
import dynamic from "next/dynamic";

// Importar componentes dinámicamente para evitar problemas con SSR
const GoogleMapComponent = dynamic(
  () => import("@/components/GoogleMapComponent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
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

export default function PassengerHomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { favorites, addFavorite, deleteFavorite } = useFavorites();
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
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [showSaveFavoriteDialog, setShowSaveFavoriteDialog] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [mapClickMode, setMapClickMode] = useState<
    "pickup" | "destination" | null
  >(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isCheckingActiveTrip, setIsCheckingActiveTrip] = useState(false);

  useEffect(() => {
    // Solo verificar autenticación una vez que termine de cargar
    if (!loading && !hasCheckedAuth) {
      setHasCheckedAuth(true);

      if (!user) {
        // Si no hay usuario después de cargar, redirigir al login
        router.push("/auth/login");
      } else if (user.role !== "passenger") {
        // Si el usuario existe pero no es pasajero, redirigir a inicio
        router.push("/");
      }
    }
  }, [user, loading, router, hasCheckedAuth]);

  useEffect(() => {
    // Verificar si hay un viaje activo y redirigir a la vista de tracking
    const checkActiveTrip = async () => {
      if (!user || user.role !== 'passenger') return;

      try {
        const { tripsAPI } = await import("@/lib/api-client");
        const data = await tripsAPI.getCurrentTrip();

        if (data.trip) {
          // Hay un viaje activo, redirigir a tracking
          router.push(`/passenger/trip/${data.trip.id}`);
        }
      } catch (error) {
        console.error('Error checking active trip:', error);
      }
    };

    if (user?.role === 'passenger') {
      // Verificar inmediatamente
      checkActiveTrip();

      // Verificar cada 5 segundos
      const interval = setInterval(checkActiveTrip, 5000);

      return () => clearInterval(interval);
    }
  }, [user, router]);

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
          alert(
            "No se pudo obtener tu ubicación. Por favor, activa el GPS o selecciona manualmente tu ubicación de recogida.",
          );
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
      alert(
        "Tu navegador no soporta geolocalización. Por favor, selecciona manualmente tu ubicación de recogida.",
      );
    }
  }, []);

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

  const handleRequestTrip = async () => {
    if (
      !pickup.latitude ||
      !pickup.longitude ||
      !destination.latitude ||
      !destination.longitude
    ) {
      alert("Por favor, selecciona la ubicación de recogida y el destino.");
      return;
    }

    // Calcular distancia
    const distance = calculateDistance(
      pickup.latitude,
      pickup.longitude,
      destination.latitude,
      destination.longitude,
    );

    // Calcular tarifa estimada
    const fare = Math.round(5000 + distance * 2000); // Tarifa base + 2000 por km
    setEstimatedFare(fare);

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
        fare,
        distance_km: parseFloat(distance.toFixed(2)),
      });

      // Éxito: solicitud creada
      alert(
        `✅ ¡Solicitud creada exitosamente!\n\n` +
          `Tu solicitud está ahora visible en el tablero de conductores.\n` +
          `Espera mientras un conductor acepta tu viaje.`,
      );

      // Redirigir a la página de tracking del viaje
      router.push(`/passenger/trip/${response.trip.id}`);
    } catch (error: any) {
      console.error("Error requesting trip:", error);
      setShowTripRequest(false);

      if (error.response?.status === 401) {
        alert("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
        router.push("/auth/login");
      } else if (error.response?.data?.error) {
        alert(`Error: ${error.response.data.error}`);
      } else {
        alert("Error al solicitar el viaje. Por favor, intenta nuevamente.");
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
      alert("Tu navegador no soporta geolocalización");
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
          if (typeof window !== "undefined" && window.google && window.google.maps) {
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
          alert("Error al obtener la dirección de tu ubicación");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsLocating(false);

        let errorMessage = "No se pudo obtener tu ubicación. ";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage += "Por favor, activa los permisos de ubicación en tu navegador.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage += "La información de ubicación no está disponible.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage += "La solicitud de ubicación ha caducado.";
        }
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
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
      alert("¡Ubicación guardada en favoritos!");
    } catch (error) {
      console.error("Error saving favorite:", error);
      alert("Error al guardar en favoritos");
    } finally {
      setIsSavingFavorite(false);
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
      <header className="bg-white shadow-sm z-10 sticky top-0">
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg md:text-xl">M</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-indigo-600">MoTaxi</h1>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <span className="text-sm md:text-base text-gray-700 hidden sm:inline">
                Hola, {user?.full_name?.split(" ")[0] || "Usuario"}
              </span>
              <button
                onClick={() => router.push("/passenger/profile")}
                className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full flex items-center justify-center hover:shadow-md transition-shadow"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6 text-indigo-600"
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
      <div className="flex-1 relative overflow-hidden">
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
          />
        </div>

        {/* Botón flotante de ubicación */}
        <button
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="absolute top-4 right-4 md:top-6 md:right-6 w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-20 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Detectar mi ubicación"
        >
          {isLocating ? (
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>

        {/* Botón de Contacto al Desarrollador */}
        <a
          href="mailto:admin@neurai.dev?subject=Soporte%20MoTaxi&body=Hola,%20necesito%20ayuda%20con%20MoTaxi..."
          className="absolute top-20 right-4 md:top-24 md:right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center w-12 h-12 md:w-14 md:h-14 z-20 transition-all duration-200 hover:scale-110 active:scale-95"
          title="Contactar Soporte"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </a>

        {/* Trip Request Card - Fija en la parte inferior con scroll */}
        <div className={`absolute bottom-0 left-0 right-0 md:left-4 md:bottom-4 md:right-auto md:w-96 bg-white/95 backdrop-blur-sm rounded-t-3xl md:rounded-3xl shadow-2xl z-30 pointer-events-auto overflow-y-auto transition-all duration-300 ${
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
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 truncate max-w-[120px] md:max-w-[200px]">
                      {pickup.address || "Origen"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 truncate max-w-[120px] md:max-w-[200px]">
                      {destination.address || "Destino"}
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
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">¿A dónde vas?</h2>

            {/* Pickup Input */}
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full ring-2 ring-green-200 z-10"></div>
                <LocationPicker
                  value={pickup.address}
                  onChange={(value) => setPickup({ ...pickup, address: value })}
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
                  className={`py-2.5 px-3 md:px-4 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 ${
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
                  className="py-2.5 px-3 md:px-4 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                >
                  {isLocating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Ubicando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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
                />
              </div>
              <button
                onClick={() => {
                  setMapClickMode("destination");
                  setIsPanelMinimized(true);
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
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

            {/* Botón para guardar destino como favorito */}
            {destination.latitude && destination.longitude && (
              <button
                onClick={() => setShowSaveFavoriteDialog(true)}
                className="w-full py-2.5 px-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center justify-center space-x-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200"
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

            {/* Estimated Fare */}
            {estimatedFare && (
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-4 border border-indigo-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-700 font-medium">Tarifa estimada:</span>
                  </div>
                  <span className="text-2xl font-bold text-indigo-600">
                    ${estimatedFare.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

                {/* Request Button */}
                <button
                  onClick={handleRequestTrip}
                  disabled={!pickup.latitude || !destination.latitude || showTripRequest}
                  className="btn btn-primary w-full py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed sticky bottom-0 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {showTripRequest ? (
                    <span className="flex items-center justify-center space-x-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Solicitando...</span>
                    </span>
                  ) : (
                    "Solicitar MoTaxi"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

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
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4 text-black"
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
                className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingFavorite ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

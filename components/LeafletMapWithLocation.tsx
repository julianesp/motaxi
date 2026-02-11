'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LeafletMapWithLocationProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pickup?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
}

export default function LeafletMapWithLocation({
  center,
  zoom = 13,
  pickup,
  destination,
  onLocationChange,
}: LeafletMapWithLocationProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Inicializar el mapa
    mapRef.current = L.map(mapContainerRef.current).setView([center.lat, center.lng], zoom);

    // Agregar capa de tiles (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Crear iconos personalizados
    const pickupIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const destinationIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    // Agregar marcadores si existen
    if (pickup) {
      pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).addTo(
        mapRef.current
      );
    }

    if (destination) {
      destinationMarkerRef.current = L.marker([destination.lat, destination.lng], {
        icon: destinationIcon,
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Actualizar centro del mapa
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom]);

  // Actualizar marcador de pickup
  useEffect(() => {
    if (mapRef.current) {
      const pickupIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (pickup) {
        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
        } else {
          pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).addTo(
            mapRef.current
          );
        }
      } else if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }
    }
  }, [pickup]);

  // Actualizar marcador de destino
  useEffect(() => {
    if (mapRef.current) {
      const destinationIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (destination) {
        if (destinationMarkerRef.current) {
          destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
        } else {
          destinationMarkerRef.current = L.marker([destination.lat, destination.lng], {
            icon: destinationIcon,
          }).addTo(mapRef.current);
        }

        // Si hay pickup y destination, ajustar el mapa para mostrar ambos
        if (pickup && mapRef.current) {
          const bounds = L.latLngBounds([
            [pickup.lat, pickup.lng],
            [destination.lat, destination.lng],
          ]);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
    }
  }, [destination, pickup]);

  // Función para centrar el mapa en la ubicación del usuario
  const handleCenterToUserLocation = () => {
    setIsGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          if (mapRef.current) {
            mapRef.current.setView([newLocation.lat, newLocation.lng], 15);

            // Agregar o actualizar marcador de ubicación del usuario
            const userIcon = L.divIcon({
              className: 'custom-marker',
              html: '<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });

            if (userLocationMarkerRef.current) {
              userLocationMarkerRef.current.setLatLng([newLocation.lat, newLocation.lng]);
            } else {
              userLocationMarkerRef.current = L.marker([newLocation.lat, newLocation.lng], {
                icon: userIcon,
              }).addTo(mapRef.current);
            }
          }

          if (onLocationChange) {
            onLocationChange(newLocation);
          }
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('No se pudo obtener tu ubicación. Por favor, verifica los permisos del navegador.');
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      alert('Tu navegador no soporta geolocalización.');
      setIsGettingLocation(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Botón de centrar ubicación */}
      <button
        onClick={handleCenterToUserLocation}
        disabled={isGettingLocation}
        className="absolute bottom-24 right-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-[1000]"
        title="Centrar en mi ubicación"
      >
        {isGettingLocation ? (
          <svg
            className="w-6 h-6 text-indigo-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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
        )}
      </button>
    </div>
  );
}

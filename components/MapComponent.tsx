'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  center: { lat: number; lng: number };
  zoom?: number;
  pickup?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
}

export default function MapComponent({ center, zoom = 13, pickup, destination }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);

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

  return <div ref={mapContainerRef} className="w-full h-full" />;
}

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MUNICIPALITIES, VALLE_SIBUNDOY_CENTER } from '@/lib/constants/municipalities';

export default function LandingMap() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Inicializar el mapa centrado en el Valle de Sibundoy
    mapRef.current = L.map(mapContainerRef.current).setView(
      [VALLE_SIBUNDOY_CENTER.lat, VALLE_SIBUNDOY_CENTER.lng],
      11
    );

    // Agregar capa de tiles (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Agregar marcadores para cada municipio
    MUNICIPALITIES.forEach((municipality) => {
      const icon = L.divIcon({
        className: 'custom-municipality-marker',
        html: `
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
          ">
            ${municipality.name[0]}
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([municipality.coordinates.lat, municipality.coordinates.lng], {
        icon,
      }).addTo(mapRef.current!);

      // Agregar popup con información del municipio
      marker.bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #667eea;">
            ${municipality.name}
          </h3>
          <p style="margin: 0; font-size: 14px; color: #666;">
            ${municipality.description}
          </p>
          ${
            municipality.population
              ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
                  Población: ${municipality.population.toLocaleString()} hab.
                </p>`
              : ''
          }
        </div>
      `);
    });

    // Agregar un círculo para resaltar el área del Valle
    L.circle([VALLE_SIBUNDOY_CENTER.lat, VALLE_SIBUNDOY_CENTER.lng], {
      color: '#667eea',
      fillColor: '#667eea',
      fillOpacity: 0.1,
      radius: 15000, // 15 km de radio aproximado
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={mapContainerRef} className="w-full h-full rounded-2xl shadow-2xl" />;
}

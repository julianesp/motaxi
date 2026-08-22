'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DriverPublicProfile {
  id: string;
  full_name: string;
  profile_image: string | null;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  vehicle_types: string;
  rating: number;
  total_trips: number;
  municipality: string | null;
  verification_status: string;
  is_available: number;
  whatsapp: string | null;
}

interface VehiclePhoto {
  id: string;
  image_key: string;
  caption: string | null;
  created_at: number;
}

const VEHICLE_LABELS: Record<string, { emoji: string; label: string }> = {
  moto: { emoji: '🏍️', label: 'Mototaxi' },
  piaggio: { emoji: '🛺', label: 'Piaggio' },
  carro: { emoji: '🚐', label: 'Van / Carro' },
  particular: { emoji: '🚗', label: 'Particular' },
};

export default function DriverPublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.id as string;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

  const [driver, setDriver] = useState<DriverPublicProfile | null>(null);
  const [vehiclePhotos, setVehiclePhotos] = useState<VehiclePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<VehiclePhoto | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/drivers/${driverId}/public`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setDriver(data.driver);
        setVehiclePhotos(data.vehicle_photos || []);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [driverId, API_URL]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#42CE1D] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (notFound || !driver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <span className="text-6xl mb-4">🏍️</span>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Conductor no encontrado</h1>
        <p className="text-gray-500 mb-6 text-center">Este perfil no existe o el conductor no está verificado.</p>
        <Link href="/" className="px-6 py-3 bg-[#42CE1D] text-white rounded-xl font-semibold hover:bg-[#35a818] transition-colors">
          Ir al inicio
        </Link>
      </div>
    );
  }

  const vehicleInfo = VEHICLE_LABELS[driver.vehicle_types] ?? { emoji: '🏍️', label: 'Mototaxi' };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <span className="text-lg font-bold text-[#42CE1D]">MoTaxi</span>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Hero card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-[#42CE1D] to-[#008000] px-6 py-8 flex flex-col items-center">
            <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white flex items-center justify-center mb-4">
              {driver.profile_image ? (
                <img src={driver.profile_image} alt={driver.full_name} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-16 h-16 text-[#42CE1D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{driver.full_name}</h1>
            <p className="text-green-100 text-sm mb-3">Conductor verificado {vehicleInfo.emoji}</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-white font-bold text-sm">{driver.rating.toFixed(1)}</span>
              </div>
              <div className="bg-white/20 rounded-full px-3 py-1">
                <span className="text-white text-sm font-semibold">{driver.total_trips} viajes</span>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${driver.is_available ? 'bg-[#42CE1D] text-white' : 'bg-white/20 text-white/70'}`}>
                {driver.is_available ? '● Disponible' : '○ No disponible'}
              </div>
            </div>
          </div>

          {/* Datos del conductor */}
          <div className="p-6 space-y-4">
            {driver.municipality && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-700 capitalize">{driver.municipality.replace('_', ' ')}</span>
              </div>
            )}

            {driver.whatsapp && (
              <a
                href={`https://wa.me/57${driver.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors"
              >
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.882l6.19-1.624A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.214-3.727.977.995-3.645-.234-.374A9.818 9.818 0 1112 21.818z"/>
                </svg>
                <div>
                  <p className="text-green-700 font-semibold text-sm">Contactar por WhatsApp</p>
                  <p className="text-green-600 text-xs">{driver.whatsapp}</p>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Tarjeta de vehículo */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">{vehicleInfo.emoji}</span>
            Mi vehículo
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tipo</p>
              <p className="font-semibold text-gray-800">{vehicleInfo.label}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Color</p>
              <p className="font-semibold text-gray-800 capitalize">{driver.vehicle_color}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Modelo</p>
              <p className="font-semibold text-gray-800">{driver.vehicle_model}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Placa</p>
              <p className="font-semibold text-gray-800 font-mono uppercase">{driver.vehicle_plate}</p>
            </div>
          </div>
        </div>

        {/* Fotos del vehículo */}
        {vehiclePhotos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Fotos del vehículo</h2>
            <div className="grid grid-cols-2 gap-3">
              {vehiclePhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setExpandedPhoto(photo)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                >
                  <img
                    src={`${API_URL}/images/${photo.image_key}`}
                    alt={photo.caption || 'Foto del vehículo'}
                    className="w-full h-full object-cover"
                  />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                      <p className="text-white text-xs truncate">{photo.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA solicitar viaje */}
        <div className="bg-[#42CE1D]/10 border border-[#42CE1D]/30 rounded-2xl p-6 text-center">
          <p className="text-gray-700 font-semibold mb-3">¿Quieres solicitar un viaje con MoTaxi?</p>
          <Link
            href="/passenger"
            className="inline-block px-8 py-3 bg-[#42CE1D] text-white font-bold rounded-xl hover:bg-[#35a818] transition-colors shadow-md"
          >
            Solicitar viaje
          </Link>
        </div>
      </div>

      {/* Modal de foto expandida */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-10 right-0 text-white text-3xl font-bold leading-none"
            >
              ×
            </button>
            <img
              src={`${API_URL}/images/${expandedPhoto.image_key}`}
              alt={expandedPhoto.caption || 'Foto del vehículo'}
              className="w-full rounded-2xl max-h-[80vh] object-contain bg-black"
            />
            {expandedPhoto.caption && (
              <p className="text-white text-center mt-3 text-sm">{expandedPhoto.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

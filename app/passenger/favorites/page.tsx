'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Swal from 'sweetalert2';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.motaxi.dev';

interface FavoriteLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string;
  created_at: number;
}

interface FavoriteDriver {
  id: string;
  driver_id: string;
  nickname?: string;
  full_name: string;
  phone: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  rating: number;
  total_trips: number;
  is_available: number;
  created_at: number;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating?.toFixed(1) ?? '—'}</span>
    </div>
  );
}

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'locations' | 'drivers'>('locations');
  const [locations, setLocations] = useState<FavoriteLocation[]>([]);
  const [drivers, setDrivers] = useState<FavoriteDriver[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/auth/login'); return; }
    if (user.role !== 'passenger') { router.push('/driver'); return; }
    fetchLocations();
    fetchDrivers();
  }, [user, authLoading]);

  const getToken = () => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  async function fetchLocations() {
    setLoadingLocations(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setLocations(data.favorites || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function fetchDrivers() {
    setLoadingDrivers(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/favorites/drivers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setDrivers(data.favoriteDrivers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDrivers(false);
    }
  }

  async function deleteLocation(id: string, name: string) {
    const result = await Swal.fire({
      title: '¿Eliminar ubicación?',
      text: `"${name}" será eliminada de tus favoritos`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#42CE1D',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/favorites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLocations((prev) => prev.filter((l) => l.id !== id));
        Swal.fire({ icon: 'success', title: 'Eliminada', text: 'Ubicación eliminada de favoritos', timer: 1500, showConfirmButton: false });
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar la ubicación' });
    }
  }

  async function deleteDriver(driverId: string, name: string) {
    const result = await Swal.fire({
      title: '¿Eliminar conductor?',
      text: `"${name}" será eliminado de tus favoritos`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#42CE1D',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/favorites/drivers/${driverId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDrivers((prev) => prev.filter((d) => d.driver_id !== driverId));
        Swal.fire({ icon: 'success', title: 'Eliminado', text: 'Conductor eliminado de favoritos', timer: 1500, showConfirmButton: false });
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar el conductor' });
    }
  }

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-[#42CE1D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Mis Favoritos</h1>
          <p className="text-xs text-gray-500">Ubicaciones y conductores guardados</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-0">
          <button
            onClick={() => setActiveTab('locations')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'locations'
                ? 'border-[#42CE1D] text-[#42CE1D]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📍 Ubicaciones
            {locations.length > 0 && (
              <span className="ml-1.5 bg-[#42CE1D] text-white text-xs rounded-full px-1.5 py-0.5">{locations.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'drivers'
                ? 'border-[#42CE1D] text-[#42CE1D]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🏍️ Conductores
            {drivers.length > 0 && (
              <span className="ml-1.5 bg-[#42CE1D] text-white text-xs rounded-full px-1.5 py-0.5">{drivers.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <>
            {loadingLocations ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#42CE1D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : locations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4">📍</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-1">Sin ubicaciones guardadas</h3>
                <p className="text-sm text-gray-500">Guarda tus lugares frecuentes para encontrarlos más rápido al pedir un viaje.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {locations.map((loc) => (
                  <div key={loc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-[#42CE1D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{loc.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{loc.address}</p>
                      <p className="text-xs text-gray-400 mt-1">Guardado el {formatDate(loc.created_at)}</p>
                    </div>
                    <button
                      onClick={() => deleteLocation(loc.id, loc.name)}
                      className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <>
            {loadingDrivers ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#42CE1D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4">🏍️</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-1">Sin conductores favoritos</h3>
                <p className="text-sm text-gray-500">Después de un viaje, podrás guardar a tus conductores preferidos aquí.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {drivers.map((drv) => (
                  <div key={drv.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#42CE1D] flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                        {drv.full_name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {drv.nickname ? `${drv.nickname} (${drv.full_name})` : drv.full_name}
                          </p>
                          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${drv.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {drv.is_available ? 'Disponible' : 'No disponible'}
                          </span>
                        </div>
                        <StarRating rating={drv.rating} />
                        <p className="text-xs text-gray-500 mt-1">
                          {drv.vehicle_color} {drv.vehicle_model} · {drv.vehicle_plate}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{drv.total_trips} viajes · Guardado el {formatDate(drv.created_at)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`tel:${drv.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-[#42CE1D] border border-[#42CE1D] text-sm font-medium py-2 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                        </svg>
                        Llamar
                      </a>
                      <button
                        onClick={() => deleteDriver(drv.driver_id, drv.full_name)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-500 border border-red-200 text-sm font-medium py-2 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

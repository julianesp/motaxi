'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface RouteHotspot {
  pickup_address: string;
  dropoff_address: string;
  trip_count: number;
}

interface Trip {
  id: string;
  passenger_name: string;
  passenger_phone: string;
  driver_name: string | null;
  driver_phone: string | null;
  pickup_address: string;
  dropoff_address: string;
  status: string;
  fare: number;
  distance_km: number;
  requested_at: number;
  completed_at: number | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  requested: { label: 'Solicitado', color: 'text-white bg-white/10' },
  accepted: { label: 'Aceptado', color: 'text-[#008000] bg-[#008000]/10' },
  driver_arriving: { label: 'Conductor en camino', color: 'text-[#008000] bg-[#008000]/10' },
  in_progress: { label: 'En curso', color: 'text-[#008000] bg-[#008000]/10' },
  completed: { label: 'Completado', color: 'text-[#008000] bg-[#008000]/10' },
  cancelled: { label: 'Cancelado', color: 'text-red-400 bg-red-400/10' },
};

export default function ViajesPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;
  const [topRoutes, setTopRoutes] = useState<RouteHotspot[]>([]);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiClient.get(`/admin/trips?${params}`);
      setTrips(res.data.trips);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);
  useEffect(() => { setPage(0); }, [statusFilter]);

  useEffect(() => {
    apiClient.get('/analytics/top-routes?limit=10&days=30')
      .then(res => setTopRoutes(res.data.routes || []))
      .catch(() => {});
  }, []);

  const filtered = trips.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.passenger_name?.toLowerCase().includes(q) ||
      t.driver_name?.toLowerCase().includes(q) ||
      t.pickup_address?.toLowerCase().includes(q) ||
      t.dropoff_address?.toLowerCase().includes(q)
    );
  });

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Viajes</h1>
        <p className="text-gray-400 text-sm">{total} viajes en total</p>
      </div>

      {/* Rutas más frecuentes */}
      {topRoutes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Rutas más frecuentes — últimos 30 días
          </h2>
          <div className="space-y-3">
            {topRoutes.map((route, i) => (
              <div key={i} className="flex items-center gap-4 bg-gray-800/50 rounded-lg px-4 py-3">
                <span className="text-lg font-bold text-[#008000] w-6 text-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 text-xs truncate">
                    <span className="text-gray-500 mr-1">📍</span>{route.pickup_address}
                  </p>
                  <p className="text-gray-400 text-xs truncate mt-0.5">
                    <span className="text-gray-500 mr-1">🏁</span>{route.dropoff_address}
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs font-semibold text-[#008000] bg-[#008000]/10 px-3 py-1 rounded-full">
                  {route.trip_count} {route.trip_count === 1 ? 'viaje' : 'viajes'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar pasajero, conductor, dirección..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#008000]"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#008000]"
        >
          <option value="">Todos los estados</option>
          <option value="requested">Solicitados</option>
          <option value="in_progress">En curso</option>
          <option value="completed">Completados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Pasajero</th>
                    <th className="px-4 py-3 text-left">Conductor</th>
                    <th className="px-4 py-3 text-left">Ruta</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-right">Tarifa</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">No hay viajes</td>
                    </tr>
                  ) : filtered.map(trip => {
                    const sc = statusLabels[trip.status] || { label: trip.status, color: 'text-gray-400 bg-gray-400/10' };
                    return (
                      <tr key={trip.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-white">{trip.passenger_name || '—'}</p>
                          <p className="text-gray-500 text-xs">{trip.passenger_phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{trip.driver_name || <span className="text-gray-500">Sin asignar</span>}</p>
                          <p className="text-gray-500 text-xs">{trip.driver_phone}</p>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-gray-300 text-xs truncate">📍 {trip.pickup_address}</p>
                          <p className="text-gray-400 text-xs truncate">🏁 {trip.dropoff_address}</p>
                          {trip.distance_km > 0 && <p className="text-gray-500 text-xs">{trip.distance_km} km</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${sc.color}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {trip.fare > 0 ? (
                            <span className="text-[#008000] font-semibold">${trip.fare.toLocaleString()}</span>
                          ) : <span className="text-gray-500">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {formatDate(trip.requested_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {total > limit && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Página {page + 1} de {Math.ceil(total / limit)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg disabled:opacity-40 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg disabled:opacity-40 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

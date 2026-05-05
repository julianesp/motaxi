'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sharedRoutesAPI } from '@/lib/api-client';
import { MUNICIPALITIES, VEREDAS, DESTINOS_EXTERNOS } from '@/lib/constants/municipalities';

interface SharedRoute {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  fare_per_seat: number;
  full_name: string;
  profile_image: string | null;
  phone: string;
  whatsapp: string | null;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_types: string;
  rating: number;
  total_trips: number;
}

const VEHICLE_LABELS: Record<string, string> = {
  moto: '🏍️ Mototaxi',
  taxi: '🚕 Taxi',
  carro: '🚐 Carro / Van',
  piaggio: '🛻 Piaggio',
  particular: '🚗 Particular',
};

export default function SharedRoutesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<SharedRoute[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filterDestination, setFilterDestination] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    fetchRoutes();
  }, [filterDestination]);

  const fetchRoutes = async () => {
    setFetching(true);
    try {
      const data = await sharedRoutesAPI.getAll(filterDestination || undefined);
      setRoutes(data.routes || []);
    } catch {
      setRoutes([]);
    } finally {
      setFetching(false);
    }
  };

  const handleContact = (route: SharedRoute) => {
    const number = route.whatsapp || route.phone;
    const msg = encodeURIComponent(
      `Hola ${route.full_name}, vi en MoTaxi que tienes un puesto disponible hacia ${route.destination} a las ${route.departure_time}. ¿Sigue disponible?`
    );
    window.open(`https://wa.me/57${number.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Rutas disponibles</h1>
          <p className="text-xs text-gray-500">Taxis con puestos libres ahora</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Filtro por destino */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Filtrar por destino</label>
          <select
            value={filterDestination}
            onChange={(e) => setFilterDestination(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
          >
            <option value="">Todos los destinos</option>
            <optgroup label="Municipios del Valle">
              {MUNICIPALITIES.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </optgroup>
            {VEREDAS.map((v) => (
              <optgroup key={v.municipio} label={`Veredas de ${v.municipio}`}>
                {v.lugares.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Fuera del Valle">
              {DESTINOS_EXTERNOS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Lista de rutas */}
        {fetching ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-[#008000] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Buscando rutas...</p>
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-5xl">🚕</span>
            <p className="font-semibold text-gray-700">No hay rutas disponibles</p>
            <p className="text-sm text-gray-400 text-center">Los conductores aún no han publicado rutas para este destino.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map((route) => (
              <div key={route.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                {/* Conductor */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                    {route.profile_image ? (
                      <img src={route.profile_image} alt={route.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                        {route.full_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{route.full_name}</p>
                    <p className="text-xs text-gray-400">{VEHICLE_LABELS[route.vehicle_types] ?? route.vehicle_types} · {route.vehicle_color} {route.vehicle_model}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-yellow-400 text-xs">★</span>
                      <span className="text-xs text-gray-600 font-medium">{route.rating?.toFixed(1) ?? 'Nuevo'}</span>
                    </div>
                    <p className="text-xs text-gray-400">{route.total_trips} viajes</p>
                  </div>
                </div>

                {/* Ruta */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#008000]" />
                    <div className="w-0.5 h-5 bg-gray-200" />
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-[#008000]" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-gray-800">{route.origin}</p>
                    <p className="text-sm font-medium text-gray-800">{route.destination}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Salida</p>
                    <p className="font-bold text-[#008000] text-base">{route.departure_time}</p>
                  </div>
                </div>

                {/* Puestos y precio */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-gray-400">Puestos libres</p>
                    <p className="font-bold text-gray-900 text-lg">{route.available_seats} <span className="text-sm font-normal text-gray-400">/ {route.total_seats}</span></p>
                  </div>
                  <div className="flex-1 bg-[#008000]/5 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-gray-400">Por puesto</p>
                    <p className="font-bold text-[#008000] text-lg">
                      {route.fare_per_seat > 0 ? `$${route.fare_per_seat.toLocaleString()}` : 'A convenir'}
                    </p>
                  </div>
                </div>

                {/* Botón contactar */}
                <button
                  onClick={() => handleContact(route)}
                  className="w-full bg-[#008000] text-white font-semibold py-2.5 rounded-xl hover:bg-[#006800] transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.859L.057 23.428a.75.75 0 00.916.916l5.569-1.475A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.667-.523-5.183-1.432l-.372-.22-3.304.875.875-3.304-.22-.372A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  Contactar por WhatsApp
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

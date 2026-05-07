'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sharedRoutesAPI } from '@/lib/api-client';
import { MUNICIPALITIES, VEREDAS, DESTINOS_EXTERNOS } from '@/lib/constants/municipalities';

// Orden de municipios en la ruta principal del Valle de Sibundoy
const ROUTE_ORDER = ['Colón', 'Sibundoy', 'Santiago', 'San Francisco', 'Mocoa'];

function getIntermediateStops(origin: string, destination: string): string[] {
  const oIdx = ROUTE_ORDER.indexOf(origin);
  const dIdx = ROUTE_ORDER.indexOf(destination);
  if (oIdx === -1 || dIdx === -1 || oIdx >= dIdx) return [];
  return ROUTE_ORDER.slice(oIdx + 1, dIdx + 1);
}

interface SharedRoute {
  id: string;
  origin: string;
  destination: string;
  total_seats: number;
  available_seats: number;
  fare_per_seat: number;
  intermediate_fares: string | null;
  full_name: string;
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

interface RequestModal {
  route: SharedRoute;
  destination: string;
  phone: string;
  saving: boolean;
  done: boolean;
}

export default function SharedRoutesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<SharedRoute[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filterDestination, setFilterDestination] = useState('');
  const [modal, setModal] = useState<RequestModal | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    fetchRoutes();
    const interval = setInterval(fetchRoutes, 15000);
    return () => clearInterval(interval);
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

  const openRequestModal = (route: SharedRoute) => {
    const stops = getIntermediateStops(route.origin, route.destination);
    const defaultDest = stops.length > 0 ? stops[stops.length - 1] : route.destination;
    setModal({
      route,
      destination: defaultDest,
      phone: user?.phone || '',
      saving: false,
      done: false,
    });
  };

  const handleRequestSeat = async () => {
    if (!modal) return;
    if (!modal.phone.trim()) return;
    setModal((m) => m ? { ...m, saving: true } : m);
    try {
      await sharedRoutesAPI.requestSeat(modal.route.id, {
        destination: modal.destination,
        phone: modal.phone.trim(),
      });
      setModal((m) => m ? { ...m, saving: false, done: true } : m);
      fetchRoutes(); // refrescar puestos disponibles
    } catch (e: any) {
      alert(e?.response?.data?.error || 'No se pudo reservar el puesto');
      setModal((m) => m ? { ...m, saving: false } : m);
    }
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
                  <div className="w-10 h-10 rounded-full bg-[#008000]/10 flex-shrink-0 flex items-center justify-center text-[#008000] font-bold text-lg">
                    {route.full_name.charAt(0)}
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
                </div>

                {/* Puestos y precios por tramo */}
                <div className="mb-3 space-y-2">
                  <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">Puestos libres</p>
                    <p className="font-bold text-gray-900 text-lg">{route.available_seats} <span className="text-sm font-normal text-gray-400">/ {route.total_seats}</span></p>
                  </div>
                  {(() => {
                    const fares: Record<string, number> = route.intermediate_fares
                      ? JSON.parse(route.intermediate_fares)
                      : {};
                    const stops = getIntermediateStops(route.origin, route.destination);
                    const hasFares = Object.keys(fares).length > 0;
                    return (
                      <div className="bg-[#008000]/5 rounded-xl px-3 py-2 space-y-1">
                        <p className="text-xs text-gray-400 mb-1">Precio según tu destino</p>
                        {hasFares ? stops.map((stop) => {
                          const key = `${route.origin}-${stop}`;
                          const price = fares[key];
                          if (!price) return null;
                          return (
                            <div key={key} className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">Hasta {stop}</span>
                              <span className="text-sm font-bold text-[#008000]">${price.toLocaleString()}</span>
                            </div>
                          );
                        }) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Hasta {route.destination}</span>
                            <span className="text-sm font-bold text-[#008000]">
                              {route.fare_per_seat > 0 ? `$${route.fare_per_seat.toLocaleString()}` : 'A convenir'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Botones acción */}
                <button
                  onClick={() => openRequestModal(route)}
                  disabled={route.available_seats === 0}
                  className="w-full bg-[#008000] text-white font-semibold py-2.5 rounded-xl hover:bg-[#006800] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {route.available_seats === 0 ? 'Sin puestos disponibles' : 'Pedir puesto'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: pedir puesto */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-4">
            {modal.done ? (
              /* Estado: reserva confirmada */
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="w-14 h-14 bg-[#008000]/10 rounded-full flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-bold text-gray-900 text-lg">¡Puesto reservado!</p>
                <p className="text-sm text-gray-500">
                  El conductor <strong>{modal.route.full_name}</strong> ya sabe que vas hasta <strong>{modal.destination}</strong> y te contactará al <strong>{modal.phone}</strong>.
                </p>
                <button
                  onClick={() => setModal(null)}
                  className="w-full bg-[#008000] text-white font-semibold py-2.5 rounded-xl mt-2"
                >
                  Entendido
                </button>
              </div>
            ) : (
              /* Formulario */
              <>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">Pedir puesto</p>
                  <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  Taxi de <strong>{modal.route.full_name}</strong> · {modal.route.origin} → {modal.route.destination}
                </p>

                {/* Destino del pasajero */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">¿Hasta dónde vas?</label>
                  <select
                    value={modal.destination}
                    onChange={(e) => setModal((m) => m ? { ...m, destination: e.target.value } : m)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
                  >
                    {getIntermediateStops(modal.route.origin, modal.route.destination).map((stop) => (
                      <option key={stop} value={stop}>{stop}</option>
                    ))}
                    {getIntermediateStops(modal.route.origin, modal.route.destination).length === 0 && (
                      <option value={modal.route.destination}>{modal.route.destination}</option>
                    )}
                  </select>
                </div>

                {/* Precio del tramo seleccionado */}
                {(() => {
                  const fares: Record<string, number> = modal.route.intermediate_fares
                    ? JSON.parse(modal.route.intermediate_fares) : {};
                  const key = `${modal.route.origin}-${modal.destination}`;
                  const price = fares[key] || modal.route.fare_per_seat;
                  if (!price) return null;
                  return (
                    <div className="bg-[#008000]/5 rounded-xl px-4 py-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Precio del tramo</span>
                      <span className="font-bold text-[#008000]">${price.toLocaleString()}</span>
                    </div>
                  );
                })()}

                {/* Celular del pasajero */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tu número de celular</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={modal.phone}
                    onChange={(e) => setModal((m) => m ? { ...m, phone: e.target.value } : m)}
                    placeholder="3001234567"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
                  />
                  <p className="text-xs text-gray-400 mt-1">El conductor te contactará a este número para recogerte.</p>
                </div>

                <button
                  onClick={handleRequestSeat}
                  disabled={modal.saving || !modal.phone.trim()}
                  className="w-full bg-[#008000] text-white font-semibold py-3 rounded-xl hover:bg-[#006800] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {modal.saving ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : 'Confirmar puesto'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

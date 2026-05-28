'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sharedRoutesAPI, driversAPI } from '@/lib/api-client';
import { MUNICIPALITIES, VEREDAS, DESTINOS_EXTERNOS } from '@/lib/constants/municipalities';
import Swal from 'sweetalert2';

// Orden de lugares en la ruta principal del Valle de Sibundoy (incluye veredas)
const ROUTE_ORDER = [
  'Colón',
  'Michoacán', 'San Pedro',          // veredas de Colón
  'Sibundoy',
  'Vichoy',                          // vereda de Santiago, antes de Santiago
  'Santiago',
  'San Andrés',                      // vereda de Santiago, cerca al municipio
  'San Francisco',
  'El Poroto',                       // vereda de San Francisco
  'Mocoa',
];

function getIntermediateStops(origin: string, destination: string): string[] {
  const oIdx = ROUTE_ORDER.indexOf(origin);
  const dIdx = ROUTE_ORDER.indexOf(destination);
  if (oIdx === -1 || dIdx === -1 || oIdx >= dIdx) return [];
  // Devuelve todos los destinos posibles desde origin hasta destination
  return ROUTE_ORDER.slice(oIdx + 1, dIdx + 1);
}

interface MyRoute {
  id: string;
  origin: string;
  destination: string;
  total_seats: number;
  available_seats: number;
  fare_per_seat: number;
  intermediate_fares: string | null;
  status: string;
}

interface RouteRequest {
  id: string;
  passenger_name: string;
  passenger_phone: string;
  destination: string;
  status: string;
  created_at: number;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_address?: string;
}

export default function DriverSharedRoutePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [myRoute, setMyRoute] = useState<MyRoute | null>(null);
  const [requests, setRequests] = useState<RouteRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nequiQrKey, setNequiQrKey] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    total_seats: 4,
    fare_per_seat: 0,
  });
  // Precios por tramo: clave = "Origen-Destino", valor = precio en COP
  const [intermediateFares, setIntermediateFares] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchMyRoute();
  }, [user]);

  const myRouteId = myRoute?.id;
  useEffect(() => {
    if (!myRouteId) return;
    const interval = setInterval(async () => {
      try {
        const [reqData, routeData] = await Promise.all([
          sharedRoutesAPI.getRequests(myRouteId),
          sharedRoutesAPI.getMy(),
        ]);
        setRequests(reqData.requests || []);
        if (routeData.route) setMyRoute(routeData.route);
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [myRouteId]);

  const fetchMyRoute = async () => {
    setFetching(true);
    try {
      const [data, profileData] = await Promise.all([
        sharedRoutesAPI.getMy(),
        driversAPI.getProfile(),
      ]);
      setNequiQrKey(profileData.driver?.nequi_qr_key || null);
      setMyRoute(data.route);
      // Precargar precios guardados si no hay ruta activa
      if (!data.route && data.default_route_fares) {
        try {
          setIntermediateFares(JSON.parse(data.default_route_fares));
        } catch {}
      }
      if (data.route) {
        const reqData = await sharedRoutesAPI.getRequests(data.route.id);
        setRequests(reqData.requests || []);
      } else {
        setRequests([]);
      }
    } catch {
      setMyRoute(null);
      setRequests([]);
    } finally {
      setFetching(false);
    }
  };

  const handlePublish = async () => {
    if (!form.origin || !form.destination) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: 'Completa el origen y el destino.', confirmButtonColor: '#008000' });
      return;
    }
    if (form.origin === form.destination) {
      Swal.fire({ icon: 'warning', title: 'Error', text: 'El origen y destino no pueden ser iguales.', confirmButtonColor: '#008000' });
      return;
    }
    setSaving(true);
    try {
      await sharedRoutesAPI.create({ ...form, intermediate_fares: Object.keys(intermediateFares).length > 0 ? intermediateFares : undefined });
      await fetchMyRoute();
      Swal.fire({ icon: 'success', title: '¡Ruta publicada!', text: 'Los pasajeros ya pueden ver tus puestos disponibles.', confirmButtonColor: '#008000' });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: e?.response?.data?.error || 'No se pudo publicar la ruta.', confirmButtonColor: '#008000' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (status: 'departed' | 'cancelled') => {
    if (!myRoute) return;
    const label = status === 'departed' ? 'saliste' : 'cancelaste';
    const confirm = await Swal.fire({
      icon: 'question',
      title: status === 'departed' ? '¿Ya saliste?' : '¿Cancelar ruta?',
      text: status === 'departed'
        ? 'Marcarás la ruta como salida y desaparecerá del tablero.'
        : 'La ruta se cancelará y los pasajeros ya no la verán.',
      showCancelButton: true,
      confirmButtonColor: '#008000',
      cancelButtonColor: '#d33',
      confirmButtonText: status === 'departed' ? 'Sí, ya salí' : 'Sí, cancelar',
      cancelButtonText: 'Volver',
    });
    if (!confirm.isConfirmed) return;
    try {
      await sharedRoutesAPI.updateStatus(myRoute.id, status);
      setMyRoute(null);
      setRequests([]);
      Swal.fire({ icon: 'success', title: status === 'departed' ? '¡Buen viaje!' : 'Ruta cancelada', confirmButtonColor: '#008000', timer: 2000, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar la ruta.', confirmButtonColor: '#008000' });
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const data = await driversAPI.uploadNequiQR(file);
      setNequiQrKey(data.nequi_qr_key);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'No se pudo subir el QR', confirmButtonColor: '#008000' });
    } finally {
      setUploadingQr(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const handleQrDelete = async () => {
    const confirm = await Swal.fire({
      icon: 'question', title: '¿Eliminar QR?', text: 'Los pasajeros ya no podrán ver tu QR de Nequi.',
      showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#008000',
      confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;
    try {
      await driversAPI.deleteNequiQR();
      setNequiQrKey(null);
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar el QR', confirmButtonColor: '#008000' });
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#008000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Publicar ruta</h1>
          <p className="text-xs text-gray-500">Anuncia tu salida y puestos disponibles</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Ruta activa */}
        {myRoute ? (
          <div className="bg-white rounded-2xl shadow-sm border border-[#008000]/20 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#008000] rounded-full animate-pulse" />
              <p className="font-semibold text-[#008000] text-sm">Ruta activa publicada</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#008000]" />
                <div className="w-0.5 h-6 bg-gray-200" />
                <div className="w-2.5 h-2.5 rounded-full border-2 border-[#008000]" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide leading-none mb-0.5">Ubicación de salida</p>
                  <p className="text-sm font-medium text-gray-800">{myRoute.origin}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide leading-none mb-0.5">Destino</p>
                  <p className="text-sm font-medium text-gray-800">{myRoute.destination}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-gray-400">Puestos libres</p>
                <p className="font-bold text-gray-900 text-2xl">{myRoute.available_seats}<span className="text-sm font-normal text-gray-400"> / {myRoute.total_seats}</span></p>
              </div>
            </div>

            {/* Precios por tramo */}
            {(() => {
              const fares: Record<string, number> = myRoute.intermediate_fares
                ? JSON.parse(myRoute.intermediate_fares)
                : {};
              const stops = getIntermediateStops(myRoute.origin, myRoute.destination);
              const hasFares = Object.keys(fares).length > 0;
              if (!hasFares && myRoute.fare_per_seat === 0) return null;
              return (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 mb-2">Precios por tramo</p>
                  {hasFares ? stops.map((stop) => {
                    const key = `${myRoute.origin}-${stop}`;
                    const price = fares[key];
                    if (!price) return null;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{myRoute.origin} → {stop}</span>
                        <span className="text-sm font-bold text-[#008000]">${price.toLocaleString()}</span>
                      </div>
                    );
                  }) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{myRoute.origin} → {myRoute.destination}</span>
                      <span className="text-sm font-bold text-[#008000]">${myRoute.fare_per_seat.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Pasajeros que pidieron puesto */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                Pasajeros ({requests.length}/{myRoute.total_seats - myRoute.available_seats})
              </p>
              {requests.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aún no hay pasajeros que hayan pedido puesto.</p>
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div key={req.id} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#008000]/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#008000]">
                            {req.passenger_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{req.passenger_name}</p>
                          <p className="text-xs text-gray-500">→ {req.destination}</p>
                        </div>
                        <a
                          href={`https://wa.me/57${req.passenger_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#25D366]/20 transition-colors shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          {req.passenger_phone}
                        </a>
                      </div>
                      {req.pickup_latitude && req.pickup_longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${req.pickup_latitude},${req.pickup_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors w-full"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{req.pickup_address || 'Ver ubicación en Maps'}</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUpdateStatus('departed')}
                className="bg-[#008000] text-white font-semibold py-2.5 rounded-xl hover:bg-[#006800] transition-colors text-sm"
              >
                ✅ Ya salí
              </button>
              <button
                onClick={() => handleUpdateStatus('cancelled')}
                className="bg-red-50 text-red-600 border border-red-200 font-semibold py-2.5 rounded-xl hover:bg-red-100 transition-colors text-sm"
              >
                ✖ Cancelar ruta
              </button>
            </div>
          </div>
        ) : (
          /* Formulario para publicar */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <p className="text-sm text-gray-500">Publica tu ruta para que los pasajeros vean que tienes puestos disponibles y puedan contactarte.</p>

            {/* Origen */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Origen</label>
              <select
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
              >
                <option value="">Selecciona tu lugar de salida</option>
                <optgroup label="Municipios">
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
              </select>
            </div>

            {/* Destino */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Destino</label>
              <select
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
              >
                <option value="">Selecciona el destino</option>
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

            {/* Puestos */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Puestos disponibles</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm((f) => ({ ...f, total_seats: Math.max(1, f.total_seats - 1) }))}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-bold"
                >−</button>
                <span className="flex-1 text-center font-bold text-2xl text-gray-900">{form.total_seats}</span>
                <button
                  onClick={() => setForm((f) => ({ ...f, total_seats: Math.min(8, f.total_seats + 1) }))}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-bold"
                >+</button>
              </div>
            </div>

            {/* Precios por tramo */}
            {(() => {
              const stops = getIntermediateStops(form.origin, form.destination);
              if (!form.origin || !form.destination) return null;
              return (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">
                    Precio por tramo (COP)
                    <span className="text-gray-400 font-normal ml-1">— pon el precio según hasta dónde va el pasajero</span>
                  </label>
                  <div className="space-y-2">
                    {stops.map((stop) => {
                      const key = `${form.origin}-${stop}`;
                      return (
                        <div key={key} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500">{form.origin}</p>
                            <p className="text-sm font-semibold text-gray-900">→ {stop}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">$</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={intermediateFares[key] || ''}
                              onChange={(e) => setIntermediateFares((prev) => ({
                                ...prev,
                                [key]: parseInt(e.target.value) || 0,
                              }))}
                              placeholder="0"
                              className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
                            />
                          </div>
                        </div>
                      );
                    })}
                    {stops.length === 0 && (
                      /* Ruta fuera del Valle o sin tramos intermedios — precio único */
                      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500">{form.origin}</p>
                          <p className="text-sm font-semibold text-gray-900">→ {form.destination}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">$</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={form.fare_per_seat || ''}
                            onChange={(e) => setForm({ ...form, fare_per_seat: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handlePublish}
              disabled={saving}
              className="w-full bg-[#008000] text-white font-semibold py-3 rounded-xl hover:bg-[#006800] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : '🚕 Publicar ruta'}
            </button>
          </div>
        )}

        {/* QR de Nequi */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-sm">QR de Nequi</p>
              <p className="text-xs text-gray-400">Los pasajeros lo verán al reservar su puesto</p>
            </div>
            {nequiQrKey && (
              <button onClick={handleQrDelete} className="text-xs text-red-500 hover:text-red-700 font-medium">
                Eliminar
              </button>
            )}
          </div>

          {nequiQrKey ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL}/images/${nequiQrKey}`}
                alt="QR Nequi"
                className="w-48 h-48 object-contain rounded-xl border border-gray-100"
              />
              <button
                onClick={() => qrInputRef.current?.click()}
                disabled={uploadingQr}
                className="text-xs text-[#008000] font-medium hover:underline"
              >
                {uploadingQr ? 'Subiendo...' : 'Cambiar QR'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => qrInputRef.current?.click()}
              disabled={uploadingQr}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-[#008000]/40 hover:bg-[#008000]/5 transition-colors"
            >
              {uploadingQr ? (
                <svg className="animate-spin w-6 h-6 text-[#008000]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : (
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span className="text-xs text-gray-400">{uploadingQr ? 'Subiendo imagen...' : 'Toca para subir tu QR de Nequi'}</span>
            </button>
          )}
          <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs text-blue-700 font-medium mb-1">¿Cómo funciona?</p>
          <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
            <li>Publicas tu ruta con el destino, hora y puestos libres</li>
            <li>Los pasajeros ven tu ruta en el tablero de salidas</li>
            <li>Te contactan por WhatsApp para reservar su puesto</li>
            <li>Cuando salgas, marca "Ya salí" para retirarla del tablero</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

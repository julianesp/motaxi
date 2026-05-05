'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sharedRoutesAPI } from '@/lib/api-client';
import { MUNICIPALITIES, VEREDAS, DESTINOS_EXTERNOS } from '@/lib/constants/municipalities';
import Swal from 'sweetalert2';

interface MyRoute {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  fare_per_seat: number;
  status: string;
}

export default function DriverSharedRoutePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [myRoute, setMyRoute] = useState<MyRoute | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    departure_time: '',
    total_seats: 4,
    fare_per_seat: 0,
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchMyRoute();
  }, [user]);

  const fetchMyRoute = async () => {
    setFetching(true);
    try {
      const data = await sharedRoutesAPI.getMy();
      setMyRoute(data.route);
    } catch {
      setMyRoute(null);
    } finally {
      setFetching(false);
    }
  };

  const handlePublish = async () => {
    if (!form.origin || !form.destination || !form.departure_time) {
      Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: 'Completa origen, destino y hora de salida.', confirmButtonColor: '#008000' });
      return;
    }
    if (form.origin === form.destination) {
      Swal.fire({ icon: 'warning', title: 'Error', text: 'El origen y destino no pueden ser iguales.', confirmButtonColor: '#008000' });
      return;
    }
    setSaving(true);
    try {
      await sharedRoutesAPI.create(form);
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
      Swal.fire({ icon: 'success', title: status === 'departed' ? '¡Buen viaje!' : 'Ruta cancelada', confirmButtonColor: '#008000', timer: 2000, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar la ruta.', confirmButtonColor: '#008000' });
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
                <p className="text-sm font-medium text-gray-800">{myRoute.origin}</p>
                <p className="text-sm font-medium text-gray-800">{myRoute.destination}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Salida</p>
                <p className="font-bold text-[#008000] text-xl">{myRoute.departure_time}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Puestos libres</p>
                <p className="font-bold text-gray-900 text-2xl">{myRoute.available_seats}<span className="text-sm font-normal text-gray-400"> / {myRoute.total_seats}</span></p>
              </div>
              <div className="bg-[#008000]/5 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Por puesto</p>
                <p className="font-bold text-[#008000] text-2xl">
                  {myRoute.fare_per_seat > 0 ? `$${myRoute.fare_per_seat.toLocaleString()}` : 'Libre'}
                </p>
              </div>
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

            {/* Hora de salida */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Hora de salida</label>
              <input
                type="time"
                value={form.departure_time}
                onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
              />
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

            {/* Precio por puesto */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Precio por puesto (COP) — opcional</label>
              <input
                type="number"
                value={form.fare_per_seat || ''}
                onChange={(e) => setForm({ ...form, fare_per_seat: parseInt(e.target.value) || 0 })}
                placeholder="Ej: 15000 — dejar vacío si es a convenir"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#008000]/30"
              />
            </div>

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

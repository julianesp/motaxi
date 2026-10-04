'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface Driver {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color: string;
  municipality: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  is_available: number;
  rating: number;
  total_trips: number;
  user_created_at: number;
  subscription_status: string | null;
  subscription_amount: number | null;
  days_remaining: number;
  is_expired: number;
  rejection_reason?: string;
  photo_license?: string;
  photo_vehicle?: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'text-adm-fg bg-adm-fg/10' },
  approved: { label: 'Aprobado', color: 'text-adm-accent bg-[#008000]/10' },
  rejected: { label: 'Rechazado', color: 'text-red-600 dark:text-red-400 bg-red-400/10' },
};

const subLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'text-adm-accent bg-[#008000]/10' },
  trial: { label: 'Prueba', color: 'text-adm-fg bg-adm-fg/10' },
  expired: { label: 'Expirada', color: 'text-red-600 dark:text-red-400 bg-red-400/10' },
  cancelled: { label: 'Cancelada', color: 'text-adm-fg3 bg-adm-fg3/10' },
};

export default function ConductoresPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    try {
      const params = filter ? `?status=${filter}` : '';
      const res = await apiClient.get(`/admin/drivers${params}`);
      setDrivers(res.data.drivers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const verify = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient.put(`/admin/drivers/${id}/verify`);
      fetchDrivers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setActionLoading(rejectId);
    try {
      await apiClient.put(`/admin/drivers/${rejectId}/reject`, { reason: rejectReason });
      setRejectId(null);
      setRejectReason('');
      fetchDrivers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = drivers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.full_name?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      d.phone?.includes(q) ||
      d.vehicle_plate?.toLowerCase().includes(q)
    );
  });

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-adm-fg">Conductores</h1>
          <p className="text-adm-fg3 text-sm">{filtered.length} conductores</p>
        </div>
        <button onClick={fetchDrivers} className="text-sm text-adm-fg3 hover:text-adm-fg transition-colors">
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, email, placa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-adm-surface border border-adm-border-strong rounded-lg px-4 py-2 text-sm text-adm-fg placeholder-adm-fg4 focus:outline-none focus:border-[#008000]"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-adm-surface border border-adm-border-strong rounded-lg px-4 py-2 text-sm text-adm-fg focus:outline-none focus:border-[#008000]"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-adm-fg4">No hay conductores</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(driver => {
            const vs = statusLabels[driver.verification_status];
            const ss = driver.subscription_status ? subLabels[driver.subscription_status] : null;
            const daysColor = driver.days_remaining <= 3
              ? 'text-red-600 dark:text-red-400'
              : driver.days_remaining <= 7
              ? 'text-adm-fg'
              : 'text-adm-accent';

            return (
              <div key={driver.id} className="bg-adm-surface border border-adm-border rounded-xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    {/* Info personal */}
                    <div>
                      <p className="font-semibold text-adm-fg text-base">{driver.full_name}</p>
                      <p className="text-adm-fg3">{driver.email}</p>
                      <p className="text-adm-fg3">{driver.phone}</p>
                      <p className="text-adm-fg4 text-xs mt-1">Registrado: {formatDate(driver.user_created_at)}</p>
                    </div>

                    {/* Vehículo */}
                    <div>
                      <p className="text-adm-fg3 text-xs uppercase tracking-wide mb-1">Vehículo</p>
                      <p className="text-adm-fg font-medium">{driver.vehicle_plate || '—'}</p>
                      <p className="text-adm-fg3">{driver.vehicle_model} {driver.vehicle_color}</p>
                      <p className="text-adm-fg3">{driver.municipality}</p>
                    </div>

                    {/* Estado suscripción */}
                    <div>
                      <p className="text-adm-fg3 text-xs uppercase tracking-wide mb-1">Suscripción</p>
                      {ss ? (
                        <>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ss.color}`}>
                            {ss.label}
                          </span>
                          {driver.subscription_status !== 'expired' && (
                            <p className={`mt-1 font-semibold ${daysColor}`}>
                              {driver.days_remaining} días restantes
                            </p>
                          )}
                          {driver.subscription_status === 'expired' && (
                            <p className="text-red-600 dark:text-red-400 text-xs mt-1">Suscripción vencida</p>
                          )}
                        </>
                      ) : (
                        <p className="text-adm-fg4">Sin suscripción</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${vs.color}`}>{vs.label}</span>
                        {driver.is_available === 1 && (
                          <span className="text-xs px-2 py-0.5 rounded text-adm-accent bg-[#008000]/10">Online</span>
                        )}
                      </div>
                      {driver.total_trips > 0 && (
                        <p className="text-adm-fg4 text-xs mt-1">⭐ {driver.rating?.toFixed(1)} · {driver.total_trips} viajes</p>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* VERIFICACIÓN MANUAL DESACTIVADA TEMPORALMENTE - auto-aprobación habilitada en el backend
                    {driver.verification_status === 'pending' && (
                      <>
                        <button
                          onClick={() => verify(driver.id)}
                          disabled={actionLoading === driver.id}
                          className="px-4 py-2 bg-[#008000] hover:bg-[#006600] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => setRejectId(driver.id)}
                          disabled={actionLoading === driver.id}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    */}
                    {driver.verification_status === 'approved' && (
                      <button
                        onClick={() => setRejectId(driver.id)}
                        className="px-3 py-2 bg-adm-muted hover:bg-adm-hover text-adm-fg3 text-sm rounded-lg transition-colors"
                      >
                        Suspender
                      </button>
                    )}
                    {driver.verification_status === 'rejected' && (
                      <button
                        onClick={() => verify(driver.id)}
                        disabled={actionLoading === driver.id}
                        className="px-4 py-2 bg-[#008000]/10 hover:bg-[#008000]/20 text-adm-accent font-semibold text-sm rounded-lg transition-colors"
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                </div>

                {driver.rejection_reason && (
                  <div className="mt-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-600 dark:text-red-400">Razón de rechazo: {driver.rejection_reason}</p>
                  </div>
                )}

                {/* Fotos */}
                {(driver.photo_license || driver.photo_vehicle) && (
                  <div className="mt-3 flex gap-3">
                    {driver.photo_license && (
                      <a href={driver.photo_license} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-adm-accent hover:text-adm-accent-strong underline">
                        Ver licencia
                      </a>
                    )}
                    {driver.photo_vehicle && (
                      <a href={driver.photo_vehicle} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-adm-accent hover:text-adm-accent-strong underline">
                        Ver foto vehículo
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal rechazar */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-adm-surface border border-adm-border-strong rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-adm-fg mb-4">Motivo de rechazo / suspensión</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Describe el motivo..."
              rows={4}
              className="w-full bg-adm-muted border border-adm-border-strong rounded-lg px-4 py-3 text-sm text-adm-fg placeholder-adm-fg4 focus:outline-none focus:border-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="flex-1 py-2 bg-adm-muted hover:bg-adm-hover text-adm-fg2 text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={reject}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface Subscription {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  plan: string;
  amount: number;
  trial_ends_at: number | null;
  current_period_start: number | null;
  current_period_end: number | null;
  days_remaining: number;
  epayco_transaction_id: string | null;
  updated_at: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'text-adm-accent bg-[#008000]/10' },
  trial: { label: 'Prueba', color: 'text-adm-fg bg-adm-fg/10' },
  expired: { label: 'Expirada', color: 'text-red-600 dark:text-red-400 bg-red-400/10' },
  cancelled: { label: 'Cancelada', color: 'text-adm-fg3 bg-adm-fg3/10' },
};

export default function SuscripcionesPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activating, setActivating] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiClient.get(`/admin/subscriptions${params}`);
      setSubscriptions(res.data.subscriptions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const activate = async (userId: string) => {
    setActivating(userId);
    try {
      await apiClient.put(`/admin/subscriptions/${userId}/activate`);
      fetch();
    } catch (err) {
      console.error(err);
    } finally {
      setActivating(null);
    }
  };

  const filtered = subscriptions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q);
  });

  const formatDate = (ts: number | null) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const summary = {
    active: subscriptions.filter(s => s.status === 'active').length,
    trial: subscriptions.filter(s => s.status === 'trial').length,
    expired: subscriptions.filter(s => s.status === 'expired').length,
    expiringSoon: subscriptions.filter(s => (s.status === 'active' || s.status === 'trial') && s.days_remaining <= 5).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-adm-fg">Suscripciones</h1>
        <div className="flex flex-wrap gap-4 mt-2">
          <span className="text-sm text-adm-accent">{summary.active} activas</span>
          <span className="text-sm text-yellow-700 dark:text-yellow-400">{summary.trial} en prueba</span>
          <span className="text-sm text-red-600 dark:text-red-400">{summary.expired} expiradas</span>
          {summary.expiringSoon > 0 && (
            <span className="text-sm text-orange-600 dark:text-orange-400">⚠ {summary.expiringSoon} por vencer (≤5 días)</span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar usuario..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-adm-surface border border-adm-border-strong rounded-lg px-4 py-2 text-sm text-adm-fg placeholder-adm-fg4 focus:outline-none focus:border-[#008000]"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-adm-surface border border-adm-border-strong rounded-lg px-4 py-2 text-sm text-adm-fg focus:outline-none focus:border-[#008000]"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="trial">En prueba</option>
          <option value="expired">Expiradas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-adm-fg4">No hay suscripciones</div>
          ) : filtered.map(sub => {
            const sc = statusConfig[sub.status] || statusConfig.cancelled;
            const daysColor = sub.days_remaining <= 3
              ? 'text-red-600 dark:text-red-400'
              : sub.days_remaining <= 7
              ? 'text-yellow-700 dark:text-yellow-400'
              : 'text-adm-accent';

            return (
              <div key={sub.id} className="bg-adm-surface border border-adm-border rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    {/* Usuario */}
                    <div>
                      <p className="font-semibold text-adm-fg">{sub.full_name}</p>
                      <p className="text-adm-fg3">{sub.email}</p>
                      <p className="text-adm-fg3">{sub.phone}</p>
                      <span className={`mt-1 inline-block text-xs ${sub.role === 'driver' ? 'text-adm-accent' : 'text-blue-600 dark:text-blue-400'}`}>
                        {sub.role === 'driver' ? 'Conductor' : 'Pasajero'}
                      </span>
                    </div>

                    {/* Suscripción */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${sc.color}`}>{sc.label}</span>
                        {sub.amount && (
                          <span className="text-adm-fg3 text-xs">${sub.amount.toLocaleString()} COP</span>
                        )}
                      </div>
                      {(sub.status === 'active' || sub.status === 'trial') && (
                        <p className={`font-bold text-lg ${daysColor}`}>
                          {sub.days_remaining} días restantes
                        </p>
                      )}
                      {sub.status === 'active' && (
                        <p className="text-adm-fg4 text-xs">Vence: {formatDate(sub.current_period_end)}</p>
                      )}
                      {sub.status === 'trial' && (
                        <p className="text-adm-fg4 text-xs">Trial vence: {formatDate(sub.trial_ends_at)}</p>
                      )}
                      {sub.status === 'expired' && (
                        <p className="text-red-600 dark:text-red-400 text-xs">Venció: {formatDate(sub.current_period_end || sub.trial_ends_at)}</p>
                      )}
                    </div>

                    {/* Pago */}
                    <div>
                      <p className="text-adm-fg3 text-xs">Inicio período</p>
                      <p className="text-adm-fg">{formatDate(sub.current_period_start)}</p>
                      {sub.epayco_transaction_id && (
                        <p className="text-adm-fg4 text-xs mt-1 break-all">Ref: {sub.epayco_transaction_id}</p>
                      )}
                    </div>
                  </div>

                  {/* Acción */}
                  <div className="flex-shrink-0">
                    {(sub.status === 'expired' || sub.status === 'cancelled') && (
                      <button
                        onClick={() => activate(sub.user_id)}
                        disabled={activating === sub.user_id}
                        className="px-4 py-2 bg-[#008000] hover:bg-[#006600] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
                      >
                        {activating === sub.user_id ? 'Activando...' : 'Activar manualmente'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

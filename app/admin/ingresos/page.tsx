'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface PeriodRevenue {
  period: string;
  trip_count: number;
  total_fares: number;
  platform_commission: number;
}

interface Revenue {
  trips: {
    today: PeriodRevenue;
    week: PeriodRevenue;
    month: PeriodRevenue;
    year: PeriodRevenue;
  };
  subscriptions: {
    month_revenue: number;
    year_revenue: number;
    total_revenue: number;
  };
}

const periodLabels: Record<string, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  year: 'Este año',
};

function RevenueCard({ data, period }: { data: PeriodRevenue; period: string }) {
  return (
    <div className="bg-adm-surface border border-adm-border rounded-xl p-5">
      <p className="text-adm-fg3 text-sm mb-3">{periodLabels[period]}</p>
      <p className="text-2xl font-bold text-adm-accent">${Math.round(data.platform_commission).toLocaleString()}</p>
      <p className="text-xs text-adm-fg4 mt-1">Comisión de plataforma</p>
      <div className="mt-3 pt-3 border-t border-adm-border space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-adm-fg3">Total tarifas</span>
          <span className="text-adm-fg">${Math.round(data.total_fares).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-adm-fg3">Viajes completados</span>
          <span className="text-adm-fg">{data.trip_count}</span>
        </div>
      </div>
    </div>
  );
}

export default function IngresosPage() {
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [revRes, payRes] = await Promise.all([
          apiClient.get('/admin/revenue'),
          apiClient.get('/admin/payments?limit=20'),
        ]);
        setRevenue(revRes.data);
        setPayments(payRes.data.payments || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
      </div>
    );
  }

  if (!revenue) return null;

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  const statusColors: Record<string, string> = {
    approved: 'text-adm-accent bg-[#008000]/10',
    pending: 'text-yellow-700 dark:text-yellow-400 bg-yellow-400/10',
    processing: 'text-blue-600 dark:text-blue-400 bg-blue-400/10',
    declined: 'text-red-600 dark:text-red-400 bg-red-400/10',
    failed: 'text-red-600 dark:text-red-400 bg-red-400/10',
    refunded: 'text-purple-600 dark:text-purple-400 bg-purple-400/10',
  };

  const statusLabels: Record<string, string> = {
    approved: 'Aprobado',
    pending: 'Pendiente',
    processing: 'Procesando',
    declined: 'Declinado',
    failed: 'Fallido',
    refunded: 'Reembolsado',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-adm-fg">Ingresos</h1>
        <p className="text-adm-fg3 text-sm">Comisiones de viajes y suscripciones</p>
      </div>

      {/* Comisiones por período */}
      <div>
        <h2 className="text-sm font-semibold text-adm-fg3 uppercase tracking-wider mb-3">Comisiones de viajes (15%)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['today', 'week', 'month', 'year'] as const).map(p => (
            <RevenueCard key={p} data={revenue.trips[p]} period={p} />
          ))}
        </div>
      </div>

      {/* Suscripciones */}
      <div>
        <h2 className="text-sm font-semibold text-adm-fg3 uppercase tracking-wider mb-3">Suscripciones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-adm-surface border border-adm-border rounded-xl p-5">
            <p className="text-adm-fg3 text-sm mb-1">Este mes</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${Math.round(revenue.subscriptions.month_revenue).toLocaleString()}</p>
          </div>
          <div className="bg-adm-surface border border-adm-border rounded-xl p-5">
            <p className="text-adm-fg3 text-sm mb-1">Este año</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">${Math.round(revenue.subscriptions.year_revenue).toLocaleString()}</p>
          </div>
          <div className="bg-adm-surface border border-adm-border rounded-xl p-5">
            <p className="text-adm-fg3 text-sm mb-1">Total histórico</p>
            <p className="text-2xl font-bold text-adm-fg">${Math.round(revenue.subscriptions.total_revenue).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Resumen este mes */}
      <div className="bg-gradient-to-r from-[#008000]/10 to-blue-500/10 border border-[#008000]/20 rounded-xl p-5">
        <p className="text-adm-fg2 text-sm mb-2">Total estimado este mes</p>
        <p className="text-3xl font-bold text-adm-fg">
          ${Math.round(revenue.trips.month.platform_commission + revenue.subscriptions.month_revenue).toLocaleString()}
          <span className="text-adm-fg3 text-lg font-normal ml-2">COP</span>
        </p>
        <p className="text-adm-fg3 text-xs mt-1">
          ${Math.round(revenue.trips.month.platform_commission).toLocaleString()} comisiones + ${Math.round(revenue.subscriptions.month_revenue).toLocaleString()} suscripciones
        </p>
      </div>

      {/* Últimas transacciones */}
      <div>
        <h2 className="text-sm font-semibold text-adm-fg3 uppercase tracking-wider mb-3">Últimas transacciones</h2>
        <div className="bg-adm-surface border border-adm-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-adm-border text-adm-fg3 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Proveedor</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-adm-border">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-adm-fg4">Sin transacciones</td>
                  </tr>
                ) : payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-adm-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-adm-fg">{p.full_name}</p>
                      <p className="text-adm-fg4 text-xs">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 text-adm-fg3 capitalize">{p.provider || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status] || 'text-adm-fg3 bg-adm-fg3/10'}`}>
                        {statusLabels[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-adm-accent">
                      ${Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-adm-fg3 text-xs">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm mb-3">{periodLabels[period]}</p>
      <p className="text-2xl font-bold text-[#008000]">${Math.round(data.platform_commission).toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-1">Comisión de plataforma</p>
      <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total tarifas</span>
          <span className="text-gray-200">${Math.round(data.total_fares).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Viajes completados</span>
          <span className="text-gray-200">{data.trip_count}</span>
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
    approved: 'text-[#008000] bg-[#008000]/10',
    pending: 'text-yellow-400 bg-yellow-400/10',
    processing: 'text-blue-400 bg-blue-400/10',
    declined: 'text-red-400 bg-red-400/10',
    failed: 'text-red-400 bg-red-400/10',
    refunded: 'text-purple-400 bg-purple-400/10',
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
        <h1 className="text-2xl font-bold text-white">Ingresos</h1>
        <p className="text-gray-400 text-sm">Comisiones de viajes y suscripciones</p>
      </div>

      {/* Comisiones por período */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Comisiones de viajes (15%)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['today', 'week', 'month', 'year'] as const).map(p => (
            <RevenueCard key={p} data={revenue.trips[p]} period={p} />
          ))}
        </div>
      </div>

      {/* Suscripciones */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Suscripciones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Este mes</p>
            <p className="text-2xl font-bold text-blue-400">${Math.round(revenue.subscriptions.month_revenue).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Este año</p>
            <p className="text-2xl font-bold text-purple-400">${Math.round(revenue.subscriptions.year_revenue).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total histórico</p>
            <p className="text-2xl font-bold text-white">${Math.round(revenue.subscriptions.total_revenue).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Resumen este mes */}
      <div className="bg-gradient-to-r from-[#008000]/10 to-blue-500/10 border border-[#008000]/20 rounded-xl p-5">
        <p className="text-gray-300 text-sm mb-2">Total estimado este mes</p>
        <p className="text-3xl font-bold text-white">
          ${Math.round(revenue.trips.month.platform_commission + revenue.subscriptions.month_revenue).toLocaleString()}
          <span className="text-gray-400 text-lg font-normal ml-2">COP</span>
        </p>
        <p className="text-gray-400 text-xs mt-1">
          ${Math.round(revenue.trips.month.platform_commission).toLocaleString()} comisiones + ${Math.round(revenue.subscriptions.month_revenue).toLocaleString()} suscripciones
        </p>
      </div>

      {/* Últimas transacciones */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Últimas transacciones</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Proveedor</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin transacciones</td>
                  </tr>
                ) : payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white">{p.full_name}</p>
                      <p className="text-gray-500 text-xs">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{p.provider || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status] || 'text-gray-400 bg-gray-400/10'}`}>
                        {statusLabels[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#008000]">
                      ${Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(p.created_at)}</td>
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

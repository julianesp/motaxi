'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { QRCodeCanvas } from 'qrcode.react';

interface TelegramUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'passenger' | 'driver';
  created_at: number;
}

interface Stats {
  drivers: { total: number; pending: number; approved: number; rejected: number; online: number };
  passengers: { total: number };
  users: { total: number; today: number; this_month: number };
  trips: { total: number; completed: number; cancelled: number; active: number; completed_today: number; completed_month: number };
  subscriptions: { total: number; active: number; trial: number; expired: number; monthly_revenue: number };
  revenue: { total_fares_month: number; platform_commission_month: number };
}

function StatCard({ title, value, subtitle, color, icon }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('[', '[').replace(']', ']')}/10`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, telegramRes] = await Promise.all([
        apiClient.get('/admin/stats'),
        apiClient.get('/admin/telegram-users'),
      ]);
      setStats(statsRes.data);
      setTelegramUsers(telegramRes.data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
      </div>
    );
  }

  if (!stats) return null;

  const revenue = stats.revenue ?? { total_fares_month: 0, platform_commission_month: 0 };
  const subscriptions = stats.subscriptions ?? { total: 0, active: 0, trial: 0, expired: 0, monthly_revenue: 0 };
  const users = stats.users ?? { total: 0, today: 0, this_month: 0 };
  const drivers = stats.drivers ?? { total: 0, pending: 0, approved: 0, rejected: 0, online: 0 };
  const passengers = stats.passengers ?? { total: 0 };
  const trips = stats.trips ?? { total: 0, completed: 0, cancelled: 0, active: 0, completed_today: 0, completed_month: 0 };
  const totalRevenue = revenue.platform_commission_month + subscriptions.monthly_revenue;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Resumen general de la plataforma</p>
      </div>

      {/* Ingresos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Ingresos este mes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Comisiones de viajes"
            value={`$${Math.round(revenue.platform_commission_month).toLocaleString()}`}
            subtitle={`De $${Math.round(revenue.total_fares_month).toLocaleString()} en tarifas`}
            color="text-[#008000]"
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          />
          <StatCard
            title="Ingresos suscripciones"
            value={`$${Math.round(subscriptions.monthly_revenue).toLocaleString()}`}
            subtitle={`${subscriptions.active} suscripciones activas`}
            color="text-[#008000]"
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
          />
          <StatCard
            title="Total estimado"
            value={`$${Math.round(totalRevenue).toLocaleString()}`}
            subtitle="Comisiones + suscripciones"
            color="text-white"
            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>
      </div>

      {/* Usuarios */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Usuarios registrados</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            title="Total usuarios"
            value={users.total}
            subtitle={`+${users.today} hoy`}
            color="text-white"
            icon={<svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
          />
          <StatCard
            title="Conductores"
            value={drivers.total}
            subtitle={`${drivers.approved} aprobados`}
            color="text-[#008000]"
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <StatCard
            title="Pasajeros"
            value={passengers.total}
            subtitle={`+${users.this_month} este mes`}
            color="text-white"
            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
          />
          <StatCard
            title="Pendientes verificación"
            value={drivers.pending}
            subtitle="Conductores por aprobar"
            color={drivers.pending > 0 ? 'text-white' : 'text-gray-400'}
            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>
      </div>

      {/* Viajes */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Viajes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Total viajes" value={trips.total} color="text-white"
            icon={<svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
          />
          <StatCard title="Completados hoy" value={trips.completed_today} color="text-[#008000]"
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard title="Completados este mes" value={trips.completed_month} color="text-[#008000]"
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
          <StatCard title="En curso ahora" value={trips.active} color={trips.active > 0 ? 'text-[#008000]' : 'text-gray-400'}
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
        </div>
      </div>

      {/* Suscripciones */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Suscripciones</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Activas" value={subscriptions.active} color="text-[#008000]"
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard title="En prueba (trial)" value={subscriptions.trial} color="text-white"
            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard title="Expiradas" value={subscriptions.expired} color={subscriptions.expired > 0 ? 'text-white' : 'text-gray-400'}
            icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard title="Conductores online" value={drivers.online} subtitle="Disponibles ahora" color="text-[#008000]"
            icon={<svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>}
          />
        </div>
      </div>

      {/* Usuarios con Telegram vinculado */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Notificaciones Telegram
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#008000]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.67l-2.95-.924c-.642-.204-.657-.641.136-.953l11.57-4.461c.537-.194 1.006.131.948.889z"/>
              </svg>
              <span className="text-sm text-white font-medium">
                {telegramUsers.length} {telegramUsers.length === 1 ? 'usuario vinculado' : 'usuarios vinculados'}
              </span>
            </div>
          </div>
          {telegramUsers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Ningún usuario ha vinculado Telegram aún</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {telegramUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.role === 'driver'
                      ? 'text-[#008000] bg-[#008000]/10'
                      : 'text-white bg-white/10'
                  }`}>
                    {u.role === 'driver' ? 'Conductor' : 'Pasajero'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Código QR */}
      <QRSection />
    </div>
  );
}

function QRSection() {
  const APP_URL = 'https://motaxi.dev';
  const canvasRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motaxi-qr.png';
    a.click();
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Código QR de la app</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div ref={canvasRef} className="bg-white p-4 rounded-xl">
          <QRCodeCanvas
            value={APP_URL}
            size={180}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
            imageSettings={{
              src: '/favicon.svg',
              height: 36,
              width: 36,
              excavate: true,
            }}
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-white font-semibold text-lg mb-1">Motaxi App</p>
          <p className="text-gray-400 text-sm mb-1">Escanea para abrir la aplicación</p>
          <p className="text-[#008000] text-sm font-mono mb-4">{APP_URL}</p>
          <p className="text-gray-500 text-xs mb-4">
            Al escanear este QR con la cámara del teléfono, el sistema mostrará la opción <span className="text-gray-300">"Abrir en el navegador"</span> automáticamente.
          </p>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 bg-[#008000] hover:bg-[#38b018] text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar QR
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface AIDataStatus {
  threshold: number;
  progreso_porcentaje: number;
  listo_para_ia: boolean;
  totales: {
    viajes_total: number;
    con_gps: number;
    completados: number;
    con_ruta_polyline: number;
    zonas_distintas: number;
    franjas_horarias_cubiertas: number;
  };
  rutas_frecuentes: { pickup_address: string; dropoff_address: string; trips: number }[];
  viajes_por_dia: { dia: string; trips: number }[];
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm mb-2">{label}</p>
      <p className="text-2xl font-bold text-[#008000]">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function DatosIAPage() {
  const [data, setData] = useState<AIDataStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get('/analytics/ai-data-status');
        setData(res.data);
      } catch (err) {
        console.error(err);
        setError(true);
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

  if (error || !data) {
    return <p className="text-gray-400 py-8 text-center">No se pudieron cargar los datos.</p>;
  }

  const t = data.totales;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Datos para la IA</h1>
        <p className="text-gray-400 text-sm">
          Información que se recolecta de cada viaje para habilitar la herramienta de
          recomendación de zonas con más demanda.
        </p>
      </div>

      {/* Barra de progreso hacia activar la IA */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-300 font-medium">Progreso para activar la IA</p>
          <span className={`text-sm font-bold ${data.listo_para_ia ? 'text-[#42CE1D]' : 'text-[#008000]'}`}>
            {t.con_gps} / {data.threshold} viajes
          </span>
        </div>
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#008000] transition-all"
            style={{ width: `${data.progreso_porcentaje}%` }}
          />
        </div>
        <p className="text-xs mt-2 text-gray-500">
          {data.listo_para_ia
            ? '✅ Ya hay suficientes datos. Puedes activar la herramienta de IA.'
            : `Faltan ${Math.max(0, data.threshold - t.con_gps)} viajes con ubicación para tener una recomendación confiable.`}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Viajes totales" value={t.viajes_total} />
        <StatCard label="Con ubicación (GPS)" value={t.con_gps} hint="Base para la predicción" />
        <StatCard label="Completados" value={t.completados} />
        <StatCard label="Con ruta guardada" value={t.con_ruta_polyline} hint="route_polyline" />
        <StatCard label="Zonas distintas" value={t.zonas_distintas} hint="Puntos de recogida ~110m" />
        <StatCard label="Franjas horarias" value={t.franjas_horarias_cubiertas} hint="día × hora con viajes" />
      </div>

      {/* Rutas más frecuentes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Rutas más frecuentes (origen → destino)</h2>
        {data.rutas_frecuentes.length === 0 ? (
          <p className="text-gray-500 text-sm">Aún no hay rutas registradas.</p>
        ) : (
          <ul className="space-y-2">
            {data.rutas_frecuentes.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm border-b border-gray-800 pb-2 last:border-0">
                <span className="text-gray-300 min-w-0 truncate">
                  {r.pickup_address} <span className="text-gray-600">→</span> {r.dropoff_address}
                </span>
                <span className="text-[#008000] font-semibold shrink-0">{r.trips}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Viajes por día (últimos 14) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Viajes recolectados (últimos 14 días)</h2>
        {data.viajes_por_dia.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin viajes en el periodo.</p>
        ) : (
          <div className="space-y-1.5">
            {data.viajes_por_dia.map((d) => (
              <div key={d.dia} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-24 shrink-0">{d.dia}</span>
                <div className="flex-1 h-4 bg-gray-800 rounded">
                  <div className="h-full bg-[#008000] rounded" style={{ width: `${Math.min(100, d.trips * 10)}%` }} />
                </div>
                <span className="text-gray-300 w-8 text-right shrink-0">{d.trips}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

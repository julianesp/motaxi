'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

/**
 * Pausa general de viajes mientras MoTaxi no tenga la habilitación del Ministerio
 * de Transporte. Con la pausa activa la app muestra el aviso y el backend rechaza
 * nuevas solicitudes (POST /trips responde 503), incluso desde versiones viejas.
 */
export default function ServiceStatusCard() {
  const [paused, setPaused] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiClient
      .get('/admin/service-status')
      .then((res) => {
        setPaused(res.data.paused);
        setMessage(res.data.message || '');
      })
      .catch(() => setStatus({ ok: false, text: 'No se pudo cargar el estado del servicio.' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async (nextPaused: boolean) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await apiClient.put('/admin/service-status', { paused: nextPaused, message });
      setPaused(res.data.paused);
      setMessage(res.data.message || '');
      setStatus({
        ok: true,
        text: res.data.paused ? 'Viajes pausados. La app muestra el aviso.' : 'Viajes reanudados.',
      });
    } catch (err: any) {
      setStatus({ ok: false, text: err?.response?.data?.error || 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full bg-adm-muted border border-adm-border-strong text-adm-fg text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#008000] placeholder-adm-fg4';

  return (
    <div className="rounded-2xl border border-adm-border bg-adm-surface p-4 space-y-3">
      <div>
        <p className="font-semibold text-sm text-adm-fg">
          Servicio de viajes:{' '}
          <span className={paused ? 'text-orange-600 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}>
            {loading ? '…' : paused ? 'pausado' : 'activo'}
          </span>
        </p>
        <p className="text-xs text-adm-fg3 mt-0.5">
          Mientras no exista la habilitación del Ministerio de Transporte (Resolución 2163 de 2016, art. 21), mantén
          los viajes pausados. Los usuarios ven este aviso en la app y no pueden crear solicitudes.
        </p>
      </div>

      <label className="text-xs text-adm-fg3 space-y-1 block">
        <span>Aviso para los usuarios (vacío = aviso por defecto)</span>
        <textarea
          rows={3}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={input}
          disabled={loading}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(paused)}
          disabled={saving || loading}
          className="px-4 py-2 bg-[#008000] hover:bg-[#006600] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar aviso'}
        </button>
        <button
          onClick={() => save(!paused)}
          disabled={saving || loading}
          className="px-4 py-2 border border-adm-border-strong text-adm-fg font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {paused ? 'Reanudar viajes' : 'Pausar viajes'}
        </button>
        {status && (
          <span className={`text-xs ${status.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}

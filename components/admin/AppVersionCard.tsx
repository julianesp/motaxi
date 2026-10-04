'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

/**
 * Control de la versión de la app Android que se anuncia a los usuarios.
 * La app consulta GET /app/version al abrirse y, si su versionCode es menor que
 * "última versión", muestra su propio aviso para ir a Play Store; por debajo de
 * "versión mínima" el aviso no se puede cerrar.
 */
export default function AppVersionCard() {
  const [latest, setLatest] = useState('');
  const [min, setMin] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiClient
      .get('/admin/app-version')
      .then((res) => {
        setLatest(res.data.latestVersionCode ? String(res.data.latestVersionCode) : '');
        setMin(res.data.minVersionCode ? String(res.data.minVersionCode) : '');
        setMessage(res.data.message || '');
      })
      .catch(() => setStatus({ ok: false, text: 'No se pudo cargar la versión actual.' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await apiClient.put('/admin/app-version', {
        latestVersionCode: Number(latest) || 0,
        minVersionCode: Number(min) || 0,
        message,
      });
      setStatus({ ok: true, text: 'Guardado. La app lo verá la próxima vez que se abra.' });
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
        <p className="font-semibold text-sm text-adm-fg">Aviso de actualización de la app</p>
        <p className="text-xs text-adm-fg3 mt-0.5">
          Usa el <strong>versionCode</strong> del .aab subido a Play Store. Los usuarios con una versión menor verán un
          aviso dentro de la app para actualizar, aunque tengan las notificaciones apagadas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-adm-fg3 space-y-1">
          <span>Última versión (versionCode)</span>
          <input
            type="number"
            min={0}
            value={latest}
            onChange={(e) => setLatest(e.target.value)}
            placeholder="Ej. 11"
            className={input}
            disabled={loading}
          />
        </label>
        <label className="text-xs text-adm-fg3 space-y-1">
          <span>Versión mínima obligatoria</span>
          <input
            type="number"
            min={0}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="0 = ninguna"
            className={input}
            disabled={loading}
          />
        </label>
        <label className="text-xs text-adm-fg3 space-y-1 sm:col-span-1">
          <span>Mensaje (opcional)</span>
          <input
            type="text"
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej. Ahora puedes entrar con Google"
            className={input}
            disabled={loading}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving || loading}
          className="px-4 py-2 bg-[#008000] hover:bg-[#006600] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
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

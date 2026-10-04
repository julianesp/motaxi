'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Feedback {
  id: string;
  role: string | null;
  ease_rating: number;
  found_needed: 'yes' | 'partly' | 'no';
  improvement: string | null;
  app_version: string | null;
  platform: string | null;
  created_at: number;
  full_name: string | null;
  email: string | null;
}

interface Summary {
  total: number;
  avg_ease: number | null;
  found_yes: number | null;
  found_partly: number | null;
  found_no: number | null;
}

const FOUND_LABEL: Record<Feedback['found_needed'], { label: string; color: string }> = {
  yes: { label: 'Sí', color: 'text-green-700 dark:text-green-400 bg-green-500/10' },
  partly: { label: 'Más o menos', color: 'text-yellow-700 dark:text-yellow-400 bg-yellow-400/10' },
  no: { label: 'No', color: 'text-red-600 dark:text-red-400 bg-red-400/10' },
};

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500" aria-label={`${value} de 5`}>
      {'★'.repeat(value)}
      <span className="text-adm-border-strong">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-adm-surface border border-adm-border rounded-xl p-5">
      <p className="text-adm-fg3 text-sm mb-2">{label}</p>
      <p className="text-2xl font-bold text-adm-accent">{value}</p>
      {hint && <p className="text-xs text-adm-fg4 mt-1">{hint}</p>}
    </div>
  );
}

export default function OpinionesPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [onlyComments, setOnlyComments] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get('/admin/feedback');
        setFeedback(res.data.feedback);
        setSummary(res.data.summary);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-adm-fg3 py-8 text-center">No se pudieron cargar las opiniones.</p>;
  }

  const total = summary?.total ?? 0;
  const pct = (n: number | null) => (total ? `${Math.round(((n ?? 0) / total) * 100)}%` : '—');
  const rows = onlyComments ? feedback.filter((f) => f.improvement) : feedback;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-adm-fg mb-1">Opiniones de la app</h1>
        <p className="text-adm-fg3 text-sm">
          Respuestas de la encuesta que la app muestra a los usuarios tras 30 segundos de uso.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Respuestas" value={total} />
        <StatCard
          label="Facilidad de uso"
          value={summary?.avg_ease ? `${summary.avg_ease.toFixed(1)} / 5` : '—'}
          hint="Promedio de estrellas"
        />
        <StatCard label="Encontró lo que necesitaba" value={pct(summary?.found_yes ?? 0)} hint={`Más o menos: ${pct(summary?.found_partly ?? 0)}`} />
        <StatCard label="No lo encontró" value={pct(summary?.found_no ?? 0)} />
      </div>

      <div className="bg-adm-surface border border-adm-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-adm-border">
          <p className="text-adm-fg2 font-medium text-sm">Respuestas recientes</p>
          <label className="flex items-center gap-2 text-xs text-adm-fg3 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyComments}
              onChange={(e) => setOnlyComments(e.target.checked)}
              className="accent-[#008000]"
            />
            Solo con comentario
          </label>
        </div>

        {rows.length === 0 ? (
          <p className="text-adm-fg3 text-sm py-10 text-center">Todavía no hay respuestas.</p>
        ) : (
          <ul className="divide-y divide-adm-border">
            {rows.map((f) => (
              <li key={f.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                  <span className="text-sm font-medium text-adm-fg">{f.full_name || 'Usuario'}</span>
                  <span className="text-xs text-adm-fg4">
                    {f.role === 'driver' ? 'Conductor' : f.role === 'passenger' ? 'Pasajero' : f.role}
                  </span>
                  <span className="text-xs text-adm-fg4">
                    {new Date(f.created_at * 1000).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  {f.app_version && <span className="text-xs text-adm-fg4">v{f.app_version}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Stars value={f.ease_rating} />
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FOUND_LABEL[f.found_needed].color}`}>
                    Encontró lo que buscaba: {FOUND_LABEL[f.found_needed].label}
                  </span>
                </div>
                {f.improvement && <p className="text-sm text-adm-fg2 mt-2 whitespace-pre-line">{f.improvement}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

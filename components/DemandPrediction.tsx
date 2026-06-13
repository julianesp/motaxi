"use client";

import { useState, useEffect, useCallback } from "react";

interface Zone {
  latitude: number;
  longitude: number;
  address: string;
  historical_trips: number;
  expected_demand: number;
  confidence: number;
  score: number;
}

interface Prediction {
  target: { hour_label: string; day_label: string };
  zones: Zone[];
  summary: string;
  has_data: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

function getToken(): string | null {
  return document.cookie.match(/authToken=([^;]+)/)?.[1] || null;
}

export default function DemandPrediction() {
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      // 1. Estado del add-on
      const statusRes = await fetch(`${API_URL}/payments/premium/status`, { headers });
      const status = await statusRes.json();
      setIsActive(!!status.is_active);

      // 2. Si está activo, traer la predicción
      if (status.is_active) {
        const predRes = await fetch(`${API_URL}/analytics/demand-prediction`, { headers });
        if (predRes.ok) {
          setPrediction(await predRes.json());
        }
      }
    } catch {
      setError("No se pudo cargar la predicción de demanda.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleActivate = async () => {
    setActivating(true);
    setError(null);
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/payments/premium/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago.");

      // Cargar checkout de ePayco
      const openCheckout = () => {
        const { key, test, ...paymentData } = data.config;
        const handler = (window as any).ePayco.checkout.configure({ key, test });
        handler.open(paymentData);
        setActivating(false);
      };

      if ((window as any).ePayco?.checkout) {
        openCheckout();
      } else {
        const script = document.createElement("script");
        script.src = "https://checkout.epayco.co/checkout.js";
        script.onload = openCheckout;
        script.onerror = () => {
          setError("No se pudo cargar el sistema de pagos.");
          setActivating(false);
        };
        document.head.appendChild(script);
      }
    } catch (e: any) {
      setError(e.message || "Error al activar.");
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#008000]/20 bg-white dark:bg-gray-900 p-5 animate-pulse">
        <div className="h-5 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  // No tiene el add-on: mostrar CTA de activación
  if (!isActive) {
    return (
      <div className="rounded-2xl border-2 border-[#008000] bg-gradient-to-br from-[#008000]/10 to-white dark:from-[#008000]/25 dark:to-gray-900 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <h3 className="font-bold text-[#008000] dark:text-[#42CE1D] mb-1">
              Predicción de demanda con IA
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
              Recibe alertas de las zonas donde se esperan más pasajeros en la
              próxima hora, según el histórico de viajes. Anticípate y ubícate
              donde hay demanda.
            </p>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button
              onClick={handleActivate}
              disabled={activating}
              className="px-5 py-2.5 bg-[#008000] hover:bg-[#006600] disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {activating ? "Procesando…" : "Activar por $9.900/mes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tiene el add-on: mostrar la predicción
  return (
    <div className="rounded-2xl border border-[#008000]/30 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📍</span>
        <h3 className="font-bold text-[#008000] dark:text-[#42CE1D]">
          Zonas con más demanda
        </h3>
      </div>

      {prediction?.summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
          {prediction.summary}
        </p>
      )}

      {prediction?.has_data ? (
        <ul className="space-y-2">
          {prediction.zones.map((z, i) => (
            <li
              key={`${z.latitude}-${z.longitude}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {z.address}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {z.historical_trips} viajes históricos en esta franja
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${z.latitude},${z.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 bg-[#42CE1D] text-white text-xs font-semibold rounded-lg hover:bg-[#36b018] transition-colors"
              >
                Ir
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aún no hay suficientes datos para predecir la demanda de esta franja
          horaria. Vuelve más tarde.
        </p>
      )}
    </div>
  );
}

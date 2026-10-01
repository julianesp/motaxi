"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import apiClient from "@/lib/api-client";

/**
 * Alerta para conductores registrados con moto: el servicio en moto aún no está
 * habilitado por los términos del Ministerio de Transporte. El texto viene del
 * backend (`vehicle_notice` en /auth/me), el mismo que usa la app móvil.
 */
export default function VehicleNoticeAlert() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "driver") return;
    const key = `vehicle-notice-seen:${user.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {}
    let cancelled = false;
    apiClient
      .get("/auth/me")
      .then((res) => {
        const notice = res.data?.vehicle_notice;
        if (!cancelled && notice?.message) setMessage(notice.message);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!message || !user) return null;

  const close = () => {
    try {
      sessionStorage.setItem(`vehicle-notice-seen:${user.id}`, "1");
    } catch {}
    setMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="vehicle-notice-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
      >
        <div className="text-4xl mb-3" aria-hidden>⚠️</div>
        <h2 id="vehicle-notice-title" className="text-lg font-bold text-gray-900 mb-2">
          Servicio en moto aún no habilitado
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        <button
          onClick={close}
          className="mt-5 w-full rounded-xl bg-[#42CE1D] py-3 text-sm font-bold text-white transition-transform active:scale-[0.97]"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSubscription } from "@/lib/hooks/useSubscription";
import EpaycoSubscriptionCheckout from "./EpaycoSubscriptionCheckout";

interface TrialBannerProps {
  user: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
}

export default function TrialBanner({ user }: TrialBannerProps) {
  const { status, loading, refetch } = useSubscription();
  const [showCheckout, setShowCheckout] = useState(false);

  if (loading || !status) return null;

  // Si tiene acceso activo (trial vigente o suscripción activa), no mostrar nada o mostrar info mínima
  if (status.has_access && status.is_subscription_active) return null;

  // Trial activo: mostrar días restantes
  if (status.has_access && status.is_trial_active) {
    const isUrgent = status.days_left <= 3;
    return (
      <>
        <div className="rounded-2xl p-4 border bg-[#008000]/10 border-[#008000]/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-[#008000]/20">
                <svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-[#003300]">
                  {isUrgent ? `¡Solo quedan ${status.days_left} día${status.days_left !== 1 ? "s" : ""} de prueba!` : `Período de prueba gratuito`}
                </p>
                <p className="text-xs mt-0.5 text-[#008000]">
                  {isUrgent
                    ? "Suscríbete para no perder el acceso al servicio."
                    : `Te quedan ${status.days_left} días gratis. Después necesitarás una suscripción.`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-[#008000] hover:bg-[#006600] text-white"
            >
              Suscribirme
            </button>
          </div>
        </div>

        {showCheckout && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <EpaycoSubscriptionCheckout
              user={user}
              onClose={() => setShowCheckout(false)}
              onSuccess={() => { setShowCheckout(false); refetch(); }}
            />
          </div>
        )}
      </>
    );
  }

  // Sin acceso (trial vencido, sin suscripción)
  return (
    <>
      <div className="rounded-2xl p-4 border bg-red-50 border-red-300">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-red-800">Período de prueba vencido</p>
              <p className="text-xs text-red-600 mt-0.5">Tu período de prueba gratuito ha terminado. Suscríbete por <strong>$14.900/mes</strong> para continuar.</p>
            </div>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#008000] hover:bg-[#35a818] text-white transition-colors"
          >
            Suscribirme
          </button>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <EpaycoSubscriptionCheckout
            user={user}
            onClose={() => setShowCheckout(false)}
            onSuccess={() => { setShowCheckout(false); refetch(); }}
          />
        </div>
      )}
    </>
  );
}

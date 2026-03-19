"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

function RespuestaPagoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const epaycoRef = searchParams.get("x_ref_payco");
    const epaycoState = searchParams.get("x_transaction_state");

    if (epaycoRef || epaycoState) {
      const stateMap: Record<string, string> = {
        Aceptada: "APPROVED",
        Rechazada: "DECLINED",
        Pendiente: "PENDING",
        Fallida: "ERROR",
        Abandonada: "VOIDED",
      };

      const rawState = epaycoState || "";
      const data = {
        transactionId: epaycoRef || searchParams.get("x_transaction_id") || "",
        reference: searchParams.get("x_id_invoice") || searchParams.get("x_extra2") || "",
        amount: parseFloat(searchParams.get("x_amount") || "0"),
        currency: searchParams.get("x_currency_code") || "COP",
        status: stateMap[rawState] || "ERROR",
        statusMessage: rawState,
        paymentMethod: searchParams.get("x_franchise") || "ePayco",
        customerEmail: searchParams.get("x_customer_email") || "",
        source: "epayco",
      };
      setPaymentData(data);
    }
    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#42CE1D]"></div>
      </div>
    );
  }

  const status = paymentData?.status;
  const isApproved = status === "APPROVED";
  const isPending = status === "PENDING";
  const isDeclined = status === "DECLINED" || status === "ERROR";

  const redirectPath = user?.role === "driver" ? "/driver/profile" : "/passenger/profile";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
          isApproved ? "bg-green-100" : isPending ? "bg-amber-100" : "bg-red-100"
        }`}>
          {isApproved ? (
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : isPending ? (
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h1 className={`text-2xl font-bold mb-2 ${
          isApproved ? "text-green-700" : isPending ? "text-amber-700" : "text-red-700"
        }`}>
          {isApproved ? "¡Pago exitoso!" : isPending ? "Pago pendiente" : "Pago no procesado"}
        </h1>

        <p className="text-gray-600 text-sm mb-6">
          {isApproved
            ? "Tu suscripción a MoTaxi está activa. ¡Disfruta del servicio!"
            : isPending
            ? "Tu pago está siendo procesado. Te notificaremos cuando se confirme."
            : "El pago no pudo completarse. Puedes intentarlo nuevamente."}
        </p>

        {/* Details */}
        {paymentData && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            {paymentData.reference && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Referencia</span>
                <span className="font-mono text-xs text-gray-700">{paymentData.reference}</span>
              </div>
            )}
            {paymentData.amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Monto</span>
                <span className="font-semibold text-gray-900">${paymentData.amount.toLocaleString("es-CO")} COP</span>
              </div>
            )}
            {paymentData.statusMessage && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estado</span>
                <span className={`font-medium ${isApproved ? "text-green-600" : isPending ? "text-amber-600" : "text-red-600"}`}>
                  {paymentData.statusMessage}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link href={redirectPath}
            className="block w-full py-3 px-4 bg-[#42CE1D] hover:bg-[#35a818] text-white font-semibold rounded-xl transition-colors">
            Ir a mi perfil
          </Link>
          {!isApproved && (
            <Link href={redirectPath}
              className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors text-sm">
              Intentar nuevamente
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RespuestaPagoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#42CE1D]"></div>
      </div>
    }>
      <RespuestaPagoContent />
    </Suspense>
  );
}

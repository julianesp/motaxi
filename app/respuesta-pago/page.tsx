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
    const stateMap: Record<string, string> = {
      Aceptada: "APPROVED",
      Aprobada: "APPROVED",
      Rechazada: "DECLINED",
      Pendiente: "PENDING",
      Fallida: "ERROR",
      Abandonada: "VOIDED",
    };

    // En la redirección, ePayco solo envía ref_payco. El estado real se
    // consulta a la API de validación de ePayco con esa referencia.
    const refPayco =
      searchParams.get("ref_payco") || searchParams.get("x_ref_payco");

    // Algunos flujos sí traen x_transaction_state directo: úsalo si existe.
    const directState = searchParams.get("x_transaction_state");

    const finish = (data: any) => {
      setPaymentData(data);
      setLoading(false);
    };

    if (directState) {
      finish({
        transactionId: searchParams.get("x_transaction_id") || refPayco || "",
        reference: searchParams.get("x_id_invoice") || searchParams.get("x_extra2") || "",
        amount: parseFloat(searchParams.get("x_amount") || "0"),
        currency: searchParams.get("x_currency_code") || "COP",
        status: stateMap[directState] || "ERROR",
        statusMessage: directState,
        source: "epayco",
      });
      return;
    }

    if (refPayco) {
      fetch(`https://secure.epayco.co/validation/v1/reference/${refPayco}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          const d = res?.data;
          if (!d) {
            finish({ status: "PENDING", statusMessage: "Pendiente", reference: refPayco, amount: 0 });
            return;
          }
          const rawState = d.x_transaction_state || d.x_response || "";
          finish({
            transactionId: d.x_ref_payco || refPayco,
            reference: d.x_id_invoice || d.x_extra2 || "",
            amount: parseFloat(d.x_amount || "0"),
            currency: d.x_currency_code || "COP",
            status: stateMap[rawState] || "PENDING",
            statusMessage: rawState || "Pendiente",
            source: "epayco",
          });
        })
        .catch(() =>
          finish({ status: "PENDING", statusMessage: "Pendiente", reference: refPayco, amount: 0 })
        );
      return;
    }

    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000]"></div>
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
            ? "Tu pago fue aprobado y tu servicio quedó activo. ¡Gracias!"
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
            className="block w-full py-3 px-4 bg-[#008000] hover:bg-[#35a818] text-white font-semibold rounded-xl transition-colors">
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000]"></div>
      </div>
    }>
      <RespuestaPagoContent />
    </Suspense>
  );
}

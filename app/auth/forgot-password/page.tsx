"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar/page";
import { apiClient } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiClient.post("/auth/forgot-password", {
        emailOrPhone,
      });

      setEmailSent(response.data.emailSent === true);
      if (response.data.resetCode) {
        setResetCode(response.data.resetCode);
      }
      setCodeSent(true);
    } catch (err: any) {
      console.error("Forgot password error:", err);

      if (err.response?.status === 400) {
        setError(
          "Por favor, ingresa un correo electrónico o número de teléfono válido.",
        );
      } else if (err.response?.status === 500) {
        setError(
          "Error del servidor. Por favor, intenta nuevamente más tarde.",
        );
      } else {
        setError(
          "Error al procesar la solicitud. Por favor, intenta nuevamente.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-[#008000]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-[#008000] mb-2">MoTaxi</h1>
            <h2 className="text-2xl font-semibold text-gray-800">
              ¿Olvidaste tu contraseña?
            </h2>
            <p className="mt-2 text-gray-600">
              Ingresa tu correo electrónico y te ayudaremos a recuperar el
              acceso
            </p>
          </div>

          {/* Estado: código enviado */}
          {codeSent && (
            <div className={`border-l-4 px-4 py-4 rounded-lg shadow-md ${emailSent ? 'bg-green-50 border-green-500 text-green-800' : 'bg-amber-50 border-amber-500 text-amber-800'}`}>
              {emailSent ? (
                <div>
                  <p className="font-semibold mb-1">✅ Correo enviado</p>
                  <p className="text-sm">Revisa tu bandeja de entrada (y spam). El código expira en 15 minutos.</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold mb-2">📋 Tu código de recuperación:</p>
                  <p className="text-4xl font-bold tracking-widest text-center my-3">{resetCode}</p>
                  <p className="text-xs text-center">Cópialo antes de continuar · expira en 15 minutos</p>
                </div>
              )}
              <button
                onClick={() => router.push(`/auth/reset-password?identifier=${encodeURIComponent(emailOrPhone)}`)}
                className="mt-4 w-full py-2.5 px-4 bg-[#008000] text-white rounded-xl font-medium hover:bg-[#006600] transition-colors"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg shadow-md animate-shake">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          {!codeSent && <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="emailOrPhone"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Correo Electrónico o Teléfono
              </label>
              <input
                id="emailOrPhone"
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                required
                className="input text-black"
                placeholder="tu@email.com o 3001234567"
                autoComplete="email"
              />
              <p className="mt-1 text-xs text-gray-500">
                Ingresa el correo o teléfono que usaste para registrarte
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Procesando..." : "Enviar código de recuperación"}
            </button>
          </form>}

          {/* Ya tienes el código? */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              ¿Ya tienes un código de recuperación?{" "}
              <Link
                href={`/auth/reset-password${emailOrPhone ? `?identifier=${encodeURIComponent(emailOrPhone)}` : ""}`}
                className="font-medium text-[#008000] hover:text-green-500"
              >
                Ingresar código
              </Link>
            </p>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center text-[#008000] hover:text-green-500 font-medium transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

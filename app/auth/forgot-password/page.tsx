'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiClient } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDebugInfo(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/forgot-password', { emailOrPhone });

      // Mostrar información de debug (el código de recuperación)
      if (response.data.debug) {
        setDebugInfo(response.data.debug);
        setResetCode(response.data.debug.resetCode);
      }

      // Redirigir a la página de reset con el email/phone
      router.push(`/auth/reset-password?identifier=${encodeURIComponent(emailOrPhone)}`);
    } catch (err: any) {
      console.error('Forgot password error:', err);

      if (err.response?.status === 400) {
        setError('Por favor, ingresa un correo electrónico o número de teléfono válido.');
      } else if (err.response?.status === 500) {
        setError('Error del servidor. Por favor, intenta nuevamente más tarde.');
      } else {
        setError('Error al procesar la solicitud. Por favor, intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-indigo-600"
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
            <h1 className="text-4xl font-bold text-indigo-600 mb-2">MoTaxi</h1>
            <h2 className="text-2xl font-semibold text-gray-800">¿Olvidaste tu contraseña?</h2>
            <p className="mt-2 text-gray-600">
              Ingresa tu correo electrónico y te ayudaremos a recuperar el acceso
            </p>
          </div>

          {/* Debug Info (Solo para desarrollo) */}
          {debugInfo && (
            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded-lg shadow-md">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-medium mb-2">Código de recuperación generado:</p>
                  <p className="text-2xl font-bold">{debugInfo.resetCode}</p>
                  <p className="text-sm mt-2">Para: {debugInfo.email || debugInfo.phone}</p>
                  <p className="text-xs mt-2 text-green-600">
                    (Este código expira en 15 minutos)
                  </p>
                </div>
              </div>
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
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico o Teléfono
              </label>
              <input
                id="emailOrPhone"
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                required
                className="input"
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
              {loading ? 'Procesando...' : 'Enviar código de recuperación'}
            </button>
          </form>

          {/* Ya tienes el código? */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              ¿Ya tienes un código de recuperación?{' '}
              <Link
                href={`/auth/reset-password${emailOrPhone ? `?identifier=${encodeURIComponent(emailOrPhone)}` : ''}`}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Ingresar código
              </Link>
            </p>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-500 font-medium transition-colors"
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

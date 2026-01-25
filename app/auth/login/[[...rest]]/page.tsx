'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { SignIn, useSignIn } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useClerk, setUseClerk] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // El AuthContext y el componente HomePage manejarán la redirección
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);

      // Manejo específico de errores según el código de respuesta
      if (err.response?.status === 401) {
        setError('Correo electrónico o contraseña incorrectos. Por favor, verifica tus credenciales.');
      } else if (err.response?.status === 404) {
        setError('Usuario no encontrado. ¿Necesitas registrarte?');
      } else if (err.response?.status === 400) {
        setError('Datos inválidos. Por favor, verifica la información ingresada.');
      } else if (err.response?.status === 500) {
        setError('Error del servidor. Por favor, intenta nuevamente más tarde.');
      } else {
        setError(err.response?.data?.error || 'Error al iniciar sesión. Verifica tus credenciales.');
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
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">MoTaxi</h1>
          <h2 className="text-2xl font-semibold text-gray-800">Iniciar Sesión</h2>
          <p className="mt-2 text-gray-600">Elige cómo quieres ingresar</p>
        </div>

        {/* Toggle entre métodos de login */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setUseClerk(false)}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              !useClerk
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Email y Contraseña
          </button>
          <button
            type="button"
            onClick={() => setUseClerk(true)}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              useClerk
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Login Social
          </button>
        </div>

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

        {/* Clerk SignIn Component */}
        {useClerk && isLoaded ? (
          <div className="mt-6">
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none',
                  formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-700',
                },
                layout: {
                  socialButtonsPlacement: 'top',
                  socialButtonsVariant: 'blockButton',
                },
              }}
              signUpUrl="/auth/register"
              afterSignInUrl="/"
            />
          </div>
        ) : null}

        {/* Login Form tradicional */}
        {!useClerk && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Recordarme
              </label>
            </div>

            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
        )}

        {/* Register Link - Solo mostrar en modo tradicional */}
        {!useClerk && (
          <div className="text-center">
            <p className="text-gray-600">
              ¿No tienes una cuenta?{' '}
              <Link href="/auth/role-selection" className="font-medium text-indigo-600 hover:text-indigo-500">
                Regístrate aquí
              </Link>
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

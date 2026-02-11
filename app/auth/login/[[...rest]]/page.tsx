"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { SignIn, useSignIn, useClerk } from "@clerk/nextjs";
import Navbar from "@/components/Navbar/Navbar";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { isLoaded, signIn } = useSignIn();
  const clerk = useClerk();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useClerkAuth, setUseClerkAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Cerrar sesión de Clerk al cambiar a modo social login
  const handleToggleClerk = async (value: boolean) => {
    if (value) {
      // Si hay una sesión de Clerk activa, cerrarla
      try {
        await clerk.signOut();
      } catch (err) {
        console.log('No active Clerk session to sign out');
      }
    }
    setUseClerkAuth(value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      // El AuthContext y el componente HomePage manejarán la redirección
      router.push("/");
    } catch (err: any) {
      console.error("Login error:", err);

      // Manejo específico de errores según el código de respuesta
      if (err.response?.status === 401) {
        setError(
          "Correo electrónico o contraseña incorrectos. Por favor, verifica tus credenciales.",
        );
      } else if (err.response?.status === 404) {
        setError("Usuario no encontrado. ¿Necesitas registrarte?");
      } else if (err.response?.status === 400) {
        setError(
          "Datos inválidos. Por favor, verifica la información ingresada.",
        );
      } else if (err.response?.status === 500) {
        setError(
          "Error del servidor. Por favor, intenta nuevamente más tarde.",
        );
      } else {
        setError(
          err.response?.data?.error ||
            "Error al iniciar sesión. Verifica tus credenciales.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#000000",
        backgroundImage: "linear-gradient(to top, #0f9b0f, #000000)",
      }}
    >
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="max-w-md w-full space-y-8 bg-gray-900 bg-opacity-90 p-8 rounded-2xl shadow-2xl border border-green-500 border-opacity-30">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-400 mb-2">MoTaxi</h1>
            <h2 className="text-2xl font-semibold text-white">
              Iniciar Sesión
            </h2>
            <p className="mt-2 text-gray-300">Elige cómo quieres ingresar</p>
          </div>

          {/* Toggle entre métodos de login */}
          <div className="flex gap-2 bg-gray-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => handleToggleClerk(false)}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                !useClerkAuth
                  ? "bg-green-600 text-white shadow-lg"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Email y Contraseña
            </button>
            <button
              type="button"
              onClick={() => handleToggleClerk(true)}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                useClerkAuth
                  ? "bg-green-600 text-white shadow-lg"
                  : "text-gray-300 hover:text-white"
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
          {useClerkAuth && isLoaded ? (
            <div className="mt-6">
              <SignIn
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none bg-transparent",
                    formButtonPrimary:
                      "bg-green-600 hover:bg-green-700 text-white",
                    formFieldInput:
                      "bg-gray-800 text-white border-gray-700 focus:border-green-500",
                    formFieldLabel: "text-gray-300",
                    footerActionLink: "text-green-400 hover:text-green-300",
                    socialButtonsBlockButton:
                      "border-gray-700 text-white hover:bg-gray-800",
                  },
                  layout: {
                    socialButtonsPlacement: "top",
                    socialButtonsVariant: "blockButton",
                  },
                }}
                signUpUrl="/auth/register"
                forceRedirectUrl="/"
              />
            </div>
          ) : null}

          {/* Login Form tradicional */}
          {!useClerkAuth && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Correo Electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-12 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 focus:outline-none"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-700 rounded bg-gray-800"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-300"
                  >
                    Recordarme
                  </label>
                </div>

                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-green-400 hover:text-green-300"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </button>
            </form>
          )}

          {/* Register Link - Solo mostrar en modo tradicional */}
          {!useClerkAuth && (
            <div className="text-center">
              <p className="text-gray-300">
                ¿No tienes una cuenta?{" "}
                <Link
                  href="/auth/role-selection"
                  className="font-medium text-green-400 hover:text-green-300"
                >
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

"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";
import { useSignUp, useClerk } from "@clerk/nextjs";
import Navbar from "@/components/Navbar/page";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const { signUp, isLoaded } = useSignUp();
  const { signOut } = useClerk();

  const handleGoogleSignUp = async () => {
    if (!isLoaded) return;
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/sso-callback/complete",
      });
    } catch (err: any) {
      if (err?.message?.includes("already signed in") || err?.errors?.[0]?.code === "session_exists") {
        await signOut();
        await signUp.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: "/sso-callback/complete",
        });
      }
    }
  };

  const roleParam = searchParams.get("role") as UserRole | null;

  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: roleParam || ("passenger" as UserRole),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roleParam) {
      router.push("/auth/role-selection");
    }
  }, [roleParam, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (!/^\d{10}$/.test(formData.phone.replace(/\s/g, ""))) {
      setError("El número de teléfono debe tener 10 dígitos");
      return;
    }

    setLoading(true);

    try {
      await register({
        full_name: formData.email.split("@")[0],
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      });

      router.push("/");
    } catch (err: any) {
      console.error("Register error:", err);

      if (err.response?.status === 409) {
        setError("Este correo electrónico o número de teléfono ya está registrado. Por favor, usa otros datos o inicia sesión.");
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.error || "Datos inválidos. Por favor, verifica la información ingresada.");
      } else if (err.response?.status === 500) {
        setError("Error del servidor. Por favor, intenta nuevamente más tarde.");
      } else {
        setError(err.response?.data?.error || "Error al registrar. Por favor, verifica tus datos e intenta nuevamente.");
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
        backgroundImage: "linear-gradient(to top, #008000, #000000)",
      }}
    >
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="max-w-md w-full space-y-8 bg-gray-900 bg-opacity-90 p-8 rounded-2xl shadow-2xl border border-green-500 border-opacity-30">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-400 mb-2">MoTaxi</h1>
            <h2 className="text-2xl font-semibold text-white">Crear Cuenta</h2>
            <p className="mt-2 text-gray-300">
              Regístrate como {formData.role === "passenger" ? "Pasajero" : "Conductor"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg shadow-md">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
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

          {/* Botón Google */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={!isLoaded}
              className="flex items-center gap-3 w-full justify-center px-4 py-3 border border-gray-600 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Registrarse con Google
            </button>
          </div>

          {/* Divisor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">O regístrate con formulario</span>
            </div>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Correo Electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input text-black"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                Teléfono
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                required
                className="input text-black"
                placeholder="3001234567"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="input text-black"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirmar Contraseña
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="input text-black"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                required
                className="h-4 w-4 text-[#008000] focus:ring-green-500 border-gray-300 rounded mt-1"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-300">
                Acepto los{" "}
                <a href="#" className="text-[#008000] hover:text-green-500">términos y condiciones</a>{" "}
                y la{" "}
                <a href="#" className="text-[#008000] hover:text-green-500">política de privacidad</a>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creando cuenta..." : "Crear Cuenta"}
            </button>
          </form>

          <div className="text-center">
            <p className="text-gray-600">
              ¿Ya tienes una cuenta?{" "}
              <Link href="/auth/login" className="font-medium text-[#008000] hover:text-green-500">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";
import { SignUp, useSignUp, useClerk } from "@clerk/nextjs";
import Navbar from "@/components/Navbar/Navbar";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const { isLoaded } = useSignUp();
  const clerk = useClerk();

  const roleParam = searchParams.get("role") as UserRole | null;

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: roleParam || ("passenger" as UserRole),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useClerkAuth, setUseClerkAuth] = useState(false);

  // Cerrar sesión de Clerk al cambiar a modo social
  const handleToggleClerk = async (value: boolean) => {
    if (value) {
      try {
        await clerk.signOut();
      } catch (err) {
        console.log('No active Clerk session to sign out');
      }
    }
    setUseClerkAuth(value);
  };

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

    // Validaciones
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
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      });

      // El AuthContext y el componente HomePage manejarán la redirección
      router.push("/");
    } catch (err: any) {
      console.error("Register error:", err);

      // Manejo específico de errores según el código de respuesta
      if (err.response?.status === 409) {
        setError(
          "Este correo electrónico o número de teléfono ya está registrado. Por favor, usa otros datos o inicia sesión.",
        );
      } else if (err.response?.status === 400) {
        setError(
          err.response?.data?.error ||
            "Datos inválidos. Por favor, verifica la información ingresada.",
        );
      } else if (err.response?.status === 500) {
        setError(
          "Error del servidor. Por favor, intenta nuevamente más tarde.",
        );
      } else {
        setError(
          err.response?.data?.error ||
            "Error al registrar. Por favor, verifica tus datos e intenta nuevamente.",
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
            <h2 className="text-2xl font-semibold text-white">Crear Cuenta</h2>
            <p className="mt-2 text-gray-300">
              {!useClerkAuth &&
                `Regístrate como ${formData.role === "passenger" ? "Pasajero" : "Conductor"}`}
              {useClerkAuth && "Elige cómo quieres registrarte"}
            </p>
          </div>

          {/* Toggle entre métodos de registro */}
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
              Formulario
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
              Registro Social
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

          {/* Clerk SignUp Component */}
          {useClerkAuth && isLoaded ? (
            <div className="mt-6">
              <SignUp
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none",
                    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700",
                  },
                  layout: {
                    socialButtonsPlacement: "top",
                    socialButtonsVariant: "blockButton",
                  },
                }}
                signInUrl="/auth/login"
              />
            </div>
          ) : null}

          {/* Register Form tradicional */}
          {!useClerkAuth && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="full_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nombre Completo
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Teléfono
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="3001234567"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirmar Contraseña
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-start">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
                />
                <label
                  htmlFor="terms"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Acepto los{" "}
                  <a href="#" className="text-indigo-600 hover:text-indigo-500">
                    términos y condiciones
                  </a>{" "}
                  y la{" "}
                  <a href="#" className="text-indigo-600 hover:text-indigo-500">
                    política de privacidad
                  </a>
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
          )}

          {/* Login Link - Solo mostrar en modo tradicional */}
          {!useClerkAuth && (
            <div className="text-center">
              <p className="text-gray-600">
                ¿Ya tienes una cuenta?{" "}
                <Link
                  href="/auth/login"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Inicia sesión
                </Link>
              </p>
            </div>
          )}
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

"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";
import Navbar from "@/components/Navbar/page";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  const roleParam = searchParams.get("role") as UserRole | null;

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    password: "",
    confirmPassword: "",
    email: "",
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.full_name.trim()) {
      setError("Ingresa tu nombre completo");
      return;
    }
    if (!/^\d{10}$/.test(formData.phone.replace(/\s/g, ""))) {
      setError("El número de celular debe tener 10 dígitos");
      return;
    }
    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("El correo electrónico no es válido");
      return;
    }

    setLoading(true);
    try {
      const { user: registeredUser } = await register({
        full_name: formData.full_name,
        email: formData.email || undefined,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      });

      if (registeredUser.email === "admin@neurai.dev") {
        router.push("/admin");
      } else if (registeredUser.role === "passenger") {
        router.push("/passenger");
      } else {
        router.push("/driver");
      }
    } catch (err: any) {
      console.error("Register error:", err);
      if (err.response?.status === 409) {
        const msg = err.response?.data?.error || "";
        if (msg.includes("Phone")) {
          setError("Este número de celular ya está registrado.");
        } else if (msg.includes("Email")) {
          setError("Este correo electrónico ya está registrado.");
        } else {
          setError("Este celular o correo ya está registrado.");
        }
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error || "No puedes registrarte con estos datos.");
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.error || "Datos inválidos. Verifica la información.");
      } else {
        setError("Error al registrar. Por favor intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "#000000", backgroundImage: "linear-gradient(to top, #008000, #000000)" }}
    >
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="max-w-md w-full space-y-6 bg-gray-900 bg-opacity-90 p-8 rounded-2xl shadow-2xl border border-green-500 border-opacity-30">

          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-400 mb-2">MoTaxi</h1>
            <h2 className="text-2xl font-semibold text-white">Crear Cuenta</h2>
            <p className="mt-1 text-gray-400">
              Regístrate como {formData.role === "passenger" ? "Pasajero" : "Conductor"}
            </p>
          </div>

          {/* Indicador de pasos */}
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? "bg-[#42CE1D]" : "bg-gray-600"}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? "bg-[#42CE1D]" : "bg-gray-600"}`} />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Paso 1: datos principales */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <p className="text-sm text-gray-400 font-medium">Paso 1 de 2 — Datos principales</p>

              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-1">
                  Nombre completo
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="input text-black"
                  placeholder="Juan Pérez"
                  autoComplete="name"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                  Número de celular
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
                  autoComplete="tel"
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
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmar contraseña
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
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full py-3 text-lg"
              >
                Continuar
              </button>
            </form>
          )}

          {/* Paso 2: email opcional */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-400 font-medium">Paso 2 de 2 — Correo electrónico (opcional)</p>

              <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-300 space-y-1">
                <p>Agregar tu correo te permite:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Recuperar tu cuenta si olvidas la contraseña</li>
                  <li>Recibir notificaciones por email</li>
                </ul>
                <p className="text-gray-500 text-xs mt-2">Si no lo agregas ahora, puedes hacerlo después desde tu perfil.</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Correo electrónico <span className="text-gray-500">(opcional)</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input text-black"
                  placeholder="tu@email.com"
                  autoComplete="email"
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
                  <a href="/terms" className="text-[#008000] hover:text-green-500">términos y condiciones</a>{" "}
                  y la{" "}
                  <a href="/privacy" className="text-[#008000] hover:text-green-500">política de privacidad</a>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setError(""); setStep(1); }}
                  className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 font-semibold hover:bg-gray-800 transition-colors"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creando cuenta..." : "Crear Cuenta"}
                </button>
              </div>
            </form>
          )}

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

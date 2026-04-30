"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";
import Navbar from "@/components/Navbar/page";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://motaxi-api.julian-burboa.workers.dev";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  const roleParam = searchParams.get("role") as UserRole | null;

  // step 1 = datos, step 2 = email opcional
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    password: "",
    confirmPassword: "",
    email: "",
    role: roleParam || ("passenger" as UserRole),
    vehicle_types: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roleParam) {
      router.push("/auth/role-selection");
    }
  }, [roleParam, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const normalized = name === "phone" ? value.replace(/\s/g, "").replace(/^\+57/, "") : value;
    setFormData({ ...formData, [name]: normalized });
  };

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.full_name.trim()) {
      setError("Ingresa tu nombre completo");
      return;
    }
    if (formData.role === "driver" && !formData.vehicle_types) {
      setError("Selecciona el tipo de vehículo");
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
        vehicle_types: formData.role === "driver" ? formData.vehicle_types : undefined,
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
            <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? "bg-[#008000]" : "bg-gray-600"}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? "bg-[#008000]" : "bg-gray-600"}`} />
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

              {formData.role === "driver" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tipo de vehículo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "moto", label: "Moto", emoji: "🏍️" },
                      { value: "taxi", label: "Taxi", emoji: "🚖" },
                      { value: "carro", label: "Carro / Van", emoji: "🚗" },
                      { value: "piaggio", label: "Piaggio", emoji: "🛺" },
                    ].map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, vehicle_types: v.value })}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          formData.vehicle_types === v.value
                            ? "border-[#008000] bg-[#008000] bg-opacity-20 text-[#008000]"
                            : "border-gray-600 text-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <span className="text-lg">{v.emoji}</span>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="input text-black w-full pr-12"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="input text-black w-full pr-12"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
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

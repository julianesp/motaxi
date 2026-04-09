"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MUNICIPALITIES } from "@/lib/constants/municipalities";
import Navbar from "@/components/Navbar/page";
import styles from "./styles.module.scss";

// Cargar el mapa dinámicamente para evitar problemas de SSR
const LandingMap = dynamic(() => import("@/components/LandingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center   rounded-2xl top-2">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
        <p className="mt-4 text-[#008000]">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeDriversCount, setActiveDriversCount] = useState<number | null>(null);
  const [totalTripsCount, setTotalTripsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
        const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
        const res = await fetch(`${API_URL}/drivers/nearby?lat=1.1656&lng=-77.0`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setActiveDriversCount((data.drivers || []).length);
        }
      } catch {
        // silencioso si falla
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#008000] via-purple-600 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto"></div>
          <p className="mt-4 text-white text-lg font-medium">
            Cargando MoTaxi...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#000000",
        backgroundImage: "linear-gradient(to top, #008000, #000000)",
      }}
    >
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(to bottom right, #008000, #000000)",
        }}
      >
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Contenido */}
            <div className="text-white space-y-8">
              <div className="inline-block">
                <span className="px-4 py-2 bg-green-500 bg-opacity-30 rounded-full text-sm font-semibold backdrop-blur-sm text-white border border-green-400">
                  Valle de Sibundoy
                </span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-white">
                Tu transporte,
                <br />a un toque
              </h1>
              <p className="text-xl lg:text-2xl text-white max-w-xl">
                Conectando los 4 municipios del Valle de Sibundoy: Santiago,
                Colón, Sibundoy y San Francisco
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  // Usuario autenticado - mostrar botón para ir a su dashboard
                  <button
                    onClick={() =>
                      router.push(
                        user.email === "admin@neurai.dev"
                          ? "/admin"
                          : user.role === "passenger"
                          ? "/passenger"
                          : "/driver",
                      )
                    }
                    className="px-8 py-4 bg-green-500 text-white font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 hover:bg-green-600 transform transition-all duration-200"
                  >
                    {user.email === "admin@neurai.dev" ? "Panel Admin" : "Ir a mi cuenta"}
                  </button>
                ) : (
                  // Usuario no autenticado - mostrar botones de registro e inicio de sesión
                  <>
                    <button
                      onClick={() => router.push("/auth/register")}
                      className="px-8 py-4 bg-green-500 text-white font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 hover:bg-green-600 transform transition-all duration-200"
                    >
                      Comenzar ahora
                    </button>
                    <button
                      onClick={() => router.push("/auth/login")}
                      className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-green-500 hover:border-green-500 transition-all duration-200"
                    >
                      Iniciar sesión
                    </button>
                  </>
                )}
              </div>

              {/* Estadísticas */}
              {/* <div className="grid grid-cols-3 gap-6 pt-8">
                <div>
                  <div className="text-3xl lg:text-4xl font-bold text-white">
                    4
                  </div>
                  <div className="text-sm text-green-100">Municipios</div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {activeDriversCount !== null && activeDriversCount > 0 && (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
                      </span>
                    )}
                    <div className="text-3xl lg:text-4xl font-bold text-white">
                      {activeDriversCount !== null ? activeDriversCount : "—"}
                    </div>
                  </div>
                  <div className="text-sm text-green-100">
                    {activeDriversCount === 1 ? "Conductor activo" : "Conductores activos"}
                  </div>
                </div>
                <div>
                  <div className="text-3xl lg:text-4xl font-bold text-white">
                    24/7
                  </div>
                  <div className="text-sm text-green-100">Disponible</div>
                </div>
              </div> */}
            </div>

            {/* Mapa */}
            <div className={`h-[300px] lg:h-[500px] ${styles.container}`}>
              <LandingMap />
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto"
          >
            <path
              d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z"
              fill="#F9FAFB"
            />
          </svg>
        </div>
      </section>

      {/* Municipios Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Nuestros Municipios
            </h2>
            <p className="text-xl text-black max-w-2xl mx-auto">
              MoTaxi conecta los cuatro municipios del Valle de Sibundoy
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {MUNICIPALITIES.map((municipality, index) => (
              <div
                key={municipality.id}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-t-4 border-[#008000]"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-[#008000] to-[#008000] rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {municipality.name[0]}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {municipality.name}
                </h3>
                {/* <p className="text-black mb-4">{municipality.description}</p> */}
                {/* {municipality.population && (
                  <div className="flex items-center text-sm text-black">
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    {municipality.population.toLocaleString()} habitantes
                  </div>
                )} */}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              ¿Por qué elegir MoTaxi?
            </h2>
            <p className="text-xl text-black max-w-2xl mx-auto">
              La solución de transporte moderna para el Valle de Sibundoy
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#008000] to-[#008000] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Rápido y Confiable
              </h3>
              <p className="text-black">
                Encuentra un conductor en minutos. Sistema de geolocalización en
                tiempo real para conexiones instantáneas.
              </p>
            </div>

            {/* Feature 2 */}
            {/* <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#008000] to-[#008000] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Seguro</h3>
              <p className="text-black">
                Conductores verificados y sistema de calificaciones. Tu
                seguridad es nuestra prioridad.
              </p>
            </div> */}

            {/* Feature 3 */}
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#008000] to-[#008000] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Tarifas Justas
              </h3>
              <p className="text-black">
                Precios transparentes y competitivos. Sabe cuánto pagarás antes
                de viajar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Aviso método de pago */}
      <section className="py-14 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-shrink-0 w-14 h-14 bg-[#008000]/10 border-2 border-[#008000] rounded-full flex items-center justify-center">
              <svg
                className="w-7 h-7 text-[#008000] "
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-black mb-2">
                Aviso sobre métodos de pago
              </h3>
              <p className="text-black leading-relaxed">
                <strong>MoTaxi es una plataforma de conexión</strong> entre
                conductores y pasajeros. El método de pago de cada viaje es
                acordado directamente y de forma libre entre las partes
                involucradas (efectivo, transferencia, u otro medio que
                decidan).{" "}
                <strong>
                  MoTaxi no procesa, gestiona ni intermedia ningún pago
                </strong>
                , por lo que no asume responsabilidad alguna sobre las
                transacciones económicas realizadas entre conductor y pasajero.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="py-20 bg-gradient-to-br from-[#008000] via-[#008000] to-[#008000]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              ¿Listo para comenzar?
            </h2>
            <p className="text-xl text-green-100 mb-8">
              Únete a la revolución del transporte en el Valle de Sibundoy
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push("/auth/role-selection")}
                className="px-8 py-4 bg-white text-black font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
              >
                Registrarse como Pasajero
              </button>
              <button
                onClick={() => router.push("/auth/role-selection")}
                className="px-8 py-4 bg-white text-gray-900 font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
              >
                Registrarse como Conductor
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

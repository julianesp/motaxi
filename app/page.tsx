"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";

interface InstructionVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  uploadedAt: number;
}

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
import dynamic from "next/dynamic";
import { MUNICIPALITIES } from "@/lib/constants/municipalities";
import Navbar from "@/components/Navbar/page";
import styles from "./styles.module.scss";

// Cargar el mapa dinámicamente (solo client-side, sin bloquear el render inicial)
const LandingMap = dynamic(() => import("@/components/LandingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center rounded-2xl top-2 bg-gradient-to-br from-green-900/20 to-black/20">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#42CE1D] mx-auto"></div>
        <p className="mt-4 text-[#42CE1D]">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeDriversCount, setActiveDriversCount] = useState<number | null>(
    null,
  );
  const [totalTripsCount, setTotalTripsCount] = useState<number | null>(null);
  const [videos, setVideos] = useState<InstructionVideo[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [topPickups, setTopPickups] = useState<{ address: string; trip_count: number }[]>([]);
  const [topDropoffs, setTopDropoffs] = useState<{ address: string; trip_count: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
        const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
        const res = await fetch(
          `${API_URL}/drivers/nearby?lat=1.1656&lng=-77.0`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
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

  useEffect(() => {
    fetch('/api/videos')
      .then(res => res.json())
      .then((data: InstructionVideo[]) => {
        setVideos(data.sort((a, b) => a.uploadedAt - b.uploadedAt));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    fetch(`${API_URL}/analytics/heatmap?days=30`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        const pickups = (data.pickup_hotspots || []).slice(0, 5).map((h: any) => ({
          address: h.pickup_address,
          trip_count: h.trip_count,
        }));
        const dropoffs = (data.dropoff_hotspots || []).slice(0, 5).map((h: any) => ({
          address: h.dropoff_address,
          trip_count: h.trip_count,
        }));
        const totalTrips =
          pickups.reduce((sum: number, h: any) => sum + h.trip_count, 0);
        if (totalTrips >= 10) {
          setTopPickups(pickups);
          setTopDropoffs(dropoffs);
        }
      })
      .catch(() => {});
  }, []);

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
          {/* Contenido hero */}
          <div className="text-white space-y-8 text-center max-w-3xl mx-auto">
            <div className="inline-block">
              <span className="px-4 py-2 bg-green-500 bg-opacity-30 rounded-full text-sm font-semibold backdrop-blur-sm text-white border border-green-400">
                Disponible donde estés
              </span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-white">
              Tu transporte,
              <br />a un toque
            </h1>
            <p className="text-xl lg:text-2xl text-white max-w-xl mx-auto">
              Pide tu moto desde donde estés. Conductores cercanos te
              muestran su distancia y tarifa para que elijas el que más
              te convenga.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
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
                  {user.email === "admin@neurai.dev"
                    ? "Panel Admin"
                    : "Ir a mi cuenta"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push("/auth/register")}
                    className="px-8 py-4 bg-green-500 text-white font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 hover:bg-green-600 transform transition-all duration-200"
                  >
                    Registrarse
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
          </div>

          {/* Videos de instrucciones — carrusel stack */}
          {videos.length > 0 && (
            <div className="mt-12 mx-auto relative" style={{ maxWidth: '700px' }}>
              <div className="relative flex items-center justify-center" style={{ height: '320px' }}>

                {videos.map((video, i) => {
                  const ytId = getYoutubeId(video.youtubeUrl);
                  const offset = i - currentVideoIndex;
                  // Normalizar offset para wrap circular
                  const total = videos.length;
                  let norm = offset;
                  if (norm > total / 2) norm -= total;
                  if (norm < -total / 2) norm += total;

                  const isActive = norm === 0;
                  const isVisible = Math.abs(norm) <= 1;

                  const translateX = norm * 75; // % de desplazamiento lateral
                  const scale = isActive ? 1 : 0.78;
                  const zIndex = isActive ? 10 : 5 - Math.abs(norm);
                  const brightness = isActive ? 1 : 0.45;

                  return (
                    <div
                      key={video.id}
                      onClick={() => !isActive && setCurrentVideoIndex(i)}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        maxWidth: '560px',
                        transform: `translateX(${translateX}%) scale(${scale})`,
                        transition: 'transform 0.45s ease-in-out, filter 0.45s ease-in-out, opacity 0.45s ease-in-out',
                        filter: `brightness(${brightness})`,
                        opacity: isVisible ? 1 : 0,
                        zIndex,
                        cursor: isActive ? 'default' : 'pointer',
                        pointerEvents: isVisible ? 'auto' : 'none',
                      }}
                    >
                      <div className="rounded-2xl overflow-hidden shadow-2xl">
                        {ytId && (
                          <div className="aspect-video bg-black">
                            {isActive ? (
                              <iframe
                                src={`https://www.youtube.com/embed/${ytId}`}
                                className="w-full h-full"
                                allowFullScreen
                                title={video.title}
                              />
                            ) : (
                              /* Thumbnail estático para los laterales — no carga el iframe */
                              <img
                                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        )}
                        <div className="px-4 py-3 bg-black/60 backdrop-blur-sm flex items-center justify-between">
                          <p className="text-white font-semibold text-sm truncate">{video.title}</p>
                          {isActive && (
                            <span className="text-white/50 text-xs ml-3 flex-shrink-0">
                              {currentVideoIndex + 1} / {videos.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Flecha izquierda — extremo izquierdo de la pantalla */}
                {videos.length > 1 && (
                  <button
                    onClick={() => setCurrentVideoIndex((i) => (i - 1 + videos.length) % videos.length)}
                    className="absolute top-1/2 -translate-y-1/2 z-20 w-10 h-16 bg-white hover:bg-gray-100 flex items-center justify-center transition-all duration-200 shadow-lg"
                    style={{ borderRadius: '0 8px 8px 0', left: 'calc(-50vw + 50%)' }}
                    aria-label="Video anterior"
                  >
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}

                {/* Flecha derecha — extremo derecho de la pantalla */}
                {videos.length > 1 && (
                  <button
                    onClick={() => setCurrentVideoIndex((i) => (i + 1) % videos.length)}
                    className="absolute top-1/2 -translate-y-1/2 z-20 w-10 h-16 bg-white hover:bg-gray-100 flex items-center justify-center transition-all duration-200 shadow-lg"
                    style={{ borderRadius: '8px 0 0 8px', right: 'calc(-50vw + 50%)' }}
                    aria-label="Video siguiente"
                  >
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Dots indicadores */}
              {videos.length > 1 && (
                <div className="flex justify-center gap-2 mt-5">
                  {videos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentVideoIndex(i)}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === currentVideoIndex ? '24px' : '8px',
                        height: '8px',
                        background: i === currentVideoIndex ? '#42CE1D' : 'rgba(255,255,255,0.35)',
                      }}
                      aria-label={`Ir al video ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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
              Zonas de cobertura
            </h2>
            <p className="text-xl text-black max-w-2xl mx-auto">
              Iniciamos en el Valle de Sibundoy, pero MoTaxi funciona desde
              cualquier lugar donde haya conductores registrados cerca de ti
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

      {/* Lugares más frecuentados — solo si hay datos */}
      {(topPickups.length > 0 || topDropoffs.length > 0) && <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Lugares más frecuentados
              </h2>
              <p className="text-xl text-black max-w-2xl mx-auto">
                Los destinos y puntos de recogida con más actividad en los últimos 30 días
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-10">
              {/* Top recogidas */}
              {topPickups.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#42CE1D]/10 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#42CE1D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Puntos de recogida</h3>
                  </div>
                  <div className="space-y-3">
                    {topPickups.map((place, i) => (
                      <div key={i} className="flex items-center gap-4 bg-gray-50 rounded-xl px-5 py-4 hover:bg-green-50 transition-colors">
                        <span className="text-2xl font-bold text-[#42CE1D] w-7 text-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 font-medium truncate">{place.address}</p>
                        </div>
                        <span className="flex-shrink-0 text-sm font-semibold text-[#42CE1D] bg-[#42CE1D]/10 px-3 py-1 rounded-full">
                          {place.trip_count} {place.trip_count === 1 ? 'viaje' : 'viajes'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top destinos */}
              {topDropoffs.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Destinos populares</h3>
                  </div>
                  <div className="space-y-3">
                    {topDropoffs.map((place, i) => (
                      <div key={i} className="flex items-center gap-4 bg-gray-50 rounded-xl px-5 py-4 hover:bg-orange-50 transition-colors">
                        <span className="text-2xl font-bold text-orange-500 w-7 text-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 font-medium truncate">{place.address}</p>
                        </div>
                        <span className="flex-shrink-0 text-sm font-semibold text-orange-500 bg-orange-100 px-3 py-1 rounded-full">
                          {place.trip_count} {place.trip_count === 1 ? 'viaje' : 'viajes'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>}

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              ¿Por qué elegir MoTaxi?
            </h2>
            <p className="text-xl text-black max-w-2xl mx-auto">
              La solución de transporte moderna, disponible donde estés
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

      {/* Mapa Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Conductores en tiempo real
            </h2>
            <p className="text-xl text-black max-w-2xl mx-auto">
              Ve dónde están los conductores disponibles cerca de ti ahora mismo
            </p>
          </div>
          <div className={`h-[400px] lg:h-[550px] ${styles.container}`}>
            <LandingMap />
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
              Únete a la revolución del transporte, desde cualquier lugar
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

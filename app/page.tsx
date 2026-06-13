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
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}
import dynamic from "next/dynamic";
import { MUNICIPALITIES } from "@/lib/constants/municipalities";
import Navbar from "@/components/Navbar/page";

// Cargar el mapa dinámicamente (solo client-side, sin bloquear el render inicial)
const LandingMap = dynamic(() => import("@/components/LandingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center rounded-2xl top-2 bg-gradient-to-br from-green-900/20 to-black/20">
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
  const [activeDriversCount, setActiveDriversCount] = useState<number | null>(
    null,
  );
  const [totalTripsCount, setTotalTripsCount] = useState<number | null>(null);
  const [videos, setVideos] = useState<InstructionVideo[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [topPickups, setTopPickups] = useState<
    { address: string; trip_count: number }[]
  >([]);
  const [topDropoffs, setTopDropoffs] = useState<
    { address: string; trip_count: number }[]
  >([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  interface ReferralWinner {
    full_name: string;
    profile_image?: string;
    referral_count: number;
    municipality?: string;
    month: number;
    year: number;
  }
  const [referralWinner, setReferralWinner] = useState<ReferralWinner | null>(
    null,
  );

  interface PublicPhoto {
    id: string;
    image_key: string;
    caption: string | null;
    created_at: number;
    driver_name: string;
    likes: number;
  }
  const [publicPhotos, setPublicPhotos] = useState<PublicPhoto[]>([]);
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<PublicPhoto | null>(null);
  const [novedadIndex, setNovedadIndex] = useState(0);

  // Modal para proponer imagen de municipio
  const [proposeImageMunicipality, setProposeImageMunicipality] = useState<
    string | null
  >(null);
  const [proposeImageUrl, setProposeImageUrl] = useState("");
  const [proposeImageLoading, setProposeImageLoading] = useState(false);
  const [proposeImageMsg, setProposeImageMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  async function handleProposeImage(e: React.FormEvent) {
    e.preventDefault();
    if (!proposeImageMunicipality) return;
    if (!proposeImageUrl.trim()) {
      setProposeImageMsg({ type: "err", text: "Ingresa la URL de la imagen." });
      return;
    }
    setProposeImageLoading(true);
    setProposeImageMsg(null);
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
      const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
      const res = await fetch(
        `${API_URL}/municipalities/${proposeImageMunicipality}/image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ image_url: proposeImageUrl }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setProposeImageMsg({ type: "ok", text: data.message });
        setProposeImageUrl("");
        setTimeout(() => {
          setProposeImageMunicipality(null);
          setProposeImageMsg(null);
        }, 3000);
      } else {
        setProposeImageMsg({
          type: "err",
          text: data.error || "Error al enviar.",
        });
      }
    } catch {
      setProposeImageMsg({ type: "err", text: "Error de conexión." });
    } finally {
      setProposeImageLoading(false);
    }
  }

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
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
    fetch(`${API_URL}/referrals/winner`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.winner) setReferralWinner(data.winner);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
    fetch(`${API_URL}/drivers/photos/public`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.photos?.length) setPublicPhotos(data.photos);
      })
      .catch(() => {});
    try {
      const stored = localStorage.getItem("motaxi_liked_photos");
      if (stored) setLikedPhotos(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const handleLikePhoto = async (photoId: string) => {
    if (likedPhotos.has(photoId) || likingId) return;
    setLikingId(photoId);
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
      const res = await fetch(`${API_URL}/drivers/photos/${photoId}/like`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = await res.json();
      setPublicPhotos((prev) =>
        prev
          .map((p) => (p.id === photoId ? { ...p, likes: data.likes } : p))
          .sort((a, b) => b.likes - a.likes || b.created_at - a.created_at),
      );
      const updated = new Set(likedPhotos).add(photoId);
      setLikedPhotos(updated);
      localStorage.setItem("motaxi_liked_photos", JSON.stringify([...updated]));
    } catch {
    } finally {
      setLikingId(null);
    }
  };

  useEffect(() => {
    fetch("/api/videos")
      .then((res) => res.json())
      .then((data: InstructionVideo[]) => {
        setVideos(data.sort((a, b) => a.uploadedAt - b.uploadedAt));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
    fetch(`${API_URL}/analytics/heatmap?days=30`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const pickups = (data.pickup_hotspots || [])
          .slice(0, 5)
          .map((h: any) => ({
            address: h.pickup_address,
            trip_count: h.trip_count,
          }));
        const dropoffs = (data.dropoff_hotspots || [])
          .slice(0, 5)
          .map((h: any) => ({
            address: h.dropoff_address,
            trip_count: h.trip_count,
          }));
        const totalTrips = pickups.reduce(
          (sum: number, h: any) => sum + h.trip_count,
          0,
        );
        if (totalTrips >= 10) {
          setTopPickups(pickups);
          setTopDropoffs(dropoffs);
        }
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#008000] to-black">
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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 lg:pt-36 lg:pb-28">
          {/* Contenido hero — dos columnas en desktop */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Columna izquierda: texto */}
            <div className="text-white flex flex-col gap-7">
              <div>
                <span className="px-4 py-2 bg-green-500 bg-opacity-30 rounded-full text-sm font-semibold backdrop-blur-sm text-white border border-green-400">
                  Disponible donde estés
                </span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-white">
                Tu transporte,
                <br />a un toque
              </h1>
              <p className="text-xl text-white max-w-lg">
                Pide tu moto desde donde estés. Conductores cercanos te muestran
                su distancia y tarifa para que elijas el que más te convenga.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
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

            {/* Columna derecha: mapa */}
            <div className="hidden lg:block h-[420px] rounded-2xl overflow-hidden shadow-2xl border border-white/20">
              <LandingMap />
            </div>
          </div>

          {/* Videos de instrucciones — carrusel stack */}
          {videos.length > 0 && (
            <div
              className="mt-12 mx-auto relative"
              style={{ maxWidth: "700px" }}
            >
              <div
                className="relative flex items-center justify-center"
                style={{ height: "320px" }}
              >
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
                        position: "absolute",
                        width: "100%",
                        maxWidth: "560px",
                        transform: `translateX(${translateX}%) scale(${scale})`,
                        transition:
                          "transform 0.45s ease-in-out, filter 0.45s ease-in-out, opacity 0.45s ease-in-out",
                        filter: `brightness(${brightness})`,
                        opacity: isVisible ? 1 : 0,
                        zIndex,
                        cursor: isActive ? "default" : "pointer",
                        pointerEvents: isVisible ? "auto" : "none",
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
                          <p className="text-white font-semibold text-sm truncate">
                            {video.title}
                          </p>
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
                    onClick={() =>
                      setCurrentVideoIndex(
                        (i) => (i - 1 + videos.length) % videos.length,
                      )
                    }
                    className="absolute top-1/2 -translate-y-1/2 z-20 w-10 h-16 bg-white hover:bg-gray-100 flex items-center justify-center transition-all duration-200 shadow-lg"
                    style={{
                      borderRadius: "0 8px 8px 0",
                      left: "calc(-50vw + 50%)",
                    }}
                    aria-label="Video anterior"
                  >
                    <svg
                      className="w-5 h-5 text-zinc-900"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}

                {/* Flecha derecha — extremo derecho de la pantalla */}
                {videos.length > 1 && (
                  <button
                    onClick={() =>
                      setCurrentVideoIndex((i) => (i + 1) % videos.length)
                    }
                    className="absolute top-1/2 -translate-y-1/2 z-20 w-10 h-16 bg-white hover:bg-gray-100 flex items-center justify-center transition-all duration-200 shadow-lg"
                    style={{
                      borderRadius: "8px 0 0 8px",
                      right: "calc(-50vw + 50%)",
                    }}
                    aria-label="Video siguiente"
                  >
                    <svg
                      className="w-5 h-5 text-zinc-900"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 5l7 7-7 7"
                      />
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
                        width: i === currentVideoIndex ? "24px" : "8px",
                        height: "8px",
                        background:
                          i === currentVideoIndex
                            ? "#008000"
                            : "rgba(255,255,255,0.35)",
                      }}
                      aria-label={`Ir al video ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Carrusel de novedades */}
          {(() => {
            const novedades = [
              {
                icon: (
                  <svg
                    className="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11c0 .936.432 1.771 1.106 2.31C5.86 14.05 5 15.426 5 17v1h8v-1c0-1.574-.86-2.95-2.106-3.69A2.995 2.995 0 0012 11z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 7a5 5 0 010 10"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 4a9 9 0 010 16"
                    />
                  </svg>
                ),
                titulo: "¡Entra con tu huella digital!",
                descripcion:
                  "Inicia sesión normal → ve a tu perfil → registra tu huella → y la próxima vez entras sin contraseña.",
                boton: "Probar",
                accion: () => router.push("/auth/login"),
              },
              {
                icon: (
                  <svg
                    className="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                ),
                titulo: "¡Propón la foto de tu municipio!",
                descripcion:
                  "¿Tienes una buena foto de tu municipio? Súgierela y si el administrador la aprueba, aparecerá como imagen de fondo en la tarjeta del municipio.",
                boton: "Ver municipios",
                accion: () => {
                  const el = document.getElementById("municipios-section");
                  el?.scrollIntoView({ behavior: "smooth" });
                },
              },
              {
                icon: (
                  <svg
                    className="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ),
                titulo: "Publica tu negocio en tu municipio",
                descripcion:
                  "Ingresa a tu municipio y sube la dirección y fotos de tu local. Otros usuarios podrán verte y pedir un mototaxi directamente a tu negocio.",
                boton: "Explorar",
                accion: () => router.push("/municipio/santiago"),
              },
            ];
            const total = novedades.length;
            return (
              <div
                className="mt-12 mx-auto relative"
                style={{ maxWidth: "700px" }}
              >
                <div
                  className="relative flex items-center justify-center"
                  style={{ height: "140px" }}
                  onTouchStart={(e) => {
                    const x = e.touches[0].clientX;
                    (e.currentTarget as any)._swipeStartX = x;
                  }}
                  onTouchEnd={(e) => {
                    const startX = (e.currentTarget as any)._swipeStartX;
                    if (startX == null) return;
                    const dx = e.changedTouches[0].clientX - startX;
                    if (Math.abs(dx) < 40) return;
                    if (dx < 0) setNovedadIndex((i) => (i + 1) % total);
                    else setNovedadIndex((i) => (i - 1 + total) % total);
                  }}
                >
                  {novedades.map((nov, i) => {
                    const offset = i - novedadIndex;
                    let norm = offset;
                    if (norm > total / 2) norm -= total;
                    if (norm < -total / 2) norm += total;
                    const isActive = norm === 0;
                    const isVisible = Math.abs(norm) <= 1;
                    const translateX = norm * 75;
                    const scale = isActive ? 1 : 0.78;
                    const zIndex = isActive ? 10 : 5 - Math.abs(norm);
                    const brightness = isActive ? 1 : 0.45;
                    return (
                      <div
                        key={i}
                        onClick={() => !isActive && setNovedadIndex(i)}
                        style={{
                          position: "absolute",
                          width: "100%",
                          maxWidth: "560px",
                          transform: `translateX(${translateX}%) scale(${scale})`,
                          transition:
                            "transform 0.45s ease-in-out, filter 0.45s ease-in-out, opacity 0.45s ease-in-out",
                          filter: `brightness(${brightness})`,
                          opacity: isVisible ? 1 : 0,
                          zIndex,
                          cursor: isActive ? "default" : "pointer",
                          pointerEvents: isVisible ? "auto" : "none",
                        }}
                      >
                        <div className="rounded-2xl overflow-hidden shadow-2xl">
                          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-[#42CE1D] rounded-xl flex items-center justify-center shadow-md">
                              {nov.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#42CE1D]">
                                  Novedad
                                </span>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#42CE1D] animate-pulse" />
                              </div>
                              <p className="text-white font-semibold text-sm leading-snug">
                                {nov.titulo}
                              </p>
                              <p className="text-white/70 text-xs mt-0.5 line-clamp-2">
                                {nov.descripcion}
                              </p>
                            </div>
                            {isActive && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  nov.accion();
                                }}
                                className="flex-shrink-0 text-xs font-semibold text-white bg-[#42CE1D] hover:bg-[#36b018] transition-colors px-3 py-1.5 rounded-lg"
                              >
                                {nov.boton}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Flecha izquierda — más pequeña */}
                  <button
                    onClick={() =>
                      setNovedadIndex((i) => (i - 1 + total) % total)
                    }
                    className="absolute top-1/2 -translate-y-1/2 z-20 w-6 h-10 bg-white/80 hover:bg-white flex items-center justify-center transition-all duration-200 shadow-md"
                    style={{
                      borderRadius: "0 6px 6px 0",
                      left: "calc(-50vw + 50%)",
                    }}
                    aria-label="Novedad anterior"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-zinc-900"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  {/* Flecha derecha — más pequeña */}
                  <button
                    onClick={() => setNovedadIndex((i) => (i + 1) % total)}
                    className="absolute top-1/2 -translate-y-1/2 z-20 w-6 h-10 bg-white/80 hover:bg-white flex items-center justify-center transition-all duration-200 shadow-md"
                    style={{
                      borderRadius: "6px 0 0 6px",
                      right: "calc(-50vw + 50%)",
                    }}
                    aria-label="Novedad siguiente"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-zinc-900"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>

                {/* Dots */}
                <div className="flex justify-center gap-2 mt-5">
                  {novedades.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setNovedadIndex(i)}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === novedadIndex ? "24px" : "8px",
                        height: "8px",
                        background:
                          i === novedadIndex
                            ? "#42CE1D"
                            : "rgba(255,255,255,0.35)",
                      }}
                      aria-label={`Novedad ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
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

      {/* Banner: Ganador del Concurso de Referidos */}
      {referralWinner && (
        <section className="py-10 bg-white dark:bg-gray-950">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-[#008000]/10 to-[#008000]/5 border border-[#008000]/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5 shadow-md">
              <div className="flex-shrink-0 w-16 h-16 bg-[#008000]/20 rounded-full flex items-center justify-center text-3xl">
                🏆
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs font-bold text-[#008000] uppercase tracking-widest mb-1">
                  Conductor del Mes — Más Referidos
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {referralWinner.full_name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {referralWinner.referral_count} pasajero
                  {referralWinner.referral_count !== 1 ? "s" : ""} registrado
                  {referralWinner.referral_count !== 1 ? "s" : ""} con su enlace
                  {referralWinner.municipality &&
                    ` · ${referralWinner.municipality.charAt(0).toUpperCase() + referralWinner.municipality.slice(1).replace("_", " ")}`}
                </p>
                <p className="text-xs text-[#008000] font-semibold mt-2">
                  Premio: mes de suscripción gratuito
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-block bg-[#008000] text-white text-xs font-bold px-4 py-2 rounded-full shadow">
                  Mes gratis ganado
                </span>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
              Cada conductor tiene un enlace de referido en su perfil. El que
              más pasajeros inscriba durante el mes gana el siguiente mes
              gratis.
            </p>
          </div>
        </section>
      )}

      {/* Municipios Section */}
      <section
        id="municipios-section"
        className="py-20 bg-white dark:bg-gray-950"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Zonas de cobertura
            </h2>
            <p className="text-xl text-black dark:text-gray-200 max-w-2xl mx-auto">
              Iniciamos en el Valle de Sibundoy, pero MoTaxi funciona desde
              cualquier lugar donde haya conductores registrados cerca de ti
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {MUNICIPALITIES.map((municipality) => (
              <div
                key={municipality.id}
                className={`rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-t-4 border-[#008000] relative overflow-hidden flex flex-col ${
                  municipality.id === "santiago"
                    ? ""
                    : "bg-white dark:bg-gray-900"
                }`}
                style={
                  municipality.id === "santiago"
                    ? {
                        backgroundImage:
                          "url(https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/municipios/santiago_1.jpeg)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {municipality.id === "santiago" && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/70" />
                )}
                <div className="relative z-10 p-8 flex-1">
                  {/* Chip circular con inicial — patrón del Design System */}
                  <div className="w-16 h-16 rounded-full bg-[#008000] flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-md">
                    {municipality.name[0]}
                  </div>
                  <h3 className="text-2xl font-extrabold mb-1 text-gray-900 dark:text-gray-100">
                    {municipality.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {municipality.description}
                  </p>
                </div>
                <div className="relative z-10 px-5 pb-5 flex gap-2">
                  <button
                    onClick={() => router.push(`/municipio/${municipality.id}`)}
                    className="flex-1 py-2 bg-[#42CE1D] text-white text-sm font-semibold rounded-xl hover:bg-[#36b018] transition-colors"
                  >
                    Ingresar
                  </button>
                  <button
                    onClick={() => {
                      if (!user) {
                        router.push("/auth/login");
                        return;
                      }
                      setProposeImageMunicipality(municipality.id);
                      setProposeImageMsg(null);
                      setProposeImageUrl("");
                    }}
                    title="Proponer imagen de fondo"
                    className="p-2 bg-white border border-[#42CE1D] text-[#42CE1D] rounded-xl hover:bg-green-50 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal: proponer imagen de municipio */}
          {proposeImageMunicipality && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                  Proponer imagen para{" "}
                  {
                    MUNICIPALITIES.find(
                      (m) => m.id === proposeImageMunicipality,
                    )?.name
                  }
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  El administrador revisará tu propuesta antes de publicarla.
                </p>
                <form onSubmit={handleProposeImage}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de la imagen
                  </label>
                  <input
                    type="url"
                    value={proposeImageUrl}
                    onChange={(e) => setProposeImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#42CE1D] mb-3"
                  />
                  {proposeImageMsg && (
                    <p
                      className={`text-sm mb-3 font-medium ${proposeImageMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}
                    >
                      {proposeImageMsg.text}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={proposeImageLoading}
                      className="flex-1 py-2 bg-[#42CE1D] text-white font-semibold rounded-xl text-sm hover:bg-[#36b018] transition-colors disabled:opacity-60"
                    >
                      {proposeImageLoading ? "Enviando..." : "Enviar propuesta"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProposeImageMunicipality(null);
                        setProposeImageMsg(null);
                      }}
                      className="flex-1 py-2 border border-gray-300 text-gray-600 dark:text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Lugares más frecuentados — solo si hay datos */}
      {(topPickups.length > 0 || topDropoffs.length > 0) && (
        <section className="py-20 bg-white dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Lugares más frecuentados
              </h2>
              <p className="text-xl text-black dark:text-gray-200 max-w-2xl mx-auto">
                Los destinos y puntos de recogida con más actividad en los
                últimos 30 días
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-10">
              {/* Top recogidas */}
              {topPickups.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#008000]/10 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-[#008000]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      Puntos de recogida
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {topPickups.map((place, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-xl px-5 py-4 hover:bg-green-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-2xl font-bold text-[#008000] w-7 text-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
                            {place.address}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-sm font-semibold text-[#008000] bg-[#008000]/10 px-3 py-1 rounded-full">
                          {place.trip_count}{" "}
                          {place.trip_count === 1 ? "viaje" : "viajes"}
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
                    <div className="w-10 h-10 bg-[#008000]/10 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-[#008000]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                        />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      Destinos populares
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {topDropoffs.map((place, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-xl px-5 py-4 hover:bg-green-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-2xl font-bold text-[#008000] w-7 text-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
                            {place.address}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-sm font-semibold text-[#008000] bg-[#008000]/10 px-3 py-1 rounded-full">
                          {place.trip_count}{" "}
                          {place.trip_count === 1 ? "viaje" : "viajes"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Galería de fotos de conductores */}
      {publicPhotos.length > 0 && (
        <section className="py-20 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Destinos compartidos por conductores
              </h2>
              <p className="text-xl text-black dark:text-gray-200 max-w-2xl mx-auto">
                Fotos reales de los lugares a donde nuestros conductores llevan
                a sus pasajeros
              </p>
            </div>

            {/* Aviso votación anónima */}
            <div className="max-w-2xl mx-auto mb-10 flex items-start gap-3 bg-white dark:bg-gray-900 border border-[#008000]/20 rounded-2xl px-5 py-4 shadow-sm">
              <svg
                className="w-5 h-5 text-[#008000] flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                <strong className="text-gray-800">
                  Vota por tus fotos favoritas de forma anónima
                </strong>{" "}
                — no necesitas crear una cuenta ni iniciar sesión. Dale like a
                las fotos que más te gusten y las mejores subirán
                automáticamente al inicio de la galería.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {publicPhotos.map((photo) => {
                const API_URL =
                  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
                const liked = likedPhotos.has(photo.id);
                const isLiking = likingId === photo.id;
                return (
                  <div
                    key={photo.id}
                    className="rounded-2xl overflow-hidden shadow-md relative group h-56 sm:h-64 cursor-pointer"
                  >
                    <img
                      src={`${API_URL}/images/${photo.image_key}`}
                      alt={photo.caption || `Foto de ${photo.driver_name}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onClick={() => setExpandedPhoto(photo)}
                    />
                    {/* Info siempre visible en la parte inferior */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-3">
                      {photo.caption && (
                        <p className="text-white text-xs font-medium leading-snug line-clamp-2">
                          {photo.caption}
                        </p>
                      )}
                      <p className="text-white/70 text-xs mt-0.5">
                        {photo.driver_name}
                      </p>
                    </div>
                    {/* Botón de like */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikePhoto(photo.id);
                      }}
                      disabled={liked || isLiking}
                      className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold shadow transition-all
                        ${
                          liked
                            ? "bg-red-500 text-white cursor-default"
                            : "bg-white/90 text-gray-700 hover:bg-red-500 hover:text-white"
                        }`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill={liked ? "currentColor" : "none"}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      {photo.likes > 0 && <span>{photo.likes}</span>}
                    </button>
                    {/* Icono expandir */}
                    <button
                      onClick={() => setExpandedPhoto(photo)}
                      className="absolute top-2 left-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Modal para expandir foto */}
            {expandedPhoto &&
              (() => {
                const API_URL =
                  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
                const liked = likedPhotos.has(expandedPhoto.id);
                return (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setExpandedPhoto(null)}
                  >
                    <div
                      className="relative max-w-2xl w-full max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src={`${API_URL}/images/${expandedPhoto.image_key}`}
                        alt={
                          expandedPhoto.caption ||
                          `Foto de ${expandedPhoto.driver_name}`
                        }
                        className="w-full max-h-[75vh] object-contain bg-black"
                      />
                      <div className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          {expandedPhoto.caption && (
                            <p className="text-gray-800 text-sm font-medium truncate">
                              {expandedPhoto.caption}
                            </p>
                          )}
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            {expandedPhoto.driver_name}
                          </p>
                        </div>
                        <button
                          onClick={() => handleLikePhoto(expandedPhoto.id)}
                          disabled={liked || likingId === expandedPhoto.id}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all
                          ${liked ? "bg-red-500 text-white cursor-default" : "bg-gray-100 text-gray-700 hover:bg-red-500 hover:text-white"}`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill={liked ? "currentColor" : "none"}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                          {expandedPhoto.likes > 0
                            ? expandedPhoto.likes
                            : "Me gusta"}
                        </button>
                      </div>
                      <button
                        onClick={() => setExpandedPhoto(null)}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        </section>
      )}

      {/* Beneficios Section */}
      <section className="py-24 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Título */}
          <div className="text-center mb-16">
            <span className="inline-block bg-[#008000]/10 text-[#008000] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              ¿Por qué MoTaxi?
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Beneficios de usar este sistema de transporte
            </h2>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Diseñado para el Valle de Sibundoy. Más rápido, más seguro y más
              conveniente que cualquier alternativa.
            </p>
          </div>

          {/* Dos columnas: Pasajeros y Conductores */}
          <div className="grid lg:grid-cols-2 gap-10">
            {/* Columna Pasajeros */}
            <div
              className="bg-gradient-to-br from-[#f0fdf4] to-white border border-[#008000]/20 rounded-3xl p-8 shadow-sm
             dark:bg-none dark:bg-gray-900 dark:border-[#42CE1D]/20"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-[#008000] rounded-2xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">🧍</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Para pasajeros
                </h3>
              </div>
              <ul className="space-y-5">
                {[
                  {
                    icon: "🏍️",
                    title: "Mototaxi",
                    desc: "Transporte rápido y económico en moto para enviar tus encomiendas. No se puede llevar pasajeros",
                  },
                  {
                    icon: "🛺",
                    title: "Piayo",
                    desc: "Vehículo ideal para recorridos con carga.",
                  },
                  {
                    icon: "📦",
                    title: "Envío de paquetes en moto",
                    desc: "Envía objetos o encomiendas sin moverte de tu lugar. El conductor los entrega por ti.",
                  },
                  {
                    icon: "🚐",
                    title: "Van / Carro",
                    desc: "Para grupos o equipaje grande. Más espacio y comodidad cuando lo necesites.",
                  },
                  // {
                  //   icon: "🚕",
                  //   title: "Taxi Cootransvalle",
                  //   desc: "Próximamente disponible, pendiente confirmación de la gerencia de Cootransvalle.",
                  // },
                  {
                    icon: "📍",
                    title: "Seguimiento en tiempo real",
                    desc: "Observa en el mapa la ubicación de tu conductor desde que acepta hasta que llega.",
                  },
                  {
                    icon: "💰",
                    title: "Tarifas transparentes",
                    desc: "Conoce el precio estimado antes de confirmar el viaje. Sin sorpresas al llegar.",
                  },
                  // {
                  //   icon: "⭐",
                  //   title: "Conductores verificados",
                  //   desc: "Cada conductor pasa por un proceso de verificación antes de poder operar en la plataforma.",
                  // },
                  {
                    icon: "❤️",
                    title: "Guarda tus favoritos",
                    desc: "Agrega conductores de confianza a tus favoritos y contáctalos fácilmente para futuros viajes.",
                  },
                ].map((b) => (
                  <li key={b.title} className="flex items-start gap-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5">
                      {b.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {b.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {b.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Columna Conductores */}
            <div className="bg-gradient-to-br from-[#f0fdf4] to-white border border-[#008000]/20 rounded-3xl p-8 shadow-sm dark:bg-none dark:bg-gray-900 dark:border-[#42CE1D]/20">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-[#008000] rounded-2xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">🏍️</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Para conductores
                </h3>
              </div>
              <ul className="space-y-5">
                {[
                  {
                    icon: "📲",
                    title: "Más visibilidad, más clientes",
                    desc: "Tu perfil está disponible para todos los pasajeros del Valle de Sibundoy durante tu horario activo.",
                  },
                  {
                    icon: "🗺️",
                    title: "Solicitudes cerca de ti",
                    desc: "Solo recibes solicitudes de pasajeros que están dentro de tu zona de operación.",
                  },
                  {
                    icon: "💵",
                    title: "Tú fijas tu tarifa",
                    desc: "Define tus propias tarifas base, por kilómetro y para rutas intermunicipales o rurales.",
                  },
                  {
                    icon: "📊",
                    title: "Registro de ganancias",
                    desc: "Lleva un historial detallado de todos tus viajes y el dinero que has generado en la plataforma.",
                  },
                  {
                    icon: "🔔",
                    title: "Notificaciones instantáneas",
                    desc: "Recibe alertas en tiempo real cuando un pasajero solicite un viaje cercano a tu ubicación.",
                  },
                  {
                    icon: "📋",
                    title: "Suscripción con tarifas claras",
                    desc: "El acceso a la plataforma tiene un costo definido por la gerencia, con condiciones justas y transparentes.",
                  },
                ].map((b) => (
                  <li key={b.title} className="flex items-start gap-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5">
                      {b.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {b.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {b.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stat bar */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "4", label: "Tipos de vehículo disponibles" },
              { value: "4", label: "Municipios cubiertos" },
              { value: "5★", label: "Sistema de calificaciones" },
              { value: "GPS", label: "Seguimiento en tiempo real" },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center bg-[#008000]/5 rounded-2xl py-6 px-4"
              >
                <p className="text-3xl font-extrabold text-[#008000]">
                  {s.value}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Aviso método de pago */}
      <section className="py-14 bg-white dark:bg-gray-950">
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
              <h3 className="text-xl font-bold text-black dark:text-gray-200 mb-2">
                Aviso sobre métodos de pago
              </h3>
              <p className="text-black dark:text-gray-200 leading-relaxed">
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

      {/* FAQ Section */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Preguntas frecuentes
            </h2>
            <p className="text-xl text-black dark:text-gray-200 max-w-2xl mx-auto">
              Resolvemos las dudas más comunes sobre MoTaxi
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "¿Cómo solicito un viaje?",
                a: "Inicia sesión como pasajero, comparte tu ubicación y elige tu destino. Verás los conductores disponibles cerca de ti y podrás seguir tu viaje en tiempo real desde el mapa.",
              },
              {
                q: "¿Cómo pago mi viaje?",
                a: "El método de pago lo acuerdas directamente con el conductor (efectivo, transferencia u otro medio). MoTaxi pronto implementará el método de pago a través de Nequi.",
              },
              {
                q: "¿Qué necesito para ser conductor?",
                a: "Regístrate como conductor con tus datos reales. Si tu vehículo es taxi o aerovan (estos hacen viajes fuera y dentro del Alto Putumayo), debes contar con placa, número de licencia y seguro vigente (SOAT).",
              },
              {
                q: "¿En qué zonas está disponible MoTaxi?",
                a: "MoTaxi opera en los municipios del Valle de Sibundoy, Putumayo. La cobertura se amplía a medida que más conductores se unen a la plataforma.",
              },
            ].map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {item.q}
                    </span>
                    <svg
                      className={`w-5 h-5 text-[#008000] flex-shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-black dark:text-gray-200 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {/* Aviso de seguridad obligatoria */}
      <section className="py-10 bg-amber-50 dark:bg-amber-950/30 border-y border-amber-200 dark:border-amber-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-300 text-base mb-1">
                Requisito obligatorio de seguridad
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-200/80 leading-relaxed">
                Todo vehículo registrado en MoTaxi{" "}
                <strong>debe contar con seguro vigente (SOAT)</strong>. Este es
                un requisito legal en Colombia y una garantía de protección para
                conductores y pasajeros. Los conductores sin seguro no podrán
                activarse en la plataforma. Además, placa y número de licencia
                deben ser datos reales y verificables — cualquier información
                falsa resultará en la suspensión inmediata de la cuenta.
              </p>
            </div>
          </div>
        </div>
      </section>

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
                className="px-8 py-4 bg-white text-zinc-900 font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
              >
                Registrarse como Pasajero
              </button>
              <button
                onClick={() => router.push("/auth/role-selection")}
                className="px-8 py-4 bg-white text-zinc-900 font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transform transition-all duration-200"
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

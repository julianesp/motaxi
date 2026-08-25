"use client";

import { useEffect, useRef, useState } from "react";

interface RegisteredDriver {
  id: string;
  full_name: string;
  profile_image?: string | null;
  municipality?: string | null;
  vehicle_types?: string | null;
}

interface DriverDetail {
  id: string;
  full_name: string;
  profile_image?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  vehicle_plate?: string | null;
  vehicle_types?: string | null;
  rating?: number | null;
  total_trips?: number | null;
  municipality?: string | null;
  whatsapp?: string | null;
}

interface VehiclePhoto {
  id: string;
  image_key: string;
  caption: string | null;
}

// Formatea el slug del municipio ("san_francisco" → "San Francisco")
function formatMunicipality(m?: string | null): string {
  if (!m) return "Alto Putumayo";
  return m
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// Nombre y apellido (máx. 2 palabras) y solo iniciales para el avatar
function nameAndSurname(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ") || full;
}
function initials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

// Etiqueta y emoji del tipo de vehículo que maneja el conductor
function vehicleLabel(t?: string | null): { emoji: string; text: string } {
  switch (t) {
    case "taxi":
      return { emoji: "🚕", text: "Taxi" };
    case "carro":
    case "particular":
      return { emoji: "🚗", text: "Carro" };
    case "piaggio":
      return { emoji: "🛺", text: "Piaggio" };
    case "moto":
    default:
      return { emoji: "🏍️", text: "Moto" };
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

// Ancho de cada tarjeta de conductor (px), incluye separación
const ITEM_WIDTH = 140;
const SPEED = 40; // px por segundo hacia la izquierda

export default function RegisteredDriversBubbles() {
  const [drivers, setDrivers] = useState<RegisteredDriver[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  // Modal de detalle del conductor
  const [detail, setDetail] = useState<DriverDetail | null>(null);
  const [vehiclePhotos, setVehiclePhotos] = useState<VehiclePhoto[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Cargar conductores registrados ──────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/drivers/registered`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.drivers?.length) setDrivers(data.drivers);
      })
      .catch(() => {});
  }, []);

  // ── Abrir modal: trae el detalle completo del conductor ─────────
  const openDriver = (driver: RegisteredDriver) => {
    // Mostramos de inmediato lo que ya tenemos, y ampliamos con el fetch
    setDetail({
      id: driver.id,
      full_name: driver.full_name,
      profile_image: driver.profile_image,
      municipality: driver.municipality,
      vehicle_types: driver.vehicle_types,
    });
    setVehiclePhotos([]);
    setLoadingDetail(true);
    fetch(`${API_URL}/drivers/${driver.id}/public`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.driver) setDetail(data.driver);
        if (data?.vehicle_photos) setVehiclePhotos(data.vehicle_photos);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  };

  const closeDriver = () => {
    setDetail(null);
    setVehiclePhotos([]);
  };

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDriver();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  // ── Desplazamiento continuo hacia la izquierda (marquee infinito) ──
  useEffect(() => {
    if (!drivers.length) return;

    // Ancho de una "vuelta" completa (una copia de la lista)
    const loopWidth = drivers.length * ITEM_WIDTH;

    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (!pausedRef.current) {
        offsetRef.current += SPEED * dt;
        // Cuando avanzó una lista completa, resetea sin salto visible
        if (offsetRef.current >= loopWidth) {
          offsetRef.current -= loopWidth;
        }
      }

      const track = trackRef.current;
      if (track) {
        track.style.transform = `translateX(${-offsetRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [drivers]);

  if (!drivers.length) return null;

  // Duplicamos la lista para que el loop sea continuo (al salir uno por la
  // izquierda, la segunda copia ya lo trae de nuevo por la derecha)
  const loopDrivers = [...drivers, ...drivers];

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl lg:text-4xl font-bold text-white">
          Conductores registrados
        </h2>
        <p className="mt-2 text-white/70 max-w-xl mx-auto">
          Estos son los mototaxistas verificados que operan en el Valle de
          Sibundoy
        </p>
      </div>

      {/* Carril con máscara: se desvanece en los bordes izq/der */}
      <div
        className="relative w-full overflow-hidden py-4"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ width: "max-content" }}
        >
          {loopDrivers.map((driver, i) => (
            <button
              key={`${driver.id}-${i}`}
              type="button"
              onClick={() => openDriver(driver)}
              className="flex flex-col items-center flex-shrink-0 px-2 cursor-pointer group focus:outline-none"
              style={{ width: ITEM_WIDTH }}
              title={`Ver información de ${driver.full_name.trim()}`}
            >
              <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#42CE1D]/80 shadow-lg bg-[#008000] flex items-center justify-center select-none transition-transform duration-200 group-hover:scale-110 group-hover:ring-[#42CE1D]">
                {driver.profile_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={driver.profile_image}
                    alt={driver.full_name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="text-white font-bold text-xl">
                    {initials(driver.full_name)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-tight font-semibold text-white text-center max-w-[132px] truncate w-full">
                {nameAndSurname(driver.full_name)}
              </p>
              <p className="flex items-center justify-center gap-0.5 text-[10px] text-[#42CE1D] font-medium">
                <svg
                  className="w-2.5 h-2.5 flex-shrink-0"
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
                {formatMunicipality(driver.municipality)}
              </p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-white/70 font-medium">
                <span>{vehicleLabel(driver.vehicle_types).emoji}</span>
                {vehicleLabel(driver.vehicle_types).text}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Modal de detalle del conductor */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeDriver}
        >
          <div
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón de cierre */}
            <button
              type="button"
              onClick={closeDriver}
              aria-label="Cerrar"
              className="absolute top-3 right-3 z-10 w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
            >
              <svg
                className="w-5 h-5 text-white"
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

            {/* Encabezado: foto + nombre */}
            <div className="bg-gradient-to-br from-[#008000] to-[#42CE1D] px-6 pt-8 pb-6 flex flex-col items-center text-center rounded-t-2xl">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/40 shadow-lg bg-[#006000] flex items-center justify-center">
                {detail.profile_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail.profile_image}
                    alt={detail.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-3xl">
                    {initials(detail.full_name)}
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-xl font-bold text-white">
                {detail.full_name.trim()}
              </h3>
              <p className="flex items-center gap-1 text-sm text-white/90 mt-1">
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
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {formatMunicipality(detail.municipality)}
              </p>
            </div>

            {/* Cuerpo: datos */}
            <div className="px-6 py-5 space-y-4">
              {/* Métricas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Calificación
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {detail.rating != null ? `⭐ ${detail.rating.toFixed(1)}` : "Nuevo"}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Viajes
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {detail.total_trips ?? 0}
                  </p>
                </div>
              </div>

              {/* Vehículo */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Vehículo
                </p>
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                  <span className="text-2xl">
                    {vehicleLabel(detail.vehicle_types).emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {vehicleLabel(detail.vehicle_types).text}
                      {detail.vehicle_model ? ` · ${detail.vehicle_model}` : ""}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {[detail.vehicle_color, detail.vehicle_plate]
                        .filter(Boolean)
                        .join(" · ") || "Sin detalles"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fotos del vehículo */}
              {vehiclePhotos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Fotos del vehículo
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {vehiclePhotos.slice(0, 6).map((ph) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={ph.id}
                        src={`${API_URL}/images/${ph.image_key}`}
                        alt={ph.caption || "Foto del vehículo"}
                        className="w-full h-20 object-cover rounded-lg"
                        loading="lazy"
                      />
                    ))}
                  </div>
                </div>
              )}

              {loadingDetail && (
                <p className="text-center text-xs text-gray-400">
                  Cargando detalles…
                </p>
              )}

              {/* Botón cerrar inferior */}
              <button
                type="button"
                onClick={closeDriver}
                className="w-full py-2.5 mt-2 bg-[#42CE1D] hover:bg-[#36b018] text-white font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

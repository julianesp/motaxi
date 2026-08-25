"use client";

import { useEffect, useRef, useState } from "react";

interface RegisteredDriver {
  id: string;
  full_name: string;
  profile_image?: string | null;
  municipality?: string | null;
  vehicle_types?: string | null;
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

  // ── Cargar conductores registrados ──────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/drivers/registered`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.drivers?.length) setDrivers(data.drivers);
      })
      .catch(() => {});
  }, []);

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
            <div
              key={`${driver.id}-${i}`}
              className="flex flex-col items-center flex-shrink-0 px-2"
              style={{ width: ITEM_WIDTH }}
            >
              <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#42CE1D]/80 shadow-lg bg-[#008000] flex items-center justify-center select-none">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

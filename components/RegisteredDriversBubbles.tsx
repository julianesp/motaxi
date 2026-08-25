"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

// Primer nombre + inicial del apellido, y solo iniciales para el avatar
function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}
function initials(full: string): string {
  const parts = full.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

interface Bubble {
  driver: RegisteredDriver;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

export default function RegisteredDriversBubbles() {
  const [drivers, setDrivers] = useState<RegisteredDriver[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const nodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Modal rotativo de ubicación
  const [modalIndex, setModalIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  // ── Cargar conductores registrados ──────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/drivers/registered`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.drivers?.length) setDrivers(data.drivers);
      })
      .catch(() => {});
  }, []);

  // ── Física de burbujas ──────────────────────────────────────────
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
  }, []);

  useEffect(() => {
    if (!drivers.length) return;
    measure();
    const { w, h } = sizeRef.current;
    if (!w || !h) return;

    // Radio de burbuja según cantidad — más conductores, burbujas más pequeñas
    const r = drivers.length > 18 ? 26 : drivers.length > 10 ? 32 : 38;

    bubblesRef.current = drivers.map((driver, i) => {
      const angle = (i / drivers.length) * Math.PI * 2;
      return {
        driver,
        x: r + Math.random() * (w - 2 * r),
        y: r + Math.random() * (h - 2 * r),
        vx: Math.cos(angle) * (0.35 + Math.random() * 0.35),
        vy: Math.sin(angle) * (0.35 + Math.random() * 0.35),
        r,
      };
    });

    const step = () => {
      const { w, h } = sizeRef.current;
      const bubbles = bubblesRef.current;

      // Mover + rebotar contra paredes
      for (const b of bubbles) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x - b.r < 0) {
          b.x = b.r;
          b.vx = Math.abs(b.vx);
        } else if (b.x + b.r > w) {
          b.x = w - b.r;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y - b.r < 0) {
          b.y = b.r;
          b.vy = Math.abs(b.vy);
        } else if (b.y + b.r > h) {
          b.y = h - b.r;
          b.vy = -Math.abs(b.vy);
        }
      }

      // Colisiones entre burbujas — rebote elástico (masa igual)
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i];
          const c = bubbles[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const minDist = a.r + c.r;
          if (dist < minDist) {
            // Separar para que no se solapen
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            c.x += nx * overlap;
            c.y += ny * overlap;
            // Intercambiar componente de velocidad sobre el eje de colisión
            const va = a.vx * nx + a.vy * ny;
            const vc = c.vx * nx + c.vy * ny;
            const diff = vc - va;
            a.vx += diff * nx;
            a.vy += diff * ny;
            c.vx -= diff * nx;
            c.vy -= diff * ny;
          }
        }
      }

      // Pintar posiciones en el DOM
      for (const b of bubbles) {
        const node = nodesRef.current.get(b.driver.id);
        if (node) {
          node.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [drivers, measure]);

  // ── Modal rotativo cada 2s (uno se cierra mientras el siguiente entra) ──
  useEffect(() => {
    if (!drivers.length) return;
    let active = true;

    // Aparecer el primero
    const showTimeout = setTimeout(() => active && setModalVisible(true), 400);

    const interval = setInterval(() => {
      if (!active) return;
      // Cerrar el actual
      setModalVisible(false);
      // Mientras se cierra (250ms), preparar el siguiente y abrirlo
      setTimeout(() => {
        if (!active) return;
        setModalIndex((i) => (i + 1) % drivers.length);
        setModalVisible(true);
      }, 260);
    }, 2000);

    return () => {
      active = false;
      clearTimeout(showTimeout);
      clearInterval(interval);
    };
  }, [drivers]);

  if (!drivers.length) return null;

  const modalDriver = drivers[modalIndex % drivers.length];

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <h2 className="text-3xl lg:text-4xl font-bold text-white">
          Conductores registrados
        </h2>
        <p className="mt-2 text-white/70 max-w-xl mx-auto">
          Estos son algunos de los mototaxistas verificados que operan en el
          Valle de Sibundoy
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-3xl h-[360px] rounded-3xl overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm"
      >
        {/* Burbujas */}
        {drivers.map((driver) => (
          <div
            key={driver.id}
            ref={(el) => {
              if (el) nodesRef.current.set(driver.id, el);
              else nodesRef.current.delete(driver.id);
            }}
            className="absolute top-0 left-0 will-change-transform"
            style={{ transform: "translate(-100px, -100px)" }}
          >
            <div
              className="rounded-full overflow-hidden ring-2 ring-[#42CE1D]/80 shadow-lg bg-[#008000] flex items-center justify-center select-none"
              style={{
                width:
                  drivers.length > 18 ? 52 : drivers.length > 10 ? 64 : 76,
                height:
                  drivers.length > 18 ? 52 : drivers.length > 10 ? 64 : 76,
              }}
              title={driver.full_name}
            >
              {driver.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={driver.profile_image}
                  alt={driver.full_name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <span className="text-white font-bold text-lg">
                  {initials(driver.full_name)}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Modal rotativo de ubicación — un solo conductor a la vez */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-300 ease-out"
          style={{
            opacity: modalVisible ? 1 : 0,
            transform: `translateX(-50%) translateY(${modalVisible ? "0" : "-12px"}) scale(${modalVisible ? 1 : 0.92})`,
          }}
        >
          <div className="flex items-center gap-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl px-4 py-2.5 border border-[#42CE1D]/40">
            <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-[#008000] flex items-center justify-center ring-2 ring-[#42CE1D]">
              {modalDriver?.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modalDriver.profile_image}
                  alt={modalDriver.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-sm">
                  {modalDriver ? initials(modalDriver.full_name) : ""}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight truncate max-w-[160px]">
                {modalDriver ? firstName(modalDriver.full_name) : ""}
              </p>
              <p className="flex items-center gap-1 text-xs text-[#008000] font-semibold">
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
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
                {formatMunicipality(modalDriver?.municipality)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

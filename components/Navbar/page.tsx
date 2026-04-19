"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import styles from "./Navbar.module.scss";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const isHomePage = pathname === "/";
  const logoRef = useRef<HTMLImageElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smokeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const smokeParticlesRef = useRef<HTMLElement[]>([]);

  const spawnSmokeParticle = (x: number, y: number) => {
    const el = document.createElement("div");
    el.className = styles.smokeParticle;
    const size = 10 + Math.random() * 16;
    const dx = -(12 + Math.random() * 20); // humo va hacia atrás (izquierda)
    const dur = 0.7 + Math.random() * 0.5;
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
      --smoke-dx: ${dx}px;
      --smoke-dur: ${dur}s;
    `;
    document.body.appendChild(el);
    smokeParticlesRef.current.push(el);
    setTimeout(
      () => {
        el.remove();
        smokeParticlesRef.current = smokeParticlesRef.current.filter(
          (p) => p !== el,
        );
      },
      dur * 1000 + 50,
    );
  };

  const startSmoke = () => {
    const el = logoRef.current;
    if (!el) return;
    smokeIntervalRef.current = setInterval(() => {
      const rect = el.getBoundingClientRect();
      // El humo sale por la parte trasera (izquierda) del logo
      const x = rect.left + 4;
      const y = rect.top + rect.height / 2 + 6;
      spawnSmokeParticle(x, y);
    }, 80);
  };

  const stopSmoke = () => {
    if (smokeIntervalRef.current) {
      clearInterval(smokeIntervalRef.current);
      smokeIntervalRef.current = null;
    }
  };

  const handleLogoMouseEnter = () => {
    const el = logoRef.current;
    if (!el) return;

    // Calcular cuánto debe viajar: centro del viewport menos posición actual del logo
    const rect = el.getBoundingClientRect();
    const travel = Math.round(
      window.innerWidth / 2 - rect.left - rect.width / 2,
    );
    el.style.setProperty("--logo-travel", `${travel}px`);

    // Fase 1: inclinarse 45°
    el.classList.remove(
      styles.logoMotoReturn,
      styles.logoMotoGo,
      styles.logoMotoBounce,
    );
    void el.offsetWidth;
    el.classList.add(styles.logoMotoTilt);

    // Fase 2: arrancar hasta el centro
    bounceTimeoutRef.current = setTimeout(() => {
      el.classList.remove(styles.logoMotoTilt);
      void el.offsetWidth;
      el.classList.add(styles.logoMotoGo);

      // Fase 3: saltar en el centro + humo
      bounceTimeoutRef.current = setTimeout(() => {
        el.classList.remove(styles.logoMotoGo);
        void el.offsetWidth;
        el.classList.add(styles.logoMotoBounce);
        startSmoke();
      }, 410);
    }, 210);
  };

  const handleLogoMouseLeave = () => {
    const el = logoRef.current;
    if (!el) return;

    if (bounceTimeoutRef.current) {
      clearTimeout(bounceTimeoutRef.current);
      bounceTimeoutRef.current = null;
    }

    stopSmoke();

    el.classList.remove(styles.logoMotoGo, styles.logoMotoBounce);
    void el.offsetWidth;
    el.classList.add(styles.logoMotoReturn);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 backdrop-blur-sm z-50 ${isHomePage ? "bg-transparent" : "bg-white shadow-md"} border rounded-e-lg ${styles.navbar}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onMouseEnter={handleLogoMouseEnter}
                  onMouseLeave={handleLogoMouseLeave}
                >
                  <Image
                    ref={logoRef}
                    src="https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png"
                    alt="MoTaxi logo"
                    width={46}
                    height={46}
                    className="rounded-full border-[1px] border-[#008000] shadow-lg bg-white"
                  />
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="text-white px-3 py-2 rounded-md text-lg font-bold transition-all duration-200 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_80%),_-1px_-1px_2px_rgb(0_0_0_/_80%),_1px_-1px_2px_rgb(0_0_0_/_80%),_-1px_1px_2px_rgb(0_0_0_/_80%)] hover:scale-105"
                >
                  MoTaxi
                </button>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-6">
              {user ? (
                // Usuario autenticado
                <>
                  <span
                    className={`${isHomePage ? "text-white" : "text-gray-700"}`}
                  >
                    Hola,{" "}
                    <span className="font-semibold">{user.full_name}</span>
                  </span>
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
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isHomePage
                        ? "bg-white bg-opacity-20 text-white hover:bg-opacity-30 backdrop-blur-sm"
                        : "bg-green-100 text-[#008000] hover:bg-green-200"
                    }`}
                  >
                    {user.email === "admin@neurai.dev"
                      ? "Panel Admin"
                      : "Mi cuenta"}
                  </button>
                  <button
                    onClick={handleLogout}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isHomePage
                        ? "bg-white bg-opacity-20 text-white hover:bg-opacity-30 backdrop-blur-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                // Usuario no autenticado
                <>
                  {!isHomePage && (
                    <button
                      onClick={() => router.push("/")}
                      className="text-gray-700 hover:text-[#008000] font-medium transition-colors"
                    >
                      Inicio
                    </button>
                  )}
                  <button
                    onClick={() => router.push("/auth/login")}
                    className="text-white  px-3 py-2 rounded-md text-lg font-bold transition-all duration-200 border border-white [text-shadow:_1px_1px_2px_rgb(0_0_0_/_90%),_-1px_-1px_2px_rgb(0_0_0_/_80%),_1px_-1px_2px_rgb(0_0_0_/_80%),_-1px_1px_2px_rgb(0_0_0_/_80%)] hover:scale-110"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={() => router.push("/auth/register")}
                    className={`px-4 py-2 rounded-lg font-medium shadow-lg transition-all hover:scale-105 ${
                      isHomePage
                        ? "bg-white text-[#008000] hover:shadow-xl"
                        : "bg-[#008000] text-white hover:bg-[#006600]"
                    }`}
                  >
                    Registrarse
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`p-2 rounded-lg ${
                  isHomePage ? "text-white" : "text-gray-700"
                } hover:bg-opacity-20 hover:bg-gray-500 transition-colors`}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {mobileMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - portal al body para cubrir todo el viewport */}
      {mounted &&
        mobileMenuOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false);
            }}
          >
            {/* Botón cerrar */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className={`absolute top-4 right-4 p-2 rounded-full ${
                isHomePage
                  ? "text-white hover:bg-white/10"
                  : "text-gray-700 hover:bg-gray-100"
              } transition-colors`}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-full max-w-xs px-6 flex flex-col items-center gap-4">
              {user ? (
                <>
                  <p
                    className={`text-sm mb-1 ${isHomePage ? "text-green-300" : "text-gray-500"}`}
                  >
                    Hola, <span className="font-bold">{user.full_name}</span>
                  </p>
                  <button
                    onClick={() => {
                      router.push(
                        user.email === "admin@neurai.dev"
                          ? "/admin"
                          : user.role === "passenger"
                            ? "/passenger"
                            : "/driver",
                      );
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center px-4 py-3 rounded-xl font-semibold transition-all bg-[#008000] text-white hover:bg-[#006600] shadow-md"
                  >
                    {user.email === "admin@neurai.dev"
                      ? "Panel Admin"
                      : "Mi cuenta"}
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-center px-4 py-3 rounded-xl font-semibold transition-all ${
                      isHomePage
                        ? "border border-white/40 text-white hover:bg-white/10"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  {!isHomePage && (
                    <button
                      onClick={() => {
                        router.push("/");
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-center px-4 py-3 rounded-xl font-semibold shadow-md transition-all bg-[#008000] text-white hover:bg-[#006600]"
                    >
                      Inicio
                    </button>
                  )}
                  <button
                    onClick={() => {
                      router.push("/auth/login");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center px-4 py-3 rounded-xl font-semibold transition-all hover:bg-gray-100"
                    style={{ backgroundColor: "#ffffff", color: "#000000" }}
                  >
                    Iniciar sesión
                  </button>

                  <button
                    onClick={() => {
                      router.push("/auth/register");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center px-4 py-3 rounded-xl font-semibold shadow-md transition-all bg-[#008000] text-white hover:bg-[#006600]"
                  >
                    Registrarse
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

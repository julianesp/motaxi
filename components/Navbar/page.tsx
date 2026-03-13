"use client";

import { useState, useRef } from "react";
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

  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoMouseEnter = () => {
    const el = logoRef.current;
    if (!el) return;

    // Calcular cuánto debe viajar: centro del viewport menos posición actual del logo
    const rect = el.getBoundingClientRect();
    const travel = Math.round(window.innerWidth / 2 - rect.left - rect.width / 2);
    el.style.setProperty("--logo-travel", `${travel}px`);

    // Fase 1: inclinarse 45°
    el.classList.remove(styles.logoMotoReturn, styles.logoMotoGo, styles.logoMotoBounce);
    void el.offsetWidth;
    el.classList.add(styles.logoMotoTilt);

    // Fase 2: arrancar hasta el centro
    bounceTimeoutRef.current = setTimeout(() => {
      el.classList.remove(styles.logoMotoTilt);
      void el.offsetWidth;
      el.classList.add(styles.logoMotoGo);

      // Fase 3: saltar en el centro
      bounceTimeoutRef.current = setTimeout(() => {
        el.classList.remove(styles.logoMotoGo);
        void el.offsetWidth;
        el.classList.add(styles.logoMotoBounce);
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

    el.classList.remove(styles.logoMotoGo, styles.logoMotoBounce);
    void el.offsetWidth;
    el.classList.add(styles.logoMotoReturn);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 backdrop-blur-sm z-50 ${isHomePage ? "bg-transparent" : "bg-white shadow-md"} border rounded-e-lg ${styles.navbar}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2"
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
              <span className="text-white  px-3 py-2 rounded-md text-lg font-bold transition-all duration-200 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_80%),_-1px_-1px_2px_rgb(0_0_0_/_80%),_1px_-1px_2px_rgb(0_0_0_/_80%),_-1px_1px_2px_rgb(0_0_0_/_80%)] hover:scale-105 ">
                MoTaxi
              </span>
            </button>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              // Usuario autenticado
              <>
                <span
                  className={`${isHomePage ? "text-white" : "text-gray-700"}`}
                >
                  Hola, <span className="font-semibold">{user.full_name}</span>
                </span>
                <button
                  onClick={() =>
                    router.push(
                      user.role === "passenger" ? "/passenger" : "/driver",
                    )
                  }
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? "bg-white bg-opacity-20 text-white hover:bg-opacity-30 backdrop-blur-sm"
                      : "bg-green-100 text-[#008000] hover:bg-green-200"
                  }`}
                >
                  Mi Dashboard
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
                  className="text-white  px-3 py-2 rounded-md text-lg font-bold transition-all duration-200 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_90%),_-1px_-1px_2px_rgb(0_0_0_/_80%),_1px_-1px_2px_rgb(0_0_0_/_80%),_-1px_1px_2px_rgb(0_0_0_/_80%)] hover:scale-110"
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

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden ${
            isHomePage
              ? "bg-[#008000] bg-opacity-95 backdrop-blur-md"
              : "bg-white border-t"
          }`}
        >
          <div className="px-4 pt-2 pb-4 space-y-3">
            {user ? (
              // Usuario autenticado - Mobile
              <>
                <div
                  className={`px-3 py-2 ${isHomePage ? "text-white" : "text-gray-700"}`}
                >
                  Hola, <span className="font-semibold">{user.full_name}</span>
                </div>
                <button
                  onClick={() => {
                    router.push(
                      user.role === "passenger" ? "/passenger" : "/driver",
                    );
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? "bg-white bg-opacity-20 text-white hover:bg-opacity-30"
                      : "bg-green-100 text-[#008000] hover:bg-green-200"
                  }`}
                >
                  Mi Dashboard
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                    isHomePage
                      ? "bg-white bg-opacity-20 text-white hover:bg-opacity-30"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              // Usuario no autenticado - Mobile
              <>
                {!isHomePage && (
                  <button
                    onClick={() => {
                      router.push("/");
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                  >
                    Inicio
                  </button>
                )}
                <button
                  onClick={() => {
                    router.push("/auth/login");
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left text-white hover:text-green-400 px-3 py-2 rounded-md text-sm font-bold transition-all duration-200 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_80%),_-1px_-1px_2px_rgb(0_0_0_/_80%),_1px_-1px_2px_rgb(0_0_0_/_80%),_-1px_1px_2px_rgb(0_0_0_/_80%)] hover:scale-105"
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => {
                    router.push("/auth/register");
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium shadow-lg transition-all ${
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
        </div>
      )}
    </nav>
  );
}

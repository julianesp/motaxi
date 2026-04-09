"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@/lib/types";
import Navbar from "@/components/Navbar/page";

export default function RoleSelectionPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      router.push(`/auth/register?role=${selectedRole}`);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#000000", backgroundImage: "linear-gradient(to top, #008000, #000000)" }}
    >
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-md bg-white bg-opacity-95 rounded-2xl shadow-2xl p-6 space-y-5">

          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[#008000]">MoTaxi</h1>
            <h2 className="text-lg font-semibold text-gray-800 mt-1">¿Cómo quieres usar MoTaxi?</h2>
          </div>

          {/* Role Cards — horizontal compacto */}
          <div className="grid grid-cols-2 gap-3">
            {/* Pasajero */}
            <button
              onClick={() => setSelectedRole("passenger")}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                selectedRole === "passenger"
                  ? "border-[#42CE1D] bg-green-50 shadow-md"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-base font-bold text-gray-800">Pasajero</span>
              <ul className="text-xs text-gray-500 space-y-1 text-left w-full">
                <li className="flex items-center gap-1"><span className="text-[#42CE1D]">✓</span> Solicita viajes</li>
                <li className="flex items-center gap-1"><span className="text-[#42CE1D]">✓</span> Conductores verificados</li>
                <li className="flex items-center gap-1"><span className="text-[#42CE1D]">✓</span> Día y noche</li>
              </ul>
              {selectedRole === "passenger" && (
                <span className="text-xs font-semibold text-[#42CE1D]">Seleccionado ✓</span>
              )}
            </button>

            {/* Conductor */}
            <button
              onClick={() => setSelectedRole("driver")}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                selectedRole === "driver"
                  ? "border-[#42CE1D] bg-green-50 shadow-md"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-base font-bold text-gray-800">Conductor</span>
              <ul className="text-xs text-gray-500 space-y-1 text-left w-full">
                <li className="flex items-center gap-1"><span className="text-[#42CE1D]">✓</span> Genera ingresos</li>
                <li className="flex items-center gap-1"><span className="text-[#42CE1D]">✓</span> Horarios flexibles</li>
                <li className="flex items-center gap-1"><span className="text-[#42CE1D]">✓</span> Moto o carro</li>
              </ul>
              {selectedRole === "driver" && (
                <span className="text-xs font-semibold text-[#42CE1D]">Seleccionado ✓</span>
              )}
            </button>
          </div>

          {/* Continuar */}
          <button
            onClick={handleContinue}
            disabled={!selectedRole}
            className="w-full py-3 rounded-xl text-white font-semibold text-base transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: selectedRole ? "#42CE1D" : "#9ca3af" }}
          >
            Continuar
          </button>

          {/* Login Link */}
          <p className="text-center text-sm text-gray-600">
            ¿Ya tienes una cuenta?{" "}
            <Link href="/auth/login" className="font-semibold text-[#008000] hover:text-green-500">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

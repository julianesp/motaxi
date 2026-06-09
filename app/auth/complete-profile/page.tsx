"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Role = "passenger" | "driver";

export default function CompleteProfilePage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1); // 1 = rol + teléfono, 2 = tipo de vehículo (solo conductor)
  const [role, setRole] = useState<Role>("passenger");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{10}$/.test(phone.replace(/\s/g, ""))) {
      setError("El número debe tener 10 dígitos");
      return;
    }
    if (role === "driver") {
      setStep(2);
    } else {
      saveProfile();
    }
  };

  const saveProfile = async (vtype?: string) => {
    setLoading(true);
    setError("");
    try {
      const { usersAPI, driversAPI } = await import("@/lib/api-client");

      // 1. Guardar teléfono
      await usersAPI.updateProfile({ phone: phone.replace(/\s/g, "") });

      // 2. Cambiar rol si es conductor
      if (role === "driver") {
        await usersAPI.switchRole("driver");
        // 3. Guardar tipo de vehículo
        if (vtype) {
          await driversAPI.updateProfile({ vehicle_types: vtype as 'moto' | 'taxi' | 'carro' | 'piaggio' | 'particular' });
        }
        router.push("/auth/en-tramite");
      } else {
        router.push("/passenger");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error al guardar. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const handleStep2 = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!vehicleType) {
      setError("Selecciona el tipo de vehículo");
      return;
    }
    saveProfile(vehicleType);
  };

  const vehicleOptions = [
    { value: "moto", label: "Moto", emoji: "🏍️" },
    { value: "piaggio", label: "Piaggio", emoji: "🛺" },
    // TAXI OCULTO: pendiente confirmación de Cootransvalle
    // { value: "taxi", label: "Taxi", emoji: "🚕" },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#000000", backgroundImage: "linear-gradient(to top, #008000, #000000)" }}
    >
      <div className="max-w-sm w-full bg-gray-900 bg-opacity-90 p-8 rounded-2xl shadow-2xl border border-green-500 border-opacity-30">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-400 mb-1">MoTaxi</h1>
          <h2 className="text-xl font-semibold text-white">
            {step === 1 ? "Un último paso" : "Tipo de vehículo"}
          </h2>
          <p className="mt-2 text-gray-400 text-sm">
            {step === 1
              ? "Cuéntanos cómo usarás MoTaxi"
              : "Selecciona el vehículo con el que ofrecerás el servicio"}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-5">
            {/* Rol */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ¿Cómo usarás MoTaxi?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "passenger", label: "Pasajero", emoji: "🧍" },
                  { value: "driver", label: "Conductor", emoji: "🏍️" },
                ] as { value: Role; label: string; emoji: string }[]).map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      role === r.value
                        ? "border-[#008000] bg-[#008000] bg-opacity-20 text-[#008000]"
                        : "border-gray-600 text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <span className="text-xl">{r.emoji}</span>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                Número de celular
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-white text-black text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="3001234567"
                maxLength={10}
                inputMode="numeric"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#008000] text-black font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Guardando..." : role === "driver" ? "Continuar →" : "Ingresar"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {vehicleOptions.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVehicleType(v.value)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    vehicleType === v.value
                      ? "border-[#008000] bg-[#008000] bg-opacity-20 text-[#008000]"
                      : "border-gray-600 text-gray-300 hover:border-gray-400"
                  }`}
                >
                  <span className="text-xl">{v.emoji}</span>
                  {v.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !vehicleType}
              className="w-full py-3 bg-[#008000] text-black font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Guardando..." : "Finalizar registro"}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              ← Volver
            </button>
          </form>
        )}

        {step === 1 && (
          <button
            onClick={() => router.push("/")}
            className="mt-4 w-full text-center text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Omitir por ahora
          </button>
        )}
      </div>
    </div>
  );
}

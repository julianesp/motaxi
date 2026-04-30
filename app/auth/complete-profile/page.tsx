"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d{10}$/.test(phone.replace(/\s/g, ""))) {
      setError("El número debe tener 10 dígitos");
      return;
    }

    setLoading(true);
    try {
      const { usersAPI } = await import("@/lib/api-client");
      await usersAPI.updateProfile({ phone });
      router.push("/");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Error al guardar. Intenta de nuevo.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#000000", backgroundImage: "linear-gradient(to top, #008000, #000000)" }}
    >
      <div className="max-w-sm w-full bg-gray-900 bg-opacity-90 p-8 rounded-2xl shadow-2xl border border-green-500 border-opacity-30">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-400 mb-1">MoTaxi</h1>
          <h2 className="text-xl font-semibold text-white">Un último paso</h2>
          <p className="mt-2 text-gray-400 text-sm">
            Agrega tu número celular para que los conductores puedan contactarte.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {loading ? "Guardando..." : "Continuar"}
          </button>
        </form>

        <button
          onClick={() => router.push("/")}
          className="mt-4 w-full text-center text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}

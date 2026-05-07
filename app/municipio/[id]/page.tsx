"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MUNICIPALITIES } from "@/lib/constants/municipalities";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface Place {
  id: string;
  municipality_id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  published_by_name: string;
  created_at: number;
}

export default function MunicipioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const municipality = MUNICIPALITIES.find((m) => m.id === id);

  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);

  // Formulario para publicar lugar
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [placeForm, setPlaceForm] = useState({
    name: "",
    description: "",
    category: "negocio",
    address: "",
    image_url: "",
  });
  const [submittingPlace, setSubmittingPlace] = useState(false);
  const [placeMsg, setPlaceMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!municipality) return;
    setLoadingPlaces(true);
    fetch(`${API_URL}/municipalities/${id}/places`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setPlaces(data?.places || []))
      .finally(() => setLoadingPlaces(false));
  }, [id, municipality]);

  if (!municipality) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Municipio no encontrado.</p>
      </div>
    );
  }

  async function handleSubmitPlace(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (!placeForm.name.trim() || !placeForm.address.trim()) {
      setPlaceMsg({ type: "err", text: "El nombre y la dirección son obligatorios." });
      return;
    }
    setSubmittingPlace(true);
    setPlaceMsg(null);
    try {
      const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
      const res = await fetch(`${API_URL}/municipalities/${id}/places`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(placeForm),
      });
      const data = await res.json();
      if (res.ok) {
        setPlaceMsg({ type: "ok", text: data.message });
        setPlaceForm({ name: "", description: "", category: "negocio", address: "", image_url: "" });
        setShowPlaceForm(false);
      } else {
        setPlaceMsg({ type: "err", text: data.error || "Error al enviar." });
      }
    } catch {
      setPlaceMsg({ type: "err", text: "Error de conexión." });
    } finally {
      setSubmittingPlace(false);
    }
  }

  function handleVisitar(place: Place) {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    const params = new URLSearchParams();
    if (place.latitude && place.longitude) {
      params.set("destLat", String(place.latitude));
      params.set("destLng", String(place.longitude));
    }
    params.set("destAddress", place.address);
    params.set("destName", place.name);
    router.push(`/passenger?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header del municipio */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{municipality.name}</h1>
            <p className="text-sm text-gray-500">{municipality.description}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Botón publicar lugar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Lugares y negocios</h2>
          {user ? (
            <button
              onClick={() => setShowPlaceForm(!showPlaceForm)}
              className="flex items-center gap-2 px-4 py-2 bg-[#42CE1D] text-white rounded-xl font-semibold text-sm hover:bg-[#36b018] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Publicar lugar
            </button>
          ) : (
            <button
              onClick={() => router.push("/auth/login")}
              className="text-sm text-[#42CE1D] font-semibold hover:underline"
            >
              Inicia sesión para publicar
            </button>
          )}
        </div>

        {/* Mensaje de confirmación/error publicación lugar */}
        {placeMsg && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
              placeMsg.type === "ok"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {placeMsg.text}
          </div>
        )}

        {/* Formulario publicar lugar */}
        {showPlaceForm && (
          <form
            onSubmit={handleSubmitPlace}
            className="bg-white rounded-2xl shadow p-6 mb-8 border border-gray-100"
          >
            <h3 className="text-base font-semibold text-gray-800 mb-4">Publicar un lugar o negocio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={placeForm.name}
                  onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })}
                  placeholder="Ej: Tienda El Sol"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#42CE1D]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={placeForm.category}
                  onChange={(e) => setPlaceForm({ ...placeForm, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#42CE1D]"
                >
                  <option value="negocio">Negocio</option>
                  <option value="restaurante">Restaurante</option>
                  <option value="farmacia">Farmacia</option>
                  <option value="supermercado">Supermercado</option>
                  <option value="salud">Salud</option>
                  <option value="educacion">Educación</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Ubicación *</label>
                <input
                  type="text"
                  value={placeForm.address}
                  onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })}
                  placeholder="Ej: Calle 5 #3-20, junto al parque"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#42CE1D]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={placeForm.description}
                  onChange={(e) => setPlaceForm({ ...placeForm, description: e.target.value })}
                  placeholder="¿Qué ofrecen? ¿Qué se vende ahí?"
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#42CE1D] resize-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de imagen (opcional)</label>
                <input
                  type="url"
                  value={placeForm.image_url}
                  onChange={(e) => setPlaceForm({ ...placeForm, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#42CE1D]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="submit"
                disabled={submittingPlace}
                className="px-5 py-2 bg-[#42CE1D] text-white rounded-xl font-semibold text-sm hover:bg-[#36b018] transition-colors disabled:opacity-60"
              >
                {submittingPlace ? "Enviando..." : "Enviar para revisión"}
              </button>
              <button
                type="button"
                onClick={() => setShowPlaceForm(false)}
                className="px-5 py-2 border border-gray-300 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Lista de lugares */}
        {loadingPlaces ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-52 animate-pulse" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">Todavía no hay lugares publicados en {municipality.name}.</p>
            <p className="text-sm mt-1">¡Sé el primero en publicar un negocio!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {places.map((place) => (
              <div
                key={place.id}
                className="bg-white rounded-2xl shadow hover:shadow-md transition-shadow overflow-hidden border border-gray-100"
              >
                {place.image_url && (
                  <img
                    src={place.image_url}
                    alt={place.name}
                    className="w-full h-36 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{place.name}</h3>
                    <span className="text-xs bg-green-50 text-[#42CE1D] border border-[#42CE1D]/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                      {place.category}
                    </span>
                  </div>
                  {place.description && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{place.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="line-clamp-1">{place.address}</span>
                  </div>
                  <button
                    onClick={() => handleVisitar(place)}
                    className="w-full py-2 bg-[#42CE1D] text-white text-sm font-semibold rounded-xl hover:bg-[#36b018] transition-colors"
                  >
                    Visitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MUNICIPALITIES } from "@/lib/constants/municipalities";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
const ADMIN_EMAIL = "admin@neurai.dev";

interface PendingImage {
  id: string;
  municipality_id: string;
  image_url: string;
  proposed_by_name: string;
  proposed_by_email: string;
  created_at: number;
}

interface PendingPlace {
  id: string;
  municipality_id: string;
  name: string;
  description: string | null;
  category: string;
  address: string;
  image_url: string | null;
  published_by_name: string;
  published_by_email: string;
  created_at: number;
}

export default function AdminMunicipiosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"images" | "places">("images");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pendingPlaces, setPendingPlaces] = useState<PendingPlace[]>([]);
  const [fetching, setFetching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function getToken() {
    return document.cookie.match(/authToken=([^;]+)/)?.[1] || "";
  }

  const fetchPending = useCallback(async () => {
    setFetching(true);
    const token = getToken();
    try {
      const [imgRes, placeRes] = await Promise.all([
        fetch(`${API_URL}/municipalities/admin/images/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/municipalities/admin/places/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const imgData = imgRes.ok ? await imgRes.json() : { images: [] };
      const placeData = placeRes.ok ? await placeRes.json() : { places: [] };
      setPendingImages(imgData.images || []);
      setPendingPlaces(placeData.places || []);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/admin");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) fetchPending();
  }, [user, fetchPending]);

  async function handleImageAction(imageId: string, action: "approve" | "reject") {
    setActionLoading(imageId);
    setMsg(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/municipalities/admin/images/${imageId}/${action}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: data.message });
        setPendingImages((prev) => prev.filter((i) => i.id !== imageId));
      } else {
        setMsg({ type: "err", text: data.error || "Error" });
      }
    } catch {
      setMsg({ type: "err", text: "Error de conexión." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePlaceAction(placeId: string, action: "approve" | "reject") {
    setActionLoading(placeId);
    setMsg(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/municipalities/admin/places/${placeId}/${action}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: data.message });
        setPendingPlaces((prev) => prev.filter((p) => p.id !== placeId));
      } else {
        setMsg({ type: "err", text: data.error || "Error" });
      }
    } catch {
      setMsg({ type: "err", text: "Error de conexión." });
    } finally {
      setActionLoading(null);
    }
  }

  function municipalityName(id: string) {
    return MUNICIPALITIES.find((m) => m.id === id)?.name || id;
  }

  if (loading || !user) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Municipios — Contenido pendiente</h1>

      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("images")}
          className={`px-5 py-2 rounded-xl font-semibold text-sm transition-colors ${
            tab === "images"
              ? "bg-[#42CE1D] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Imágenes propuestas
          {pendingImages.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {pendingImages.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("places")}
          className={`px-5 py-2 rounded-xl font-semibold text-sm transition-colors ${
            tab === "places"
              ? "bg-[#42CE1D] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Lugares / negocios
          {pendingPlaces.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {pendingPlaces.length}
            </span>
          )}
        </button>
      </div>

      {fetching ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : tab === "images" ? (
        pendingImages.length === 0 ? (
          <p className="text-gray-400 text-sm py-12 text-center">No hay imágenes pendientes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pendingImages.map((img) => (
              <div key={img.id} className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
                <img
                  src={img.image_url}
                  alt="Propuesta"
                  className="w-full h-44 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-0.5">
                    Municipio: <span className="text-[#42CE1D]">{municipalityName(img.municipality_id)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mb-1">Por: {img.proposed_by_name} ({img.proposed_by_email})</p>
                  <p className="text-xs text-gray-400 mb-3 break-all">{img.image_url}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleImageAction(img.id, "approve")}
                      disabled={actionLoading === img.id}
                      className="flex-1 py-1.5 bg-[#42CE1D] text-white text-sm font-semibold rounded-xl hover:bg-[#36b018] transition-colors disabled:opacity-60"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleImageAction(img.id, "reject")}
                      disabled={actionLoading === img.id}
                      className="flex-1 py-1.5 border border-red-300 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        pendingPlaces.length === 0 ? (
          <p className="text-gray-400 text-sm py-12 text-center">No hay lugares pendientes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pendingPlaces.map((place) => (
              <div key={place.id} className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
                {place.image_url && (
                  <img
                    src={place.image_url}
                    alt={place.name}
                    className="w-full h-36 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-gray-900">{place.name}</p>
                    <span className="text-xs bg-green-50 text-[#42CE1D] border border-[#42CE1D]/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                      {place.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-0.5">
                    Municipio: <span className="font-medium">{municipalityName(place.municipality_id)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mb-0.5">Dirección: {place.address}</p>
                  {place.description && (
                    <p className="text-xs text-gray-400 mb-1">{place.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mb-3">
                    Por: {place.published_by_name} ({place.published_by_email})
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePlaceAction(place.id, "approve")}
                      disabled={actionLoading === place.id}
                      className="flex-1 py-1.5 bg-[#42CE1D] text-white text-sm font-semibold rounded-xl hover:bg-[#36b018] transition-colors disabled:opacity-60"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => handlePlaceAction(place.id, "reject")}
                      disabled={actionLoading === place.id}
                      className="flex-1 py-1.5 border border-red-300 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

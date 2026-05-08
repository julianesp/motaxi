"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Swal from "sweetalert2";
import { registerPasskey, isPasskeySupported } from "@/lib/hooks/usePasskey";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
export default function PassengerProfilePage() {
  const router = useRouter();
  const { user, loading, logout, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  // Passkeys (huella digital)
  const [passkeysList, setPasskeysList] = useState<{ id: string; device_name: string; created_at: number; last_used_at: number | null }[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => { setPasskeySupported(isPasskeySupported()); }, []);

  const fetchPasskeys = useCallback(async () => {
    const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
    if (!token) return;
    const res = await fetch(`${API_URL}/passkeys`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const data = await res.json() as any; setPasskeysList(data.passkeys || []); }
  }, []);

  useEffect(() => { if (user) fetchPasskeys(); }, [user, fetchPasskeys]);

  const handleRegisterPasskey = async () => {
    setPasskeyLoading(true);
    setPasskeyMsg(null);
    const result = await registerPasskey();
    if (result.success) {
      setPasskeyMsg({ type: "ok", text: "¡Huella registrada! Ya puedes entrar con tu huella." });
      fetchPasskeys();
    } else {
      setPasskeyMsg({ type: "err", text: result.error || "No se pudo registrar la huella" });
    }
    setPasskeyLoading(false);
  };

  const handleDeletePasskey = async (credId: string) => {
    const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
    if (!token) return;
    await fetch(`${API_URL}/passkeys/${encodeURIComponent(credId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchPasskeys();
  };
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    gender: "" as "male" | "female" | "other" | "",
  });

  useEffect(() => {
    if (!loading) {
      if (!user) return router.push("/");
      if (user.email === "admin@neurai.dev") return router.push("/admin");
      if (user.role === "driver") return router.push("/driver");
      if (user.role !== "passenger") return router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      // Los usuarios de Google tienen phone placeholder tipo "G-xxxxxxxxx"
      const phoneValue = user.phone?.startsWith("G-") ? "" : user.phone;
      setFormData({
        full_name: user.full_name,
        phone: phoneValue,
        email: user.email,
        gender: (user as any).gender || "",
      });
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleSwitchToDriver = async () => {
    const result = await Swal.fire({
      title: '¿Cambiar a modo Conductor?',
      html: `
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
          Podrás operar como conductor y recibir solicitudes de viaje.<br/>
          Tu cuenta de pasajero seguirá activa — puedes cambiar entre modos cuando quieras.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🏍️ Sí, ser conductor',
      confirmButtonColor: '#008000',
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#6b7280',
    });
    if (!result.isConfirmed) return;
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.put('/users/switch-role', { role: 'driver' });
      await refreshUser();
      await Swal.fire({
        icon: 'success',
        title: '¡Modo conductor activado!',
        text: 'Ahora puedes recibir viajes. Completa tu perfil de conductor.',
        confirmButtonColor: '#008000',
        timer: 3000,
        timerProgressBar: true,
      });
      router.push('/driver');
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el modo. Contacta soporte.', confirmButtonColor: '#008000' });
    }
  };

  const handleChangePassword = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Cambiar contraseña',
      html: `
        <input id="swal-current" type="password" placeholder="Contraseña actual" class="swal2-input" />
        <input id="swal-new" type="password" placeholder="Nueva contraseña (mín. 6 caracteres)" class="swal2-input" />
        <input id="swal-confirm" type="password" placeholder="Confirmar nueva contraseña" class="swal2-input" />
      `,
      confirmButtonText: 'Cambiar',
      confirmButtonColor: '#008000',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#6b7280',
      focusConfirm: false,
      preConfirm: () => {
        const current = (document.getElementById('swal-current') as HTMLInputElement).value;
        const newPwd = (document.getElementById('swal-new') as HTMLInputElement).value;
        const confirm = (document.getElementById('swal-confirm') as HTMLInputElement).value;
        if (!current || !newPwd || !confirm) {
          Swal.showValidationMessage('Completa todos los campos');
          return false;
        }
        if (newPwd.length < 6) {
          Swal.showValidationMessage('La nueva contraseña debe tener al menos 6 caracteres');
          return false;
        }
        if (newPwd !== confirm) {
          Swal.showValidationMessage('Las contraseñas no coinciden');
          return false;
        }
        return { current, newPwd };
      },
    });
    if (!formValues) return;
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.post('/auth/change-password', { currentPassword: formValues.current, newPassword: formValues.newPwd });
      Swal.fire({ icon: 'success', title: '¡Contraseña actualizada!', confirmButtonColor: '#008000', timer: 2500, timerProgressBar: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'No se pudo cambiar la contraseña';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#008000' });
    }
  };

  const handleDeleteAccount = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      html: `<p style="color:#4b5563;font-size:14px;">Se eliminarán todos tus datos. Esta acción es <strong>irreversible</strong>.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#6b7280',
    });
    if (!result.isConfirmed) return;

    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.delete('/users/account');
      await logout();
      router.push('/');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'No se pudo eliminar la cuenta. Contacta soporte.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#008000' });
    }
  };

  const handleSave = async () => {
    try {
      const { usersAPI } = await import("@/lib/api-client");
      const updates: Record<string, any> = { full_name: formData.full_name, gender: formData.gender || null };
      // Solo enviar phone si realmente cambió para evitar UNIQUE constraint
      if (formData.phone && formData.phone !== user?.phone) {
        updates.phone = formData.phone;
      }
      // Solo enviar email si cambió y no está vacío
      if (formData.email && formData.email !== user?.email) {
        updates.email = formData.email;
      }
      await usersAPI.updateProfile(updates);
      setIsEditing(false);
      alert("✅ Perfil actualizado correctamente");
      // Recargar para reflejar cambios
      window.location.reload();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      const msg = error?.response?.data?.error || "Error al actualizar el perfil. Intenta nuevamente.";
      alert("❌ " + msg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-black"
            >
              <svg
                className="w-6 h-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Volver
            </button>
            <h1 className="text-xl font-bold text-[#008000]">Mi Perfil</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container-app py-6">
        <div className="max-w-2xl mx-auto">

          {/* Banner: recordatorio de email */}
          {user.email?.endsWith('@motaxi.local') && (
            <div className="mb-4 bg-[#008000]/10 border border-[#008000]/30 rounded-2xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-[#008000] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-[#008000]">Agrega tu correo electrónico</p>
                <p className="text-xs text-[#008000]/80 mt-0.5">
                  Sin un email registrado no podrás recuperar tu contraseña si la olvidas. Toca <strong>Editar Perfil</strong> para agregarlo.
                </p>
              </div>
            </div>
          )}

          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header with Avatar */}
            <div className="bg-gradient-to-r from-[#008000] to-[#006600] px-6 py-8">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-16 h-16 text-[#008000]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {user.full_name}
                </h2>
                <p className="text-green-100">Pasajero</p>
              </div>
            </div>

            {/* Profile Information */}
            <div className="p-6 space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico
                </label>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008000] text-gray-900 bg-white"
                    />
                  ) : (
                    <span className="text-black">{user.email}</span>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008000] text-gray-900 bg-white"
                    />
                  ) : (
                    <span className="text-black">{user.phone}</span>
                  )}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo
                </label>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008000] text-gray-900 bg-white"
                    />
                  ) : (
                    <span className="text-black">{user.full_name}</span>
                  )}
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Género
                </label>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {isEditing ? (
                    <select
                      value={formData.gender}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gender: e.target.value as any,
                        })
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008000] text-gray-900 bg-white"
                    >
                      <option value="">Sin especificar</option>
                      <option value="male">Masculino</option>
                      <option value="female">Femenino</option>
                      <option value="other">Otro</option>
                    </select>
                  ) : (
                    <span className="text-black">
                      {formData.gender === "male"
                        ? "Masculino"
                        : formData.gender === "female"
                          ? "Femenino"
                          : formData.gender === "other"
                            ? "Otro"
                            : "Sin especificar"}
                    </span>
                  )}
                </div>
              </div>

              {/* Member Since */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Miembro desde
                </label>
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-black">
                    {new Date(
                      typeof user.created_at === "number"
                        ? user.created_at * 1000
                        : user.created_at,
                    ).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 py-3 px-4 bg-[#008000] text-white rounded-xl font-medium hover:bg-[#006600] transition-colors"
                    >
                      Guardar Cambios
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-3 px-4 bg-[#008000] text-white rounded-xl font-medium hover:bg-[#006600] transition-colors"
                  >
                    Editar Perfil
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="mt-6">
            {/* Grid 2 columnas */}
            <div className="grid grid-cols-2 gap-3">
              {/* Historial */}
              <button
                onClick={() => router.push("/passenger/history")}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors min-h-[90px]"
              >
                <svg className="w-7 h-7 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Historial</span>
              </button>

              {/* Soporte */}
              <a
                href="mailto:admin@neurai.dev?subject=Soporte%20MoTaxi&body=Hola,%20necesito%20ayuda%20con%20MoTaxi..."
                className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors min-h-[90px]"
              >
                <svg className="w-7 h-7 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Soporte</span>
              </a>

              {/* Ser Conductor */}
              <button
                onClick={handleSwitchToDriver}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center justify-center gap-2 hover:bg-green-50 transition-colors border border-green-100 min-h-[90px]"
              >
                <span className="text-2xl">🏍️</span>
                <span className="text-sm font-medium text-[#008000]">Ser Conductor</span>
              </button>

              {/* Compartir */}
              <button
                onClick={() => {
                  const url = window.location.origin;
                  if (navigator.share) {
                    navigator.share({
                      title: 'MoTaxi',
                      text: 'Te invito a usar esta aplicación MoTaxi. Regístrate cómo pasajero o conductor',
                      url,
                    });
                  } else {
                    navigator.clipboard.writeText(url).then(() => {
                      Swal.fire({
                        icon: 'success',
                        title: '¡Enlace copiado!',
                        text: 'Comparte el enlace con tus amigos.',
                        confirmButtonColor: '#008000',
                        timer: 2500,
                        timerProgressBar: true,
                      });
                    });
                  }
                }}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center justify-center gap-2 hover:bg-green-50 transition-colors border border-green-100 min-h-[90px]"
              >
                <svg className="w-7 h-7 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="text-sm font-medium text-[#008000]">Compartir</span>
              </button>
            </div>

            {/* Cambiar contraseña */}
            <button
              onClick={handleChangePassword}
              className="mt-3 w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-6 h-6 text-[#008000] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-medium text-gray-800">Cambiar contraseña</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Huella digital / Passkeys */}
            {passkeySupported && (
              <div className="mt-3 bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-[#42CE1D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11c0 .936.432 1.771 1.106 2.31C5.86 14.05 5 15.426 5 17v1h8v-1c0-1.574-.86-2.95-2.106-3.69A2.995 2.995 0 0012 11z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a5 5 0 010 10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 4a9 9 0 010 16" />
                    </svg>
                    <span className="font-semibold text-gray-800">Huella digital</span>
                  </div>
                  <button
                    onClick={handleRegisterPasskey}
                    disabled={passkeyLoading}
                    className="text-xs font-semibold px-3 py-1.5 bg-[#42CE1D] text-white rounded-lg hover:bg-[#36b018] transition-colors disabled:opacity-60"
                  >
                    {passkeyLoading ? "Registrando..." : "+ Agregar huella"}
                  </button>
                </div>

                {passkeyMsg && (
                  <p className={`text-xs mb-2 font-medium ${passkeyMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                    {passkeyMsg.text}
                  </p>
                )}

                {passkeysList.length === 0 ? (
                  <p className="text-xs text-gray-400">No tienes huellas registradas. Agrega una para entrar sin contraseña.</p>
                ) : (
                  <ul className="space-y-2">
                    {passkeysList.map((pk) => (
                      <li key={pk.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{pk.device_name}</p>
                          <p className="text-xs text-gray-400">
                            Registrada: {new Date(pk.created_at * 1000).toLocaleDateString("es-CO")}
                            {pk.last_used_at && ` · Último uso: ${new Date(pk.last_used_at * 1000).toLocaleDateString("es-CO")}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeletePasskey(pk.id)}
                          className="text-red-400 hover:text-red-600 transition-colors ml-2"
                          title="Eliminar huella"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              className="mt-3 w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium text-red-600">Cerrar Sesión</span>
              </div>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Eliminar cuenta */}
            <button
              onClick={handleDeleteAccount}
              className="mt-3 w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-red-50 transition-colors border border-red-100"
            >
              <div className="flex items-center">
                <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <div className="text-left">
                  <span className="font-medium text-red-400 block">Eliminar cuenta</span>
                  <span className="text-xs text-gray-400">Acción irreversible</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

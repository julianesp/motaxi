'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { MUNICIPALITIES } from '@/lib/constants/municipalities';
import TrialBanner from '@/components/TrialBanner';
import { useSubscription } from '@/lib/hooks/useSubscription';
import Swal from 'sweetalert2';

interface DriverInfo {
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  license_number: string;
  is_available: number;
  verification_status: string;
  rating: number;
  total_trips: number;
  municipality?: string;
  accepts_intercity_trips?: number;
  accepts_rural_trips?: number;
  night_only?: number;
  whatsapp?: string;
  base_fare?: number;
  intercity_fare?: number;
  rural_fare?: number;
  per_km_fare?: number;
  vehicle_types?: string;
}

export default function DriverProfilePage() {
  const router = useRouter();
  const { user, loading, logout, refreshUser } = useAuth();
  const [isDriverOfMonth, setIsDriverOfMonth] = useState(false);
  const { status: subscriptionStatus } = useSubscription();

  // Conteo regresivo: mostrar alerta una vez al día a partir del día 7 de prueba
  useEffect(() => {
    if (!subscriptionStatus?.is_trial_active) return;
    const daysLeft = subscriptionStatus.days_left;
    const totalTrialDays = 30;
    const daysElapsed = totalTrialDays - daysLeft;
    if (daysElapsed < 7) return; // Solo mostrar desde el día 7

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lastSeen = localStorage.getItem('motaxi_trial_alert_date');
    if (lastSeen === today) return;

    localStorage.setItem('motaxi_trial_alert_date', today);

    const isUrgent = daysLeft <= 3;
    Swal.fire({
      icon: isUrgent ? 'warning' : 'info',
      title: isUrgent ? '⏰ ¡Prueba por vencer!' : '📅 Tu período de prueba',
      html: isUrgent
        ? `<p>Solo te quedan <strong>${daysLeft} día${daysLeft !== 1 ? 's' : ''}</strong> de prueba.<br/>Suscríbete para no perder el acceso.</p>`
        : `<p>Te quedan <strong>${daysLeft} días</strong> de los 30 de prueba.<br/>Cuando termine necesitarás una suscripción para continuar.</p>`,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#008000',
      background: '#fff',
    });
  }, [subscriptionStatus]);

  const [driverOfMonth, setDriverOfMonth] = useState<{ full_name: string; avg_rating: number; month_trips: number; municipality?: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);

  // Fotos de lugares visitados
  interface DriverPhoto { id: string; image_key: string; caption: string | null; created_at: number; }
  const [driverPhotos, setDriverPhotos] = useState<DriverPhoto[]>([]);
  const [isUploadingPlacePhoto, setIsUploadingPlacePhoto] = useState(false);
  const [placePhotoCaption, setPlacePhotoCaption] = useState('');
  const [selectedPlacePhoto, setSelectedPlacePhoto] = useState<File | null>(null);
  const [placePhotoPreview, setPlacePhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    profile_image: '',
  });
  const [driverFormData, setDriverFormData] = useState({
    municipality: '',
    accepts_intercity_trips: true,
    accepts_rural_trips: true,
    night_only: false,
    whatsapp: '',
    vehicle_model: '',
    vehicle_color: '',
    vehicle_plate: '',
    license_number: '',
    base_fare: '' as number | string,
    intercity_fare: '' as number | string,
    rural_fare: '' as number | string,
    per_km_fare: '' as number | string,
    vehicle_types: 'moto' as 'moto' | 'taxi' | 'carro' | 'piaggio' | 'particular',
  });

  useEffect(() => {
    if (!loading && (!user || user.role !== 'driver')) {
      if (user?.role === 'passenger') {
        router.push('/passenger');
      } else {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        profile_image: (user as any).profile_image || '',
      });
      setPhotoPreview((user as any).profile_image || null);
      fetchDriverInfo();
      fetchDriverPhotos();
      checkTelegramStatus();
    }
  }, [user]);

  const fetchDriverInfo = async () => {
    try {
      const { driversAPI, apiClient } = await import('@/lib/api-client');
      // Verificar conductor del mes
      try {
        const domRes = await apiClient.get('/drivers/of-the-month');
        const winner = domRes.data?.winner;
        if (winner) {
          setDriverOfMonth(winner);
          if (user && winner.id === user.id) setIsDriverOfMonth(true);
        }
      } catch (_) {}
      const response = await driversAPI.getProfile();

      if (response.driver) {
        const driver = response.driver;
        setDriverInfo({
          vehicle_model: driver.vehicle_model || 'No especificado',
          vehicle_color: driver.vehicle_color || '-',
          vehicle_plate: driver.vehicle_plate || '-',
          license_number: driver.license_number || '-',
          is_available: driver.is_available || 0,
          verification_status: driver.verification_status || 'pending',
          rating: driver.rating || 5.0,
          total_trips: driver.total_trips || 0,
          municipality: driver.municipality || '',
          accepts_intercity_trips: driver.accepts_intercity_trips || 1,
          accepts_rural_trips: driver.accepts_rural_trips || 1,
          base_fare: driver.base_fare || 2000,
          intercity_fare: driver.intercity_fare || 5000,
          rural_fare: driver.rural_fare || 4000,
          per_km_fare: driver.per_km_fare || 500,
          vehicle_types: driver.vehicle_types || 'moto',
        });

        // Inicializar formData del conductor
        setDriverFormData({
          municipality: driver.municipality || '',
          accepts_intercity_trips: driver.accepts_intercity_trips === 1,
          accepts_rural_trips: driver.accepts_rural_trips === 1,
          night_only: driver.night_only === 1,
          whatsapp: driver.whatsapp || '',
          vehicle_model: driver.vehicle_model || '',
          vehicle_color: driver.vehicle_color || '',
          vehicle_plate: driver.vehicle_plate || '',
          license_number: driver.license_number || '',
          base_fare: driver.base_fare || '',
          intercity_fare: driver.intercity_fare || '',
          rural_fare: driver.rural_fare || '',
          per_km_fare: driver.per_km_fare || '',
          vehicle_types: (driver.vehicle_types as 'moto' | 'taxi' | 'carro' | 'piaggio' | 'particular') || 'moto',
        });
      }
    } catch (error) {
      console.error('Error fetching driver info:', error);
      // Mostrar valores por defecto en caso de error
      setDriverInfo({
        vehicle_model: 'Error al cargar',
        vehicle_color: '-',
        vehicle_plate: '-',
        license_number: '-',
        is_available: 0,
        verification_status: 'pending',
        rating: 5.0,
        total_trips: 0,
      });
    }
  };

  const handleLinkTelegram = async () => {
    setTelegramLoading(true);
    try {
      const { apiClient } = await import('@/lib/api-client');
      const res = await apiClient.get('/telegram/link-token');
      if (res.data.linked) {
        setTelegramLinked(true);
        Swal.fire({ icon: 'info', title: 'Ya vinculado', text: 'Tu cuenta de Telegram ya está conectada.', confirmButtonColor: '#008000' });
      } else {
        const result = await Swal.fire({
          icon: 'info',
          title: 'Activar notificaciones',
          html: `
            <p style="margin-bottom:12px">Sigue estos pasos:</p>
            <ol style="text-align:left; line-height:2">
              <li><b>1.</b> Toca el botón <b>"Abrir bot"</b> abajo</li>
              <li><b>2.</b> En Telegram, toca el botón <b>INICIAR</b></li>
              <li><b>3.</b> ¡Listo! Recibirás alertas de viajes</li>
            </ol>
          `,
          confirmButtonColor: '#008000',
          confirmButtonText: '📲 Abrir bot',
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
        });
        if (result.isConfirmed) {
          window.open(res.data.deepLink, '_blank');
          setTelegramLinked(false);
          await Swal.fire({
            icon: 'success',
            title: '¡Ya casi!',
            html: 'Ahora en Telegram toca <b>INICIAR</b> o <b>START</b> para terminar la activación.',
            confirmButtonColor: '#008000',
            confirmButtonText: 'Listo',
          });
          checkTelegramStatus();
        }
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el enlace de Telegram.', confirmButtonColor: '#008000' });
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    const result = await Swal.fire({
      title: '¿Desvincular Telegram?',
      text: 'Dejarás de recibir notificaciones de viajes en Telegram.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desvincular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.delete('/telegram/unlink');
      setTelegramLinked(false);
      Swal.fire({ icon: 'success', title: 'Desvinculado', text: 'Telegram desconectado correctamente.', confirmButtonColor: '#008000' });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo desvincular Telegram.', confirmButtonColor: '#008000' });
    }
  };

  const checkTelegramStatus = async () => {
    try {
      const { apiClient } = await import('@/lib/api-client');
      const res = await apiClient.get('/telegram/link-token');
      setTelegramLinked(!!res.data.linked);
    } catch {
      // silencioso
    }
  };

  const fetchDriverPhotos = async () => {
    try {
      const { apiClient } = await import('@/lib/api-client');
      const res = await apiClient.get('/drivers/photos/my');
      setDriverPhotos(res.data.photos || []);
    } catch {
      // silencioso
    }
  };

  const handlePlacePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Swal.fire({ icon: 'warning', title: 'Formato inválido', text: 'Selecciona una imagen válida.', confirmButtonColor: '#008000' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Imagen muy grande', text: 'La imagen no puede superar 5MB.', confirmButtonColor: '#008000' });
      return;
    }
    setSelectedPlacePhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPlacePhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadPlacePhoto = async () => {
    if (!selectedPlacePhoto) return;
    setIsUploadingPlacePhoto(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
      const token = document.cookie.match(/authToken=([^;]+)/)?.[1];
      const fd = new FormData();
      fd.append('photo', selectedPlacePhoto);
      if (placePhotoCaption.trim()) fd.append('caption', placePhotoCaption.trim());
      const res = await fetch(`${API_URL}/drivers/photos`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al subir la foto');
      }
      setSelectedPlacePhoto(null);
      setPlacePhotoPreview(null);
      setPlacePhotoCaption('');
      await fetchDriverPhotos();
      Swal.fire({ icon: 'success', title: 'Foto compartida', text: 'Tu foto ya aparece en la página de inicio.', confirmButtonColor: '#008000' });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo subir la foto.', confirmButtonColor: '#008000' });
    } finally {
      setIsUploadingPlacePhoto(false);
    }
  };

  const handleDeletePlacePhoto = async (photoId: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar foto?',
      text: 'La foto se quitará de la página de inicio.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.delete(`/drivers/photos/${photoId}`);
      await fetchDriverPhotos();
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar la foto.', confirmButtonColor: '#008000' });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire({ icon: 'warning', title: 'Formato inválido', text: 'Por favor selecciona una imagen válida.', confirmButtonColor: '#008000' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Imagen muy grande', text: 'La imagen no puede superar 2MB.', confirmButtonColor: '#008000' });
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setFormData(prev => ({ ...prev, profile_image: base64 }));
      setIsUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    // Foto de perfil obligatoria
    if (!photoPreview && !formData.profile_image) {
      alert('📸 La foto de perfil es obligatoria. Por favor agrega una foto.');
      return;
    }

    setIsSaving(true);
    try {
      const { driversAPI, usersAPI } = await import('@/lib/api-client');

      // Guardar nombre, teléfono y foto
      const isNewImage = formData.profile_image && formData.profile_image.startsWith('data:');
      const userUpdates: Record<string, any> = {};
      if (formData.full_name !== user?.full_name) userUpdates.full_name = formData.full_name;
      if (formData.phone && formData.phone !== user?.phone) userUpdates.phone = formData.phone;
      if (isNewImage) {
        userUpdates.full_name = formData.full_name;
        userUpdates.profile_image = formData.profile_image;
      }
      if (Object.keys(userUpdates).length > 0) {
        await usersAPI.updateProfile(userUpdates);
      }

      // Preparar datos con valores por defecto para campos vacíos
      const dataToSend = {
        ...driverFormData,
        base_fare: (typeof driverFormData.base_fare === 'number' ? driverFormData.base_fare : (driverFormData.base_fare === '' ? 2000 : parseInt(driverFormData.base_fare))) as number,
        intercity_fare: (typeof driverFormData.intercity_fare === 'number' ? driverFormData.intercity_fare : (driverFormData.intercity_fare === '' ? 5000 : parseInt(driverFormData.intercity_fare))) as number,
        rural_fare: (typeof driverFormData.rural_fare === 'number' ? driverFormData.rural_fare : (driverFormData.rural_fare === '' ? 4000 : parseInt(driverFormData.rural_fare))) as number,
        per_km_fare: (typeof driverFormData.per_km_fare === 'number' ? driverFormData.per_km_fare : (driverFormData.per_km_fare === '' ? 500 : parseInt(driverFormData.per_km_fare))) as number,
      };

      // Actualizar perfil del conductor
      await driversAPI.updateProfile(dataToSend);

      // Recargar información
      await fetchDriverInfo();

      setIsEditing(false);
      Swal.fire({ icon: 'success', title: 'Perfil actualizado', text: 'Perfil actualizado correctamente', confirmButtonColor: '#008000' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const msg = error?.response?.data?.error || error?.message || 'Error al actualizar el perfil. Intenta nuevamente.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#008000' });
    } finally {
      setIsSaving(false);
    }
  };

  const getVerificationStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente de Verificación';
      case 'approved':
        return 'Verificado ✓';
      case 'rejected':
        return 'Rechazado';
      default:
        return 'Desconocido';
    }
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'approved':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
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
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
          {/* Conductor del Mes */}
          {driverOfMonth && (
            <div className="mb-4 bg-[#008000]/10 border border-[#008000]/30 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#008000]/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🏆</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#008000] uppercase tracking-wide">Conductor del Mes</p>
                <p className="text-sm font-bold text-gray-800 truncate">{driverOfMonth.full_name}</p>
                <p className="text-xs text-gray-500">
                  ⭐ {driverOfMonth.avg_rating?.toFixed(1)} · {driverOfMonth.month_trips} viajes
                  {driverOfMonth.municipality && ` · ${driverOfMonth.municipality.charAt(0).toUpperCase() + driverOfMonth.municipality.slice(1).replace('_', ' ')}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs bg-[#008000] text-white px-2 py-0.5 rounded-full font-semibold">🏆 Conductor del Mes</span>
              </div>
            </div>
          )}

          {/* Trial / Subscription Banner */}
          <div className="mb-4">
            <TrialBanner user={{ id: user.id, full_name: user.full_name, email: user.email, phone: user.phone }} />
          </div>

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
            <div className="bg-gradient-to-r from-green-500 to-[#008000] px-6 py-8">
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-16 h-16 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  {/* Botón de cambiar foto - siempre visible */}
                  <label
                    htmlFor="photo-upload"
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#008000] hover:bg-[#35a818] rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors"
                    title="Cambiar foto de perfil"
                  >
                    {isUploadingPhoto ? (
                      <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  {/* Indicador de foto requerida */}
                  {!photoPreview && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{user.full_name}</h2>
                <p className="text-green-100 mb-2">Conductor</p>
                {/* Badge Conductor del Mes */}
                {isDriverOfMonth && (
                  <div className="flex items-center gap-1.5 bg-[#008000] text-white px-3 py-1 rounded-full text-xs font-bold mb-1 shadow-md">
                    🏆 Conductor del Mes
                  </div>
                )}
                {/* Badge Conductor Destacado */}
                {driverInfo && driverInfo.rating >= 4.5 && driverInfo.total_trips >= 20 && (
                  <div className="flex items-center gap-1.5 bg-white text-[#008000] px-3 py-1 rounded-full text-xs font-bold mb-2 shadow-md">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Conductor Destacado
                  </div>
                )}
              </div>
            </div>

            {/* Profile Information */}
            <div className="p-6 space-y-6">
              {/* Statistics Row */}
              {driverInfo && (
                <div className="grid grid-cols-2 gap-4 pb-6 border-b border-gray-200">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <svg className="w-5 h-5 text-yellow-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-2xl font-bold text-gray-900">{driverInfo.rating.toFixed(1)}</span>
                    </div>
                    <p className="text-sm text-gray-600">Calificación</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{driverInfo.total_trips}</p>
                    <p className="text-sm text-gray-600">Viajes</p>
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico
                </label>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                    />
                  ) : (
                    <span className="text-gray-900">{user.email}</span>
                  )}
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp <span className="text-gray-400 font-normal">(opcional — visible para pasajeros)</span>
                </label>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.882l6.19-1.624A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.214-3.727.977.995-3.645-.234-.374A9.818 9.818 0 1112 21.818z"/>
                  </svg>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={driverFormData.whatsapp}
                      onChange={(e) => setDriverFormData({ ...driverFormData, whatsapp: e.target.value })}
                      placeholder="Ej: 3001234567"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                    />
                  ) : (
                    <span className="text-gray-900">{driverInfo?.whatsapp || <span className="text-gray-400">No configurado</span>}</span>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                    />
                  ) : (
                    <span className="text-gray-900">{user.phone}</span>
                  )}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo
                </label>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                    />
                  ) : (
                    <span className="text-gray-900">{user.full_name}</span>
                  )}
                </div>
              </div>

              {/* Vehicle Information */}
              {driverInfo && (
                <>
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Vehículo</h3>

                    {/* Tipo de Vehículo */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de vehículo
                      </label>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'moto', label: '🏍️', desc: 'Mototaxi' },
                            { value: 'taxi', label: '🚕', desc: 'Taxi' },
                            { value: 'carro', label: '🚐', desc: 'Carro / Van' },
                            { value: 'piaggio', label: '🛻', desc: 'Piaggio' },
                            { value: 'particular', label: '🚗', desc: 'Particular' },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setDriverFormData({ ...driverFormData, vehicle_types: opt.value })}
                              className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-all text-center ${
                                driverFormData.vehicle_types === opt.value
                                  ? 'border-[#008000] bg-green-50'
                                  : 'border-gray-200 hover:border-green-300'
                              }`}
                            >
                              <span className="text-2xl">{opt.label}</span>
                              <span className={`text-xs font-semibold mt-1 ${driverFormData.vehicle_types === opt.value ? 'text-[#008000]' : 'text-gray-600'}`}>{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-gray-900">
                            {({ moto: '🏍️ Mototaxi', taxi: '🚕 Taxi', carro: '🚐 Carro / Van', piaggio: '🛻 Piaggio', particular: '🚗 Particular' } as Record<string, string>)[driverInfo.vehicle_types ?? ''] ?? '🏍️ Mototaxi'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Vehicle Model */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Modelo
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={driverFormData.vehicle_model}
                          onChange={(e) => setDriverFormData({ ...driverFormData, vehicle_model: e.target.value })}
                          placeholder="Ej: Yamaha FZ 150"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                        />
                      ) : (
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-gray-900">{driverInfo.vehicle_model}</span>
                        </div>
                      )}
                    </div>

                    {/* Vehicle Color */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={driverFormData.vehicle_color}
                          onChange={(e) => setDriverFormData({ ...driverFormData, vehicle_color: e.target.value })}
                          placeholder="Ej: Rojo"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                        />
                      ) : (
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                          <span className="text-gray-900">{driverInfo.vehicle_color}</span>
                        </div>
                      )}
                    </div>

                    {/* Vehicle Plate */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Placa
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={driverFormData.vehicle_plate}
                          onChange={(e) => setDriverFormData({ ...driverFormData, vehicle_plate: e.target.value.toUpperCase() })}
                          placeholder="Ej: ABC123"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black font-mono uppercase"
                          maxLength={6}
                        />
                      ) : (
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-gray-900 font-mono uppercase">{driverInfo.vehicle_plate}</span>
                        </div>
                      )}
                    </div>

                    {/* License Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Licencia de Conducir
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={driverFormData.license_number}
                          onChange={(e) => setDriverFormData({ ...driverFormData, license_number: e.target.value })}
                          placeholder="Ej: 123456789"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                        />
                      ) : (
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                          </svg>
                          <span className="text-gray-900">{driverInfo.license_number}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Driver Location and Route Preferences */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Ubicación y Preferencias de Rutas</h3>

                    {/* Municipality */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Municipio Base
                      </label>
                      {isEditing ? (
                        <select
                          value={driverFormData.municipality}
                          onChange={(e) => setDriverFormData({ ...driverFormData, municipality: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                        >
                          <option value="">Seleccionar municipio</option>
                          {MUNICIPALITIES.map((municipality) => (
                            <option key={municipality.id} value={municipality.name}>
                              {municipality.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-gray-900">{driverInfo.municipality || 'No especificado'}</span>
                        </div>
                      )}
                    </div>

                    {/* Intercity Trips */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start space-x-3 flex-1">
                          <svg className="w-5 h-5 text-[#008000] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <div className="flex-1">
                            <label className="text-sm font-medium text-gray-900 cursor-pointer">
                              Acepto viajes a otros pueblos
                            </label>
                            <p className="text-xs text-gray-600 mt-1">
                              Realizar viajes entre los 4 municipios del Valle de Sibundoy
                            </p>
                          </div>
                        </div>
                        {isEditing ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={driverFormData.accepts_intercity_trips}
                              onChange={(e) => setDriverFormData({ ...driverFormData, accepts_intercity_trips: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008000]"></div>
                          </label>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${driverInfo.accepts_intercity_trips ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {driverInfo.accepts_intercity_trips ? 'Sí' : 'No'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rural Trips */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start space-x-3 flex-1">
                          <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <label className="text-sm font-medium text-gray-900 cursor-pointer">
                              Acepto viajes a veredas
                            </label>
                            <p className="text-xs text-gray-600 mt-1">
                              Realizar viajes a zonas rurales y veredas del Valle de Sibundoy
                            </p>
                          </div>
                        </div>
                        {isEditing ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={driverFormData.accepts_rural_trips}
                              onChange={(e) => setDriverFormData({ ...driverFormData, accepts_rural_trips: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                          </label>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${driverInfo.accepts_rural_trips ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {driverInfo.accepts_rural_trips ? 'Sí' : 'No'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Conductor nocturno */}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">🌙 Solo viajes nocturnos</p>
                      <p className="text-xs text-gray-500">Los pasajeros verán que trabajas de 6pm a 6am</p>
                    </div>
                    <div>
                      {isEditing ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={driverFormData.night_only}
                            onChange={(e) => setDriverFormData({ ...driverFormData, night_only: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#008000]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008000]"></div>
                        </label>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${driverInfo.night_only ? 'bg-[#008000]/10 text-[#008000]' : 'bg-gray-100 text-gray-800'}`}>
                          {driverInfo.night_only ? '🌙 Sí' : 'No'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Custom Pricing */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Tarifas Personalizadas</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Configura tus tarifas para diferentes tipos de viajes. Estas tarifas serán mostradas a los pasajeros.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Base Fare */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tarifa Base (mismo municipio)
                        </label>
                        {isEditing ? (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={driverFormData.base_fare}
                              onChange={(e) => setDriverFormData({ ...driverFormData, base_fare: e.target.value === '' ? '' : parseInt(e.target.value) })}
                              placeholder="2000"
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                              min="0"
                              step="1000"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-900">${driverInfo.base_fare?.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Intercity Fare */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tarifa Intermunicipal
                        </label>
                        {isEditing ? (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={driverFormData.intercity_fare}
                              onChange={(e) => setDriverFormData({ ...driverFormData, intercity_fare: e.target.value === '' ? '' : parseInt(e.target.value) })}
                              placeholder="10000"
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                              min="0"
                              step="1000"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="text-gray-900">${driverInfo.intercity_fare?.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Rural Fare */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tarifa a Veredas
                        </label>
                        {isEditing ? (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={driverFormData.rural_fare}
                              onChange={(e) => setDriverFormData({ ...driverFormData, rural_fare: e.target.value === '' ? '' : parseInt(e.target.value) })}
                              placeholder="8000"
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                              min="0"
                              step="1000"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-900">${driverInfo.rural_fare?.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Per KM Fare */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tarifa por KM adicional
                        </label>
                        {isEditing ? (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={driverFormData.per_km_fare}
                              onChange={(e) => setDriverFormData({ ...driverFormData, per_km_fare: e.target.value === '' ? '' : parseInt(e.target.value) })}
                              placeholder="2000"
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-black"
                              min="0"
                              step="500"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span className="text-gray-900">${driverInfo.per_km_fare?.toLocaleString()}/km</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 p-4 bg-[#008000]/10 border border-[#008000]/30 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <svg className="w-5 h-5 text-[#008000] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm text-[#008000] font-medium">Información sobre tarifas</p>
                            <p className="text-xs text-[#008000]/80 mt-1">
                              Estas tarifas son referenciales y pueden variar según la distancia del viaje.
                              Asegúrate de establecer tarifas competitivas y justas.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Member Since */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Miembro desde
                </label>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-900">
                    {new Date(typeof user.created_at === 'number' ? user.created_at * 1000 : user.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
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
                      disabled={isSaving}
                      className="flex-1 py-3 px-4 bg-[#008000] text-white rounded-xl font-medium hover:bg-[#006600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Guardando...' : 'Guardar Cambios'}
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
              {/* Ganancias */}
              <button
                onClick={() => router.push('/driver/earnings')}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors min-h-[90px]"
              >
                <svg className="w-7 h-7 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Ganancias</span>
              </button>

              {/* Historial */}
              <button
                onClick={() => router.push('/driver/history')}
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

              {/* Ser Pasajero */}
              <button
                onClick={async () => {
                  const result = await Swal.fire({
                    title: '¿Cambiar a modo Pasajero?',
                    html: `<p style="color:#4b5563;font-size:14px;line-height:1.6;">Podrás solicitar viajes como pasajero.<br/>Tu perfil de conductor seguirá activo — puedes regresar cuando quieras.</p>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: '🧍 Sí, modo pasajero',
                    confirmButtonColor: '#008000',
                    cancelButtonText: 'Cancelar',
                    cancelButtonColor: '#6b7280',
                  });
                  if (!result.isConfirmed) return;
                  try {
                    const { apiClient } = await import('@/lib/api-client');
                    await apiClient.put('/users/switch-role', { role: 'passenger' });
                    await refreshUser();
                    await Swal.fire({ icon: 'success', title: '¡Modo pasajero activado!', confirmButtonColor: '#008000', timer: 2500, timerProgressBar: true });
                    router.push('/passenger');
                  } catch {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el modo. Contacta soporte.', confirmButtonColor: '#008000' });
                  }
                }}
                className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center justify-center gap-2 hover:bg-green-50 transition-colors border border-green-100 min-h-[90px]"
              >
                <span className="text-2xl">🧍</span>
                <span className="text-sm font-medium text-[#008000]">Ser Pasajero</span>
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

            {/* Notificaciones por Telegram — ancho completo por su complejidad */}
            <div className="mt-3 bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-6 h-6 mr-3 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#29B6F6"/>
                    <path d="M5.5 11.5l10-4-3.5 10-2-3.5-4.5-2.5z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
                    <path d="M10 13.5l1.5 1.5 2-3" stroke="#29B6F6" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Telegram</p>
                    <p className="text-xs text-gray-500">
                      {telegramLinked ? '✅ Vinculado — recibes alertas de viajes' : 'Recibe alertas aunque el navegador esté cerrado'}
                    </p>
                  </div>
                </div>
                {telegramLinked ? (
                  <button
                    onClick={handleUnlinkTelegram}
                    className="text-xs text-red-500 hover:text-red-700 font-medium ml-2 flex-shrink-0"
                  >
                    Desvincular
                  </button>
                ) : (
                  <button
                    onClick={handleLinkTelegram}
                    disabled={telegramLoading}
                    className="bg-[#29B6F6] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#0288D1] transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
                  >
                    {telegramLoading ? 'Cargando...' : 'Vincular'}
                  </button>
                )}
              </div>
            </div>

            {/* Fotos de lugares visitados */}
            <div className="mt-3 bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#008000]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Fotos de lugares visitados</p>
                  <p className="text-xs text-gray-500">Comparte fotos de los destinos donde llevas a tus pasajeros. Aparecen en la página de inicio.</p>
                </div>
              </div>

              {/* Subir nueva foto */}
              {!placePhotoPreview ? (
                <label className="flex items-center justify-center w-full border-2 border-dashed border-[#008000]/40 rounded-xl p-5 cursor-pointer hover:border-[#008000] hover:bg-[#008000]/5 transition-colors">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-[#008000]/60 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-sm text-[#008000] font-medium">Seleccionar foto</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG · máx. 5MB</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePlacePhotoSelect} />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={placePhotoPreview} alt="Vista previa" className="w-full h-48 object-cover" />
                    <button
                      onClick={() => { setPlacePhotoPreview(null); setSelectedPlacePhoto(null); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Descripción del lugar (opcional)"
                    value={placePhotoCaption}
                    onChange={e => setPlacePhotoCaption(e.target.value)}
                    maxLength={120}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008000]"
                  />
                  <button
                    onClick={handleUploadPlacePhoto}
                    disabled={isUploadingPlacePhoto}
                    className="w-full bg-[#008000] text-white font-semibold py-2 rounded-lg hover:bg-[#006800] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isUploadingPlacePhoto ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Subiendo...
                      </>
                    ) : 'Publicar foto'}
                  </button>
                </div>
              )}

              {/* Galería de fotos propias */}
              {driverPhotos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {driverPhotos.map(photo => {
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
                    return (
                      <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square">
                        <img
                          src={`${API_URL}/images/${photo.image_key}`}
                          alt={photo.caption || 'Foto'}
                          className="w-full h-full object-cover"
                        />
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs truncate">{photo.caption}</p>
                          </div>
                        )}
                        <button
                          onClick={() => handleDeletePlacePhoto(photo.id)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {driverPhotos.length === 0 && !placePhotoPreview && (
                <p className="text-center text-xs text-gray-400 mt-3">Aún no tienes fotos publicadas</p>
              )}
            </div>

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
              onClick={async () => {
                const result = await Swal.fire({
                  title: '¿Eliminar tu cuenta?',
                  html: `<p style="color:#4b5563;font-size:14px;">Esta acción es <strong>irreversible</strong>. Se eliminarán todos tus datos, historial y suscripción.</p>`,
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
              }}
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

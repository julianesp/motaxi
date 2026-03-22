'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { MUNICIPALITIES } from '@/lib/constants/municipalities';
import TrialBanner from '@/components/TrialBanner';
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
  base_fare?: number;
  intercity_fare?: number;
  rural_fare?: number;
  per_km_fare?: number;
}

export default function DriverProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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
    vehicle_model: '',
    vehicle_color: '',
    vehicle_plate: '',
    license_number: '',
    base_fare: '' as number | string,
    intercity_fare: '' as number | string,
    rural_fare: '' as number | string,
    per_km_fare: '' as number | string,
  });

  useEffect(() => {
    if (!loading && (!user || user.role !== 'driver')) {
      router.push('/');
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
    }
  }, [user]);

  const fetchDriverInfo = async () => {
    try {
      const { driversAPI } = await import('@/lib/api-client');
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
        });

        // Inicializar formData del conductor
        setDriverFormData({
          municipality: driver.municipality || '',
          accepts_intercity_trips: driver.accepts_intercity_trips === 1,
          accepts_rural_trips: driver.accepts_rural_trips === 1,
          vehicle_model: driver.vehicle_model || '',
          vehicle_color: driver.vehicle_color || '',
          vehicle_plate: driver.vehicle_plate || '',
          license_number: driver.license_number || '',
          base_fare: driver.base_fare || '',
          intercity_fare: driver.intercity_fare || '',
          rural_fare: driver.rural_fare || '',
          per_km_fare: driver.per_km_fare || '',
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
      Swal.fire({ icon: 'warning', title: 'Formato inválido', text: 'Por favor selecciona una imagen válida.', confirmButtonColor: '#42CE1D' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Imagen muy grande', text: 'La imagen no puede superar 2MB.', confirmButtonColor: '#42CE1D' });
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

      // Guardar foto de perfil si cambió
      if (formData.profile_image) {
        await usersAPI.updateProfile({
          full_name: formData.full_name,
          phone: formData.phone,
          profile_image: formData.profile_image,
        });
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
      Swal.fire({ icon: 'success', title: 'Perfil actualizado', text: 'Perfil actualizado correctamente', confirmButtonColor: '#42CE1D' });
    } catch (error) {
      console.error('Error updating profile:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error al actualizar el perfil. Intenta nuevamente.', confirmButtonColor: '#42CE1D' });
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
      <header className="bg-white shadow-sm">
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
          {/* Trial / Subscription Banner */}
          <div className="mb-4">
            <TrialBanner user={{ id: user.id, full_name: user.full_name, email: user.email, phone: user.phone }} />
          </div>

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
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#42CE1D] hover:bg-[#35a818] rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors"
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
                {/* Badge Conductor Destacado */}
                {driverInfo && driverInfo.rating >= 4.5 && driverInfo.total_trips >= 20 && (
                  <div className="flex items-center gap-1.5 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold mb-2 shadow-md">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Conductor Destacado
                  </div>
                )}
                {driverInfo && (
                  <div className={`px-4 py-2 rounded-full text-sm font-medium border ${getVerificationStatusColor(driverInfo.verification_status)}`}>
                    {getVerificationStatusText(driverInfo.verification_status)}
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
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm text-blue-800 font-medium">Información sobre tarifas</p>
                            <p className="text-xs text-blue-700 mt-1">
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
          <div className="mt-6 space-y-3">
            <button
              onClick={() => router.push('/driver/earnings')}
              className="w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-6 h-6 text-[#008000] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-gray-900">Mis Ganancias</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => router.push('/driver/history')}
              className="w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-6 h-6 text-[#008000] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-gray-900">Historial de Viajes</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <a
              href="mailto:admin@neurai.dev?subject=Soporte%20MoTaxi&body=Hola,%20necesito%20ayuda%20con%20MoTaxi..."
              className="w-full bg-gradient-to-r from-purple-600 to-[#008000] rounded-xl shadow-md p-4 flex items-center justify-between hover:from-purple-700 hover:to-[#006600] transition-all"
            >
              <div className="flex items-center">
                <svg className="w-6 h-6 text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium text-white">Contactar Soporte</span>
              </div>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>

            {/* Cambiar a modo Pasajero */}
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
                  await Swal.fire({ icon: 'success', title: '¡Modo pasajero activado!', confirmButtonColor: '#008000', timer: 2500, timerProgressBar: true });
                  router.push('/passenger');
                } catch {
                  Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el modo. Contacta soporte.', confirmButtonColor: '#008000' });
                }
              }}
              className="w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-blue-50 transition-colors border border-blue-100"
            >
              <div className="flex items-center">
                <span className="text-xl mr-3">🧍</span>
                <div className="text-left">
                  <span className="font-medium text-blue-600 block">Cambiar a modo Pasajero</span>
                  <span className="text-xs text-gray-400">Solicita viajes con tu cuenta</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              className="w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-red-50 transition-colors"
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
                const first = await Swal.fire({
                  title: '¿Eliminar tu cuenta?',
                  html: `<p style="color:#4b5563;font-size:14px;">Esta acción es <strong>irreversible</strong>. Se eliminarán todos tus datos, historial y suscripción.</p>`,
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonText: 'Sí, eliminar',
                  confirmButtonColor: '#dc2626',
                  cancelButtonText: 'Cancelar',
                  cancelButtonColor: '#6b7280',
                });
                if (!first.isConfirmed) return;
                const second = await Swal.fire({
                  title: 'Confirma escribiendo tu email',
                  input: 'email',
                  inputPlaceholder: user?.email,
                  inputAttributes: { autocomplete: 'off' },
                  showCancelButton: true,
                  confirmButtonText: 'Eliminar definitivamente',
                  confirmButtonColor: '#dc2626',
                  cancelButtonColor: '#6b7280',
                  preConfirm: (val) => {
                    if (val !== user?.email) { Swal.showValidationMessage('El email no coincide'); return false; }
                    return val;
                  },
                });
                if (!second.isConfirmed) return;
                try {
                  const { apiClient } = await import('@/lib/api-client');
                  await apiClient.delete('/users/account');
                  await logout();
                  router.push('/');
                } catch {
                  Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar la cuenta. Contacta soporte.', confirmButtonColor: '#008000' });
                }
              }}
              className="w-full bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:bg-red-50 transition-colors border border-red-100"
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

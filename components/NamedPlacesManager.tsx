'use client';

import { useState, useRef } from 'react';
import Swal from 'sweetalert2';
import { useNamedPlaces } from '@/lib/hooks/useNamedPlaces';
import { NamedPlace } from '@/lib/services/namedPlaces';

interface NamedPlacesManagerProps {
  userId: string;
}

export default function NamedPlacesManager({ userId }: NamedPlacesManagerProps) {
  const { savedPlaces, searchResults, search, createPlace, deletePlace, savePlace, unsavePlace } =
    useNamedPlaces();
  const [activeTab, setActiveTab] = useState<'comunidad' | 'guardados'>('guardados');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleCreate = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Agregar lugar conocido',
      html: `
        <div style="text-align:left;font-size:14px;color:#374151;">
          <p style="margin-bottom:12px;">Este lugar quedará visible para todos los usuarios de MoTaxi.</p>
          <label style="display:block;font-weight:600;margin-bottom:4px;">Nombre del lugar *</label>
          <input id="swal-name" class="swal2-input" placeholder="Ej: Cancha La Esperanza, Hospital San Francisco">
          <label style="display:block;font-weight:600;margin:10px 0 4px;">Descripción (opcional)</label>
          <input id="swal-desc" class="swal2-input" placeholder="Ej: Frente al parque principal">
          <label style="display:block;font-weight:600;margin:10px 0 4px;">Dirección de referencia *</label>
          <input id="swal-address" class="swal2-input" placeholder="Ej: Calle 5 #12-30, Sibundoy">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
            <div>
              <label style="display:block;font-weight:600;margin-bottom:4px;">Latitud *</label>
              <input id="swal-lat" class="swal2-input" placeholder="1.2345" type="number" step="any">
            </div>
            <div>
              <label style="display:block;font-weight:600;margin-bottom:4px;">Longitud *</label>
              <input id="swal-lng" class="swal2-input" placeholder="-77.1234" type="number" step="any">
            </div>
          </div>
          <button id="swal-gps-btn" style="margin-top:10px;width:100%;padding:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;color:#166534;font-size:13px;cursor:pointer;">
            📍 Usar mi ubicación actual
          </button>
        </div>
      `,
      confirmButtonText: 'Guardar lugar',
      confirmButtonColor: '#008000',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      didOpen: () => {
        document.getElementById('swal-gps-btn')?.addEventListener('click', () => {
          navigator.geolocation?.getCurrentPosition((pos) => {
            (document.getElementById('swal-lat') as HTMLInputElement).value =
              pos.coords.latitude.toFixed(6);
            (document.getElementById('swal-lng') as HTMLInputElement).value =
              pos.coords.longitude.toFixed(6);
          });
        });
      },
      preConfirm: () => {
        const name = (document.getElementById('swal-name') as HTMLInputElement).value.trim();
        const description = (document.getElementById('swal-desc') as HTMLInputElement).value.trim();
        const address = (document.getElementById('swal-address') as HTMLInputElement).value.trim();
        const lat = parseFloat((document.getElementById('swal-lat') as HTMLInputElement).value);
        const lng = parseFloat((document.getElementById('swal-lng') as HTMLInputElement).value);

        if (!name) { Swal.showValidationMessage('El nombre es requerido'); return false; }
        if (!address) { Swal.showValidationMessage('La dirección es requerida'); return false; }
        if (isNaN(lat) || isNaN(lng)) { Swal.showValidationMessage('Ingresa coordenadas válidas'); return false; }

        return { name, description: description || undefined, address, latitude: lat, longitude: lng };
      },
    });

    if (!formValues) return;

    try {
      await createPlace(formValues);
      Swal.fire({
        icon: 'success',
        title: '¡Lugar creado!',
        text: 'Ya está visible para todos los usuarios.',
        confirmButtonColor: '#008000',
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#008000' });
    }
  };

  const handleDelete = async (place: NamedPlace) => {
    const result = await Swal.fire({
      title: `¿Eliminar "${place.name}"?`,
      text: 'Este lugar dejará de aparecer para todos los usuarios.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#6b7280',
    });
    if (!result.isConfirmed) return;
    try {
      await deletePlace(place.id);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#008000' });
    }
  };

  const handleToggleSave = async (place: NamedPlace) => {
    try {
      if (place.is_saved) {
        await unsavePlace(place.id);
      } else {
        await savePlace(place.id);
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#008000' });
    }
  };

  const displayList: NamedPlace[] = activeTab === 'guardados'
    ? savedPlaces
    : searchResults;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#008000] to-[#006600] px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-base">Lugares conocidos</h3>
          <p className="text-green-100 text-xs mt-0.5">Ayuda a todos con referencias del Valle</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-white text-[#008000] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
        >
          + Agregar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('guardados')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'guardados'
              ? 'text-[#008000] border-b-2 border-[#008000]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Mis guardados ({savedPlaces.length})
        </button>
        <button
          onClick={() => setActiveTab('comunidad')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'comunidad'
              ? 'text-[#008000] border-b-2 border-[#008000]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Comunidad
        </button>
      </div>

      {/* Búsqueda (solo en tab comunidad) */}
      {activeTab === 'comunidad' && (
        <div className="px-4 pt-3 pb-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar lugar por nombre..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000] bg-gray-50 text-gray-900"
          />
        </div>
      )}

      {/* Lista */}
      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {displayList.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            {activeTab === 'guardados'
              ? 'No tienes lugares guardados aún'
              : searchQuery.length >= 2
              ? 'No se encontraron lugares'
              : 'Escribe para buscar lugares'}
          </div>
        ) : (
          displayList.map((place) => (
            <div key={place.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#008000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{place.name}</p>
                {place.description && (
                  <p className="text-xs text-gray-500">{place.description}</p>
                )}
                <p className="text-xs text-gray-400 truncate">{place.address.split(',')[0]}</p>
                {place.creator_name && (
                  <p className="text-xs text-gray-300 mt-0.5">por {place.creator_name}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Botón guardar/quitar */}
                <button
                  onClick={() => handleToggleSave(place)}
                  title={place.is_saved ? 'Quitar de guardados' : 'Guardar'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    place.is_saved
                      ? 'text-yellow-500 hover:bg-yellow-50'
                      : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill={place.is_saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                {/* Botón eliminar (solo el creador) */}
                {place.created_by === userId && (
                  <button
                    onClick={() => handleDelete(place)}
                    title="Eliminar lugar"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

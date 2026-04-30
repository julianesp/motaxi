'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'passenger' | 'driver';
  created_at: number;
  subscription_status: string | null;
  subscription_days_remaining: number | null;
  verification_status: string | null;
  is_available: number | null;
  driver_rating: number | null;
  driver_total_trips: number | null;
  passenger_rating: number | null;
  passenger_total_trips: number | null;
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const params = roleFilter ? `?role=${roleFilter}` : '';
      const res = await apiClient.get(`/admin/users${params}`);
      setUsers(res.data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const confirmDelete = (id: string, name: string) => {
    setDeleteId(id);
    setDeleteName(name);
  };

  const deleteUser = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/users/${deleteId}`);
      setDeleteId(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q);
  });

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const getSubColor = (status: string | null, days: number | null) => {
    if (!status) return 'text-gray-500';
    if (status === 'expired') return 'text-red-400';
    if (status === 'active' && days !== null && days <= 3) return 'text-red-400';
    if (status === 'active' && days !== null && days <= 7) return 'text-yellow-400';
    if (status === 'active') return 'text-[#008000]';
    if (status === 'trial') return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getSubLabel = (status: string | null, days: number | null) => {
    if (!status) return '—';
    if (status === 'expired') return 'Expirada';
    if (status === 'active') return days !== null ? `Activa · ${days}d` : 'Activa';
    if (status === 'trial') return days !== null ? `Prueba · ${days}d` : 'Prueba';
    if (status === 'cancelled') return 'Cancelada';
    return status;
  };

  const totals = {
    total: users.length,
    drivers: users.filter(u => u.role === 'driver').length,
    passengers: users.filter(u => u.role === 'passenger').length,
    today: users.filter(u => u.created_at >= Math.floor(new Date().setHours(0,0,0,0) / 1000)).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <p className="text-gray-400 text-sm">{totals.total} usuarios · {totals.drivers} conductores · {totals.passengers} pasajeros · +{totals.today} hoy</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar nombre, email, teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#008000]"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#008000]"
        >
          <option value="">Todos los roles</option>
          <option value="driver">Conductores</option>
          <option value="passenger">Pasajeros</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Rol</th>
                  <th className="px-4 py-3 text-left">Suscripción</th>
                  <th className="px-4 py-3 text-left">Viajes</th>
                  <th className="px-4 py-3 text-left">Registrado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">No hay usuarios</td>
                  </tr>
                ) : filtered.map(user => (
                  <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{user.full_name}</p>
                      <p className="text-gray-400 text-xs">{user.email}</p>
                      <p className="text-gray-500 text-xs">{user.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        user.role === 'driver'
                          ? 'text-[#008000] bg-[#008000]/10'
                          : 'text-blue-400 bg-blue-400/10'
                      }`}>
                        {user.role === 'driver' ? 'Conductor' : 'Pasajero'}
                      </span>
                      {user.role === 'driver' && user.verification_status && (
                        <p className="text-xs text-gray-500 mt-1">
                          {user.verification_status === 'approved' ? '✓ Verificado' :
                           user.verification_status === 'pending' ? '⏳ Pendiente' : '✗ Rechazado'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${getSubColor(user.subscription_status, user.subscription_days_remaining)}`}>
                        {getSubLabel(user.subscription_status, user.subscription_days_remaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {user.role === 'driver'
                        ? user.driver_total_trips !== null ? `${user.driver_total_trips} viajes · ⭐${user.driver_rating?.toFixed(1) ?? '—'}` : '—'
                        : user.passenger_total_trips !== null ? `${user.passenger_total_trips} viajes` : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => confirmDelete(user.id, user.full_name)}
                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Eliminar usuario"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white">Eliminar usuario</p>
                <p className="text-sm text-gray-400">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              ¿Estás seguro que quieres eliminar a <span className="font-semibold text-white">{deleteName}</span> y todos sus datos?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={deleteUser}
                disabled={deleting}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

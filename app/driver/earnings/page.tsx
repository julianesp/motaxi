'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface Trip {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  fare: number;
  distance_km: number;
  completed_at: number;
  driver_rating?: number;
}

interface EarningsSummary {
  today: number;
  week: number;
  month: number;
  total: number;
  totalTrips: number;
}

export default function DriverEarningsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [summary, setSummary] = useState<EarningsSummary>({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
    totalTrips: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'driver')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'driver') {
      fetchEarnings();
    }
  }, [user]);

  const fetchEarnings = async () => {
    try {
      const { driversAPI } = await import('@/lib/api-client');
      const response = await driversAPI.getEarnings();

      if (response.trips) {
        const completedTrips = response.trips;
        setTrips(completedTrips);

        // Calcular resúmenes
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime() / 1000;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;

        const todayEarnings = completedTrips
          .filter((t: Trip) => t.completed_at >= todayStart)
          .reduce((sum: number, t: Trip) => sum + (t.fare || 0), 0);

        const weekEarnings = completedTrips
          .filter((t: Trip) => t.completed_at >= weekStart)
          .reduce((sum: number, t: Trip) => sum + (t.fare || 0), 0);

        const monthEarnings = completedTrips
          .filter((t: Trip) => t.completed_at >= monthStart)
          .reduce((sum: number, t: Trip) => sum + (t.fare || 0), 0);

        const totalEarnings = completedTrips.reduce((sum: number, t: Trip) => sum + (t.fare || 0), 0);

        setSummary({
          today: todayEarnings,
          week: weekEarnings,
          month: monthEarnings,
          total: totalEarnings,
          totalTrips: completedTrips.length,
        });
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
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
            <h1 className="text-xl font-bold text-indigo-600">Mis Ganancias</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container-app py-6">
        <div className="max-w-4xl mx-auto">
          {/* Earnings Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Today */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-90">Hoy</span>
                <svg className="w-8 h-8 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold">${summary.today.toLocaleString()}</p>
            </div>

            {/* Week */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-90">Esta Semana</span>
                <svg className="w-8 h-8 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-3xl font-bold">${summary.week.toLocaleString()}</p>
            </div>

            {/* Month */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-90">Este Mes</span>
                <svg className="w-8 h-8 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-3xl font-bold">${summary.month.toLocaleString()}</p>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-90">Total</span>
                <svg className="w-8 h-8 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <p className="text-3xl font-bold">${summary.total.toLocaleString()}</p>
              <p className="text-sm opacity-90 mt-2">{summary.totalTrips} viajes</p>
            </div>
          </div>

          {/* Recent Trips */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
              <h2 className="text-xl font-bold">Historial de Viajes Completados</h2>
            </div>

            {trips.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No hay viajes completados</h3>
                <p className="text-gray-500">Tus viajes completados aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {trips.map((trip) => (
                  <div key={trip.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-start space-x-2 mb-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">Origen</p>
                            <p className="text-gray-900 font-medium">{trip.pickup_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">Destino</p>
                            <p className="text-gray-900 font-medium">{trip.dropoff_address}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-indigo-600">${trip.fare.toLocaleString()}</p>
                        <p className="text-sm text-gray-500">{trip.distance_km} km</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center text-sm text-gray-500">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(trip.completed_at)}
                        </div>
                        {trip.driver_rating && (
                          <div className="flex items-center text-sm text-yellow-600">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {trip.driver_rating.toFixed(1)} estrellas
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

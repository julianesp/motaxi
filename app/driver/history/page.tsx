'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { tripsAPI } from '@/lib/api-client';

interface Trip {
  id: string;
  passenger_id: string;
  pickup_address: string;
  dropoff_address: string;
  fare: number;
  distance_km: number;
  status: string;
  created_at: number;
  completed_at?: number;
  passenger_rating?: number;
  passenger_comment?: string;
}

interface DayStats {
  date: string;
  trips: number;
  earnings: number;
}

export default function DriverHistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'driver')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await tripsAPI.getTripHistory();
        setTrips(data.trips || []);
      } catch (error) {
        console.error('Error fetching trip history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === 'driver') {
      fetchHistory();
    }
  }, [user]);

  // Calcular estadísticas
  const calculateStats = () => {
    const completedTrips = trips.filter(t => t.status === 'completed');
    const totalEarnings = completedTrips.reduce((sum, t) => sum + t.fare, 0);
    const totalTrips = completedTrips.length;
    const averageEarnings = totalTrips > 0 ? totalEarnings / totalTrips : 0;

    // Agrupar por fecha
    const tripsByDate: { [key: string]: DayStats } = {};
    completedTrips.forEach(trip => {
      const date = new Date(trip.completed_at! * 1000).toLocaleDateString('es-ES');
      if (!tripsByDate[date]) {
        tripsByDate[date] = { date, trips: 0, earnings: 0 };
      }
      tripsByDate[date].trips += 1;
      tripsByDate[date].earnings += trip.fare;
    });

    const dayStats = Object.values(tripsByDate);

    // Encontrar el mejor día por ganancias
    const bestEarningsDay = dayStats.reduce((best, day) =>
      day.earnings > best.earnings ? day : best,
      { date: '', trips: 0, earnings: 0 }
    );

    // Encontrar el día con más viajes
    const mostTripsDay = dayStats.reduce((best, day) =>
      day.trips > best.trips ? day : best,
      { date: '', trips: 0, earnings: 0 }
    );

    return {
      totalEarnings,
      totalTrips,
      averageEarnings,
      bestEarningsDay,
      mostTripsDay,
      dayStats
    };
  };

  const stats = calculateStats();

  // Filtrar viajes por período
  const filterTripsByPeriod = () => {
    const now = new Date();
    const completedTrips = trips.filter(t => t.status === 'completed');

    return completedTrips.filter(trip => {
      const tripDate = new Date(trip.completed_at! * 1000);

      if (selectedPeriod === 'day') {
        return tripDate.toDateString() === now.toDateString();
      } else if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return tripDate >= weekAgo;
      } else {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return tripDate >= monthAgo;
      }
    });
  };

  const filteredTrips = filterTripsByPeriod();
  const periodEarnings = filteredTrips.reduce((sum, t) => sum + t.fare, 0);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando historial...</p>
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
            <h1 className="text-xl font-bold text-indigo-600">Historial de Viajes</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container-app py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Estadísticas Generales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-1">Total de Viajes</p>
                  <p className="text-3xl font-bold">{stats.totalTrips}</p>
                </div>
                <svg className="w-12 h-12 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm mb-1">Ganancias Totales</p>
                  <p className="text-3xl font-bold">${stats.totalEarnings.toLocaleString()}</p>
                </div>
                <svg className="w-12 h-12 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm mb-1">Promedio por Viaje</p>
                  <p className="text-3xl font-bold">${Math.round(stats.averageEarnings).toLocaleString()}</p>
                </div>
                <svg className="w-12 h-12 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          {/* Mejores Días */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-yellow-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-900">Mejor Día de Ganancias</h3>
              </div>
              {stats.bestEarningsDay.date ? (
                <div>
                  <p className="text-gray-600 text-sm mb-2">{stats.bestEarningsDay.date}</p>
                  <p className="text-3xl font-bold text-green-600">${stats.bestEarningsDay.earnings.toLocaleString()}</p>
                  <p className="text-gray-500 text-sm mt-1">{stats.bestEarningsDay.trips} viajes</p>
                </div>
              ) : (
                <p className="text-gray-500">No hay datos disponibles</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-indigo-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-900">Día con Más Viajes</h3>
              </div>
              {stats.mostTripsDay.date ? (
                <div>
                  <p className="text-gray-600 text-sm mb-2">{stats.mostTripsDay.date}</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.mostTripsDay.trips} viajes</p>
                  <p className="text-gray-500 text-sm mt-1">${stats.mostTripsDay.earnings.toLocaleString()} ganados</p>
                </div>
              ) : (
                <p className="text-gray-500">No hay datos disponibles</p>
              )}
            </div>
          </div>

          {/* Filtros de Período */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Viajes Recientes</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPeriod('day')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPeriod === 'day'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setSelectedPeriod('week')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPeriod === 'week'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setSelectedPeriod('month')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPeriod === 'month'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Mes
                </button>
              </div>
            </div>

            {/* Resumen del Período */}
            <div className="bg-indigo-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-600 font-medium">
                    {selectedPeriod === 'day' ? 'Hoy' : selectedPeriod === 'week' ? 'Esta Semana' : 'Este Mes'}
                  </p>
                  <p className="text-2xl font-bold text-indigo-900">${periodEarnings.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-indigo-600 font-medium">{filteredTrips.length} viajes</p>
                  <p className="text-sm text-indigo-500">
                    Promedio: ${filteredTrips.length > 0 ? Math.round(periodEarnings / filteredTrips.length).toLocaleString() : 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de Viajes */}
            <div className="space-y-4">
              {filteredTrips.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500">No hay viajes en este período</p>
                </div>
              ) : (
                filteredTrips.map((trip) => (
                  <div key={trip.id} className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                          <p className="text-sm text-gray-600 line-clamp-1">{trip.pickup_address}</p>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                          <p className="text-sm text-gray-600 line-clamp-1">{trip.dropoff_address}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xl font-bold text-green-600">${trip.fare.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{trip.distance_km.toFixed(1)} km</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center text-sm text-gray-500">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(trip.completed_at! * 1000).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {trip.passenger_rating && (
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">{trip.passenger_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {trip.passenger_comment && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-sm text-gray-600 italic">"{trip.passenger_comment}"</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

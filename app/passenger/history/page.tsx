'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { tripsAPI } from '@/lib/api-client';
import { GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { useGoogleMaps } from '@/lib/google-maps-provider';

interface Trip {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  fare: number;
  distance_km: number;
  status: string;
  created_at: number;
  completed_at?: number;
  driver_name?: string;
  driver_rating?: number;
  driver_comment?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
}

function TripMapModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    if (!isLoaded || !trip.pickup_latitude || !trip.dropoff_latitude) return;
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: { lat: trip.pickup_latitude, lng: trip.pickup_longitude! },
        destination: { lat: trip.dropoff_latitude, lng: trip.dropoff_longitude! },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        }
      }
    );
  }, [isLoaded, trip]);

  const center = trip.pickup_latitude
    ? { lat: (trip.pickup_latitude + trip.dropoff_latitude!) / 2, lng: (trip.pickup_longitude! + trip.dropoff_longitude!) / 2 }
    : { lat: 1.1656, lng: -77.0 };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex flex-col">
      {/* Header del modal */}
      <div className="bg-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-bold text-gray-900">Recorrido del viaje</h2>
          <p className="text-xs text-gray-500">{trip.distance_km?.toFixed(1)} km · ${trip.fare?.toLocaleString()}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Direcciones */}
      <div className="bg-gray-50 px-4 py-2 flex-shrink-0 space-y-1">
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2 flex-shrink-0"></div>
          <span className="line-clamp-1">{trip.pickup_address}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2 flex-shrink-0"></div>
          <span className="line-clamp-1">{trip.dropoff_address}</span>
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1">
        {!isLoaded ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008000]"></div>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={13}
            options={{ disableDefaultUI: true, gestureHandling: 'greedy' }}
          >
            {directions ? (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: { strokeColor: '#008000', strokeWeight: 5, strokeOpacity: 0.8 },
                }}
              />
            ) : null}
            {trip.pickup_latitude && (
              <Marker
                position={{ lat: trip.pickup_latitude, lng: trip.pickup_longitude! }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10, fillColor: '#10b981', fillOpacity: 1,
                  strokeColor: '#fff', strokeWeight: 3,
                }}
                title="Punto de recogida"
              />
            )}
            {trip.dropoff_latitude && (
              <Marker
                position={{ lat: trip.dropoff_latitude, lng: trip.dropoff_longitude! }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10, fillColor: '#ef4444', fillOpacity: 1,
                  strokeColor: '#fff', strokeWeight: 3,
                }}
                title="Destino"
              />
            )}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}

export default function PassengerHistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [mapTrip, setMapTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'passenger')) {
      if (user?.role === 'driver') router.push('/driver');
      else router.push('/');
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
    if (user?.role === 'passenger') fetchHistory();
  }, [user]);

  const completedTrips = trips.filter(t => t.status === 'completed');
  const totalTrips = completedTrips.length;
  const totalSpent = completedTrips.reduce((sum, t) => sum + t.fare, 0);
  const avgFare = totalTrips > 0 ? totalSpent / totalTrips : 0;

  const filterTripsByPeriod = () => {
    const now = new Date();
    return completedTrips.filter(trip => {
      const tripDate = new Date((trip.completed_at ?? trip.created_at) * 1000);
      if (selectedPeriod === 'day') return tripDate.toDateString() === now.toDateString();
      if (selectedPeriod === 'week') return tripDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return tripDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    });
  };

  const filteredTrips = filterTripsByPeriod();
  const periodSpent = filteredTrips.reduce((sum, t) => sum + t.fare, 0);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal del mapa */}
      {mapTrip && <TripMapModal trip={mapTrip} onClose={() => setMapTrip(null)} />}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} className="flex items-center text-gray-600 hover:text-gray-900">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h1 className="text-xl font-bold text-[#008000]">Mis Viajes</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <div className="container-app py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Estadísticas generales */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-[#008000] to-[#006600] rounded-2xl shadow-lg p-4 text-white text-center">
              <p className="text-green-100 text-xs mb-1">Total viajes</p>
              <p className="text-3xl font-bold">{totalTrips}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 text-white text-center">
              <p className="text-blue-100 text-xs mb-1">Total gastado</p>
              <p className="text-2xl font-bold">${totalSpent.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-4 text-white text-center">
              <p className="text-purple-100 text-xs mb-1">Promedio</p>
              <p className="text-2xl font-bold">${Math.round(avgFare).toLocaleString()}</p>
            </div>
          </div>

          {/* Filtros y lista */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Viajes recientes</h3>
              <div className="flex gap-2">
                {(['day', 'week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPeriod === p ? 'bg-[#008000] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen del período */}
            <div className="bg-green-50 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[#008000] font-medium text-sm">
                  {selectedPeriod === 'day' ? 'Hoy' : selectedPeriod === 'week' ? 'Esta semana' : 'Este mes'}
                </p>
                <p className="text-2xl font-bold text-[#003300]">${periodSpent.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[#008000] font-medium">{filteredTrips.length} viajes</p>
                <p className="text-sm text-green-500">
                  Promedio: ${filteredTrips.length > 0 ? Math.round(periodSpent / filteredTrips.length).toLocaleString() : 0}
                </p>
              </div>
            </div>

            {/* Lista de viajes */}
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
                  <div key={trip.id} className="border border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-2 flex-shrink-0"></div>
                          <p className="text-sm text-gray-600 line-clamp-1">{trip.pickup_address}</p>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-2 flex-shrink-0"></div>
                          <p className="text-sm text-gray-600 line-clamp-1">{trip.dropoff_address}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-xl font-bold text-[#008000]">${trip.fare?.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{trip.distance_km?.toFixed(1)} km</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center text-sm text-gray-500">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(((trip.completed_at ?? trip.created_at)) * 1000).toLocaleString('es-ES', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                      <div className="flex items-center gap-3">
                        {trip.driver_rating && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">{trip.driver_rating.toFixed(1)}</span>
                          </div>
                        )}
                        {/* Botón Ver recorrido */}
                        {trip.pickup_latitude && trip.dropoff_latitude && (
                          <button
                            onClick={() => setMapTrip(trip)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-[#008000] border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Ver recorrido
                          </button>
                        )}
                      </div>
                    </div>

                    {trip.driver_name && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center text-sm text-gray-500">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {trip.driver_name}
                      </div>
                    )}
                    {trip.driver_comment && (
                      <div className="mt-1 text-sm text-gray-600 italic">"{trip.driver_comment}"</div>
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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatabaseService } from '../../services/database.service';
import { useAuth } from '../../contexts/AuthContext';
import { Trip } from '../../types';
import { Ionicons } from '@expo/vector-icons';

const TripHistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    if (!user) return;

    const userTrips = await DatabaseService.getUserTrips(user.id, user.role);
    setTrips(userTrips);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'in_progress':
        return '#2196F3';
      default:
        return '#FF9800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'cancelled':
        return 'Cancelado';
      case 'in_progress':
        return 'En progreso';
      case 'accepted':
        return 'Aceptado';
      case 'driver_arriving':
        return 'Conductor en camino';
      case 'requested':
        return 'Solicitado';
      default:
        return status;
    }
  };

  const renderTripItem = ({ item }: { item: Trip }) => {
    const date = new Date(item.requested_at);
    const formattedDate = date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.tripHeaderLeft}>
            <Ionicons
              name={item.status === 'completed' ? 'checkmark-circle' : 'bicycle'}
              size={24}
              color={getStatusColor(item.status)}
            />
            <Text style={[styles.tripStatus, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
          <Text style={styles.tripFare}>${item.fare.toLocaleString()}</Text>
        </View>

        <View style={styles.tripDetails}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#FF6B6B" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.pickup_address || item.pickup_location?.address || 'Punto de recogida'}
            </Text>
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#4CAF50" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.dropoff_address || item.dropoff_location?.address || 'Destino'}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <Text style={styles.tripDate}>
            {formattedDate} • {formattedTime}
          </Text>
          {item.distance_km && (
            <Text style={styles.tripDistance}>{item.distance_km.toFixed(2)} km</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Viajes</Text>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No tienes viajes registrados</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tripsList}
          refreshing={loading}
          onRefresh={loadTrips}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  tripsList: {
    padding: 15,
    gap: 15,
  },
  tripCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  tripHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  tripFare: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tripDetails: {
    gap: 10,
    marginBottom: 15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  tripDate: {
    fontSize: 12,
    color: '#999',
  },
  tripDistance: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
});

export default TripHistoryScreen;

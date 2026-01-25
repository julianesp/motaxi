import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatabaseService } from '../../services/database.service';
import { useAuth } from '../../contexts/AuthContext';
import { Trip } from '../../types';
import { Ionicons } from '@expo/vector-icons';

const EarningsScreen: React.FC = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    if (!user) return;

    const completedTrips = await DatabaseService.getUserTrips(user.id, 'driver');
    const completed = completedTrips.filter((trip) => trip.status === 'completed');
    setTrips(completed);
    setLoading(false);
  };

  const calculateTotalEarnings = () => {
    return trips.reduce((total, trip) => total + trip.fare, 0);
  };

  const calculateTodayEarnings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return trips
      .filter((trip) => {
        const tripDate = new Date(trip.completed_at || '');
        tripDate.setHours(0, 0, 0, 0);
        return tripDate.getTime() === today.getTime();
      })
      .reduce((total, trip) => total + trip.fare, 0);
  };

  const calculateWeekEarnings = () => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return trips
      .filter((trip) => {
        const tripDate = new Date(trip.completed_at || '');
        return tripDate >= weekAgo;
      })
      .reduce((total, trip) => total + trip.fare, 0);
  };

  const calculateMonthEarnings = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return trips
      .filter((trip) => {
        const tripDate = new Date(trip.completed_at || '');
        return (
          tripDate.getMonth() === currentMonth &&
          tripDate.getFullYear() === currentYear
        );
      })
      .reduce((total, trip) => total + trip.fare, 0);
  };

  const calculateTotalDistance = () => {
    return trips.reduce((total, trip) => total + (trip.distance_km || 0), 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mis Ganancias</Text>
        </View>

        <View style={styles.totalContainer}>
          <Ionicons name="wallet" size={40} color="white" />
          <Text style={styles.totalLabel}>Total Ganado</Text>
          <Text style={styles.totalAmount}>
            ${calculateTotalEarnings().toLocaleString()}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="today" size={24} color="#4CAF50" />
            <Text style={styles.statLabel}>Hoy</Text>
            <Text style={styles.statValue}>
              ${calculateTodayEarnings().toLocaleString()}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar" size={24} color="#2196F3" />
            <Text style={styles.statLabel}>Esta Semana</Text>
            <Text style={styles.statValue}>
              ${calculateWeekEarnings().toLocaleString()}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color="#FF9800" />
            <Text style={styles.statLabel}>Este Mes</Text>
            <Text style={styles.statValue}>
              ${calculateMonthEarnings().toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Resumen</Text>

          <View style={styles.summaryItem}>
            <View style={styles.summaryItemLeft}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.summaryLabel}>Viajes Completados</Text>
            </View>
            <Text style={styles.summaryValue}>{trips.length}</Text>
          </View>

          <View style={styles.summaryItem}>
            <View style={styles.summaryItemLeft}>
              <Ionicons name="navigate" size={20} color="#2196F3" />
              <Text style={styles.summaryLabel}>Distancia Total</Text>
            </View>
            <Text style={styles.summaryValue}>
              {calculateTotalDistance().toFixed(2)} km
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <View style={styles.summaryItemLeft}>
              <Ionicons name="cash" size={20} color="#FF9800" />
              <Text style={styles.summaryLabel}>Promedio por Viaje</Text>
            </View>
            <Text style={styles.summaryValue}>
              {trips.length > 0
                ? `$${Math.round(calculateTotalEarnings() / trips.length).toLocaleString()}`
                : '$0'}
            </Text>
          </View>
        </View>

        {trips.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="bicycle-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>
              Aún no has completado ningún viaje
            </Text>
          </View>
        )}
      </ScrollView>
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
  totalContainer: {
    backgroundColor: '#4CAF50',
    margin: 15,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 10,
  },
  totalAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryContainer: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
});

export default EarningsScreen;

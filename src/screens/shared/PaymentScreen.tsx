import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api';

interface PaymentMethod {
  id: string;
  type: 'pse' | 'nequi' | 'daviplata' | 'card' | 'cash';
  bank_name?: string;
  phone?: string;
  card_last_four?: string;
  card_brand?: string;
}

interface Trip {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  fare: number;
  distance: number;
  duration: number;
  driver_name: string;
}

export const PaymentScreen = ({ route, navigation }: any) => {
  const { tripId } = route.params;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [tripRes, methodsRes] = await Promise.all([
        apiClient.get(`/trips/${tripId}`),
        apiClient.get('/payments/methods'),
      ]);

      setTrip(tripRes.data.trip);
      setMethods(methodsRes.data.methods || []);

      // Auto-seleccionar efectivo si existe
      const cashMethod = methodsRes.data.methods.find((m: PaymentMethod) => m.type === 'cash');
      if (cashMethod) {
        setSelectedMethod(cashMethod.id);
      } else if (methodsRes.data.methods.length > 0) {
        setSelectedMethod(methodsRes.data.methods[0].id);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.response?.data?.error || 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Selecciona un método de pago');
      return;
    }

    const method = methods.find(m => m.id === selectedMethod);
    if (!method) return;

    try {
      setProcessing(true);

      const response = await apiClient.post('/payments/process', {
        trip_id: tripId,
        payment_method_id: selectedMethod,
      });

      const { transaction, payment_url } = response.data;

      // Si es efectivo, ya está aprobado
      if (method.type === 'cash') {
        Alert.alert(
          'Pago Registrado',
          'El pago en efectivo ha sido registrado correctamente.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'PassengerHome' }],
                });
              },
            },
          ]
        );
        return;
      }

      // Si es método electrónico, abrir URL de pago
      if (payment_url) {
        Alert.alert(
          'Procesar Pago',
          'Serás redirigido a la plataforma de pago segura.',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => setProcessing(false),
            },
            {
              text: 'Continuar',
              onPress: async () => {
                try {
                  const canOpen = await Linking.canOpenURL(payment_url);
                  if (canOpen) {
                    await Linking.openURL(payment_url);

                    // Mostrar mensaje de espera
                    Alert.alert(
                      'Pago en Proceso',
                      'Una vez completes el pago, recibirás una notificación de confirmación.',
                      [
                        {
                          text: 'OK',
                          onPress: () => {
                            navigation.reset({
                              index: 0,
                              routes: [{ name: 'PassengerHome' }],
                            });
                          },
                        },
                      ]
                    );
                  } else {
                    Alert.alert('Error', 'No se pudo abrir el enlace de pago');
                  }
                } catch (error) {
                  console.error('Error opening payment URL:', error);
                  Alert.alert('Error', 'No se pudo abrir el enlace de pago');
                } finally {
                  setProcessing(false);
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Error', error.response?.data?.error || 'No se pudo procesar el pago');
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'pse': return 'business-outline';
      case 'nequi': return 'phone-portrait-outline';
      case 'daviplata': return 'phone-portrait-outline';
      case 'card': return 'card-outline';
      case 'cash': return 'cash-outline';
      default: return 'card-outline';
    }
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method.type) {
      case 'pse':
        return `PSE - ${method.bank_name}`;
      case 'nequi':
        return `Nequi - ${method.phone}`;
      case 'daviplata':
        return `Daviplata - ${method.phone}`;
      case 'card':
        return `${method.card_brand} •••• ${method.card_last_four}`;
      case 'cash':
        return 'Efectivo';
      default:
        return 'Método de pago';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>No se pudo cargar la información del viaje</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Trip Summary */}
        <View style={styles.tripCard}>
          <Text style={styles.tripTitle}>Resumen del Viaje</Text>

          <View style={styles.locationRow}>
            <View style={styles.locationDot} style={[styles.locationDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {trip.pickup_address}
            </Text>
          </View>

          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: '#F44336' }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {trip.dropoff_address}
            </Text>
          </View>

          <View style={styles.tripStats}>
            <View style={styles.tripStat}>
              <Ionicons name="navigate-outline" size={16} color="#666" />
              <Text style={styles.tripStatText}>{formatDistance(trip.distance)}</Text>
            </View>
            <View style={styles.tripStat}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.tripStatText}>{formatDuration(trip.duration)}</Text>
            </View>
          </View>

          <View style={styles.driverRow}>
            <Ionicons name="person-circle-outline" size={24} color="#666" />
            <Text style={styles.driverText}>Conductor: {trip.driver_name}</Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total a Pagar</Text>
          <Text style={styles.amountValue}>{formatCurrency(trip.fare)}</Text>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Método de Pago</Text>

          {methods.length === 0 ? (
            <View style={styles.emptyMethods}>
              <Ionicons name="card-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No tienes métodos de pago</Text>
              <TouchableOpacity
                style={styles.addMethodButton}
                onPress={() => navigation.navigate('PaymentMethods')}
              >
                <Text style={styles.addMethodButtonText}>Agregar Método</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {methods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodCard,
                    selectedMethod === method.id && styles.methodCardSelected,
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                >
                  <View style={styles.methodIcon}>
                    <Ionicons
                      name={getMethodIcon(method.type)}
                      size={24}
                      color={selectedMethod === method.id ? '#007AFF' : '#666'}
                    />
                  </View>

                  <View style={styles.methodDetails}>
                    <Text style={styles.methodLabel}>{getMethodLabel(method)}</Text>
                  </View>

                  {selectedMethod === method.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.addMethodLink}
                onPress={() => navigation.navigate('PaymentMethods')}
              >
                <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                <Text style={styles.addMethodLinkText}>Agregar otro método</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#4CAF50" />
          <Text style={styles.infoText}>
            Tus pagos están protegidos con encriptación de nivel bancario
          </Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      {methods.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.payButton, processing && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.payButtonText}>
                  Pagar {formatCurrency(trip.fare)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  tripCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: '#666',
  },
  tripStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  tripStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripStatText: {
    fontSize: 14,
    color: '#666',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  driverText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  amountCard: {
    backgroundColor: '#007AFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodDetails: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  addMethodLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  addMethodLinkText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyMethods: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  addMethodButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addMethodButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#4CAF50',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  payButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
});

export default PaymentScreen;

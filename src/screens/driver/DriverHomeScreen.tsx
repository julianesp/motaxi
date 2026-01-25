import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LocationService } from '../../services/location.service';
import { DatabaseService } from '../../services/database.service';
import { useAuth } from '../../contexts/AuthContext';
import { Location, Trip } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { useActiveTripPolling } from '../../hooks/useActiveTripPolling';
import * as Notifications from 'expo-notifications';
import { RatingModal } from '../../components/RatingModal';
import { ShareTripModal } from '../../components/ShareTripModal';
import { apiClient } from '../../services/api';

const DriverHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [locationSubscription, setLocationSubscription] =
    useState<ExpoLocation.LocationSubscription | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [completedTripId, setCompletedTripId] = useState<string | null>(null);
  const [passengerName, setPassengerName] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<string>('pending');
  const [sosActive, setSosActive] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Hook de polling para obtener viajes activos en tiempo real
  const { activeTrips, loading: loadingTrips, refresh: refreshTrips } = useActiveTripPolling({
    enabled: isAvailable && !currentTrip,
    pollingInterval: 10000, // 10 segundos
    onNewTrip: (trip) => {
      // Notificación local cuando hay un nuevo viaje
      Notifications.scheduleNotificationAsync({
        content: {
          title: '¡Nuevo viaje disponible!',
          body: `${trip.pickup_location?.address || 'Nueva solicitud'} - $${trip.fare.toLocaleString()}`,
          sound: true,
        },
        trigger: null,
      });
    },
  });

  useEffect(() => {
    loadCurrentLocation();
    setupNotifications();
    loadVerificationStatus();

    return () => {
      if (locationSubscription) {
        LocationService.stopLocationTracking(locationSubscription);
      }
    };
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const response = await DatabaseService.getUser(user?.id || '');
      // TODO: Agregar verification_status al response
      // Por ahora asumimos 'approved' para testing
      setVerificationStatus('approved');
    } catch (error) {
      console.error('Error loading verification status:', error);
    }
  };

  const setupNotifications = async () => {
    // Configurar las notificaciones para que se muestren incluso con la app abierta
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Solicitar permisos de notificaciones
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Permisos de notificaciones no otorgados');
    }
  };

  const loadCurrentLocation = async () => {
    const location = await LocationService.getCurrentLocation();
    if (location) {
      setCurrentLocation(location);
    }
  };

  const toggleAvailability = async () => {
    if (!user) return;

    const newAvailability = !isAvailable;

    if (newAvailability) {
      const subscription = await LocationService.startLocationTracking(
        async (location) => {
          setCurrentLocation(location);
          await DatabaseService.updateDriverLocation(
            user.id,
            location.latitude,
            location.longitude
          );
        },
        5000
      );

      if (subscription) {
        setLocationSubscription(subscription);
      }
    } else {
      if (locationSubscription) {
        LocationService.stopLocationTracking(locationSubscription);
        setLocationSubscription(null);
      }
    }

    const success = await DatabaseService.updateDriverAvailability(
      user.id,
      newAvailability
    );

    if (success) {
      setIsAvailable(newAvailability);
    } else {
      Alert.alert('Error', 'No se pudo actualizar tu disponibilidad');
    }
  };

  const acceptTrip = async (trip: Trip) => {
    if (!user) return;

    Alert.alert(
      'Aceptar Viaje',
      `Distancia: ${trip.distance_km?.toFixed(2)} km\nTarifa: $${trip.fare.toLocaleString()}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            const success = await DatabaseService.acceptTrip(trip.id);

            if (success) {
              setCurrentTrip(trip);
              setActiveTrips((prev) => prev.filter((t) => t.id !== trip.id));
              Alert.alert('Viaje Aceptado', 'Dirígete al punto de recogida');
            } else {
              Alert.alert('Error', 'No se pudo aceptar el viaje');
            }
          },
        },
      ]
    );
  };

  const startTrip = async () => {
    if (!currentTrip) return;

    const success = await DatabaseService.updateTripStatus(currentTrip.id, 'in_progress');

    if (success) {
      setCurrentTrip({ ...currentTrip, status: 'in_progress' });
      Alert.alert('Viaje Iniciado', 'Buen viaje!');
    }
  };

  const completeTrip = async () => {
    if (!currentTrip) return;

    Alert.alert(
      'Completar Viaje',
      '¿Confirmas que has llegado al destino?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          onPress: async () => {
            const success = await DatabaseService.updateTripStatus(
              currentTrip.id,
              'completed'
            );

            if (success) {
              // Mostrar modal de calificación
              setCompletedTripId(currentTrip.id);
              setPassengerName('Pasajero'); // TODO: Obtener nombre real del pasajero
              setShowRatingModal(true);
              setCurrentTrip(null);
            }
          },
        },
      ]
    );
  };

  const handleSOS = async () => {
    if (!currentTrip || !currentLocation) return;

    Alert.alert(
      '🚨 ALERTA DE EMERGENCIA',
      '¿Confirmas que necesitas ayuda de emergencia? Tus contactos serán notificados inmediatamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'SÍ, ACTIVAR SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              setSosActive(true);
              const response = await apiClient.post('/emergency/sos', {
                trip_id: currentTrip.id,
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              });

              Alert.alert(
                '✅ Alerta Activada',
                `Tus contactos de emergencia han sido notificados. ${response.data.contacts_notified || 0} contacto(s) alertado(s).`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // También notificar a autoridades si es necesario
                      // TODO: Integrar con número de emergencia local
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error activating SOS:', error);
              Alert.alert(
                'Error',
                error.response?.data?.error || 'No se pudo activar la alerta SOS. Intenta llamar directamente al 123.'
              );
              setSosActive(false);
            }
          },
        },
      ]
    );
  };

  const renderTripItem = ({ item }: { item: Trip }) => {
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => acceptTrip(item)}
      >
        <View style={styles.tripCardHeader}>
          <Ionicons name="location" size={24} color="#4CAF50" />
          <View style={styles.tripCardInfo}>
            <Text style={styles.tripCardAddress}>
              {item.pickup_location?.address || 'Dirección de recogida'}
            </Text>
            <Text style={styles.tripCardDestination}>
              → {item.dropoff_location?.address || 'Destino'}
            </Text>
          </View>
        </View>

        <View style={styles.tripCardFooter}>
          <Text style={styles.tripFare}>${item.fare.toLocaleString()}</Text>
          <Text style={styles.tripDistance}>
            {item.distance_km?.toFixed(2)} km
          </Text>
        </View>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptTrip(item)}
        >
          <Text style={styles.acceptButtonText}>Aceptar Viaje</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.availabilityContainer}>
          <View>
            <Text style={styles.availabilityLabel}>
              {isAvailable ? 'Disponible' : 'No disponible'}
            </Text>
            {currentLocation && (
              <Text style={styles.locationText}>
                📍 {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
              </Text>
            )}
          </View>
          <Switch
            value={isAvailable}
            onValueChange={toggleAvailability}
            trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
            thumbColor="white"
          />
        </View>
      </View>

      {currentTrip ? (
        <View style={styles.currentTripContainer}>
          <Ionicons name="bicycle" size={60} color="#4CAF50" />
          <Text style={styles.currentTripTitle}>Viaje Activo</Text>
          <Text style={styles.currentTripInfo}>Estado: {currentTrip.status}</Text>
          <Text style={styles.currentTripInfo}>
            Tarifa: ${currentTrip.fare.toLocaleString()}
          </Text>
          <Text style={styles.currentTripAddress}>
            📍 {currentTrip.pickup_location?.address || 'Punto de recogida'}
          </Text>
          <Text style={styles.currentTripAddress}>
            🎯 {currentTrip.dropoff_location?.address || 'Destino'}
          </Text>

          {/* SOS Button - Always visible during active trip */}
          <TouchableOpacity
            style={[styles.sosButton, sosActive && styles.sosButtonActive]}
            onPress={handleSOS}
            disabled={sosActive}
          >
            <Ionicons name="warning" size={24} color="white" />
            <Text style={styles.sosButtonText}>
              {sosActive ? 'SOS ACTIVADO' : 'EMERGENCIA SOS'}
            </Text>
          </TouchableOpacity>

          {/* Share Trip Button */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setShowShareModal(true)}
          >
            <Ionicons name="share-social-outline" size={20} color="#007AFF" />
            <Text style={styles.shareButtonText}>Compartir Viaje</Text>
          </TouchableOpacity>

          {/* Chat Button */}
          <TouchableOpacity
            style={styles.chatButton}
            onPress={async () => {
              try {
                const response = await apiClient.get(`/chat/conversation/${currentTrip.id}`);
                const conversation = response.data.conversation;
                navigation.navigate('Chat' as never, {
                  conversationId: conversation.id,
                  tripId: currentTrip.id,
                  otherUserName: conversation.passenger_name || 'Pasajero',
                } as never);
              } catch (error) {
                console.error('Error opening chat:', error);
                Alert.alert('Error', 'No se pudo abrir el chat');
              }
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#4CAF50" />
            <Text style={styles.chatButtonText}>Chat con Pasajero</Text>
          </TouchableOpacity>

          {currentTrip.status === 'accepted' && (
            <TouchableOpacity style={styles.startButton} onPress={startTrip}>
              <Ionicons name="play" size={20} color="white" />
              <Text style={styles.startButtonText}>Iniciar Viaje</Text>
            </TouchableOpacity>
          )}

          {currentTrip.status === 'in_progress' && (
            <TouchableOpacity style={styles.completeButton} onPress={completeTrip}>
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.completeButtonText}>Completar Viaje</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : isAvailable ? (
        <View style={styles.tripsContainer}>
          <Text style={styles.tripsTitle}>Solicitudes Disponibles</Text>
          {activeTrips.length === 0 ? (
            <View style={styles.noTripsContainer}>
              <Ionicons name="bicycle-outline" size={80} color="#ccc" />
              <Text style={styles.noTripsText}>No hay solicitudes disponibles</Text>
              <Text style={styles.noTripsSubtext}>
                Las solicitudes aparecerán aquí cuando los pasajeros las hagan
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeTrips}
              renderItem={renderTripItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.tripsList}
              refreshControl={
                <RefreshControl
                  refreshing={loadingTrips}
                  onRefresh={refreshTrips}
                />
              }
            />
          )}
        </View>
      ) : (
        <View style={styles.unavailableContainer}>
          {verificationStatus === 'pending' ? (
            <>
              <Ionicons name="hourglass-outline" size={80} color="#FFA500" />
              <Text style={styles.unavailableText}>
                Tu cuenta está en proceso de verificación
              </Text>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#FFA500" />
                <Text style={styles.infoText}>
                  Estamos revisando tus documentos. Te notificaremos cuando tu cuenta sea aprobada.
                </Text>
              </View>
            </>
          ) : verificationStatus === 'rejected' ? (
            <>
              <Ionicons name="close-circle-outline" size={80} color="#FF6B6B" />
              <Text style={styles.unavailableText}>
                Tu solicitud no fue aprobada
              </Text>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#FF6B6B" />
                <Text style={styles.infoText}>
                  Por favor contacta con soporte para más información.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons name="moon-outline" size={80} color="#ccc" />
              <Text style={styles.unavailableText}>
                Activa tu disponibilidad para recibir solicitudes
              </Text>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#666" />
                <Text style={styles.infoText}>
                  Cuando estés disponible, las solicitudes de viaje aparecerán aquí.
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Rating Modal */}
      {completedTripId && (
        <RatingModal
          visible={showRatingModal}
          tripId={completedTripId}
          passengerName={passengerName}
          onClose={() => setShowRatingModal(false)}
          onRated={() => {
            Alert.alert('¡Gracias!', `Ganancia del viaje: $${currentTrip?.fare.toLocaleString() || '0'}`);
          }}
        />
      )}

      {/* Share Trip Modal */}
      {currentTrip && (
        <ShareTripModal
          visible={showShareModal}
          tripId={currentTrip.id}
          onClose={() => setShowShareModal(false)}
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
  header: {
    backgroundColor: 'white',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  availabilityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  tripsContainer: {
    flex: 1,
    padding: 15,
  },
  tripsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  tripsList: {
    paddingBottom: 15,
  },
  tripCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripCardHeader: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  tripCardInfo: {
    flex: 1,
    marginLeft: 15,
  },
  tripCardAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  tripCardDestination: {
    fontSize: 14,
    color: '#666',
  },
  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  tripFare: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  tripDistance: {
    fontSize: 14,
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noTripsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noTripsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
  },
  noTripsSubtext: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  unavailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  unavailableText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 20,
  },
  currentTripContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  currentTripTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  currentTripInfo: {
    fontSize: 18,
    marginBottom: 5,
    color: '#666',
  },
  currentTripAddress: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  completeButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginLeft: 10,
  },
  sosButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    width: '100%',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sosButtonActive: {
    backgroundColor: '#666',
    opacity: 0.7,
  },
  sosButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    letterSpacing: 1,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  shareButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  chatButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  chatButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default DriverHomeScreen;

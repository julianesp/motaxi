import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { LocationService } from '../../services/location.service';
import { MapsService } from '../../services/maps.service';
import { DatabaseService } from '../../services/database.service';
import { useAuth } from '../../contexts/AuthContext';
import { Location, Trip } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { RatingModal } from '../../components/RatingModal';
import { ShareTripModal } from '../../components/ShareTripModal';
import { PlaceAutocomplete } from '../../components/PlaceAutocomplete';
import { useTripTracking } from '../../hooks/useTripTracking';
import { apiClient } from '../../services/api';

const { width, height } = Dimensions.get('window');

const PassengerHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestingTrip, setRequestingTrip] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [estimatedFare, setEstimatedFare] = useState(0);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [driverName, setDriverName] = useState<string>('');
  const [sosActive, setSosActive] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    loadCurrentLocation();
  }, []);

  // Detectar cuando un viaje se completa para mostrar rating
  useEffect(() => {
    if (currentTrip && currentTrip.status === 'completed' && !showRatingModal) {
      setDriverName('Conductor'); // TODO: Obtener nombre real del conductor
      setShowRatingModal(true);
    }
  }, [currentTrip]);

  const loadCurrentLocation = async () => {
    const location = await LocationService.getCurrentLocation();
    if (location) {
      setCurrentLocation(location);
      const address = await LocationService.getAddressFromCoordinates(
        location.latitude,
        location.longitude
      );
      if (address) {
        setPickupAddress(address);
      }
    }
    setLoading(false);
  };

  const calculateEstimatedFare = async () => {
    if (!currentLocation || !dropoffLocation) {
      // Si no tenemos destino, usar estimación simple
      const estimatedDistance = 3.5;
      return LocationService.calculateFare(estimatedDistance);
    }

    try {
      // Usar cálculo de distancia en línea recta (más confiable)
      const distance = MapsService.calculateStraightLineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        dropoffLocation.latitude,
        dropoffLocation.longitude
      );

      // Agregar 20% más a la distancia en línea recta para aproximar la ruta real
      const adjustedDistance = distance * 1.2;
      setRouteDistance(adjustedDistance);

      // Estimar duración basada en velocidad promedio de 30 km/h
      const estimatedDuration = (adjustedDistance / 30) * 60; // en minutos
      setRouteDuration(estimatedDuration);

      return LocationService.calculateFare(adjustedDistance);
    } catch (error) {
      console.error('Error calculating fare:', error);
      const estimatedDistance = 3.5;
      return LocationService.calculateFare(estimatedDistance);
    }
  };

  const requestTrip = async () => {
    if (!pickupAddress || !dropoffAddress || !user || !currentLocation || !dropoffLocation) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setRequestingTrip(true);
    const fare = await calculateEstimatedFare();
    setRequestingTrip(false);

    const distanceText = routeDistance ? `${routeDistance.toFixed(1)} km` : 'Calculando...';
    const durationText = routeDuration ? `~${Math.round(routeDuration)} min` : '';

    Alert.alert(
      'Confirmar Viaje',
      `Tarifa estimada: $${fare.toLocaleString()}\nDistancia: ${distanceText}\n${durationText}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: async () => {
            setRequestingTrip(true);

            try {
              const trip = await DatabaseService.createTrip({
                passenger_id: user.id,
                pickup_location: {
                  ...currentLocation,
                  address: pickupAddress,
                },
                dropoff_location: {
                  ...dropoffLocation,
                  address: dropoffAddress,
                },
                fare,
                distance_km: routeDistance || 0,
                status: 'requested',
              });

              setRequestingTrip(false);

              if (trip) {
                setCurrentTrip(trip);
                Alert.alert(
                  'Viaje Solicitado',
                  'Estamos buscando un conductor cercano...'
                );
              } else {
                Alert.alert('Error', 'No se pudo crear el viaje. Intenta nuevamente.');
              }
            } catch (error: any) {
              setRequestingTrip(false);
              const errorMessage = error.response?.data?.error || error.message || 'Error desconocido';
              Alert.alert(
                'Error al Crear Viaje',
                `No se pudo crear el viaje:\n${errorMessage}\n\nVerifica tu conexión a internet.`
              );
              console.error('Error completo:', error);
            }
          },
        },
      ]
    );
  };

  const resetTrip = () => {
    setPickupAddress('');
    setDropoffAddress('');
    setCurrentTrip(null);
    setEstimatedFare(0);
    setRouteDistance(null);
    setRouteDuration(null);
    setDropoffLocation(null);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  if (!currentLocation) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No se pudo obtener tu ubicación</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadCurrentLocation}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Mapa de fondo */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || 1.189164,
          longitude: currentLocation?.longitude || -76.970478,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Tu ubicación"
            pinColor="#FF6B6B"
          />
        )}
      </MapView>

      {/* Formulario flotante */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Ionicons name="bicycle" size={32} color="#FF6B6B" />
          <Text style={styles.headerTitle}>Solicitar MoTaxi</Text>
        </View>

        {currentTrip ? (
          <View style={styles.tripInfo}>
            <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
            <Text style={styles.tripInfoTitle}>Viaje Solicitado</Text>
            <Text style={styles.tripInfoText}>Estado: {currentTrip.status}</Text>
            <Text style={styles.tripInfoText}>
              Tarifa: ${currentTrip.fare.toLocaleString()}
            </Text>
            <Text style={styles.tripInfoSubtext}>
              Buscando conductor disponible...
            </Text>

            {/* SOS Button */}
            <TouchableOpacity
              style={[styles.sosButton, sosActive && styles.sosButtonActive]}
              onPress={handleSOS}
              disabled={sosActive}
            >
              <Ionicons name="warning" size={20} color="white" />
              <Text style={styles.sosButtonText}>
                {sosActive ? 'SOS ACTIVADO' : 'EMERGENCIA SOS'}
              </Text>
            </TouchableOpacity>

            {/* Share Trip Button */}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => setShowShareModal(true)}
            >
              <Ionicons name="share-social-outline" size={18} color="#007AFF" />
              <Text style={styles.shareButtonText}>Compartir Viaje</Text>
            </TouchableOpacity>

            {/* Chat Button - Solo visible si el viaje fue aceptado */}
            {(currentTrip.status === 'accepted' || currentTrip.status === 'in_progress') && (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={async () => {
                  try {
                    const response = await apiClient.get(`/chat/conversation/${currentTrip.id}`);
                    const conversation = response.data.conversation;
                    navigation.navigate('Chat' as never, {
                      conversationId: conversation.id,
                      tripId: currentTrip.id,
                      otherUserName: conversation.driver_name || 'Conductor',
                    } as never);
                  } catch (error) {
                    console.error('Error opening chat:', error);
                    Alert.alert('Error', 'No se pudo abrir el chat');
                  }
                }}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#4CAF50" />
                <Text style={styles.chatButtonText}>Chat con Conductor</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={resetTrip}>
              <Text style={styles.cancelButtonText}>Cancelar Viaje</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <View style={styles.form}>
              <PlaceAutocomplete
                placeholder="Dirección de recogida"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                onPlaceSelected={(place) => {
                  setPickupAddress(place.address);
                  setCurrentLocation({
                    latitude: place.latitude,
                    longitude: place.longitude,
                  });
                  // Centrar mapa en la nueva ubicación
                  mapRef.current?.animateToRegion({
                    latitude: place.latitude,
                    longitude: place.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                }}
                icon="radio-button-on"
                iconColor="#FF6B6B"
                editable={!requestingTrip}
                currentLocation={currentLocation}
              />

              {/* Botón Mi Ubicación */}
              <TouchableOpacity
                style={styles.myLocationButton}
                onPress={async () => {
                  setLoading(true);
                  const location = await LocationService.getCurrentLocation();
                  if (location) {
                    setCurrentLocation(location);
                    const address = await LocationService.getAddressFromCoordinates(
                      location.latitude,
                      location.longitude
                    );
                    if (address) {
                      setPickupAddress(address);
                    }
                    // Centrar mapa en ubicación actual
                    mapRef.current?.animateToRegion({
                      latitude: location.latitude,
                      longitude: location.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    });
                  }
                  setLoading(false);
                }}
                disabled={requestingTrip}
              >
                <Ionicons name="locate" size={18} color="#007AFF" />
                <Text style={styles.myLocationButtonText}>Mi ubicación</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <PlaceAutocomplete
                placeholder="¿A dónde vas?"
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                onPlaceSelected={(place) => {
                  setDropoffAddress(place.address);
                  setDropoffLocation({
                    latitude: place.latitude,
                    longitude: place.longitude,
                  });
                }}
                icon="location-sharp"
                iconColor="#4CAF50"
                editable={!requestingTrip}
                currentLocation={currentLocation}
              />
            </View>

            {pickupAddress && dropoffAddress && (
              <>
                <View style={styles.fareContainer}>
                  <View>
                    <Text style={styles.fareLabel}>Tarifa estimada:</Text>
                    {routeDistance && (
                      <Text style={styles.fareSubLabel}>
                        {routeDistance.toFixed(1)} km {routeDuration ? `• ${Math.round(routeDuration)} min` : ''}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.fareAmount}>
                    $~{LocationService.calculateFare(routeDistance || 3.5).toLocaleString()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.requestButton, requestingTrip && styles.buttonDisabled]}
                  onPress={requestTrip}
                  disabled={requestingTrip}
                >
                  <Ionicons name="bicycle" size={24} color="white" />
                  <Text style={styles.requestButtonText}>
                    {requestingTrip ? 'Solicitando...' : 'Solicitar MoTaxi'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {(pickupAddress || dropoffAddress) && (
              <TouchableOpacity style={styles.resetButton} onPress={resetTrip}>
                <Text style={styles.resetButtonText}>Reiniciar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Rating Modal */}
      {currentTrip && currentTrip.status === 'completed' && (
        <RatingModal
          visible={showRatingModal}
          tripId={currentTrip.id}
          driverName={driverName}
          onClose={() => {
            setShowRatingModal(false);
            setCurrentTrip(null);
          }}
          onRated={() => {
            Alert.alert('Viaje Completado', `Total: $${currentTrip.fare.toLocaleString()}`);
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
  map: {
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: 'white',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  formContainer: {
    padding: 15,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  input: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 5,
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  fareLabel: {
    fontSize: 16,
    color: '#666',
  },
  fareSubLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  fareAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  requestButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  requestButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  tripInfo: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 30,
    margin: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  tripInfoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  tripInfoText: {
    fontSize: 18,
    marginBottom: 5,
    color: '#666',
  },
  tripInfoSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    marginBottom: 30,
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    padding: 15,
    width: '80%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sosButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 15,
    width: '80%',
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
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '80%',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  shareButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  chatButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '80%',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  chatButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  myLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginTop: 10,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 6,
  },
  myLocationButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PassengerHomeScreen;

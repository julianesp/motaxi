import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const NotificationsSettingsScreen: React.FC = () => {
  // Estados para controlar cada tipo de notificación
  const [tripUpdates, setTripUpdates] = useState(true);
  const [messages, setMessages] = useState(true);
  const [promotions, setPromotions] = useState(true);
  const [priceChanges, setPriceChanges] = useState(true);
  const [driverArrival, setDriverArrival] = useState(true);
  const [tripReminders, setTripReminders] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const NotificationItem = ({
    icon,
    title,
    description,
    value,
    onValueChange,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.notificationItem}>
      <View style={styles.notificationIcon}>
        <Ionicons name={icon} size={24} color="#FF6B6B" />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: '#FFB4B4' }}
        thumbColor={value ? '#FF6B6B' : '#F3F4F6'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificaciones de Viaje</Text>
          <Text style={styles.sectionDescription}>
            Recibe actualizaciones sobre tus viajes en tiempo real
          </Text>

          <NotificationItem
            icon="car-outline"
            title="Actualizaciones de viaje"
            description="Solicitudes, aceptaciones y cambios de estado"
            value={tripUpdates}
            onValueChange={setTripUpdates}
          />

          <NotificationItem
            icon="location-outline"
            title="Llegada del conductor"
            description="Aviso cuando el conductor esté cerca"
            value={driverArrival}
            onValueChange={setDriverArrival}
          />

          <NotificationItem
            icon="time-outline"
            title="Recordatorios de viaje"
            description="Notificaciones sobre viajes programados"
            value={tripReminders}
            onValueChange={setTripReminders}
          />

          <NotificationItem
            icon="cash-outline"
            title="Cambios de tarifa"
            description="Información sobre tarifas dinámicas"
            value={priceChanges}
            onValueChange={setPriceChanges}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comunicación</Text>
          <Text style={styles.sectionDescription}>
            Mantente conectado con conductores y pasajeros
          </Text>

          <NotificationItem
            icon="chatbubble-outline"
            title="Mensajes"
            description="Nuevos mensajes del chat"
            value={messages}
            onValueChange={setMessages}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marketing</Text>
          <Text style={styles.sectionDescription}>
            Ofertas, promociones y novedades
          </Text>

          <NotificationItem
            icon="gift-outline"
            title="Promociones y ofertas"
            description="Descuentos especiales y eventos"
            value={promotions}
            onValueChange={setPromotions}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración de Alertas</Text>
          <Text style={styles.sectionDescription}>
            Personaliza cómo recibes las notificaciones
          </Text>

          <NotificationItem
            icon="volume-high-outline"
            title="Sonido"
            description="Reproducir sonido con las notificaciones"
            value={soundEnabled}
            onValueChange={setSoundEnabled}
          />

          <NotificationItem
            icon="phone-portrait-outline"
            title="Vibración"
            description="Vibrar cuando llegue una notificación"
            value={vibrationEnabled}
            onValueChange={setVibrationEnabled}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Estas preferencias solo afectan las notificaciones de la app. Las
            notificaciones críticas de seguridad siempre se enviarán.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  notificationDescription: {
    fontSize: 13,
    color: '#666',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});

export default NotificationsSettingsScreen;

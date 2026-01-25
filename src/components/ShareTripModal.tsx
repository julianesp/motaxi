import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/api';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  is_primary: number;
}

interface ShareTripModalProps {
  visible: boolean;
  tripId: string;
  onClose: () => void;
}

export const ShareTripModal: React.FC<ShareTripModalProps> = ({
  visible,
  tripId,
  onClose,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/emergency/contacts');
      setContacts(response.data.contacts);
    } catch (error: any) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'No se pudieron cargar los contactos');
    } finally {
      setLoading(false);
    }
  };

  const shareWithContact = async (contact: EmergencyContact) => {
    try {
      setSharing(true);
      const response = await apiClient.post('/emergency/share-trip', {
        trip_id: tripId,
        contact_id: contact.id,
      });

      const shareLink = response.data.share_link;

      // Use React Native Share API to share the link
      await Share.share({
        message: `Hola ${contact.name}, estoy compartiendo mi viaje contigo. Puedes seguirlo en tiempo real aquí: ${shareLink}`,
        title: 'Compartir Viaje',
      });

      Alert.alert(
        'Viaje Compartido',
        `Tu viaje ha sido compartido con ${contact.name}`
      );
    } catch (error: any) {
      console.error('Error sharing trip:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'No se pudo compartir el viaje'
      );
    } finally {
      setSharing(false);
    }
  };

  const shareViaOtherApps = async () => {
    try {
      setSharing(true);

      // Create a generic share link (without specific contact)
      const response = await apiClient.post('/emergency/share-trip', {
        trip_id: tripId,
        contact_id: contacts[0]?.id || 'generic', // Use first contact or generic
      });

      const shareLink = response.data.share_link;

      await Share.share({
        message: `Estoy en un viaje. Puedes seguirlo en tiempo real aquí: ${shareLink}`,
        title: 'Compartir Mi Viaje',
      });
    } catch (error: any) {
      console.error('Error sharing trip:', error);
      Alert.alert('Error', 'No se pudo compartir el viaje');
    } finally {
      setSharing(false);
    }
  };

  const renderContact = ({ item }: { item: EmergencyContact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => shareWithContact(item)}
      disabled={sharing}
    >
      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.is_primary === 1 && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryText}>Principal</Text>
            </View>
          )}
        </View>
        <Text style={styles.contactPhone}>{item.phone}</Text>
        {item.relationship && (
          <Text style={styles.contactRelationship}>{item.relationship}</Text>
        )}
      </View>
      <Ionicons name="share-outline" size={24} color="#007AFF" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Compartir Viaje</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Selecciona con quién compartir tu ubicación en tiempo real
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={60} color="#CCCCCC" />
              <Text style={styles.emptyText}>No tienes contactos de emergencia</Text>
              <Text style={styles.emptySubtext}>
                Agrega contactos en tu perfil para compartir viajes
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={contacts}
                renderItem={renderContact}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                style={styles.list}
              />

              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.otherAppsButton}
                  onPress={shareViaOtherApps}
                  disabled={sharing}
                >
                  <Ionicons name="share-social-outline" size={20} color="#007AFF" />
                  <Text style={styles.otherAppsText}>
                    Compartir vía otras apps
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {sharing && (
            <View style={styles.sharingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.sharingText}>Compartiendo...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  list: {
    maxHeight: 400,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  primaryBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  primaryText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactRelationship: {
    fontSize: 12,
    color: '#999',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  otherAppsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  otherAppsText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sharingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sharingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 12,
  },
});

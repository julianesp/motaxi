import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
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

export const EmergencyContactsScreen: React.FC = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/emergency/contacts');
      setContacts(response.data.contacts);
    } catch (error: any) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'No se pudieron cargar los contactos de emergencia');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingContact(null);
    setName('');
    setPhone('');
    setRelationship('');
    setIsPrimary(false);
    setShowAddModal(true);
  };

  const openEditModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setName(contact.name);
    setPhone(contact.phone);
    setRelationship(contact.relationship || '');
    setIsPrimary(contact.is_primary === 1);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'El nombre y teléfono son obligatorios');
      return;
    }

    try {
      if (editingContact) {
        // Update existing contact
        await apiClient.put(`/emergency/contacts/${editingContact.id}`, {
          name: name.trim(),
          phone: phone.trim(),
          relationship: relationship.trim() || undefined,
          is_primary: isPrimary,
        });
      } else {
        // Create new contact
        await apiClient.post('/emergency/contacts', {
          name: name.trim(),
          phone: phone.trim(),
          relationship: relationship.trim() || undefined,
          is_primary: isPrimary,
        });
      }

      setShowAddModal(false);
      loadContacts();
      Alert.alert(
        'Éxito',
        editingContact ? 'Contacto actualizado' : 'Contacto agregado'
      );
    } catch (error: any) {
      console.error('Error saving contact:', error);
      const errorMsg = error.response?.data?.error || 'No se pudo guardar el contacto';
      Alert.alert('Error', errorMsg);
    }
  };

  const handleDelete = (contact: EmergencyContact) => {
    Alert.alert(
      'Eliminar contacto',
      `¿Estás seguro de eliminar a ${contact.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/emergency/contacts/${contact.id}`);
              loadContacts();
              Alert.alert('Éxito', 'Contacto eliminado');
            } catch (error: any) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'No se pudo eliminar el contacto');
            }
          },
        },
      ]
    );
  };

  const renderContact = ({ item }: { item: EmergencyContact }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.is_primary === 1 && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryText}>Principal</Text>
            </View>
          )}
        </View>
        <Text style={styles.contactPhone}>
          <Ionicons name="call-outline" size={14} /> {item.phone}
        </Text>
        {item.relationship && (
          <Text style={styles.contactRelationship}>
            <Ionicons name="people-outline" size={14} /> {item.relationship}
          </Text>
        )}
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contactos de Emergencia</Text>
        <Text style={styles.subtitle}>
          Estos contactos serán notificados en caso de emergencia
        </Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={80} color="#CCCCCC" />
          <Text style={styles.emptyText}>No tienes contactos de emergencia</Text>
          <Text style={styles.emptySubtext}>
            Agrega al menos un contacto para activar el botón SOS
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity
        style={[styles.addButton, contacts.length >= 5 && styles.addButtonDisabled]}
        onPress={openAddModal}
        disabled={contacts.length >= 5}
      >
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.addButtonText}>
          {contacts.length >= 5 ? 'Máximo 5 contactos' : 'Agregar Contacto'}
        </Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: María González"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Teléfono *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Ej: +57 300 123 4567"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Relación</Text>
              <TextInput
                style={styles.input}
                value={relationship}
                onChangeText={setRelationship}
                placeholder="Ej: Madre, Esposo, Amigo"
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setIsPrimary(!isPrimary)}
              >
                <Ionicons
                  name={isPrimary ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#007AFF"
                />
                <Text style={styles.checkboxLabel}>Contacto principal</Text>
              </TouchableOpacity>

              <Text style={styles.helperText}>
                El contacto principal será notificado primero en caso de emergencia
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  listContent: {
    padding: 15,
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  primaryBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  primaryText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 14,
    color: '#999',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 15,
    borderRadius: 12,
    gap: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 10,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    marginLeft: 34,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

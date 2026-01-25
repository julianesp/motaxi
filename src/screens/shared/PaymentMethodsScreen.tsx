import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api';

interface PaymentMethod {
  id: string;
  type: 'pse' | 'nequi' | 'daviplata' | 'card' | 'cash' | 'bank_transfer';
  is_default: number;
  bank_name?: string;
  account_number?: string;
  account_type?: string;
  phone?: string;
  card_last_four?: string;
  card_brand?: string;
  created_at: number;
}

export const PaymentMethodsScreen = ({ navigation }: any) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');

  useEffect(() => {
    loadMethods();
  }, []);

  const loadMethods = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/payments/methods');
      setMethods(response.data.methods || []);
    } catch (error: any) {
      console.error('Error loading methods:', error);
      Alert.alert('Error', error.response?.data?.error || 'No se pudieron cargar los métodos de pago');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (methodId: string) => {
    Alert.alert(
      'Eliminar Método',
      '¿Estás seguro de que deseas eliminar este método de pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/payments/methods/${methodId}`);
              loadMethods();
              Alert.alert('Éxito', 'Método de pago eliminado');
            } catch (error: any) {
              console.error('Delete error:', error);
              Alert.alert('Error', error.response?.data?.error || 'No se pudo eliminar el método');
            }
          },
        },
      ]
    );
  };

  const openAddModal = (type: string) => {
    setSelectedType(type);
    setShowAddModal(true);
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'pse': return 'business-outline';
      case 'nequi': return 'phone-portrait-outline';
      case 'daviplata': return 'phone-portrait-outline';
      case 'card': return 'card-outline';
      case 'cash': return 'cash-outline';
      case 'bank_transfer': return 'business-outline';
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
      case 'bank_transfer':
        return `${method.bank_name} - ${method.account_number}`;
      default:
        return 'Método de pago';
    }
  };

  const renderMethod = (method: PaymentMethod) => (
    <View key={method.id} style={styles.methodCard}>
      <View style={styles.methodIcon}>
        <Ionicons name={getMethodIcon(method.type)} size={24} color="#007AFF" />
      </View>

      <View style={styles.methodDetails}>
        <Text style={styles.methodLabel}>{getMethodLabel(method)}</Text>
        {method.is_default === 1 && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultText}>Predeterminado</Text>
          </View>
        )}
      </View>

      {method.type !== 'cash' && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(method.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      )}
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Current Methods */}
        {methods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mis Métodos de Pago</Text>
            {methods.map(renderMethod)}
          </View>
        )}

        {/* Add Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agregar Método de Pago</Text>

          <TouchableOpacity
            style={styles.addMethodCard}
            onPress={() => openAddModal('nequi')}
          >
            <View style={styles.addMethodIcon}>
              <Ionicons name="phone-portrait-outline" size={28} color="#007AFF" />
            </View>
            <View style={styles.addMethodContent}>
              <Text style={styles.addMethodTitle}>Nequi</Text>
              <Text style={styles.addMethodDescription}>
                Paga con tu cuenta Nequi
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addMethodCard}
            onPress={() => openAddModal('daviplata')}
          >
            <View style={styles.addMethodIcon}>
              <Ionicons name="phone-portrait-outline" size={28} color="#007AFF" />
            </View>
            <View style={styles.addMethodContent}>
              <Text style={styles.addMethodTitle}>Daviplata</Text>
              <Text style={styles.addMethodDescription}>
                Paga con tu cuenta Daviplata
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addMethodCard}
            onPress={() => openAddModal('pse')}
          >
            <View style={styles.addMethodIcon}>
              <Ionicons name="business-outline" size={28} color="#007AFF" />
            </View>
            <View style={styles.addMethodContent}>
              <Text style={styles.addMethodTitle}>PSE</Text>
              <Text style={styles.addMethodDescription}>
                Transferencia bancaria segura
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addMethodCard}
            onPress={() => openAddModal('bank_transfer')}
          >
            <View style={styles.addMethodIcon}>
              <Ionicons name="business-outline" size={28} color="#007AFF" />
            </View>
            <View style={styles.addMethodContent}>
              <Text style={styles.addMethodTitle}>Cuenta Bancaria</Text>
              <Text style={styles.addMethodDescription}>
                Para recibir retiros
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#4CAF50" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Pagos Seguros</Text>
            <Text style={styles.infoDescription}>
              Tus datos están protegidos con encriptación de nivel bancario
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Add Method Modal */}
      <AddMethodModal
        visible={showAddModal}
        type={selectedType}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          loadMethods();
        }}
      />
    </SafeAreaView>
  );
};

interface AddMethodModalProps {
  visible: boolean;
  type: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AddMethodModal: React.FC<AddMethodModalProps> = ({ visible, type, onClose, onSuccess }) => {
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('savings');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (type === 'nequi' || type === 'daviplata') {
      if (!phone || phone.length < 10) {
        Alert.alert('Error', 'Ingresa un número de teléfono válido');
        return;
      }
    } else if (type === 'pse' || type === 'bank_transfer') {
      if (!bankName || !accountNumber) {
        Alert.alert('Error', 'Completa todos los campos');
        return;
      }
    }

    try {
      setSubmitting(true);

      const payload: any = { type };

      if (type === 'nequi' || type === 'daviplata') {
        payload.phone = phone;
      } else if (type === 'pse' || type === 'bank_transfer') {
        payload.bank_name = bankName;
        payload.account_number = accountNumber;
        payload.account_type = accountType;
      }

      await apiClient.post('/payments/methods', payload);

      Alert.alert('Éxito', 'Método de pago agregado correctamente');
      setPhone('');
      setBankName('');
      setAccountNumber('');
      setAccountType('savings');
      onSuccess();
    } catch (error: any) {
      console.error('Add method error:', error);
      Alert.alert('Error', error.response?.data?.error || 'No se pudo agregar el método de pago');
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'nequi': return 'Agregar Nequi';
      case 'daviplata': return 'Agregar Daviplata';
      case 'pse': return 'Agregar PSE';
      case 'bank_transfer': return 'Agregar Cuenta Bancaria';
      default: return 'Agregar Método';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{getTitle()}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {(type === 'nequi' || type === 'daviplata') && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Número de Teléfono</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="3001234567"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            )}

            {(type === 'pse' || type === 'bank_transfer') && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Banco</Text>
                  <TextInput
                    style={styles.input}
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="Ej: Bancolombia"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Número de Cuenta</Text>
                  <TextInput
                    style={styles.input}
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder="Ej: 12345678"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Tipo de Cuenta</Text>
                  <View style={styles.accountTypeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.accountTypeButton,
                        accountType === 'savings' && styles.accountTypeButtonActive,
                      ]}
                      onPress={() => setAccountType('savings')}
                    >
                      <Text
                        style={[
                          styles.accountTypeText,
                          accountType === 'savings' && styles.accountTypeTextActive,
                        ]}
                      >
                        Ahorros
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.accountTypeButton,
                        accountType === 'checking' && styles.accountTypeButtonActive,
                      ]}
                      onPress={() => setAccountType('checking')}
                    >
                      <Text
                        style={[
                          styles.accountTypeText,
                          accountType === 'checking' && styles.accountTypeTextActive,
                        ]}
                      >
                        Corriente
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Agregar Método</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
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
    marginBottom: 4,
  },
  defaultBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  defaultText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  addMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addMethodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addMethodContent: {
    flex: 1,
  },
  addMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addMethodDescription: {
    fontSize: 13,
    color: '#666',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  accountTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  accountTypeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountTypeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  accountTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  accountTypeTextActive: {
    color: '#007AFF',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default PaymentMethodsScreen;

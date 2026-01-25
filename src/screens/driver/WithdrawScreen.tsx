import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api';

interface PaymentMethod {
  id: string;
  type: 'bank_transfer' | 'nequi' | 'daviplata';
  bank_name?: string;
  account_number?: string;
  account_type?: string;
  phone?: string;
}

export const WithdrawScreen = ({ navigation }: any) => {
  const [wallet, setWallet] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [walletRes, methodsRes] = await Promise.all([
        apiClient.get('/payments/wallet'),
        apiClient.get('/payments/methods'),
      ]);

      setWallet(walletRes.data.wallet);

      // Filtrar solo métodos válidos para retiro
      const withdrawMethods = methodsRes.data.methods.filter((m: PaymentMethod) =>
        ['bank_transfer', 'nequi', 'daviplata'].includes(m.type)
      );
      setPaymentMethods(withdrawMethods);

      if (withdrawMethods.length > 0) {
        setSelectedMethod(withdrawMethods[0].id);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.response?.data?.error || 'No se pudo cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Selecciona un método de retiro');
      return;
    }

    const withdrawAmount = parseFloat(amount);

    if (!withdrawAmount || withdrawAmount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    if (withdrawAmount < 10000) {
      Alert.alert('Error', 'El monto mínimo de retiro es $10,000 COP');
      return;
    }

    if (withdrawAmount > wallet.balance) {
      Alert.alert('Error', 'No tienes suficiente balance');
      return;
    }

    Alert.alert(
      'Confirmar Retiro',
      `¿Deseas retirar ${formatCurrency(withdrawAmount)}?\n\nEl dinero será transferido a tu cuenta en 1-3 días hábiles.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setSubmitting(true);

              await apiClient.post('/payments/wallet/withdraw', {
                amount: withdrawAmount,
                payment_method_id: selectedMethod,
              });

              Alert.alert(
                'Retiro Solicitado',
                'Tu solicitud de retiro ha sido procesada. Recibirás el dinero en 1-3 días hábiles.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error: any) {
              console.error('Withdraw error:', error);
              Alert.alert('Error', error.response?.data?.error || 'No se pudo procesar el retiro');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatAmount = (text: string) => {
    // Solo números
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
  };

  const setQuickAmount = (percentage: number) => {
    const quickAmount = Math.floor((wallet.balance * percentage) / 1000) * 1000;
    setAmount(quickAmount.toString());
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'nequi': return 'phone-portrait-outline';
      case 'daviplata': return 'phone-portrait-outline';
      case 'bank_transfer': return 'business-outline';
      default: return 'card-outline';
    }
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method.type) {
      case 'nequi':
        return `Nequi - ${method.phone}`;
      case 'daviplata':
        return `Daviplata - ${method.phone}`;
      case 'bank_transfer':
        return `${method.bank_name} - ${method.account_number}`;
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

  if (paymentMethods.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="card-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No tienes métodos de retiro</Text>
          <Text style={styles.emptySubtext}>
            Agrega una cuenta bancaria, Nequi o Daviplata para poder retirar tu dinero
          </Text>
          <TouchableOpacity
            style={styles.addMethodButton}
            onPress={() => navigation.navigate('PaymentMethods')}
          >
            <Text style={styles.addMethodButtonText}>Agregar Método de Retiro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance Disponible</Text>
          <Text style={styles.balanceAmount}>
            {formatCurrency(wallet?.balance || 0)}
          </Text>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monto a Retirar</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={formatAmount}
              placeholder="0"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {amount && parseFloat(amount) > 0 && (
            <Text style={styles.amountText}>
              {formatCurrency(parseFloat(amount))}
            </Text>
          )}

          <View style={styles.quickAmounts}>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setQuickAmount(0.25)}
            >
              <Text style={styles.quickButtonText}>25%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setQuickAmount(0.5)}
            >
              <Text style={styles.quickButtonText}>50%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setQuickAmount(0.75)}
            >
              <Text style={styles.quickButtonText}>75%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => setQuickAmount(1)}
            >
              <Text style={styles.quickButtonText}>Todo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Mínimo: {formatCurrency(10000)} COP
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Método de Retiro</Text>

          {paymentMethods.map((method) => (
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
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Tiempo de procesamiento</Text>
            <Text style={styles.infoDescription}>
              El dinero llegará a tu cuenta en 1-3 días hábiles
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.withdrawButton,
            (!amount || parseFloat(amount) < 10000 || submitting) && styles.withdrawButtonDisabled,
          ]}
          onPress={handleWithdraw}
          disabled={!amount || parseFloat(amount) < 10000 || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="cash-outline" size={20} color="white" />
              <Text style={styles.withdrawButtonText}>
                Retirar {amount ? formatCurrency(parseFloat(amount)) : '$0'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    paddingVertical: 16,
  },
  amountText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
    marginBottom: 16,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#007AFF',
    flex: 1,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 8,
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
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodDetails: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 15,
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
  withdrawButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  withdrawButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
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
});

export default WithdrawScreen;

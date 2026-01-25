import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api';

interface WalletData {
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_withdrawals: number;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  trip_id?: string;
  created_at: number;
}

export const WalletScreen = ({ navigation }: any) => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      const response = await apiClient.get('/payments/wallet');
      setWallet(response.data.wallet);
      setTransactions(response.data.transactions || []);
    } catch (error: any) {
      console.error('Error loading wallet:', error);
      Alert.alert('Error', error.response?.data?.error || 'No se pudo cargar la billetera');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWallet(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTransaction = (transaction: Transaction) => {
    const isCredit = transaction.type === 'credit';

    return (
      <View key={transaction.id} style={styles.transactionCard}>
        <View style={[
          styles.transactionIcon,
          { backgroundColor: isCredit ? '#E8F5E9' : '#FFEBEE' }
        ]}>
          <Ionicons
            name={isCredit ? 'arrow-down' : 'arrow-up'}
            size={20}
            color={isCredit ? '#4CAF50' : '#F44336'}
          />
        </View>

        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>{transaction.description}</Text>
          <Text style={styles.transactionDate}>{formatDate(transaction.created_at)}</Text>
        </View>

        <Text style={[
          styles.transactionAmount,
          { color: isCredit ? '#4CAF50' : '#F44336' }
        ]}>
          {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance Disponible</Text>
          <Text style={styles.balanceAmount}>
            {formatCurrency(wallet?.balance || 0)}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Total Ganado</Text>
              <Text style={styles.statValue}>
                {formatCurrency(wallet?.total_earned || 0)}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statLabel}>Total Retirado</Text>
              <Text style={styles.statValue}>
                {formatCurrency(wallet?.total_withdrawn || 0)}
              </Text>
            </View>
          </View>

          {wallet && wallet.pending_withdrawals > 0 && (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={16} color="#FF9800" />
              <Text style={styles.pendingText}>
                {formatCurrency(wallet.pending_withdrawals)} en proceso
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.withdrawButton,
              (wallet?.balance || 0) < 10000 && styles.withdrawButtonDisabled
            ]}
            onPress={() => navigation.navigate('Withdraw')}
            disabled={(wallet?.balance || 0) < 10000}
          >
            <Ionicons name="cash-outline" size={20} color="white" />
            <Text style={styles.withdrawButtonText}>Retirar Dinero</Text>
          </TouchableOpacity>

          {(wallet?.balance || 0) < 10000 && (
            <Text style={styles.minimumText}>
              Mínimo para retirar: {formatCurrency(10000)}
            </Text>
          )}
        </View>

        {/* Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
            <Ionicons name="receipt-outline" size={20} color="#666" />
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No hay movimientos aún</Text>
              <Text style={styles.emptySubtext}>
                Completa viajes para empezar a ganar
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map(renderTransaction)}
            </View>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  pendingText: {
    fontSize: 13,
    color: 'white',
    fontWeight: '500',
  },
  withdrawButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  withdrawButtonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  minimumText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 4,
  },
});

export default WalletScreen;

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';

type RoleSelectionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'RoleSelection'
>;

interface Props {
  navigation: RoleSelectionScreenNavigationProp;
}

const RoleSelectionScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Bienvenido a MoTaxi</Text>
        <Text style={styles.subtitle}>¿Cómo deseas usar la aplicación?</Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionCard, styles.passengerCard]}
            onPress={() => navigation.navigate('Register', { role: 'passenger' })}
          >
            <Ionicons name="person" size={60} color="#FF6B6B" />
            <Text style={styles.optionTitle}>Soy Pasajero</Text>
            <Text style={styles.optionDescription}>
              Solicita un mototaxi y llega a tu destino
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, styles.driverCard]}
            onPress={() => navigation.navigate('Register', { role: 'driver' })}
          >
            <Ionicons name="bicycle" size={60} color="#4CAF50" />
            <Text style={styles.optionTitle}>Soy Conductor</Text>
            <Text style={styles.optionDescription}>
              Ofrece el servicio y genera ingresos
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>¿Ya tienes cuenta? Inicia sesión</Text>
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  optionsContainer: {
    gap: 20,
  },
  optionCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passengerCard: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  driverCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  optionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
    color: '#333',
  },
  optionDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
  },
  loginButton: {
    marginTop: 30,
    padding: 15,
  },
  loginButtonText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default RoleSelectionScreen;

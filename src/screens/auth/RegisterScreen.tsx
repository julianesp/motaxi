import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;
type RegisterScreenRouteProp = RouteProp<RootStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
  route: RegisterScreenRouteProp;
}

const RegisterScreen: React.FC<Props> = ({ route }) => {
  const { role } = route.params;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<'moto' | 'taxi' | 'carro' | 'piaggio' | 'particular'>('moto');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const VEHICLE_OPTIONS: { value: 'moto' | 'taxi' | 'carro' | 'piaggio' | 'particular'; label: string; icon: string }[] = [
    { value: 'moto', label: 'Mototaxi', icon: '🏍️' },
    { value: 'taxi', label: 'Taxi', icon: '🚕' },
    { value: 'carro', label: 'Carro / Van', icon: '🚐' },
    { value: 'piaggio', label: 'Piaggio', icon: '🛻' },
    { value: 'particular', label: 'Particular', icon: '🚗' },
  ];

  const handleRegister = async () => {
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const success = await signUp(email, password, {
        full_name: fullName,
        phone,
        role,
        ...(role === 'driver' && { vehicle_types: vehicleType }),
      });

      setLoading(false);

      if (success) {
        Alert.alert(
          'Cuenta Creada',
          role === 'driver'
            ? 'Tu cuenta de conductor ha sido creada. Será verificada por nuestro equipo antes de poder recibir viajes.'
            : '¡Bienvenido a MoTaxi! Ya puedes solicitar viajes.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          'No se pudo crear la cuenta. Verifica tu conexión a internet o intenta con otro correo.'
        );
      }
    } catch (error: any) {
      setLoading(false);
      console.error('Registration error:', error);

      let errorMessage = 'Error inesperado al crear la cuenta. Intenta nuevamente.';

      if (error.message) {
        // Traducir mensajes comunes del backend
        if (error.message.includes('Email or phone already registered')) {
          errorMessage = 'Este correo electrónico o teléfono ya está registrado. Por favor usa otros datos o inicia sesión.';
        } else if (error.message.includes('Network request failed')) {
          errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
        } else if (error.message.includes('Missing required fields')) {
          errorMessage = 'Por favor completa todos los campos requeridos.';
        } else if (error.message.includes('Invalid role')) {
          errorMessage = 'Rol de usuario inválido.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('Error al Crear Cuenta', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Ionicons
              name={role === 'passenger' ? 'person' : 'bicycle'}
              size={70}
              color={role === 'passenger' ? '#FF6B6B' : '#4CAF50'}
            />
            <Text style={styles.title}>Crear Cuenta</Text>
            <Text style={styles.subtitle}>
              {role === 'passenger' ? 'Pasajero' : 'Conductor'}
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Nombre completo"
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Correo electrónico"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Teléfono"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>

              {role === 'driver' && (
                <View style={styles.vehicleSection}>
                  <Text style={styles.vehicleLabel}>Tipo de vehículo</Text>
                  <View style={styles.vehicleGrid}>
                    {VEHICLE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.vehicleOption,
                          vehicleType === opt.value && styles.vehicleOptionSelected,
                        ]}
                        onPress={() => setVehicleType(opt.value)}
                        disabled={loading}
                      >
                        <Text style={styles.vehicleIcon}>{opt.icon}</Text>
                        <Text style={[
                          styles.vehicleOptionText,
                          vehicleType === opt.value && styles.vehicleOptionTextSelected,
                        ]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.registerButton,
                  { backgroundColor: role === 'passenger' ? '#FF6B6B' : '#4CAF50' },
                  loading && styles.registerButtonDisabled,
                ]}
                onPress={handleRegister}
                disabled={loading}
              >
                <Text style={styles.registerButtonText}>
                  {loading ? 'Creando cuenta...' : 'Registrarse'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  registerButton: {
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  registerButtonDisabled: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  vehicleSection: {
    marginBottom: 15,
  },
  vehicleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 10,
    marginLeft: 4,
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleOption: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  vehicleOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0faf0',
  },
  vehicleIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  vehicleOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  vehicleOptionTextSelected: {
    color: '#4CAF50',
  },
});

export default RegisterScreen;

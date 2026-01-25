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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../config/api';

type ForgotPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ForgotPassword'>;

interface Props {
  navigation: ForgotPasswordScreenNavigationProp;
}

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugCode, setDebugCode] = useState('');

  const handleRequestReset = async () => {
    if (!emailOrPhone) {
      Alert.alert('Error', 'Por favor ingresa tu correo o teléfono');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/forgot-password', {
        emailOrPhone,
      });

      setLoading(false);

      // Guardar código de desarrollo
      if (response.debug?.resetCode) {
        setDebugCode(response.debug.resetCode);
      }

      Alert.alert(
        'Código Enviado',
        `Se ha generado un código de recuperación.\n\n${
          response.debug?.resetCode
            ? `CÓDIGO DE PRUEBA: ${response.debug.resetCode}\n\n`
            : ''
        }Ingresa el código en la siguiente pantalla.`,
        [{ text: 'OK', onPress: () => setStep('code') }]
      );
    } catch (error: any) {
      setLoading(false);
      Alert.alert(
        'Error',
        error.message || 'No se pudo procesar tu solicitud'
      );
    }
  };

  const handleResetPassword = async () => {
    if (!resetCode || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        emailOrPhone,
        resetCode,
        newPassword,
      });

      setLoading(false);

      Alert.alert(
        'Contraseña Actualizada',
        'Tu contraseña ha sido actualizada exitosamente. Ahora puedes iniciar sesión.',
        [
          {
            text: 'Iniciar Sesión',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      setLoading(false);
      let errorMessage = 'No se pudo resetear la contraseña';

      if (error.message?.includes('Invalid or expired reset code')) {
        errorMessage = 'El código es inválido o ha expirado. Solicita uno nuevo.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.content}>
            <Ionicons name="lock-closed-outline" size={70} color="#FF6B6B" />
            <Text style={styles.title}>
              {step === 'email' ? 'Recuperar Cuenta' : 'Resetear Contraseña'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'email'
                ? 'Ingresa tu correo o teléfono para recibir un código de recuperación'
                : 'Ingresa el código y tu nueva contraseña'}
            </Text>

            <View style={styles.form}>
              {step === 'email' ? (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#666" />
                    <TextInput
                      style={styles.input}
                      placeholder="Correo o teléfono"
                      value={emailOrPhone}
                      onChangeText={setEmailOrPhone}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleRequestReset}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.buttonText}>Solicitar Código</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key-outline" size={20} color="#666" />
                    <TextInput
                      style={styles.input}
                      placeholder="Código de recuperación (6 dígitos)"
                      value={resetCode}
                      onChangeText={setResetCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!loading}
                    />
                  </View>

                  {debugCode && (
                    <View style={styles.debugBox}>
                      <Text style={styles.debugText}>
                        Código de prueba: {debugCode}
                      </Text>
                    </View>
                  )}

                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" />
                    <TextInput
                      style={styles.input}
                      placeholder="Nueva contraseña"
                      value={newPassword}
                      onChangeText={setNewPassword}
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
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.buttonText}>Actualizar Contraseña</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setStep('email')}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Solicitar nuevo código
                    </Text>
                  </TouchableOpacity>
                </>
              )}
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
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1,
    padding: 10,
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
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
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
  button: {
    backgroundColor: '#FF6B6B',
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
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  debugBox: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },
  debugText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ForgotPasswordScreen;

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Navigators
import PassengerNavigator from './PassengerNavigator';
import DriverNavigator from './DriverNavigator';

// Shared Screens
import ChatScreen from '../screens/shared/ChatScreen';
import PaymentMethodsScreen from '../screens/shared/PaymentMethodsScreen';
import PaymentScreen from '../screens/shared/PaymentScreen';
import NotificationsSettingsScreen from '../screens/shared/NotificationsSettingsScreen';
import PrivacySecurityScreen from '../screens/shared/PrivacySecurityScreen';
import HelpSupportScreen from '../screens/shared/HelpSupportScreen';
import AboutScreen from '../screens/shared/AboutScreen';

// Driver Screens
import WalletScreen from '../screens/driver/WalletScreen';
import WithdrawScreen from '../screens/driver/WithdrawScreen';

export type RootStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  Register: { role: 'passenger' | 'driver' };
  ForgotPassword: undefined;
  PassengerApp: undefined;
  DriverApp: undefined;
  Chat: { conversationId: string; tripId: string; otherUserName: string };
  PaymentMethods: undefined;
  Payment: { tripId: string };
  NotificationsSettings: undefined;
  PrivacySecurity: undefined;
  HelpSupport: undefined;
  About: undefined;
  Wallet: undefined;
  Withdraw: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // TODO: Agregar pantalla de carga
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!user ? (
          // Pantallas de autenticación
          <>
            <Stack.Screen
              name="RoleSelection"
              component={RoleSelectionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Pantallas según rol del usuario
          <>
            {user.role === 'passenger' ? (
              <Stack.Screen
                name="PassengerApp"
                component={PassengerNavigator}
                options={{ headerShown: false }}
              />
            ) : (
              <Stack.Screen
                name="DriverApp"
                component={DriverNavigator}
                options={{ headerShown: false }}
              />
            )}

            {/* Pantallas compartidas - modales */}
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                headerShown: true,
                presentation: 'modal',
                headerBackTitle: 'Volver',
              }}
            />
            <Stack.Screen
              name="PaymentMethods"
              component={PaymentMethodsScreen}
              options={{
                headerShown: true,
                title: 'Métodos de Pago',
                presentation: 'modal',
                headerBackTitle: 'Volver',
              }}
            />
            <Stack.Screen
              name="Payment"
              component={PaymentScreen}
              options={{
                headerShown: true,
                title: 'Pagar Viaje',
                presentation: 'modal',
                headerBackTitle: 'Volver',
              }}
            />
            <Stack.Screen
              name="NotificationsSettings"
              component={NotificationsSettingsScreen}
              options={{
                headerShown: true,
                title: 'Notificaciones',
                presentation: 'modal',
                headerBackTitle: 'Volver',
              }}
            />
            <Stack.Screen
              name="PrivacySecurity"
              component={PrivacySecurityScreen}
              options={{
                headerShown: true,
                title: 'Privacidad y Seguridad',
                presentation: 'modal',
                headerBackTitle: 'Volver',
              }}
            />
            <Stack.Screen
              name="HelpSupport"
              component={HelpSupportScreen}
              options={{
                headerShown: true,
                title: 'Ayuda y Soporte',
                presentation: 'modal',
                headerBackTitle: 'Volver',
              }}
            />
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{
                headerShown: true,
                title: 'Acerca de',
                presentation: 'modal',
                headerBackTitle: 'Volver',
              }}
            />

            {/* Pantallas para conductores */}
            {user.role === 'driver' && (
              <>
                <Stack.Screen
                  name="Wallet"
                  component={WalletScreen}
                  options={{
                    headerShown: true,
                    title: 'Mi Billetera',
                    presentation: 'modal',
                    headerBackTitle: 'Volver',
                  }}
                />
                <Stack.Screen
                  name="Withdraw"
                  component={WithdrawScreen}
                  options={{
                    headerShown: true,
                    title: 'Retirar Dinero',
                    presentation: 'modal',
                    headerBackTitle: 'Volver',
                  }}
                />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

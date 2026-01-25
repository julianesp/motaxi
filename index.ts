import 'react-native-gesture-handler';

// Suprimir errores de expo-notifications en Expo Go ANTES de cualquier import
const originalError = console.error;
console.error = (...args) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('expo-notifications') ||
     msg.includes('Android Push notifications') ||
     msg.includes('remote notifications') ||
     msg.includes('functionality provided by expo-notifications'))
  ) {
    return; // Silenciar errores de notificaciones en Expo Go
  }
  originalError(...args);
};

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

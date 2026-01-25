import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../config/api';

// Suprimir warnings y errores de Expo Go relacionados con push notifications
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('expo-notifications') ||
     msg.includes('Android Push notifications') ||
     msg.includes('remote notifications') ||
     msg.includes('functionality provided by expo-notifications was removed'))
  ) {
    return; // Silenciar warnings de notificaciones en Expo Go
  }
  originalWarn(...args);
};

console.error = (...args) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('expo-notifications') ||
     msg.includes('Android Push notifications') ||
     msg.includes('remote notifications') ||
     msg.includes('functionality provided by expo-notifications was removed'))
  ) {
    return; // Silenciar errores de notificaciones en Expo Go
  }
  originalError(...args);
};

// Configurar cómo se manejan las notificaciones cuando la app está en primer plano
// Solo si no estamos en Expo Go
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (error) {
  // Silenciar error en Expo Go
}

export class NotificationService {
  /**
   * Registra el dispositivo para recibir push notifications
   * y envía el token al backend
   */
  static async registerForPushNotifications(): Promise<string | null> {
    // Verificar si estamos en Expo Go (que no soporta push notifications remotas)
    const isExpoGo = !Device.isDevice || __DEV__ === false;

    if (isExpoGo) {
      console.log('📱 Expo Go detectado - Push notifications remotas deshabilitadas');
      console.log('ℹ️  Las notificaciones locales seguirán funcionando');
      console.log('💡 Para habilitar push remotas, crea un development build');
      return null;
    }

    // Solo funciona en dispositivos físicos con development build
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    try {
      // Solicitar permisos
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Permission for push notifications was not granted');
        return null;
      }

      // Obtener el Expo Push Token
      // El projectId se obtiene automáticamente de app.config.js
      const tokenData = await Notifications.getExpoPushTokenAsync();

      const token = tokenData.data;

      // Configuración específica de Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B6B',
        });
      }

      // Enviar el token al backend para guardarlo
      await this.saveTokenToBackend(token);

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Guarda el push token en el backend
   */
  private static async saveTokenToBackend(token: string): Promise<void> {
    try {
      await apiClient.post('/users/push-token', { pushToken: token });
    } catch (error) {
      console.error('Error saving push token to backend:', error);
    }
  }

  /**
   * Elimina el push token del backend (cuando el usuario cierra sesión)
   */
  static async removePushToken(): Promise<void> {
    try {
      await apiClient.delete('/users/push-token');
    } catch (error) {
      // Silenciar error - es normal si no hay conexión al backend
    }
  }

  /**
   * Programa una notificación local (no requiere internet)
   */
  static async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    triggerSeconds?: number
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: triggerSeconds ? { seconds: triggerSeconds } : null,
    });
  }

  /**
   * Cancela una notificación local programada
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancela todas las notificaciones locales
   */
  static async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Escucha notificaciones recibidas cuando la app está abierta
   */
  static addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Escucha cuando el usuario toca una notificación
   */
  static addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

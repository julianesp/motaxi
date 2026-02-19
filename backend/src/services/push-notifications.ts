/**
 * Servicio para enviar push notifications usando Expo Push Notification API
 * Este servicio se ejecuta en Cloudflare Workers y envía notificaciones
 * a través del servicio de Expo (no requiere Firebase)
 */

export interface PushMessage {
  to: string; // Expo Push Token
  title: string;
  body: string;
  data?: any;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export class PushNotificationService {
  private static EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

  /**
   * Envía una push notification a un dispositivo específico
   */
  static async sendPushNotification(message: PushMessage): Promise<boolean> {
    try {
      const response = await fetch(this.EXPO_PUSH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('Push notification errors:', data.errors);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Envía push notifications a múltiples dispositivos
   */
  static async sendBulkPushNotifications(messages: PushMessage[]): Promise<boolean> {
    try {
      const response = await fetch(this.EXPO_PUSH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('Bulk push notification errors:', data.errors);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending bulk push notifications:', error);
      return false;
    }
  }

  /**
   * Notifica a un conductor sobre un nuevo viaje disponible
   */
  static async notifyDriverAboutTrip(
    driverPushToken: string,
    tripData: {
      tripId: string;
      pickupAddress: string;
      fare: number;
    }
  ): Promise<boolean> {
    return this.sendPushNotification({
      to: driverPushToken,
      title: '¡Nuevo viaje disponible!',
      body: `${tripData.pickupAddress} - $${tripData.fare.toLocaleString()}`,
      data: {
        type: 'new_trip',
        tripId: tripData.tripId,
      },
      sound: 'default',
      priority: 'high',
    });
  }

  /**
   * Notifica a un pasajero que su viaje fue aceptado
   */
  static async notifyPassengerTripAccepted(
    passengerPushToken: string,
    driverData: {
      driverName: string;
      vehicleInfo: string;
    }
  ): Promise<boolean> {
    return this.sendPushNotification({
      to: passengerPushToken,
      title: '¡Conductor asignado!',
      body: `${driverData.driverName} está en camino (${driverData.vehicleInfo})`,
      data: {
        type: 'trip_accepted',
      },
      sound: 'default',
      priority: 'high',
    });
  }

  /**
   * Notifica que el conductor está cerca
   */
  static async notifyPassengerDriverArriving(
    passengerPushToken: string,
    estimatedMinutes: number
  ): Promise<boolean> {
    return this.sendPushNotification({
      to: passengerPushToken,
      title: 'Tu conductor está cerca',
      body: `Llegará en aproximadamente ${estimatedMinutes} minutos`,
      data: {
        type: 'driver_arriving',
      },
      sound: 'default',
    });
  }

  /**
   * Notifica que el viaje ha iniciado
   */
  static async notifyTripStarted(
    passengerPushToken: string
  ): Promise<boolean> {
    return this.sendPushNotification({
      to: passengerPushToken,
      title: 'Viaje iniciado',
      body: '¡Buen viaje! Tu conductor ha iniciado el recorrido',
      data: {
        type: 'trip_started',
      },
      sound: 'default',
    });
  }

  /**
   * Notifica que el viaje se completó
   */
  static async notifyTripCompleted(
    userPushToken: string,
    fare: number
  ): Promise<boolean> {
    return this.sendPushNotification({
      to: userPushToken,
      title: 'Viaje completado',
      body: `Gracias por viajar con MoTaxi. Total: $${fare.toLocaleString()}`,
      data: {
        type: 'trip_completed',
      },
      sound: 'default',
    });
  }

  /**
   * Notifica a un pasajero sobre una nueva oferta de precio de un conductor
   */
  static async notifyPassengerNewOffer(
    passengerPushToken: string,
    offerData: {
      driverName: string;
      offeredPrice: number;
      tripId: string;
    }
  ): Promise<boolean> {
    return this.sendPushNotification({
      to: passengerPushToken,
      title: '¡Nueva oferta de conductor!',
      body: `${offerData.driverName} te ofrece el viaje por $${offerData.offeredPrice.toLocaleString()}`,
      data: {
        type: 'price_offer',
        tripId: offerData.tripId,
        offeredPrice: offerData.offeredPrice,
      },
      sound: 'default',
      priority: 'high',
    });
  }
}

/**
 * Servicio de notificaciones por Telegram
 * Usa la API de Telegram Bot para enviar mensajes a los conductores
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

export class TelegramService {
  /**
   * Envía un mensaje de texto a un chat de Telegram
   */
  static async sendMessage(
    botToken: string,
    chatId: string | number,
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
  ): Promise<boolean> {
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      });

      const data = await response.json() as any;
      return data.ok === true;
    } catch (error) {
      console.error('Telegram sendMessage error:', error);
      return false;
    }
  }

  /**
   * Notifica a un conductor sobre un nuevo viaje
   */
  static async notifyDriverNewTrip(
    botToken: string,
    chatId: string | number,
    trip: {
      tripId: string;
      pickupAddress: string;
      dropoffAddress: string;
      fare: number;
      distanceKm: number;
      tripType: 'ride' | 'delivery';
      passengerName: string;
    }
  ): Promise<boolean> {
    const isDelivery = trip.tripType === 'delivery';
    const emoji = isDelivery ? '📦' : '🏍️';
    const tipo = isDelivery ? 'ENVÍO' : 'VIAJE';

    const text = `${emoji} <b>¡Nueva solicitud de ${tipo}!</b>

📍 <b>Recogida:</b> ${trip.pickupAddress}
🏁 <b>Destino:</b> ${trip.dropoffAddress}
📏 <b>Distancia:</b> ${trip.distanceKm} km
💰 <b>Tarifa estimada:</b> $${trip.fare.toLocaleString('es-CO')}
👤 <b>Pasajero:</b> ${trip.passengerName}

<i>Entra a la app para aceptar el viaje.</i>`;

    return this.sendMessage(botToken, chatId, text);
  }

  /**
   * Configura el webhook del bot para recibir mensajes de conductores
   */
  static async setWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });

      const data = await response.json() as any;
      return data.ok === true;
    } catch (error) {
      console.error('Telegram setWebhook error:', error);
      return false;
    }
  }

  /**
   * Obtiene información del webhook actual
   */
  static async getWebhookInfo(botToken: string): Promise<any> {
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/getWebhookInfo`);
      return await response.json();
    } catch (error) {
      console.error('Telegram getWebhookInfo error:', error);
      return null;
    }
  }
}

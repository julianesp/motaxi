import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';
import { TelegramService } from '../services/telegram';

export const telegramRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /telegram/webhook
 * Recibe mensajes del bot de Telegram (sin autenticación — llamado por Telegram).
 * Cuando un conductor envía /start <token>, vincula su chat_id con su cuenta.
 */
telegramRoutes.post('/webhook', async (c) => {
  try {
    const body = await c.req.json() as any;
    const message = body?.message;

    if (!message || !message.text) {
      return c.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text: string = message.text.trim();

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const linkToken = parts[1];

      if (!linkToken) {
        if (c.env.TELEGRAM_BOT_TOKEN) {
          await TelegramService.sendMessage(
            c.env.TELEGRAM_BOT_TOKEN,
            chatId,
            '👋 <b>¡Hola! Soy el bot de MoTaxi.</b>\n\nPara recibir notificaciones de nuevos viajes, ve a tu perfil en la app y toca <b>"Vincular Telegram"</b>.'
          );
        }
        return c.json({ ok: true });
      }

      // Buscar conductor con ese token de vinculación
      const driver = await c.env.DB.prepare(
        'SELECT id, full_name FROM users WHERE telegram_link_token = ? AND role = ?'
      )
        .bind(linkToken, 'driver')
        .first() as any;

      if (!driver) {
        if (c.env.TELEGRAM_BOT_TOKEN) {
          await TelegramService.sendMessage(
            c.env.TELEGRAM_BOT_TOKEN,
            chatId,
            '❌ Enlace inválido o expirado. Genera un nuevo enlace desde tu perfil en la app.'
          );
        }
        return c.json({ ok: true });
      }

      // Guardar chat_id y limpiar el token usado
      await c.env.DB.prepare(
        'UPDATE users SET telegram_chat_id = ?, telegram_link_token = NULL WHERE id = ?'
      )
        .bind(String(chatId), driver.id)
        .run();

      if (c.env.TELEGRAM_BOT_TOKEN) {
        await TelegramService.sendMessage(
          c.env.TELEGRAM_BOT_TOKEN,
          chatId,
          `✅ <b>¡Cuenta vinculada exitosamente!</b>\n\nHola ${driver.full_name}, a partir de ahora recibirás notificaciones de nuevos viajes aquí. 🏍️\n\n<i>No necesitas hacer nada más, solo mantén Telegram activo en tu celular.</i>`
        );
      }
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return c.json({ ok: true }); // Siempre 200 para Telegram
  }
});

// Rutas autenticadas
telegramRoutes.use('/link-token', authMiddleware);
telegramRoutes.use('/unlink', authMiddleware);

/**
 * GET /telegram/link-token
 * Genera un token de vinculación para el conductor autenticado.
 * Devuelve un deep link directo para abrir el bot con el token.
 */
telegramRoutes.get('/link-token', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Solo los conductores pueden vincular Telegram' }, 403);
    }

    // Verificar si ya tiene Telegram vinculado
    const existing = await c.env.DB.prepare(
      'SELECT telegram_chat_id FROM users WHERE id = ?'
    ).bind(user.id).first() as any;

    if (existing?.telegram_chat_id) {
      return c.json({
        linked: true,
        message: 'Tu cuenta de Telegram ya está vinculada.',
      });
    }

    // Generar token único de 32 caracteres hex
    const linkToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    await c.env.DB.prepare(
      'UPDATE users SET telegram_link_token = ? WHERE id = ?'
    )
      .bind(linkToken, user.id)
      .run();

    const deepLink = `https://t.me/motaxiBot?start=${linkToken}`;

    return c.json({ linked: false, deepLink });
  } catch (error: any) {
    console.error('Link token error:', error);
    return c.json({ error: error.message || 'Error generando enlace' }, 500);
  }
});

/**
 * DELETE /telegram/unlink
 * Desvincula la cuenta de Telegram del conductor autenticado.
 */
telegramRoutes.delete('/unlink', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Solo los conductores pueden desvincular Telegram' }, 403);
    }

    await c.env.DB.prepare(
      'UPDATE users SET telegram_chat_id = NULL, telegram_link_token = NULL WHERE id = ?'
    ).bind(user.id).run();

    return c.json({ success: true, message: 'Telegram desvinculado correctamente.' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error desvinculando' }, 500);
  }
});

/**
 * POST /telegram/setup-webhook
 * Configura el webhook del bot (ejecutar una vez al desplegar).
 * Requiere pasar la URL del backend en el body: { url: "https://..." }
 */
telegramRoutes.post('/setup-webhook', async (c) => {
  try {
    if (!c.env.TELEGRAM_BOT_TOKEN) {
      return c.json({ error: 'TELEGRAM_BOT_TOKEN no está configurado' }, 500);
    }

    const body = await c.req.json().catch(() => ({})) as any;
    if (!body.url) {
      return c.json({ error: 'Se requiere el campo "url" con la URL del webhook' }, 400);
    }

    const ok = await TelegramService.setWebhook(c.env.TELEGRAM_BOT_TOKEN, body.url);
    const info = await TelegramService.getWebhookInfo(c.env.TELEGRAM_BOT_TOKEN);

    return c.json({ success: ok, webhookInfo: info });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

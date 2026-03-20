import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

export const notificationRoutes = new Hono<{ Bindings: Env }>();

notificationRoutes.use('*', authMiddleware);

/**
 * GET /notifications
 * Obtener notificaciones del usuario
 */
notificationRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');

    const notifications = await c.env.DB.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    )
      .bind(user.id)
      .all();

    return c.json({ notifications: notifications.results || [] });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get notifications' }, 500);
  }
});

/**
 * PUT /notifications/:id/read
 * Marcar notificación como leída
 */
notificationRoutes.put('/:id/read', async (c) => {
  try {
    const user = c.get('user');
    const notificationId = c.req.param('id');

    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
    )
      .bind(notificationId, user.id)
      .run();

    return c.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to mark notification' }, 500);
  }
});

/**
 * GET /notifications/vapid-public-key
 * Obtener la clave pública VAPID para Web Push (sin autenticación requerida)
 */
notificationRoutes.get('/vapid-public-key', async (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: 'Web Push not configured' }, 503);
  return c.json({ publicKey: key });
});

/**
 * POST /notifications/push-subscription
 * Guardar suscripción Web Push del conductor
 */
notificationRoutes.post('/push-subscription', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { endpoint, p256dh, auth } = body;

    if (!endpoint || !p256dh || !auth) {
      return c.json({ error: 'Missing subscription fields' }, 400);
    }

    // Eliminar suscripción previa del mismo usuario en el mismo endpoint
    await c.env.DB.prepare(
      'DELETE FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?'
    ).bind(user.id, endpoint).run();

    await c.env.DB.prepare(
      'INSERT INTO web_push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)'
    ).bind(uuidv4(), user.id, endpoint, p256dh, auth).run();

    return c.json({ message: 'Push subscription saved' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to save push subscription' }, 500);
  }
});

/**
 * DELETE /notifications/push-subscription
 * Eliminar suscripción Web Push (cuando el conductor desactiva notificaciones)
 */
notificationRoutes.delete('/push-subscription', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const { endpoint } = body as any;

    if (endpoint) {
      await c.env.DB.prepare(
        'DELETE FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?'
      ).bind(user.id, endpoint).run();
    } else {
      await c.env.DB.prepare(
        'DELETE FROM web_push_subscriptions WHERE user_id = ?'
      ).bind(user.id).run();
    }

    return c.json({ message: 'Push subscription removed' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to remove push subscription' }, 500);
  }
});

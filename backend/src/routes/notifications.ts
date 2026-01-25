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

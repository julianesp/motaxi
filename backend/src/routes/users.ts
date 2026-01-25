import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

export const userRoutes = new Hono<{ Bindings: Env }>();

userRoutes.use('*', authMiddleware);

/**
 * GET /users/profile
 * Obtener perfil del usuario
 */
userRoutes.get('/profile', async (c) => {
  try {
    const user = c.get('user');
    const { password_hash, ...userWithoutPassword } = user;

    return c.json({ user: userWithoutPassword });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get profile' }, 500);
  }
});

/**
 * PUT /users/profile
 * Actualizar perfil del usuario
 */
userRoutes.put('/profile', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { full_name, phone, profile_image } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (full_name) {
      updates.push('full_name = ?');
      values.push(full_name);
    }
    if (phone) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (profile_image) {
      updates.push('profile_image = ?');
      values.push(profile_image);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    values.push(user.id);

    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    const updatedUser = await c.env.DB.prepare(
      'SELECT id, email, phone, full_name, role, profile_image, created_at FROM users WHERE id = ?'
    )
      .bind(user.id)
      .first();

    return c.json({ user: updatedUser });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update profile' }, 500);
  }
});

/**
 * POST /users/push-token
 * Guardar token de push notifications
 */
userRoutes.post('/push-token', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { pushToken } = body;

    if (!pushToken) {
      return c.json({ error: 'Push token is required' }, 400);
    }

    await c.env.DB.prepare(
      'UPDATE users SET push_token = ? WHERE id = ?'
    )
      .bind(pushToken, user.id)
      .run();

    return c.json({ message: 'Push token saved' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to save push token' }, 500);
  }
});

/**
 * DELETE /users/push-token
 * Eliminar token de push notifications
 */
userRoutes.delete('/push-token', async (c) => {
  try {
    const user = c.get('user');

    await c.env.DB.prepare(
      'UPDATE users SET push_token = NULL WHERE id = ?'
    )
      .bind(user.id)
      .run();

    return c.json({ message: 'Push token removed' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to remove push token' }, 500);
  }
});

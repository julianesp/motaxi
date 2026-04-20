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
    const { full_name, phone, profile_image, gender } = body;

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
    if (gender !== undefined) {
      // Validar que el gender sea uno de los valores permitidos
      if (!['male', 'female', 'other'].includes(gender) && gender !== null) {
        return c.json({ error: 'Invalid gender value. Must be: male, female, other, or null' }, 400);
      }
      updates.push('gender = ?');
      values.push(gender);
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
      'SELECT id, email, phone, full_name, role, profile_image, gender, created_at FROM users WHERE id = ?'
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
 * PUT /users/switch-role
 * Cambiar rol del usuario entre passenger y driver
 */
userRoutes.put('/switch-role', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { role } = body;

    if (!['passenger', 'driver'].includes(role)) {
      return c.json({ error: 'Invalid role. Must be: passenger or driver' }, 400);
    }

    if (user.role === role) {
      return c.json({ error: 'Already in this role' }, 400);
    }

    // Cambiar rol en tabla users
    await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?')
      .bind(role, user.id)
      .run();

    // Si cambia a driver, crear registro en drivers y suscripción si no existen
    if (role === 'driver') {
      const now = Math.floor(Date.now() / 1000);
      const existing = await c.env.DB.prepare('SELECT id FROM drivers WHERE id = ?')
        .bind(user.id).first();
      if (!existing) {
        // Usar un sufijo único basado en timestamp para evitar colisiones UNIQUE
        const uniqueSuffix = user.id.substring(0, 6) + now.toString().slice(-4);
        const tempPlate = `P-${uniqueSuffix}`;
        const tempLicense = `L-${uniqueSuffix}`;
        await c.env.DB.prepare(
          'INSERT OR IGNORE INTO drivers (id, license_number, vehicle_plate, vehicle_model, vehicle_color, rating, verification_status, is_verified, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(user.id, tempLicense, tempPlate, 'PENDING', 'PENDING', null, 'approved', 1, now).run();
      }
      // Crear suscripción de prueba si no tiene una
      const existingSub = await c.env.DB.prepare('SELECT id FROM subscriptions WHERE user_id = ?')
        .bind(user.id).first();
      if (!existingSub) {
        const trialEndsAt = now + (15 * 24 * 60 * 60);
        const { v4: uuidv4 } = await import('uuid');
        await c.env.DB.prepare(
          `INSERT INTO subscriptions (id, user_id, status, plan, amount, trial_ends_at) VALUES (?, ?, 'trial', 'monthly', 14900, ?)`
        ).bind(uuidv4(), user.id, trialEndsAt).run();
      }
    }

    return c.json({ message: 'Role updated successfully', role });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to switch role' }, 500);
  }
});

/**
 * DELETE /users/account
 * Eliminar cuenta del usuario
 */
userRoutes.delete('/account', async (c) => {
  try {
    const user = c.get('user');
    const id = user.id;

    // Eliminar en orden para evitar conflictos de integridad
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM web_push_subscriptions WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM emergency_contacts WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM sos_alerts WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM payment_methods WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM payment_transactions WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM favorite_drivers WHERE passenger_id = ? OR driver_id = ?').bind(id, id).run();
    await c.env.DB.prepare('DELETE FROM favorite_locations WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM saved_named_places WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM named_places WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM trip_shares WHERE shared_by = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM messages WHERE sender_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM typing_indicators WHERE user_id = ?').bind(id).run();

    if (user.role === 'driver') {
      await c.env.DB.prepare('DELETE FROM driver_price_offers WHERE driver_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM driver_wallets WHERE driver_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM driver_payouts WHERE driver_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM earnings WHERE driver_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM wallet_transactions WHERE driver_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(id).run();
      await c.env.DB.prepare('UPDATE trips SET driver_id = NULL WHERE driver_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM drivers WHERE id = ?').bind(id).run();
    } else if (user.role === 'passenger') {
      await c.env.DB.prepare('UPDATE trips SET passenger_id = NULL WHERE passenger_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM passengers WHERE id = ?').bind(id).run();
    }

    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return c.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return c.json({ error: error.message || 'Failed to delete account' }, 500);
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

import { Hono } from 'hono';
import { Env } from '../index';

export const adminRoutes = new Hono<{ Bindings: Env }>();

const ADMIN_EMAIL = 'admin@neurai.dev';

// Middleware: solo el email admin puede acceder
async function adminOnlyMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const token = authHeader.substring(7);
  const { AuthUtils } = await import('../utils/auth');
  const user = await AuthUtils.verifyToken(c.env.DB, token);

  if (!user) {
    return c.json({ error: 'Token inválido o expirado' }, 401);
  }

  if (user.email !== ADMIN_EMAIL) {
    return c.json({ error: 'Acceso denegado. Solo administradores.' }, 403);
  }

  c.set('user', user);
  c.set('userId', user.id);
  await next();
}

adminRoutes.use('*', adminOnlyMiddleware);

/**
 * GET /admin/stats
 * Estadísticas generales del panel
 */
adminRoutes.get('/stats', async (c) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = Math.floor(new Date().setHours(0,0,0,0) / 1000);
    const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

    // Estadísticas de conductores
    const driverStats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN verification_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN is_available = 1 AND verification_status = 'approved' THEN 1 ELSE 0 END) as online
       FROM drivers`
    ).first();

    // Estadísticas de pasajeros
    const passengerStats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM passengers`
    ).first();

    // Total usuarios registrados
    const userStats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as this_month
       FROM users
       WHERE email != ?`
    ).bind(todayStart, monthStart, ADMIN_EMAIL).first();

    // Estadísticas de viajes
    const tripStats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status IN ('requested','accepted','driver_arriving','in_progress') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' AND completed_at >= ? THEN 1 ELSE 0 END) as completed_today,
        SUM(CASE WHEN status = 'completed' AND completed_at >= ? THEN 1 ELSE 0 END) as completed_month
       FROM trips`
    ).bind(todayStart, monthStart).first();

    // Ingresos por suscripciones
    const subscriptionStats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'trial' THEN 1 ELSE 0 END) as trial,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as monthly_revenue
       FROM subscriptions`
    ).first();

    // Ganancias totales de viajes este mes
    const revenueStats = await c.env.DB.prepare(
      `SELECT
        SUM(fare) as total_fares_month,
        SUM(fare * 0.15) as platform_commission_month
       FROM trips
       WHERE status = 'completed' AND completed_at >= ?`
    ).bind(monthStart).first();

    return c.json({
      drivers: {
        total: Number(driverStats?.total) || 0,
        pending: Number(driverStats?.pending) || 0,
        approved: Number(driverStats?.approved) || 0,
        rejected: Number(driverStats?.rejected) || 0,
        online: Number(driverStats?.online) || 0,
      },
      passengers: {
        total: Number(passengerStats?.total) || 0,
      },
      users: {
        total: Number(userStats?.total) || 0,
        today: Number(userStats?.today) || 0,
        this_month: Number(userStats?.this_month) || 0,
      },
      trips: {
        total: Number(tripStats?.total) || 0,
        completed: Number(tripStats?.completed) || 0,
        cancelled: Number(tripStats?.cancelled) || 0,
        active: Number(tripStats?.active) || 0,
        completed_today: Number(tripStats?.completed_today) || 0,
        completed_month: Number(tripStats?.completed_month) || 0,
      },
      subscriptions: {
        total: Number(subscriptionStats?.total) || 0,
        active: Number(subscriptionStats?.active) || 0,
        trial: Number(subscriptionStats?.trial) || 0,
        expired: Number(subscriptionStats?.expired) || 0,
        monthly_revenue: Number(subscriptionStats?.monthly_revenue) || 0,
      },
      revenue: {
        total_fares_month: Number(revenueStats?.total_fares_month) || 0,
        platform_commission_month: Number(revenueStats?.platform_commission_month) || 0,
      },
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return c.json({ error: error.message || 'Failed to get stats' }, 500);
  }
});

/**
 * GET /admin/drivers
 * Todos los conductores con info de suscripción y días restantes
 */
adminRoutes.get('/drivers', async (c) => {
  try {
    const status = c.req.query('status');
    const now = Math.floor(Date.now() / 1000);

    let query = `
      SELECT
        d.*,
        u.email,
        u.full_name,
        u.phone,
        u.created_at as user_created_at,
        s.status as subscription_status,
        s.amount as subscription_amount,
        s.current_period_start,
        s.current_period_end,
        s.trial_ends_at,
        s.epayco_transaction_id,
        CASE
          WHEN s.status = 'active' THEN MAX(0, CAST((s.current_period_end - ${now}) / 86400 AS INTEGER))
          WHEN s.status = 'trial' THEN MAX(0, CAST((s.trial_ends_at - ${now}) / 86400 AS INTEGER))
          ELSE 0
        END as days_remaining,
        CASE
          WHEN s.status = 'active' AND s.current_period_end < ${now} THEN 1
          WHEN s.status = 'trial' AND s.trial_ends_at < ${now} THEN 1
          ELSE 0
        END as is_expired
       FROM drivers d
       JOIN users u ON d.id = u.id
       LEFT JOIN subscriptions s ON s.user_id = d.id
    `;

    const params: any[] = [];

    if (status) {
      query += ' WHERE d.verification_status = ?';
      params.push(status);
    }

    query += ' ORDER BY u.created_at DESC';

    const stmt = params.length > 0
      ? c.env.DB.prepare(query).bind(...params)
      : c.env.DB.prepare(query);

    const drivers = await stmt.all();

    return c.json({ drivers: drivers.results || [] });
  } catch (error: any) {
    console.error('Get drivers error:', error);
    return c.json({ error: error.message || 'Failed to get drivers' }, 500);
  }
});

/**
 * GET /admin/drivers/pending
 * Conductores pendientes de verificación
 */
adminRoutes.get('/drivers/pending', async (c) => {
  try {
    const drivers = await c.env.DB.prepare(
      `SELECT
        d.*,
        u.email,
        u.full_name,
        u.phone,
        u.created_at as user_created_at
       FROM drivers d
       JOIN users u ON d.id = u.id
       WHERE d.verification_status = 'pending'
       ORDER BY u.created_at DESC`
    ).all();

    return c.json({ drivers: drivers.results || [] });
  } catch (error: any) {
    console.error('Get pending drivers error:', error);
    return c.json({ error: error.message || 'Failed to get pending drivers' }, 500);
  }
});

/**
 * PUT /admin/drivers/:id/verify
 * Aprobar conductor
 */
adminRoutes.put('/drivers/:id/verify', async (c) => {
  try {
    const user = c.get('user');
    const driverId = c.req.param('id');

    await c.env.DB.prepare(
      `UPDATE drivers
       SET verification_status = 'approved',
           is_verified = 1,
           verified_at = ?,
           verified_by = ?
       WHERE id = ?`
    ).bind(Math.floor(Date.now() / 1000), user.id, driverId).run();

    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      driverId,
      '¡Cuenta verificada!',
      'Tu cuenta de conductor ha sido aprobada. Ya puedes empezar a recibir solicitudes de viaje.',
      'verification_approved'
    ).run();

    const driver = await c.env.DB.prepare('SELECT * FROM drivers WHERE id = ?').bind(driverId).first();
    return c.json({ driver, message: 'Driver verified successfully' });
  } catch (error: any) {
    console.error('Verify driver error:', error);
    return c.json({ error: error.message || 'Failed to verify driver' }, 500);
  }
});

/**
 * PUT /admin/drivers/:id/reject
 * Rechazar conductor
 */
adminRoutes.put('/drivers/:id/reject', async (c) => {
  try {
    const user = c.get('user');
    const driverId = c.req.param('id');
    const body = await c.req.json();
    const { reason } = body;

    if (!reason) {
      return c.json({ error: 'Rejection reason is required' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE drivers
       SET verification_status = 'rejected',
           is_verified = 0,
           rejection_reason = ?,
           verified_at = ?,
           verified_by = ?
       WHERE id = ?`
    ).bind(reason, Math.floor(Date.now() / 1000), user.id, driverId).run();

    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      driverId,
      'Verificación rechazada',
      `Tu solicitud de conductor no fue aprobada. Motivo: ${reason}`,
      'verification_rejected',
      JSON.stringify({ reason })
    ).run();

    const driver = await c.env.DB.prepare('SELECT * FROM drivers WHERE id = ?').bind(driverId).first();
    return c.json({ driver, message: 'Driver rejected' });
  } catch (error: any) {
    console.error('Reject driver error:', error);
    return c.json({ error: error.message || 'Failed to reject driver' }, 500);
  }
});

/**
 * GET /admin/subscriptions
 * Lista de todas las suscripciones con info del usuario
 */
adminRoutes.get('/subscriptions', async (c) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const statusFilter = c.req.query('status');

    let query = `
      SELECT
        s.*,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        CASE
          WHEN s.status = 'active' THEN MAX(0, CAST((s.current_period_end - ${now}) / 86400 AS INTEGER))
          WHEN s.status = 'trial' THEN MAX(0, CAST((s.trial_ends_at - ${now}) / 86400 AS INTEGER))
          ELSE 0
        END as days_remaining
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
    `;

    const params: any[] = [];
    if (statusFilter) {
      query += ' WHERE s.status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY s.updated_at DESC';

    const stmt = params.length > 0
      ? c.env.DB.prepare(query).bind(...params)
      : c.env.DB.prepare(query);

    const subscriptions = await stmt.all();

    return c.json({ subscriptions: subscriptions.results || [] });
  } catch (error: any) {
    console.error('Get subscriptions error:', error);
    return c.json({ error: error.message || 'Failed to get subscriptions' }, 500);
  }
});

/**
 * GET /admin/users
 * Lista de todos los usuarios registrados
 */
adminRoutes.get('/users', async (c) => {
  try {
    const role = c.req.query('role');
    const now = Math.floor(Date.now() / 1000);

    let query = `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.role,
        u.created_at,
        u.updated_at,
        s.status as subscription_status,
        CASE
          WHEN s.status = 'active' THEN MAX(0, CAST((s.current_period_end - ${now}) / 86400 AS INTEGER))
          WHEN s.status = 'trial' THEN MAX(0, CAST((s.trial_ends_at - ${now}) / 86400 AS INTEGER))
          ELSE NULL
        END as subscription_days_remaining,
        d.verification_status,
        d.is_available,
        d.rating as driver_rating,
        d.total_trips as driver_total_trips,
        p.rating as passenger_rating,
        p.total_trips as passenger_total_trips
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN drivers d ON d.id = u.id AND u.role = 'driver'
       LEFT JOIN passengers p ON p.id = u.id AND u.role = 'passenger'
       WHERE u.email != ?
    `;

    const params: any[] = [ADMIN_EMAIL];

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    query += ' ORDER BY u.created_at DESC';

    const users = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({ users: users.results || [] });
  } catch (error: any) {
    console.error('Get users error:', error);
    return c.json({ error: error.message || 'Failed to get users' }, 500);
  }
});

/**
 * GET /admin/payments
 * Lista de pagos/transacciones recientes
 */
adminRoutes.get('/payments', async (c) => {
  try {
    const limit = Number(c.req.query('limit') || 50);
    const offset = Number(c.req.query('offset') || 0);

    const payments = await c.env.DB.prepare(
      `SELECT
        pt.*,
        u.full_name,
        u.email,
        t.pickup_address,
        t.dropoff_address
       FROM payment_transactions pt
       JOIN users u ON pt.user_id = u.id
       LEFT JOIN trips t ON pt.trip_id = t.id
       ORDER BY pt.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM payment_transactions'
    ).first();

    return c.json({
      payments: payments.results || [],
      total: Number(total?.count) || 0,
    });
  } catch (error: any) {
    console.error('Get payments error:', error);
    return c.json({ error: error.message || 'Failed to get payments' }, 500);
  }
});

/**
 * GET /admin/trips
 * Lista de viajes con filtros
 */
adminRoutes.get('/trips', async (c) => {
  try {
    const limit = Number(c.req.query('limit') || 50);
    const offset = Number(c.req.query('offset') || 0);
    const status = c.req.query('status');

    let query = `
      SELECT
        t.*,
        pu.full_name as passenger_name,
        pu.phone as passenger_phone,
        du.full_name as driver_name,
        du.phone as driver_phone
       FROM trips t
       LEFT JOIN users pu ON t.passenger_id = pu.id
       LEFT JOIN users du ON t.driver_id = du.id
    `;

    const params: any[] = [];
    if (status) {
      query += ' WHERE t.status = ?';
      params.push(status);
    }

    query += ' ORDER BY t.requested_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const trips = await c.env.DB.prepare(query).bind(...params).all();

    const countQuery = status
      ? 'SELECT COUNT(*) as count FROM trips WHERE status = ?'
      : 'SELECT COUNT(*) as count FROM trips';
    const total = status
      ? await c.env.DB.prepare(countQuery).bind(status).first()
      : await c.env.DB.prepare(countQuery).first();

    return c.json({
      trips: trips.results || [],
      total: Number(total?.count) || 0,
    });
  } catch (error: any) {
    console.error('Get trips error:', error);
    return c.json({ error: error.message || 'Failed to get trips' }, 500);
  }
});

/**
 * PUT /admin/subscriptions/:userId/activate
 * Activar manualmente la suscripción de un usuario
 */
adminRoutes.put('/subscriptions/:userId/activate', async (c) => {
  try {
    const userId = c.req.param('userId');
    const now = Math.floor(Date.now() / 1000);
    const periodEnd = now + 30 * 24 * 60 * 60; // 30 días

    const existing = await c.env.DB.prepare(
      'SELECT * FROM subscriptions WHERE user_id = ?'
    ).bind(userId).first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE subscriptions
         SET status = 'active',
             current_period_start = ?,
             current_period_end = ?,
             updated_at = ?
         WHERE user_id = ?`
      ).bind(now, periodEnd, now, userId).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO subscriptions (id, user_id, status, plan, amount, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, 'active', 'monthly', 14900, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), userId, now, periodEnd, now, now).run();
    }

    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      userId,
      'Suscripción activada',
      'Tu suscripción ha sido activada por el administrador.',
      'general'
    ).run();

    return c.json({ message: 'Subscription activated successfully' });
  } catch (error: any) {
    console.error('Activate subscription error:', error);
    return c.json({ error: error.message || 'Failed to activate subscription' }, 500);
  }
});

/**
 * GET /admin/revenue
 * Ingresos por período
 */
adminRoutes.get('/revenue', async (c) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const periods = {
      today: Math.floor(new Date().setHours(0,0,0,0) / 1000),
      week: now - 7 * 24 * 60 * 60,
      month: Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000),
      year: Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000),
    };

    const revenueByPeriod = await Promise.all(
      Object.entries(periods).map(async ([period, start]) => {
        const result = await c.env.DB.prepare(
          `SELECT
            COUNT(*) as trip_count,
            SUM(fare) as total_fares,
            SUM(fare * 0.15) as platform_commission
           FROM trips
           WHERE status = 'completed' AND completed_at >= ?`
        ).bind(start).first();
        return {
          period,
          trip_count: Number(result?.trip_count) || 0,
          total_fares: Number(result?.total_fares) || 0,
          platform_commission: Number(result?.platform_commission) || 0,
        };
      })
    );

    const subscriptionRevenue = await c.env.DB.prepare(
      `SELECT
        SUM(CASE WHEN current_period_start >= ? THEN amount ELSE 0 END) as month_revenue,
        SUM(CASE WHEN current_period_start >= ? THEN amount ELSE 0 END) as year_revenue,
        SUM(amount) as total_revenue
       FROM subscriptions
       WHERE status = 'active'`
    ).bind(periods.month, periods.year).first();

    return c.json({
      trips: Object.fromEntries(revenueByPeriod.map(r => [r.period, r])),
      subscriptions: {
        month_revenue: Number(subscriptionRevenue?.month_revenue) || 0,
        year_revenue: Number(subscriptionRevenue?.year_revenue) || 0,
        total_revenue: Number(subscriptionRevenue?.total_revenue) || 0,
      },
    });
  } catch (error: any) {
    console.error('Get revenue error:', error);
    return c.json({ error: error.message || 'Failed to get revenue' }, 500);
  }
});

/**
 * DELETE /admin/users/:id
 * Eliminar usuario y todos sus datos asociados
 */
adminRoutes.delete('/users/:id', async (c) => {
  try {
    const userId = c.req.param('id');

    // No permitir eliminar al propio admin
    if (userId === 'admin-neurai-001') {
      return c.json({ error: 'No puedes eliminar la cuenta de administrador' }, 403);
    }

    // Verificar columnas reales de la DB antes de eliminar
    // messages: sender_id | typing_indicators: user_id | conversations: passenger_id, driver_id
    // favorite_drivers: passenger_id, driver_id | notifications: user_id
    const tables: Array<{ sql: string; params: string[] }> = [
      { sql: 'DELETE FROM messages WHERE sender_id = ?', params: [userId] },
      { sql: 'DELETE FROM typing_indicators WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM conversations WHERE passenger_id = ? OR driver_id = ?', params: [userId, userId] },
      { sql: 'DELETE FROM notifications WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM sos_alerts WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM emergency_contacts WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM favorite_drivers WHERE passenger_id = ? OR driver_id = ?', params: [userId, userId] },
      { sql: 'DELETE FROM favorite_locations WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM payment_methods WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM payment_transactions WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM wallet_transactions WHERE driver_id = ?', params: [userId] },
      { sql: 'DELETE FROM driver_payouts WHERE driver_id = ?', params: [userId] },
      { sql: 'DELETE FROM driver_wallets WHERE driver_id = ?', params: [userId] },
      { sql: 'DELETE FROM earnings WHERE driver_id = ?', params: [userId] },
      { sql: 'DELETE FROM trip_shares WHERE shared_by_user_id = ?', params: [userId] },
      { sql: 'DELETE FROM subscriptions WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM password_resets WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM sessions WHERE user_id = ?', params: [userId] },
      { sql: 'DELETE FROM trips WHERE passenger_id = ? OR driver_id = ?', params: [userId, userId] },
      { sql: 'DELETE FROM passengers WHERE id = ?', params: [userId] },
      { sql: 'DELETE FROM drivers WHERE id = ?', params: [userId] },
      { sql: 'DELETE FROM users WHERE id = ?', params: [userId] },
    ];

    for (const t of tables) {
      try {
        await c.env.DB.prepare(t.sql).bind(...t.params).run();
      } catch (e: any) {
        console.error(`Error en "${t.sql}": ${e.message}`);
        // Continuar aunque falle una tabla secundaria
      }
    }

    return c.json({ message: 'Usuario eliminado correctamente' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return c.json({ error: error.message || 'Failed to delete user' }, 500);
  }
});

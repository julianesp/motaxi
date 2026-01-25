import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.use('*', authMiddleware);

/**
 * GET /admin/drivers/pending
 * Obtener conductores pendientes de verificación
 */
adminRoutes.get('/drivers/pending', async (c) => {
  try {
    const user = c.get('user');

    // TODO: Implementar rol de admin en users
    // Por ahora, cualquier usuario puede acceder (temporal)

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
 * GET /admin/drivers
 * Obtener todos los conductores con filtros
 */
adminRoutes.get('/drivers', async (c) => {
  try {
    const status = c.req.query('status'); // pending, approved, rejected

    let query = `
      SELECT
        d.*,
        u.email,
        u.full_name,
        u.phone,
        u.created_at as user_created_at
       FROM drivers d
       JOIN users u ON d.id = u.id
    `;

    const params: string[] = [];

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
 * PUT /admin/drivers/:id/verify
 * Aprobar un conductor
 */
adminRoutes.put('/drivers/:id/verify', async (c) => {
  try {
    const user = c.get('user');
    const driverId = c.req.param('id');

    // Actualizar estado de verificación
    await c.env.DB.prepare(
      `UPDATE drivers
       SET verification_status = 'approved',
           is_verified = 1,
           verified_at = ?,
           verified_by = ?
       WHERE id = ?`
    )
      .bind(Math.floor(Date.now() / 1000), user.id, driverId)
      .run();

    // Crear notificación para el conductor
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        driverId,
        '¡Cuenta verificada!',
        'Tu cuenta de conductor ha sido aprobada. Ya puedes empezar a recibir solicitudes de viaje.',
        'verification_approved'
      )
      .run();

    const driver = await c.env.DB.prepare(
      'SELECT * FROM drivers WHERE id = ?'
    )
      .bind(driverId)
      .first();

    return c.json({ driver, message: 'Driver verified successfully' });
  } catch (error: any) {
    console.error('Verify driver error:', error);
    return c.json({ error: error.message || 'Failed to verify driver' }, 500);
  }
});

/**
 * PUT /admin/drivers/:id/reject
 * Rechazar un conductor
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

    // Actualizar estado de verificación
    await c.env.DB.prepare(
      `UPDATE drivers
       SET verification_status = 'rejected',
           is_verified = 0,
           rejection_reason = ?,
           verified_at = ?,
           verified_by = ?
       WHERE id = ?`
    )
      .bind(reason, Math.floor(Date.now() / 1000), user.id, driverId)
      .run();

    // Crear notificación para el conductor
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        driverId,
        'Verificación rechazada',
        `Tu solicitud de conductor no fue aprobada. Motivo: ${reason}`,
        'verification_rejected',
        JSON.stringify({ reason })
      )
      .run();

    const driver = await c.env.DB.prepare(
      'SELECT * FROM drivers WHERE id = ?'
    )
      .bind(driverId)
      .first();

    return c.json({ driver, message: 'Driver rejected' });
  } catch (error: any) {
    console.error('Reject driver error:', error);
    return c.json({ error: error.message || 'Failed to reject driver' }, 500);
  }
});

/**
 * GET /admin/stats
 * Estadísticas generales
 */
adminRoutes.get('/stats', async (c) => {
  try {
    const stats = {
      drivers: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      },
      trips: {
        total: 0,
        completed: 0,
        cancelled: 0,
        in_progress: 0,
      },
    };

    // Estadísticas de conductores
    const driverStats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN verification_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM drivers`
    ).first();

    if (driverStats) {
      stats.drivers = {
        total: Number(driverStats.total) || 0,
        pending: Number(driverStats.pending) || 0,
        approved: Number(driverStats.approved) || 0,
        rejected: Number(driverStats.rejected) || 0,
      };
    }

    // Estadísticas de viajes
    const tripStats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
       FROM trips`
    ).first();

    if (tripStats) {
      stats.trips = {
        total: Number(tripStats.total) || 0,
        completed: Number(tripStats.completed) || 0,
        cancelled: Number(tripStats.cancelled) || 0,
        in_progress: Number(tripStats.in_progress) || 0,
      };
    }

    return c.json({ stats });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return c.json({ error: error.message || 'Failed to get stats' }, 500);
  }
});

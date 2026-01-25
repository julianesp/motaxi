import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

export const driverRoutes = new Hono<{ Bindings: Env }>();

driverRoutes.use('*', authMiddleware);

/**
 * PUT /drivers/location
 * Actualizar ubicación del conductor
 */
driverRoutes.put('/location', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { latitude, longitude } = body;

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can update location' }, 403);
    }

    const timestamp = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      'UPDATE drivers SET current_latitude = ?, current_longitude = ?, last_location_update = ? WHERE id = ?'
    )
      .bind(latitude, longitude, timestamp, user.id)
      .run();

    return c.json({ message: 'Location updated' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update location' }, 500);
  }
});

/**
 * PUT /drivers/availability
 * Actualizar disponibilidad del conductor
 */
driverRoutes.put('/availability', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { isAvailable } = body;

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can update availability' }, 403);
    }

    await c.env.DB.prepare('UPDATE drivers SET is_available = ? WHERE id = ?')
      .bind(isAvailable ? 1 : 0, user.id)
      .run();

    return c.json({ message: 'Availability updated' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update availability' }, 500);
  }
});

/**
 * GET /drivers/nearby
 * Obtener conductores cercanos (para pasajeros)
 */
driverRoutes.get('/nearby', async (c) => {
  try {
    const lat = parseFloat(c.req.query('lat') || '0');
    const lng = parseFloat(c.req.query('lng') || '0');

    const drivers = await c.env.DB.prepare(
      `SELECT d.id, d.current_latitude, d.current_longitude, d.rating, d.total_trips, d.verification_status,
              u.full_name, d.vehicle_model, d.vehicle_color
       FROM drivers d
       JOIN users u ON d.id = u.id
       WHERE d.is_available = 1 AND d.verification_status = 'approved'`
    )
      .all();

    return c.json({ drivers: drivers.results || [] });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get nearby drivers' }, 500);
  }
});

/**
 * GET /drivers/earnings
 * Obtener ganancias del conductor
 */
driverRoutes.get('/earnings', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can view earnings' }, 403);
    }

    const trips = await c.env.DB.prepare(
      'SELECT * FROM trips WHERE driver_id = ? AND status = ? ORDER BY completed_at DESC'
    )
      .bind(user.id, 'completed')
      .all();

    return c.json({ trips: trips.results || [] });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get earnings' }, 500);
  }
});

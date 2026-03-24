import { Hono } from 'hono';
import { authMiddleware, subscriptionMiddleware } from '../utils/auth';
import { Env } from '../index';

export const driverRoutes = new Hono<{ Bindings: Env }>();

driverRoutes.use('*', authMiddleware);
// Disponibilidad y ubicación requieren suscripción activa
driverRoutes.use('/availability', subscriptionMiddleware);
driverRoutes.use('/location', subscriptionMiddleware);

/**
 * GET /drivers/profile
 * Obtener perfil completo del conductor
 */
driverRoutes.get('/profile', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can access this endpoint' }, 403);
    }

    // Obtener información del conductor
    const driver = await c.env.DB.prepare(
      `SELECT
        d.vehicle_model,
        d.vehicle_color,
        d.vehicle_plate,
        d.license_number,
        d.is_available,
        d.verification_status,
        d.rating,
        d.total_trips,
        d.current_latitude,
        d.current_longitude,
        d.last_location_update,
        d.municipality,
        d.accepts_intercity_trips,
        d.accepts_rural_trips,
        d.base_fare,
        d.intercity_fare,
        d.rural_fare,
        d.per_km_fare,
        d.profile_completed
      FROM drivers d
      WHERE d.id = ?`
    )
      .bind(user.id)
      .first();

    if (!driver) {
      return c.json({ error: 'Driver profile not found' }, 404);
    }

    return c.json({
      driver,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        profile_image: user.profile_image,
        created_at: user.created_at
      }
    });
  } catch (error: any) {
    console.error('Get driver profile error:', error);
    return c.json({ error: error.message || 'Failed to get driver profile' }, 500);
  }
});

/**
 * PUT /drivers/profile
 * Actualizar perfil del conductor
 */
driverRoutes.put('/profile', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can update profile' }, 403);
    }

    const {
      municipality,
      accepts_intercity_trips,
      accepts_rural_trips,
      vehicle_model,
      vehicle_color,
      vehicle_plate,
      license_number,
      base_fare,
      intercity_fare,
      rural_fare,
      per_km_fare,
      vehicle_types
    } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (municipality !== undefined) {
      updates.push('municipality = ?');
      values.push(municipality);
    }
    if (accepts_intercity_trips !== undefined) {
      updates.push('accepts_intercity_trips = ?');
      values.push(accepts_intercity_trips ? 1 : 0);
    }
    if (accepts_rural_trips !== undefined) {
      updates.push('accepts_rural_trips = ?');
      values.push(accepts_rural_trips ? 1 : 0);
    }
    if (vehicle_model !== undefined) {
      updates.push('vehicle_model = ?');
      values.push(vehicle_model);
    }
    if (vehicle_color !== undefined) {
      updates.push('vehicle_color = ?');
      values.push(vehicle_color);
    }
    if (vehicle_plate !== undefined) {
      updates.push('vehicle_plate = ?');
      values.push(vehicle_plate);
    }
    if (license_number !== undefined) {
      updates.push('license_number = ?');
      values.push(license_number);
    }
    if (base_fare !== undefined) {
      updates.push('base_fare = ?');
      values.push(base_fare);
    }
    if (intercity_fare !== undefined) {
      updates.push('intercity_fare = ?');
      values.push(intercity_fare);
    }
    if (rural_fare !== undefined) {
      updates.push('rural_fare = ?');
      values.push(rural_fare);
    }
    if (per_km_fare !== undefined) {
      updates.push('per_km_fare = ?');
      values.push(per_km_fare);
    }
    if (vehicle_types !== undefined) {
      if (!['moto', 'carro', 'ambos'].includes(vehicle_types)) {
        return c.json({ error: 'vehicle_types must be: moto, carro, or ambos' }, 400);
      }
      updates.push('vehicle_types = ?');
      values.push(vehicle_types);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    // Verificar si se completaron todos los campos obligatorios para marcar perfil como completo
    if (vehicle_model && vehicle_color && vehicle_plate && license_number) {
      updates.push('profile_completed = ?');
      values.push(1);
    }

    values.push(user.id);

    await c.env.DB.prepare(
      `UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    // Obtener el perfil actualizado
    const driver = await c.env.DB.prepare(
      `SELECT * FROM drivers WHERE id = ?`
    )
      .bind(user.id)
      .first();

    return c.json({ driver });
  } catch (error: any) {
    console.error('Update driver profile error:', error);
    return c.json({ error: error.message || 'Failed to update profile' }, 500);
  }
});

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

    // Verificar si el perfil está completo antes de permitir activarse
    if (isAvailable) {
      const driver = await c.env.DB.prepare(
        'SELECT profile_completed, verification_status FROM drivers WHERE id = ?'
      )
        .bind(user.id)
        .first();

      if (!driver) {
        return c.json({ error: 'Driver profile not found' }, 404);
      }

      if (!driver.profile_completed) {
        return c.json({
          error: 'Debes completar tu perfil antes de activarte',
          profileIncomplete: true
        }, 400);
      }

      if (driver.verification_status !== 'approved') {
        return c.json({
          error: 'Tu cuenta debe estar verificada para activarte',
          notVerified: true
        }, 400);
      }
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
    const vehicleType = c.req.query('vehicle_type'); // 'moto' | 'carro' | undefined

    let whereClause = `d.is_available = 1 AND d.verification_status = 'approved'`;

    // Filtrar por tipo de vehículo si se especifica
    if (vehicleType === 'moto') {
      whereClause += ` AND (d.vehicle_types = 'moto' OR d.vehicle_types = 'ambos')`;
    } else if (vehicleType === 'carro') {
      whereClause += ` AND (d.vehicle_types = 'carro' OR d.vehicle_types = 'ambos')`;
    }

    const drivers = await c.env.DB.prepare(
      `SELECT d.id, d.current_latitude, d.current_longitude, d.rating, d.total_trips,
              d.vehicle_model, d.vehicle_color, d.vehicle_plate, d.is_available,
              d.municipality,
              COALESCE(d.vehicle_types, 'moto') AS vehicle_types,
              COALESCE(d.base_fare, 2000) AS base_fare,
              COALESCE(d.per_km_fare, 500) AS per_km_fare,
              u.full_name, u.phone
       FROM drivers d
       JOIN users u ON d.id = u.id
       WHERE ${whereClause}`
    )
      .all();

    // Calcular distancia solo para conductores con ubicación conocida
    const driversWithDistance = (drivers.results || []).map((driver: any) => {
      if (!driver.current_latitude || !driver.current_longitude) {
        return { ...driver, distance_km: null };
      }
      const dLat = ((driver.current_latitude - lat) * Math.PI) / 180;
      const dLng = ((driver.current_longitude - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((driver.current_latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const distance_km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...driver, distance_km: parseFloat(distance_km.toFixed(2)) };
    });

    // Primero los que tienen ubicación (ordenados por distancia), luego los sin ubicación
    driversWithDistance.sort((a: any, b: any) => {
      if (a.distance_km === null && b.distance_km === null) return 0;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });

    return c.json({ drivers: driversWithDistance });
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

/**
 * GET /drivers/of-the-month
 * Conductor del mes actual (público)
 */
driverRoutes.get('/of-the-month', async (c) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Buscar ganador ya calculado este mes
    const winner = await c.env.DB.prepare(
      `SELECT dom.*, u.full_name, d.rating, d.total_trips, d.vehicle_model, d.vehicle_color, d.municipality
       FROM driver_of_month dom
       JOIN users u ON dom.driver_id = u.id
       JOIN drivers d ON dom.driver_id = d.id
       WHERE dom.month = ? AND dom.year = ?`
    ).bind(month, year).first() as any;

    if (winner) {
      return c.json({ winner });
    }

    // Calcular conductor del mes: mejor rating promedio con ≥5 viajes este mes
    const monthStart = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
    const monthEnd = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);

    const top = await c.env.DB.prepare(
      `SELECT d.id, u.full_name, d.rating, d.total_trips, d.vehicle_model, d.municipality,
              COUNT(t.id) as month_trips, AVG(t.rating) as month_rating
       FROM drivers d
       JOIN users u ON d.id = u.id
       LEFT JOIN trips t ON d.id = t.driver_id AND t.status = 'completed'
         AND t.completed_at BETWEEN ? AND ?
       WHERE d.rating IS NOT NULL
       GROUP BY d.id
       HAVING month_trips >= 3
       ORDER BY month_rating DESC, month_trips DESC
       LIMIT 1`
    ).bind(monthStart, monthEnd).first() as any;

    if (!top) {
      return c.json({ winner: null });
    }

    return c.json({ winner: { ...top, month, year, reward_type: 'free_month' } });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get driver of the month' }, 500);
  }
});

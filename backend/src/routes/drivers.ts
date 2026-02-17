import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

export const driverRoutes = new Hono<{ Bindings: Env }>();

driverRoutes.use('*', authMiddleware);

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
      per_km_fare
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

    const drivers = await c.env.DB.prepare(
      `SELECT d.id, d.current_latitude, d.current_longitude, d.rating, d.total_trips,
              d.vehicle_model, d.vehicle_color, d.vehicle_plate, d.is_available,
              COALESCE(d.base_fare, 2000) AS base_fare,
              COALESCE(d.per_km_fare, 500) AS per_km_fare,
              u.full_name, u.phone
       FROM drivers d
       JOIN users u ON d.id = u.id
       WHERE d.is_available = 1 AND d.verification_status = 'approved'
         AND d.current_latitude IS NOT NULL AND d.current_longitude IS NOT NULL`
    )
      .all();

    // Calcular distancia y ordenar por proximidad (fórmula Haversine simplificada)
    const driversWithDistance = (drivers.results || []).map((driver: any) => {
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

    // Ordenar por distancia ascendente y limitar a 20 conductores
    driversWithDistance.sort((a: any, b: any) => a.distance_km - b.distance_km);

    return c.json({ drivers: driversWithDistance.slice(0, 20) });
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

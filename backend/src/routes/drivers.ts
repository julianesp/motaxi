import { Hono } from 'hono';
import { authMiddleware, subscriptionMiddleware } from '../utils/auth';
import { Env } from '../index';

export const driverRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /drivers/photos/public
 * Fotos públicas recientes de todos los conductores (para la homepage)
 * No requiere autenticación — debe ir ANTES del authMiddleware
 */
driverRoutes.get('/photos/public', async (c) => {
  try {
    const photos = await c.env.DB.prepare(
      `SELECT dp.id, dp.image_key, dp.caption, dp.created_at, dp.likes, u.full_name as driver_name
       FROM driver_photos dp
       JOIN users u ON dp.driver_id = u.id
       WHERE dp.is_visible = 1
       ORDER BY dp.likes DESC, dp.created_at DESC
       LIMIT 30`
    ).all();

    return c.json({ photos: photos.results });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get public photos' }, 500);
  }
});

/**
 * POST /drivers/photos/:id/like
 * Dar like a una foto (anónimo, sin autenticación)
 */
driverRoutes.post('/photos/:id/like', async (c) => {
  try {
    const photoId = c.req.param('id');
    const exists = await c.env.DB.prepare(
      'SELECT id FROM driver_photos WHERE id = ? AND is_visible = 1'
    ).bind(photoId).first();
    if (!exists) return c.json({ error: 'Photo not found' }, 404);

    await c.env.DB.prepare(
      'UPDATE driver_photos SET likes = likes + 1 WHERE id = ?'
    ).bind(photoId).run();

    const updated = await c.env.DB.prepare(
      'SELECT likes FROM driver_photos WHERE id = ?'
    ).bind(photoId).first<{ likes: number }>();

    return c.json({ success: true, likes: updated?.likes ?? 0 });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to like photo' }, 500);
  }
});

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
        d.vehicle_types,
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
        d.night_only,
        d.weekend_daytime,
        d.whatsapp,
        d.base_fare,
        d.intercity_fare,
        d.rural_fare,
        d.per_km_fare,
        d.default_route_fares,
        d.nequi_qr_key,
        d.nequi_phone,
        d.profile_completed,
        d.profile_skipped_at,
        d.usual_hours,
        d.usual_origin,
        d.usual_destination
      FROM drivers d
      WHERE d.id = ?`
    )
      .bind(user.id)
      .first();

    if (!driver) {
      // Crear el registro faltante con valores por defecto
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO drivers (id, license_number, vehicle_plate, vehicle_model, vehicle_color, verification_status, is_available, profile_completed)
         VALUES (?, ?, ?, '', '', 'pending', 0, 0)`
      ).bind(user.id, `tmp_${user.id}`, `tmp_${user.id}`).run();

      const newDriver = await c.env.DB.prepare(
        `SELECT d.vehicle_model, d.vehicle_color, d.vehicle_plate, d.license_number,
                d.is_available, d.verification_status, d.rating, d.total_trips,
                d.current_latitude, d.current_longitude, d.last_location_update,
                d.municipality, d.accepts_intercity_trips, d.accepts_rural_trips,
                d.night_only, d.weekend_daytime, d.whatsapp, d.base_fare, d.intercity_fare, d.rural_fare, d.per_km_fare,
                d.profile_completed, d.profile_skipped_at
         FROM drivers d WHERE d.id = ?`
      ).bind(user.id).first();

      return c.json({
        driver: newDriver,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          full_name: user.full_name,
          profile_image: user.profile_image,
          created_at: user.created_at
        }
      });
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
      night_only,
      weekend_daytime,
      whatsapp,
      nequi_phone,
      vehicle_model,
      vehicle_color,
      vehicle_plate,
      license_number,
      base_fare,
      intercity_fare,
      rural_fare,
      per_km_fare,
      vehicle_types,
      default_route_fares,
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
    if (night_only !== undefined) {
      updates.push('night_only = ?');
      values.push(night_only ? 1 : 0);
    }
    if (weekend_daytime !== undefined) {
      updates.push('weekend_daytime = ?');
      values.push(weekend_daytime ? 1 : 0);
    }
    if (whatsapp !== undefined) {
      updates.push('whatsapp = ?');
      values.push(whatsapp || null);
    }
    if (nequi_phone !== undefined) {
      updates.push('nequi_phone = ?');
      values.push(nequi_phone || null);
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
      if (!['moto', 'taxi', 'carro', 'piaggio', 'particular'].includes(vehicle_types)) {
        return c.json({ error: 'vehicle_types must be: moto, taxi, carro, piaggio, or particular' }, 400);
      }
      updates.push('vehicle_types = ?');
      values.push(vehicle_types);
    }
    if (default_route_fares !== undefined) {
      updates.push('default_route_fares = ?');
      values.push(default_route_fares ? JSON.stringify(default_route_fares) : null);
    }
    const { usual_hours, usual_origin, usual_destination } = body;
    if (usual_hours !== undefined) {
      updates.push('usual_hours = ?');
      values.push(usual_hours || null);
    }
    if (usual_origin !== undefined) {
      updates.push('usual_origin = ?');
      values.push(usual_origin || null);
    }
    if (usual_destination !== undefined) {
      updates.push('usual_destination = ?');
      values.push(usual_destination || null);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    // Verificar si se completaron todos los campos obligatorios para marcar perfil como completo
    if (vehicle_model && vehicle_color && vehicle_plate) {
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
        'SELECT profile_completed, verification_status, vehicle_plate, license_number FROM drivers WHERE id = ?'
      )
        .bind(user.id)
        .first<{ profile_completed: number; verification_status: string; vehicle_plate: string; license_number: string }>();

      // TODO: Reactivar cuando haya suficientes conductores y pasajeros registrados.
      // if (!driver) {
      //   await c.env.DB.prepare(
      //     `INSERT OR IGNORE INTO drivers (id, license_number, vehicle_plate, vehicle_model, vehicle_color, verification_status, is_available, profile_completed)
      //      VALUES (?, ?, ?, '', '', 'pending', 0, 0)`
      //   ).bind(user.id, `tmp_${user.id}`, `tmp_${user.id}`).run();
      //   return c.json({
      //     error: 'Debes completar tu perfil antes de activarte',
      //     profileIncomplete: true
      //   }, 400);
      // }

      // TODO: Reactivar cuando haya suficientes conductores y pasajeros registrados.
      // if (!driver.profile_completed) {
      //   return c.json({
      //     error: 'Debes completar tu perfil antes de activarte',
      //     profileIncomplete: true
      //   }, 400);
      // }

      // TODO: Reactivar cuando haya suficientes conductores y pasajeros registrados.
      // Verificar que placa y licencia sean datos reales (no valores PENDING generados automáticamente)
      // const isPending = (val: string) => !val || val.startsWith('PENDING') || val.startsWith('tmp_') || val.startsWith('P-') || val.startsWith('L-');
      // if (isPending(driver.vehicle_plate) || isPending(driver.license_number)) {
      //   return c.json({
      //     error: 'Debes registrar tu placa y número de licencia reales antes de activarte. Los pasajeros dependen de esta información para su seguridad.',
      //     missingVehicleInfo: true
      //   }, 400);
      // }
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
 * GET /drivers/stats
 * Estadísticas y beneficios del perfil del conductor
 */
driverRoutes.get('/stats', async (c) => {
  try {
    const user = c.get('user');

    // Historial de últimas 20 rutas compartidas
    const routeHistory = await c.env.DB.prepare(`
      SELECT sr.id, sr.origin, sr.destination, sr.created_at,
             sr.total_seats, sr.fare_per_seat, sr.intermediate_fares, sr.status,
             COUNT(rr.id) as passenger_count,
             COALESCE(SUM(
               CASE
                 WHEN sr.intermediate_fares IS NOT NULL THEN (
                   SELECT CAST(json_extract(sr.intermediate_fares, '$.' || REPLACE(rr.destination, ' ', '_')) AS REAL)
                 )
                 ELSE sr.fare_per_seat
               END
             ), 0) as estimated_earnings
      FROM shared_routes sr
      LEFT JOIN route_requests rr ON rr.route_id = sr.id AND rr.status IN ('pending','confirmed','on_the_way')
      WHERE sr.driver_id = ?
      GROUP BY sr.id
      ORDER BY sr.created_at DESC
      LIMIT 20
    `).bind(user.id).all();

    // Ganancias totales estimadas por rutas compartidas
    const earningsResult = await c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT sr.id) as total_routes,
        COALESCE(SUM(rr_count.cnt * sr.fare_per_seat), 0) as total_earnings
      FROM shared_routes sr
      LEFT JOIN (
        SELECT route_id, COUNT(*) as cnt
        FROM route_requests
        WHERE status IN ('pending','confirmed','on_the_way')
        GROUP BY route_id
      ) rr_count ON rr_count.route_id = sr.id
      WHERE sr.driver_id = ? AND sr.status IN ('departed','active')
    `).bind(user.id).first<{ total_routes: number; total_earnings: number }>();

    // Pasajeros frecuentes (teléfonos que han viajado 2+ veces)
    const frequentPassengers = await c.env.DB.prepare(`
      SELECT rr.passenger_name, rr.passenger_phone, COUNT(*) as trip_count
      FROM route_requests rr
      JOIN shared_routes sr ON sr.id = rr.route_id
      WHERE sr.driver_id = ? AND rr.status IN ('pending','confirmed','on_the_way')
      GROUP BY rr.passenger_phone
      HAVING trip_count >= 2
      ORDER BY trip_count DESC
      LIMIT 10
    `).bind(user.id).all();

    // Insignias
    const totalRoutes = earningsResult?.total_routes || 0;
    const driverRating = await c.env.DB.prepare(
      'SELECT rating, total_trips FROM drivers WHERE id = ?'
    ).bind(user.id).first<{ rating: number; total_trips: number }>();

    const cancelledRoutes = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM shared_routes WHERE driver_id = ? AND status = 'cancelled'`
    ).bind(user.id).first<{ cnt: number }>();

    const badges: { id: string; label: string; icon: string; earned: boolean }[] = [
      { id: 'first_route', label: 'Primera ruta', icon: '🚀', earned: totalRoutes >= 1 },
      { id: 'routes_10', label: '10 rutas', icon: '🛣️', earned: totalRoutes >= 10 },
      { id: 'routes_50', label: '50 rutas', icon: '🏆', earned: totalRoutes >= 50 },
      { id: 'routes_100', label: '100 rutas', icon: '💯', earned: totalRoutes >= 100 },
      { id: 'five_stars', label: '5 estrellas', icon: '⭐', earned: (driverRating?.rating || 0) >= 4.8 },
      { id: 'no_cancellations', label: 'Sin cancelaciones', icon: '✅', earned: (cancelledRoutes?.cnt || 0) === 0 && totalRoutes >= 5 },
      { id: 'frequent_passenger', label: 'Pasajero fiel', icon: '🤝', earned: (frequentPassengers.results?.length || 0) >= 1 },
    ];

    return c.json({
      route_history: routeHistory.results || [],
      total_routes: totalRoutes,
      total_earnings: earningsResult?.total_earnings || 0,
      frequent_passengers: frequentPassengers.results || [],
      badges,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get stats' }, 500);
  }
});

/**
 * POST /drivers/notify-passengers
 * Notifica a pasajeros frecuentes cuando el conductor publica una ruta
 */
driverRoutes.post('/notify-passengers', async (c) => {
  try {
    const user = c.get('user');
    const { route_id } = await c.req.json();

    // Obtener la ruta recién publicada
    const route = await c.env.DB.prepare(
      `SELECT origin, destination FROM shared_routes WHERE id = ? AND driver_id = ? AND status = 'active'`
    ).bind(route_id, user.id).first<{ origin: string; destination: string }>();
    if (!route) return c.json({ error: 'Ruta no encontrada' }, 404);

    // Obtener pasajeros frecuentes con suscripción push
    const frequent = await c.env.DB.prepare(`
      SELECT DISTINCT u.id, u.full_name
      FROM route_requests rr
      JOIN shared_routes sr ON sr.id = rr.route_id
      JOIN users u ON u.phone = rr.passenger_phone
      JOIN web_push_subscriptions wps ON wps.user_id = u.id
      WHERE sr.driver_id = ? AND rr.status IN ('pending','confirmed','on_the_way')
      GROUP BY u.id
      HAVING COUNT(*) >= 1
    `).bind(user.id).all();

    const subs = await c.env.DB.prepare(`
      SELECT wps.endpoint, wps.p256dh, wps.auth, wps.user_id
      FROM web_push_subscriptions wps
      WHERE wps.user_id IN (${(frequent.results || []).map(() => '?').join(',') || "''"})
    `).bind(...(frequent.results || []).map((r: any) => r.id)).all();

    if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY || !(subs.results?.length)) {
      return c.json({ notified: 0 });
    }

    const { sendWebPush } = await import('../services/web-push');
    const payload = {
      title: `🚕 ${user.full_name} publicó una ruta`,
      body: `${route.origin} → ${route.destination}. ¡Reserva tu puesto!`,
      data: { type: 'new_shared_route', route_id },
      icon: '/logo.png',
      tag: `shared-route-${route_id}`,
    };

    const sends = (subs.results || []).map((sub: any) =>
      sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        c.env.VAPID_PUBLIC_KEY!,
        c.env.VAPID_PRIVATE_KEY!
      ).catch(() => {})
    );
    c.executionCtx?.waitUntil(Promise.all(sends));

    return c.json({ notified: subs.results?.length || 0 });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to notify passengers' }, 500);
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

    // Ocultar conductores nocturnos fuera de su horario (6:00pm–6:00am, UTC-5 Colombia)
    const now = new Date();
    const horaCol = (now.getUTCHours() - 5 + 24) % 24; // hora actual en Colombia
    const diaSemana = (now.getUTCDay() - 0 + 7) % 7; // 0=domingo, 6=sábado (en hora Colombia)
    const esFindeSemana = diaSemana === 0 || diaSemana === 6; // sábado o domingo
    const esHoraDia = horaCol >= 6 && horaCol < 18; // 6:01am a 5:59pm
    if (esHoraDia) {
      // En horario diurno: mostrar conductores sin restricción nocturna,
      // o conductores nocturnos que trabajan también de día en fines de semana (si es fin de semana)
      whereClause += ` AND (
        d.night_only IS NULL OR d.night_only = 0
        OR (d.night_only = 1 AND d.weekend_daytime = 1 AND ${esFindeSemana ? '1=1' : '1=0'})
      )`;
    }

    // Filtrar por tipo de vehículo si se especifica
    // Los conductores con vehicle_types NULL se tratan como 'moto' (valor por defecto histórico)
    if (vehicleType && ['moto', 'taxi', 'carro', 'piaggio', 'particular'].includes(vehicleType)) {
      if (vehicleType === 'moto') {
        whereClause += ` AND (d.vehicle_types = 'moto' OR d.vehicle_types IS NULL)`;
      } else {
        whereClause += ` AND d.vehicle_types = '${vehicleType}'`;
      }
    }

    const drivers = await c.env.DB.prepare(
      `SELECT d.id, d.current_latitude, d.current_longitude, d.rating, d.total_trips,
              d.vehicle_model, d.vehicle_color, d.vehicle_plate, d.is_available,
              d.municipality, d.night_only, d.weekend_daytime, d.whatsapp, d.nequi_phone,
              d.vehicle_types,
              COALESCE(d.base_fare, 2000) AS base_fare,
              COALESCE(d.per_km_fare, 500) AS per_km_fare,
              u.full_name, u.phone, u.profile_image
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

/**
 * POST /drivers/nequi-qr
 * Subir o reemplazar el QR de Nequi del conductor
 */
driverRoutes.post('/nequi-qr', async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'driver') return c.json({ error: 'Solo conductores' }, 403);

    const formData = await c.req.formData();
    const file = formData.get('qr') as File | null;
    if (!file) return c.json({ error: 'No se recibió imagen' }, 400);
    if (!file.type.startsWith('image/')) return c.json({ error: 'Debe ser una imagen' }, 400);
    if (file.size > 3 * 1024 * 1024) return c.json({ error: 'Imagen máximo 3MB' }, 400);

    if (!c.env.IMAGES) return c.json({ error: 'Storage no configurado' }, 500);

    // Eliminar QR anterior si existe
    const existing = await c.env.DB.prepare(
      'SELECT nequi_qr_key FROM drivers WHERE id = ?'
    ).bind(user.id).first<{ nequi_qr_key: string | null }>();
    if (existing?.nequi_qr_key) {
      await c.env.IMAGES.delete(existing.nequi_qr_key).catch(() => {});
    }

    const ext = file.type.split('/')[1] || 'jpg';
    const key = `nequi-qr/${user.id}.${ext}`;
    const buffer = await file.arrayBuffer();
    await c.env.IMAGES.put(key, buffer, { httpMetadata: { contentType: file.type } });

    await c.env.DB.prepare('UPDATE drivers SET nequi_qr_key = ? WHERE id = ?').bind(key, user.id).run();

    return c.json({ success: true, nequi_qr_key: key });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al subir QR' }, 500);
  }
});

/**
 * DELETE /drivers/nequi-qr
 * Eliminar el QR de Nequi del conductor
 */
driverRoutes.delete('/nequi-qr', async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'driver') return c.json({ error: 'Solo conductores' }, 403);

    const existing = await c.env.DB.prepare(
      'SELECT nequi_qr_key FROM drivers WHERE id = ?'
    ).bind(user.id).first<{ nequi_qr_key: string | null }>();

    if (existing?.nequi_qr_key && c.env.IMAGES) {
      await c.env.IMAGES.delete(existing.nequi_qr_key).catch(() => {});
    }

    await c.env.DB.prepare('UPDATE drivers SET nequi_qr_key = NULL WHERE id = ?').bind(user.id).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al eliminar QR' }, 500);
  }
});

/**
 * POST /drivers/skip-profile
 * El conductor decide completar el perfil después.
 * Guarda la fecha actual para calcular recordatorios.
 */
driverRoutes.post('/skip-profile', async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can access this endpoint' }, 403);
    }
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(
      'UPDATE drivers SET profile_skipped_at = ? WHERE id = ? AND profile_skipped_at IS NULL'
    ).bind(now, user.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to skip profile' }, 500);
  }
});

/**
 * POST /drivers/photos
 * Subir una foto de un lugar visitado (conductor autenticado)
 * Body: multipart/form-data con campo "photo" (archivo) y "caption" (texto opcional)
 */
driverRoutes.post('/photos', async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can upload photos' }, 403);
    }

    const formData = await c.req.formData();
    const file = formData.get('photo') as File | null;
    const caption = (formData.get('caption') as string | null) || null;

    if (!file) {
      return c.json({ error: 'No photo provided' }, 400);
    }

    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400);
    }

    // Limitar tamaño a 5MB
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'Image must be under 5MB' }, 400);
    }

    // Limitar a 20 fotos por conductor
    const count = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM driver_photos WHERE driver_id = ? AND is_visible = 1'
    ).bind(user.id).first<{ cnt: number }>();

    if ((count?.cnt ?? 0) >= 20) {
      return c.json({ error: 'Maximum 20 photos allowed. Delete one before uploading.' }, 400);
    }

    if (!c.env.IMAGES) {
      return c.json({ error: 'Image storage not configured' }, 500);
    }

    const id = crypto.randomUUID();
    const ext = file.type.split('/')[1] || 'jpg';
    const imageKey = `driver-photos/${user.id}/${id}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    await c.env.IMAGES.put(imageKey, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    await c.env.DB.prepare(
      'INSERT INTO driver_photos (id, driver_id, image_key, caption, created_at) VALUES (?, ?, ?, ?, unixepoch())'
    ).bind(id, user.id, imageKey, caption).run();

    return c.json({ success: true, id, image_key: imageKey });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to upload photo' }, 500);
  }
});

/**
 * GET /drivers/photos/my
 * Listar fotos propias del conductor autenticado
 */
driverRoutes.get('/photos/my', async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can access this endpoint' }, 403);
    }

    const photos = await c.env.DB.prepare(
      `SELECT id, image_key, caption, created_at
       FROM driver_photos
       WHERE driver_id = ? AND is_visible = 1
       ORDER BY created_at DESC`
    ).bind(user.id).all();

    return c.json({ photos: photos.results });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get photos' }, 500);
  }
});

/**
 * DELETE /drivers/photos/:id
 * Eliminar una foto propia del conductor
 */
driverRoutes.delete('/photos/:id', async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can delete photos' }, 403);
    }

    const photoId = c.req.param('id');
    const photo = await c.env.DB.prepare(
      'SELECT image_key FROM driver_photos WHERE id = ? AND driver_id = ?'
    ).bind(photoId, user.id).first<{ image_key: string }>();

    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }

    if (c.env.IMAGES) {
      await c.env.IMAGES.delete(photo.image_key);
    }

    await c.env.DB.prepare(
      'DELETE FROM driver_photos WHERE id = ? AND driver_id = ?'
    ).bind(photoId, user.id).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete photo' }, 500);
  }
});

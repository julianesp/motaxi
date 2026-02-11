import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';
import { PushNotificationService } from '../services/push-notifications';

export const tripRoutes = new Hono<{ Bindings: Env }>();

// Todas las rutas requieren autenticación
tripRoutes.use('*', authMiddleware);

/**
 * POST /trips
 * Crear nuevo viaje (pasajero)
 */
tripRoutes.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const {
      pickup_latitude,
      pickup_longitude,
      pickup_address,
      dropoff_latitude,
      dropoff_longitude,
      dropoff_address,
      fare,
      distance_km,
    } = body;

    if (user.role !== 'passenger') {
      return c.json({ error: 'Only passengers can create trips' }, 403);
    }

    const tripId = uuidv4();

    await c.env.DB.prepare(
      `INSERT INTO trips (
        id, passenger_id, pickup_latitude, pickup_longitude, pickup_address,
        dropoff_latitude, dropoff_longitude, dropoff_address, fare, distance_km, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`
    )
      .bind(
        tripId,
        user.id,
        pickup_latitude,
        pickup_longitude,
        pickup_address,
        dropoff_latitude,
        dropoff_longitude,
        dropoff_address,
        fare,
        distance_km
      )
      .run();

    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    // Buscar conductores disponibles cercanos (radio de 10km)
    // Usamos la fórmula de Haversine simplificada para calcular distancia
    const SEARCH_RADIUS_KM = 10;
    const nearbyDrivers = await c.env.DB.prepare(
      `SELECT u.id, u.full_name, u.push_token, d.current_latitude, d.current_longitude
       FROM users u
       JOIN drivers d ON u.id = d.id
       WHERE d.is_available = 1
         AND d.verification_status = 'approved'
         AND d.current_latitude IS NOT NULL
         AND d.current_longitude IS NOT NULL`
    ).all();

    // Calcular distancia y filtrar conductores dentro del radio
    const availableDrivers = (nearbyDrivers.results || []).filter((driver: any) => {
      const lat1 = pickup_latitude;
      const lon1 = pickup_longitude;
      const lat2 = driver.current_latitude;
      const lon2 = driver.current_longitude;

      // Fórmula de Haversine
      const R = 6371; // Radio de la Tierra en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return distance <= SEARCH_RADIUS_KM;
    });

    console.log(`Found ${availableDrivers.length} available drivers within ${SEARCH_RADIUS_KM}km`);

    // Enviar notificaciones a todos los conductores cercanos
    const notificationPromises = availableDrivers.map(async (driver: any) => {
      try {
        // Crear notificación en la base de datos
        await c.env.DB.prepare(
          `INSERT INTO notifications (id, user_id, title, message, type, data)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(
            uuidv4(),
            driver.id,
            '¡Nuevo viaje disponible!',
            `${pickup_address} - $${fare.toLocaleString()}`,
            'trip_request',
            JSON.stringify({ trip_id: tripId })
          )
          .run();

        // Enviar push notification
        if (driver.push_token) {
          await PushNotificationService.notifyDriverAboutTrip(
            driver.push_token,
            {
              tripId,
              pickupAddress: pickup_address || 'Ubicación del pasajero',
              fare,
            }
          );
        }
      } catch (notifError) {
        console.error(`Failed to notify driver ${driver.id}:`, notifError);
        // No fallar la creación del viaje si una notificación falla
      }
    });

    // Esperar a que se envíen todas las notificaciones (pero no bloquear si alguna falla)
    await Promise.allSettled(notificationPromises);

    return c.json({
      trip,
      driversNotified: availableDrivers.length,
    }, 201);
  } catch (error: any) {
    console.error('Create trip error:', error);
    return c.json({ error: error.message || 'Failed to create trip' }, 500);
  }
});

/**
 * GET /trips/active
 * Obtener viajes activos/solicitados (para conductores)
 */
tripRoutes.get('/active', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can view active trips' }, 403);
    }

    // Verificar que el conductor esté aprobado
    const driver = await c.env.DB.prepare(
      'SELECT verification_status FROM drivers WHERE id = ?'
    )
      .bind(user.id)
      .first();

    if (!driver || driver.verification_status !== 'approved') {
      return c.json({
        trips: [],
        message: 'Your account must be verified to see trip requests'
      });
    }

    const trips = await c.env.DB.prepare(
      'SELECT * FROM trips WHERE status = ? ORDER BY requested_at ASC'
    )
      .bind('requested')
      .all();

    return c.json({ trips: trips.results || [] });
  } catch (error: any) {
    console.error('Get active trips error:', error);
    return c.json({ error: error.message || 'Failed to get active trips' }, 500);
  }
});

/**
 * GET /trips/current
 * Obtener viaje actual del pasajero (requested, accepted, in_progress)
 */
tripRoutes.get('/current', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'passenger') {
      return c.json({ error: 'Only passengers can view current trip' }, 403);
    }

    const trip = await c.env.DB.prepare(
      `SELECT t.*,
              u.full_name as driver_name,
              u.phone as driver_phone,
              d.vehicle_model,
              d.vehicle_color,
              d.vehicle_plate,
              d.current_latitude as driver_latitude,
              d.current_longitude as driver_longitude,
              d.rating as driver_rating
       FROM trips t
       LEFT JOIN users u ON t.driver_id = u.id
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.passenger_id = ?
         AND t.status IN ('requested', 'accepted', 'in_progress')
       ORDER BY t.created_at DESC
       LIMIT 1`
    )
      .bind(user.id)
      .first();

    return c.json({ trip });
  } catch (error: any) {
    console.error('Get current trip error:', error);
    return c.json({ error: error.message || 'Failed to get current trip' }, 500);
  }
});

/**
 * GET /trips/history
 * Obtener historial de viajes del usuario
 */
tripRoutes.get('/history', async (c) => {
  try {
    const user = c.get('user');
    const column = user.role === 'passenger' ? 'passenger_id' : 'driver_id';

    const trips = await c.env.DB.prepare(
      `SELECT * FROM trips WHERE ${column} = ? ORDER BY created_at DESC LIMIT 50`
    )
      .bind(user.id)
      .all();

    return c.json({ trips: trips.results || [] });
  } catch (error: any) {
    console.error('Get trip history error:', error);
    return c.json({ error: error.message || 'Failed to get trip history' }, 500);
  }
});

/**
 * PUT /trips/:id/accept
 * Aceptar viaje (conductor)
 */
tripRoutes.put('/:id/accept', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('id');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can accept trips' }, 403);
    }

    // Verificar que el viaje existe y está disponible
    const trip = await c.env.DB.prepare(
      'SELECT * FROM trips WHERE id = ? AND status = ?'
    )
      .bind(tripId, 'requested')
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found or already accepted' }, 404);
    }

    // Actualizar viaje
    await c.env.DB.prepare(
      'UPDATE trips SET driver_id = ?, status = ?, accepted_at = ? WHERE id = ?'
    )
      .bind(user.id, 'accepted', Math.floor(Date.now() / 1000), tripId)
      .run();

    // Obtener información del conductor y pasajero para las notificaciones
    const driver = await c.env.DB.prepare(
      `SELECT u.full_name, u.push_token, d.vehicle_model, d.vehicle_color, d.vehicle_plate
       FROM users u
       JOIN drivers d ON u.id = d.id
       WHERE u.id = ?`
    )
      .bind(user.id)
      .first();

    const passenger = await c.env.DB.prepare(
      'SELECT push_token FROM users WHERE id = ?'
    )
      .bind(trip.passenger_id)
      .first();

    // Crear notificación en la base de datos
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        uuidv4(),
        trip.passenger_id,
        'Conductor asignado',
        'Tu conductor está en camino',
        'trip_accepted',
        JSON.stringify({ trip_id: tripId })
      )
      .run();

    // Enviar push notification al pasajero
    if (passenger && passenger.push_token && driver) {
      const vehicleInfo = `${driver.vehicle_model} ${driver.vehicle_color} - ${driver.vehicle_plate}`;
      await PushNotificationService.notifyPassengerTripAccepted(
        passenger.push_token as string,
        {
          driverName: driver.full_name as string,
          vehicleInfo,
        }
      );
    }

    const updatedTrip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    return c.json({ trip: updatedTrip });
  } catch (error: any) {
    console.error('Accept trip error:', error);
    return c.json({ error: error.message || 'Failed to accept trip' }, 500);
  }
});

/**
 * PUT /trips/:id/status
 * Actualizar estado del viaje
 */
tripRoutes.put('/:id/status', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('id');
    const body = await c.req.json();
    const { status } = body;

    const validStatuses = [
      'driver_arriving',
      'in_progress',
      'completed',
      'cancelled',
    ];

    if (!validStatuses.includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Verificar que el viaje existe
    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found' }, 404);
    }

    // Verificar permisos
    if (
      user.role === 'driver' &&
      trip.driver_id !== user.id
    ) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (
      user.role === 'passenger' &&
      trip.passenger_id !== user.id
    ) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Determinar columna de timestamp
    let timestampColumn = null;
    if (status === 'in_progress') timestampColumn = 'started_at';
    if (status === 'completed') timestampColumn = 'completed_at';
    if (status === 'cancelled') timestampColumn = 'cancelled_at';

    // Actualizar viaje
    const timestamp = Math.floor(Date.now() / 1000);
    if (timestampColumn) {
      await c.env.DB.prepare(
        `UPDATE trips SET status = ?, ${timestampColumn} = ? WHERE id = ?`
      )
        .bind(status, timestamp, tripId)
        .run();
    } else {
      await c.env.DB.prepare('UPDATE trips SET status = ? WHERE id = ?')
        .bind(status, tripId)
        .run();
    }

    const updatedTrip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    return c.json({ trip: updatedTrip });
  } catch (error: any) {
    console.error('Update trip status error:', error);
    return c.json({ error: error.message || 'Failed to update trip status' }, 500);
  }
});

/**
 * GET /trips/:id
 * Obtener detalles de un viaje
 */
tripRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('id');

    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found' }, 404);
    }

    // Verificar permisos
    if (
      trip.passenger_id !== user.id &&
      trip.driver_id !== user.id
    ) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ trip });
  } catch (error: any) {
    console.error('Get trip error:', error);
    return c.json({ error: error.message || 'Failed to get trip' }, 500);
  }
});

/**
 * PUT /trips/:id/rate
 * Calificar un viaje (pasajero califica conductor o viceversa)
 */
tripRoutes.put('/:id/rate', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('id');
    const body = await c.req.json();
    const { rating, comment } = body;

    // Validar rating
    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: 'Rating must be between 1 and 5' }, 400);
    }

    // Obtener viaje
    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found' }, 404);
    }

    // Verificar que el viaje esté completado
    if (trip.status !== 'completed') {
      return c.json({ error: 'Can only rate completed trips' }, 400);
    }

    // Determinar quién está calificando
    let updateQuery = '';
    let ratedUserId = '';

    if (user.id === trip.passenger_id) {
      // Pasajero califica al conductor
      if (trip.driver_rating) {
        return c.json({ error: 'Trip already rated by passenger' }, 400);
      }
      updateQuery = 'UPDATE trips SET driver_rating = ?, driver_comment = ? WHERE id = ?';
      ratedUserId = trip.driver_id as string;
    } else if (user.id === trip.driver_id) {
      // Conductor califica al pasajero
      if (trip.passenger_rating) {
        return c.json({ error: 'Trip already rated by driver' }, 400);
      }
      updateQuery = 'UPDATE trips SET passenger_rating = ?, passenger_comment = ? WHERE id = ?';
      ratedUserId = trip.passenger_id as string;
    } else {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Actualizar rating del viaje
    await c.env.DB.prepare(updateQuery)
      .bind(rating, comment || null, tripId)
      .run();

    // Actualizar rating promedio del usuario calificado
    if (user.id === trip.passenger_id) {
      // Actualizar rating del conductor
      const avgRating = await c.env.DB.prepare(
        'SELECT AVG(driver_rating) as avg FROM trips WHERE driver_id = ? AND driver_rating IS NOT NULL'
      )
        .bind(ratedUserId)
        .first();

      await c.env.DB.prepare('UPDATE drivers SET rating = ? WHERE id = ?')
        .bind(avgRating?.avg || 5.0, ratedUserId)
        .run();
    } else {
      // Actualizar rating del pasajero
      const avgRating = await c.env.DB.prepare(
        'SELECT AVG(passenger_rating) as avg FROM trips WHERE passenger_id = ? AND passenger_rating IS NOT NULL'
      )
        .bind(ratedUserId)
        .first();

      await c.env.DB.prepare('UPDATE passengers SET rating = ? WHERE id = ?')
        .bind(avgRating?.avg || 5.0, ratedUserId)
        .run();
    }

    const updatedTrip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    return c.json({ trip: updatedTrip });
  } catch (error: any) {
    console.error('Rate trip error:', error);
    return c.json({ error: error.message || 'Failed to rate trip' }, 500);
  }
});

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
      distance_km,
      estimated_fare, // Precio estimado calculado por el frontend
    } = body;

    if (user.role !== 'passenger') {
      return c.json({ error: 'Only passengers can create trips' }, 403);
    }

    const tripId = uuidv4();

    // Guardar el fare estimado. Cuando el conductor acepta, se recalculará con sus tarifas.
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
        estimated_fare || 0, // Usar estimated_fare o 0 si no viene
        distance_km
      )
      .run();

    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    // NUEVO FLUJO: Los conductores verán la solicitud en su tablero
    // y ellos decidirán si aceptarla o no.
    // Ya NO se envían notificaciones automáticas.

    return c.json({
      success: true,
      trip,
      message: 'Viaje creado. Los conductores podrán ver tu solicitud en su tablero.',
    }, 201);
  } catch (error: any) {
    console.error('Create trip error:', error);
    return c.json({ error: error.message || 'Failed to create trip' }, 500);
  }
});

/**
 * GET /trips/active
 * Obtener viajes activos/solicitados (TABLERO para conductores)
 * Muestra todas las solicitudes disponibles que pueden aceptar
 */
tripRoutes.get('/active', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can view active trips' }, 403);
    }

    // Obtener información del conductor (incluyendo ubicación)
    const driver = await c.env.DB.prepare(
      'SELECT * FROM drivers WHERE id = ?'
    )
      .bind(user.id)
      .first();

    if (!driver || driver.verification_status !== 'approved') {
      return c.json({
        trips: [],
        message: 'Tu cuenta debe estar verificada para ver solicitudes de viajes'
      });
    }

    // Obtener solicitudes disponibles (estado 'requested' sin conductor asignado)
    // Incluye ubicación y género del pasajero para mostrar en el mapa del conductor
    const availableTrips = await c.env.DB.prepare(
      `SELECT
        t.*,
        u.full_name as passenger_name,
        u.phone as passenger_phone,
        u.gender as passenger_gender
       FROM trips t
       JOIN users u ON t.passenger_id = u.id
       WHERE t.status = 'requested'
         AND t.driver_id IS NULL
       ORDER BY t.created_at DESC
       LIMIT 50`
    ).all();

    // Calcular distancia del conductor a cada punto de recogida
    const tripsWithDistance = (availableTrips.results || []).map((trip: any) => {
      let distance = null;

      if (driver.current_latitude && driver.current_longitude &&
          trip.pickup_latitude && trip.pickup_longitude) {
        // Fórmula de Haversine para calcular distancia
        const R = 6371; // Radio de la Tierra en km
        const dLat = (trip.pickup_latitude - driver.current_latitude) * Math.PI / 180;
        const dLon = (trip.pickup_longitude - driver.current_longitude) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(driver.current_latitude * Math.PI / 180) *
          Math.cos(trip.pickup_latitude * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = R * c; // distancia en km
      }

      return {
        ...trip,
        distance_to_pickup: distance ? parseFloat(distance.toFixed(2)) : null,
      };
    });

    // Ordenar por distancia (los más cercanos primero)
    tripsWithDistance.sort((a: any, b: any) => {
      if (a.distance_to_pickup === null) return 1;
      if (b.distance_to_pickup === null) return -1;
      return a.distance_to_pickup - b.distance_to_pickup;
    });

    return c.json({
      success: true,
      trips: tripsWithDistance,
      count: tripsWithDistance.length,
    });
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
 * GET /trips/current-driver
 * Obtener viaje actual del conductor (accepted, in_progress)
 */
tripRoutes.get('/current-driver', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can view current trip' }, 403);
    }

    const trip = await c.env.DB.prepare(
      `SELECT t.*,
              u.full_name as passenger_name,
              u.phone as passenger_phone,
              u.gender as passenger_gender,
              u.profile_image as passenger_image,
              p.emergency_contact_name,
              p.emergency_contact_phone
       FROM trips t
       JOIN users u ON t.passenger_id = u.id
       LEFT JOIN passengers p ON t.passenger_id = p.id
       WHERE t.driver_id = ?
         AND t.status IN ('accepted', 'in_progress')
       ORDER BY t.created_at DESC
       LIMIT 1`
    )
      .bind(user.id)
      .first();

    return c.json({ trip });
  } catch (error: any) {
    console.error('Get current driver trip error:', error);
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

    // Obtener precios y ubicación actual del conductor para calcular la tarifa
    const driverData = await c.env.DB.prepare(
      `SELECT u.full_name, u.push_token,
              d.vehicle_model, d.vehicle_color, d.vehicle_plate,
              d.base_fare, d.intercity_fare, d.per_km_fare,
              d.current_latitude, d.current_longitude
       FROM users u
       JOIN drivers d ON u.id = d.id
       WHERE u.id = ?`
    )
      .bind(user.id)
      .first() as any;

    // Calcular tarifa según precios del conductor
    // Si el conductor está a más de 5 km del punto de recogida → tarifa intermunicipal
    let calculatedFare = 0;
    const baseFare = driverData?.base_fare ?? 5000;
    const intercityFare = driverData?.intercity_fare ?? 10000;
    const perKmFare = driverData?.per_km_fare ?? 2000;
    const distanceKm = (trip as any).distance_km ?? 0;

    let selectedBaseFare = baseFare;
    if (
      driverData?.current_latitude &&
      driverData?.current_longitude &&
      (trip as any).pickup_latitude &&
      (trip as any).pickup_longitude
    ) {
      const dLat = (((trip as any).pickup_latitude - driverData.current_latitude) * Math.PI) / 180;
      const dLng = (((trip as any).pickup_longitude - driverData.current_longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((driverData.current_latitude * Math.PI) / 180) *
          Math.cos(((trip as any).pickup_latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const driverToPickupKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      // Si el conductor está a más de 5 km del punto de recogida → intermunicipal
      if (driverToPickupKm > 5) {
        selectedBaseFare = intercityFare;
      }
    }

    calculatedFare = Math.round(selectedBaseFare + distanceKm * perKmFare);

    // Actualizar viaje con el conductor asignado y la tarifa calculada
    await c.env.DB.prepare(
      'UPDATE trips SET driver_id = ?, status = ?, accepted_at = ?, fare = ? WHERE id = ?'
    )
      .bind(user.id, 'accepted', Math.floor(Date.now() / 1000), calculatedFare, tripId)
      .run();

    // alias para mantener el resto del código igual
    const driver = driverData;

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
 * PUT /trips/:id/offer-price
 * Conductor envía una oferta de precio personalizada
 */
tripRoutes.put('/:id/offer-price', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('id');
    const body = await c.req.json();
    const { custom_price } = body;

    // Solo conductores pueden enviar ofertas
    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can send price offers' }, 403);
    }

    // Validar precio
    if (!custom_price || custom_price <= 0) {
      return c.json({ error: 'Invalid price' }, 400);
    }

    if (custom_price < 1000) {
      return c.json({ error: 'Minimum price is $1,000' }, 400);
    }

    // Verificar que el viaje existe y está en estado 'requested'
    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found' }, 404);
    }

    if (trip.status !== 'requested') {
      return c.json({ error: 'Trip is no longer available for offers' }, 400);
    }

    // Verificar que el conductor tiene perfil completo
    const driver = await c.env.DB.prepare(
      'SELECT profile_completed FROM drivers WHERE id = ?'
    )
      .bind(user.id)
      .first() as any;

    if (!driver || !driver.profile_completed) {
      return c.json({ error: 'Please complete your driver profile first' }, 400);
    }

    // Insertar o actualizar la oferta del conductor
    const offerId = uuidv4();
    const currentTimestamp = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(
      `INSERT INTO driver_price_offers (id, trip_id, driver_id, offered_price, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(trip_id, driver_id)
       DO UPDATE SET offered_price = ?, created_at = ?`
    )
      .bind(offerId, tripId, user.id, custom_price, currentTimestamp, custom_price, currentTimestamp)
      .run();

    // Obtener información del conductor para notificar al pasajero
    const driverInfo = await c.env.DB.prepare(
      `SELECT u.full_name, u.push_token,
              d.vehicle_model, d.vehicle_color, d.vehicle_plate
       FROM users u
       JOIN drivers d ON u.id = d.id
       WHERE u.id = ?`
    )
      .bind(user.id)
      .first() as any;

    // Crear notificación para el pasajero
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        uuidv4(),
        trip.passenger_id,
        'Nueva oferta de conductor',
        `${driverInfo?.full_name || 'Un conductor'} te ofrece el viaje por $${custom_price.toLocaleString()}`,
        'general',
        JSON.stringify({ trip_id: tripId, driver_id: user.id, offered_price: custom_price, notification_type: 'price_offer' })
      )
      .run();

    // Enviar push notification al pasajero si tiene token
    const passenger = await c.env.DB.prepare('SELECT push_token FROM users WHERE id = ?')
      .bind(trip.passenger_id)
      .first() as any;

    if (passenger?.push_token && driverInfo) {
      await PushNotificationService.notifyPassengerNewOffer(
        passenger.push_token,
        {
          driverName: driverInfo.full_name,
          offeredPrice: custom_price,
          tripId: tripId,
        }
      );
    }

    return c.json({
      message: 'Offer sent successfully',
      offer: {
        id: offerId,
        trip_id: tripId,
        driver_id: user.id,
        offered_price: custom_price,
      }
    });
  } catch (error: any) {
    console.error('Offer price error:', error);
    return c.json({ error: error.message || 'Failed to send offer' }, 500);
  }
});

/**
 * PUT /trips/:id/accept-offer
 * Pasajero acepta una oferta específica de un conductor
 */
tripRoutes.put('/:id/accept-offer', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('id');
    const body = await c.req.json();
    const { driver_id } = body;

    // Solo pasajeros pueden aceptar ofertas
    if (user.role !== 'passenger') {
      return c.json({ error: 'Only passengers can accept offers' }, 403);
    }

    if (!driver_id) {
      return c.json({ error: 'driver_id is required' }, 400);
    }

    // Verificar que el viaje existe y pertenece al pasajero
    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found' }, 404);
    }

    if (trip.passenger_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (trip.status !== 'requested') {
      return c.json({ error: 'Trip is no longer available' }, 400);
    }

    // Obtener la oferta del conductor
    const offer = await c.env.DB.prepare(
      'SELECT * FROM driver_price_offers WHERE trip_id = ? AND driver_id = ?'
    )
      .bind(tripId, driver_id)
      .first() as any;

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Obtener información del conductor
    const driverInfo = await c.env.DB.prepare(
      `SELECT u.full_name, u.push_token,
              d.vehicle_model, d.vehicle_color, d.vehicle_plate
       FROM users u
       JOIN drivers d ON u.id = d.id
       WHERE u.id = ?`
    )
      .bind(driver_id)
      .first() as any;

    // Actualizar viaje con el conductor asignado y la tarifa de la oferta
    await c.env.DB.prepare(
      'UPDATE trips SET driver_id = ?, status = ?, accepted_at = ?, fare = ? WHERE id = ?'
    )
      .bind(driver_id, 'accepted', Math.floor(Date.now() / 1000), offer.offered_price, tripId)
      .run();

    // Crear notificación para el conductor
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        uuidv4(),
        driver_id,
        '¡Tu oferta fue aceptada!',
        `${user.full_name} aceptó tu oferta de $${offer.offered_price.toLocaleString()}. Dirígete al punto de recogida.`,
        'trip_accepted',
        JSON.stringify({ trip_id: tripId, accepted_price: offer.offered_price })
      )
      .run();

    // Enviar push notification al conductor
    if (driverInfo?.push_token) {
      const vehicleInfo = `${driverInfo.vehicle_model} ${driverInfo.vehicle_color} - ${driverInfo.vehicle_plate}`;
      await PushNotificationService.notifyPassengerTripAccepted(
        driverInfo.push_token,
        {
          driverName: user.full_name,
          vehicleInfo: `Oferta aceptada: $${offer.offered_price.toLocaleString()}`,
        }
      );
    }

    const updatedTrip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    return c.json({
      message: 'Offer accepted successfully',
      trip: updatedTrip
    });
  } catch (error: any) {
    console.error('Accept offer error:', error);
    return c.json({ error: error.message || 'Failed to accept offer' }, 500);
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

    // El pasajero solo puede cancelar si el viaje aún no ha sido aceptado por un conductor
    if (user.role === 'passenger' && status === 'cancelled' && trip.status !== 'requested') {
      return c.json({
        error: 'No puedes cancelar el viaje porque el conductor ya lo aceptó. Comunícate directamente con él.',
        alreadyAccepted: true,
      }, 400);
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

    // Si el viaje tiene conductor asignado, obtener información del conductor
    let tripWithDetails: any = { ...trip };

    if (trip.driver_id) {
      // Obtener información del conductor (nombre, teléfono, rating, ubicación)
      const driver = await c.env.DB.prepare(
        `SELECT u.full_name, u.phone, d.rating, d.vehicle_model, d.vehicle_color, d.vehicle_plate,
                d.current_latitude, d.current_longitude
         FROM users u
         LEFT JOIN drivers d ON d.id = u.id
         WHERE u.id = ?`
      )
        .bind(trip.driver_id)
        .first();

      if (driver) {
        tripWithDetails.driver_name = driver.full_name;
        tripWithDetails.driver_phone = driver.phone;
        tripWithDetails.driver_rating = driver.rating;
        tripWithDetails.vehicle_model = driver.vehicle_model;
        tripWithDetails.vehicle_color = driver.vehicle_color;
        tripWithDetails.vehicle_plate = driver.vehicle_plate;
        // AGREGAR UBICACIÓN EN TIEMPO REAL DEL CONDUCTOR
        tripWithDetails.driver_latitude = driver.current_latitude;
        tripWithDetails.driver_longitude = driver.current_longitude;
      }
    }

    return c.json({ trip: tripWithDetails });
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
        .bind(avgRating?.avg || null, ratedUserId)
        .run();

      // Crear notificación para el conductor
      const stars = '⭐'.repeat(rating);
      await c.env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type, data)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          uuidv4(),
          ratedUserId,
          'Nueva calificación recibida',
          `${user.full_name} te calificó con ${rating} estrellas ${stars}${comment ? `: "${comment}"` : ''}`,
          'general',
          JSON.stringify({ trip_id: tripId, rating, comment, notification_type: 'rating_received' })
        )
        .run();

      // Obtener push token del conductor
      const driver = await c.env.DB.prepare('SELECT push_token FROM users WHERE id = ?')
        .bind(ratedUserId)
        .first() as any;

      // Enviar push notification al conductor
      if (driver?.push_token) {
        await PushNotificationService.sendPushNotification({
          to: driver.push_token,
          title: 'Nueva calificación',
          body: `${user.full_name} te calificó con ${rating} estrellas ${stars}`,
          data: {
            type: 'rating_received',
            tripId: tripId,
            rating: rating,
          },
          sound: 'default',
          priority: 'high',
        });
      }
    } else {
      // Actualizar rating del pasajero
      const avgRating = await c.env.DB.prepare(
        'SELECT AVG(passenger_rating) as avg FROM trips WHERE passenger_id = ? AND passenger_rating IS NOT NULL'
      )
        .bind(ratedUserId)
        .first();

      await c.env.DB.prepare('UPDATE passengers SET rating = ? WHERE id = ?')
        .bind(avgRating?.avg || null, ratedUserId)
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

/**
 * GET /trips/:id/offers
 * Obtener todas las ofertas de precio de conductores para un viaje
 */
tripRoutes.get('/:id/offers', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('id');

    // Verificar que el viaje existe
    const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found' }, 404);
    }

    // Solo el pasajero del viaje puede ver las ofertas
    if (user.role === 'passenger' && trip.passenger_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Obtener todas las ofertas con información del conductor
    const offers = await c.env.DB.prepare(
      `SELECT
        dpo.id,
        dpo.driver_id,
        dpo.offered_price,
        dpo.created_at,
        u.full_name as driver_name,
        d.vehicle_model,
        d.vehicle_color,
        d.vehicle_plate,
        d.rating as driver_rating,
        d.current_latitude,
        d.current_longitude
       FROM driver_price_offers dpo
       JOIN users u ON dpo.driver_id = u.id
       JOIN drivers d ON dpo.driver_id = d.id
       WHERE dpo.trip_id = ?
       ORDER BY dpo.created_at DESC`
    )
      .bind(tripId)
      .all();

    return c.json({ offers: offers.results || [] });
  } catch (error: any) {
    console.error('Get offers error:', error);
    return c.json({ error: error.message || 'Failed to get offers' }, 500);
  }
});

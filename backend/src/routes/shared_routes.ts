import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';
import { v4 as uuidv4 } from 'uuid';

export const sharedRouteRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /shared-routes
 * Listar rutas activas (para pasajeros)
 */
sharedRouteRoutes.get('/', async (c) => {
  try {
    const destination = c.req.query('destination');

    // Intentar obtener usuario autenticado (opcional, no bloquea si no hay token)
    let passengerId: string | null = null;
    try {
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const { AuthUtils } = await import('../utils/auth');
        const session = await AuthUtils.verifyToken(c.env.DB, authHeader.slice(7));
        if (session?.id) passengerId = session.id;
      }
    } catch {}

    let query = `
      SELECT sr.id, sr.origin, sr.destination,
             sr.total_seats, sr.available_seats, sr.fare_per_seat, sr.intermediate_fares,
             sr.status, sr.created_at,
             u.full_name, u.phone,
             d.vehicle_model, d.vehicle_color, d.vehicle_plate,
             d.vehicle_types, d.rating, d.total_trips, d.whatsapp, d.nequi_qr_key
      FROM shared_routes sr
      JOIN users u ON sr.driver_id = u.id
      JOIN drivers d ON sr.driver_id = d.id
      WHERE sr.status = 'active' AND sr.available_seats > 0
    `;

    if (destination) query += ` AND sr.destination = ?`;
    query += ` ORDER BY sr.departure_time ASC`;

    const result = destination
      ? await c.env.DB.prepare(query).bind(destination).all()
      : await c.env.DB.prepare(query).all();

    let routes = result.results || [];

    // Anotar qué ruta tiene reservada el pasajero actual
    if (passengerId && routes.length > 0) {
      const requests = await c.env.DB.prepare(
        `SELECT rr.id as request_id, rr.route_id, rr.destination as request_destination, rr.status as request_status
         FROM route_requests rr
         JOIN users u ON u.phone = rr.passenger_phone
         WHERE u.id = ? AND rr.status IN ('pending', 'confirmed', 'on_the_way')`
      ).bind(passengerId).all();

      const byRoute: Record<string, { request_id: string; request_destination: string; request_status: string }> = {};
      for (const r of (requests.results || []) as any[]) {
        byRoute[r.route_id] = { request_id: r.request_id, request_destination: r.request_destination, request_status: r.request_status };
      }

      routes = (routes as any[]).map((r) => ({
        ...r,
        ...(byRoute[r.id] || { request_id: null, request_destination: null, request_status: null }),
      }));
    }

    return c.json({ routes });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get routes' }, 500);
  }
});

/**
 * POST /shared-routes
 * Conductor publica una nueva ruta con cupos
 */
sharedRouteRoutes.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Solo los conductores pueden publicar rutas' }, 403);
    }

    const body = await c.req.json();
    const { origin, destination, total_seats, fare_per_seat, intermediate_fares } = body;

    if (!origin || !destination || !total_seats) {
      return c.json({ error: 'Faltan campos requeridos' }, 400);
    }

    if (origin === destination) {
      return c.json({ error: 'El origen y destino no pueden ser iguales' }, 400);
    }

    if (total_seats < 1 || total_seats > 8) {
      return c.json({ error: 'El número de puestos debe ser entre 1 y 8' }, 400);
    }

    // Cancelar rutas activas anteriores del mismo conductor
    await c.env.DB.prepare(
      `UPDATE shared_routes SET status = 'cancelled', updated_at = unixepoch()
       WHERE driver_id = ? AND status = 'active'`
    ).bind(user.id).run();

    const id = uuidv4();
    const faresJson = intermediate_fares ? JSON.stringify(intermediate_fares) : null;
    await c.env.DB.prepare(
      `INSERT INTO shared_routes (id, driver_id, origin, destination, departure_time, total_seats, available_seats, fare_per_seat, intermediate_fares)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, origin, destination, '', total_seats, total_seats, fare_per_seat || 0, faresJson).run();

    // Guardar precios como predeterminados para futuras rutas
    if (faresJson || fare_per_seat) {
      await c.env.DB.prepare(
        `UPDATE drivers SET default_route_fares = ? WHERE id = ?`
      ).bind(faresJson, user.id).run();
    }

    return c.json({ success: true, id });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create route' }, 500);
  }
});

/**
 * GET /shared-routes/my
 * Ruta activa del conductor autenticado
 */
sharedRouteRoutes.get('/my', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    const route = await c.env.DB.prepare(
      `SELECT * FROM shared_routes WHERE driver_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id).first();

    // Incluir precios predeterminados guardados del conductor
    const driverFares = await c.env.DB.prepare(
      `SELECT default_route_fares FROM drivers WHERE id = ?`
    ).bind(user.id).first<{ default_route_fares: string | null }>();

    return c.json({
      route: route || null,
      default_route_fares: driverFares?.default_route_fares || null,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get route' }, 500);
  }
});

/**
 * POST /shared-routes/:id/request
 * Pasajero pide un puesto en una ruta
 */
sharedRouteRoutes.post('/:id/request', authMiddleware, async (c) => {
  try {
    const routeId = c.req.param('id');
    const user = c.get('user');
    const { destination, phone, pickup_latitude, pickup_longitude, pickup_address } = await c.req.json();

    if (!destination || !phone) {
      return c.json({ error: 'Faltan destino o teléfono' }, 400);
    }

    const route = await c.env.DB.prepare(
      `SELECT id, available_seats, driver_id FROM shared_routes WHERE id = ? AND status = 'active'`
    ).bind(routeId).first<{ id: string; available_seats: number; driver_id: string }>();

    if (!route) return c.json({ error: 'Ruta no encontrada o ya no activa' }, 404);
    if (route.available_seats <= 0) return c.json({ error: 'No quedan puestos disponibles' }, 409);
    if (route.driver_id === user.id) return c.json({ error: 'No puedes pedir un puesto en tu propia ruta' }, 403);

    // Verificar que no haya pedido ya un puesto
    const existing = await c.env.DB.prepare(
      `SELECT id FROM route_requests WHERE route_id = ? AND passenger_phone = ? AND status = 'pending'`
    ).bind(routeId, phone).first();
    if (existing) return c.json({ error: 'Ya tienes un puesto reservado en esta ruta' }, 409);

    const id = uuidv4();
    await c.env.DB.prepare(
      `INSERT INTO route_requests (id, route_id, passenger_name, passenger_phone, destination, pickup_latitude, pickup_longitude, pickup_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, routeId, user.full_name, phone, destination, pickup_latitude || null, pickup_longitude || null, pickup_address || null).run();

    await c.env.DB.prepare(
      `UPDATE shared_routes SET available_seats = available_seats - 1, updated_at = unixepoch() WHERE id = ?`
    ).bind(routeId).run();

    return c.json({ success: true, id });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al reservar puesto' }, 500);
  }
});

/**
 * DELETE /shared-routes/:id/request/:requestId
 * Pasajero cancela su reserva en una ruta
 */
sharedRouteRoutes.delete('/:id/request/:requestId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const routeId = c.req.param('id');
    const requestId = c.req.param('requestId');

    const request = await c.env.DB.prepare(
      `SELECT id, route_id FROM route_requests WHERE id = ? AND passenger_phone = (SELECT phone FROM users WHERE id = ?) AND status = 'pending'`
    ).bind(requestId, user.id).first<{ id: string; route_id: string }>();

    if (!request || request.route_id !== routeId) {
      return c.json({ error: 'Reserva no encontrada' }, 404);
    }

    await c.env.DB.prepare(
      `UPDATE route_requests SET status = 'cancelled' WHERE id = ?`
    ).bind(requestId).run();

    await c.env.DB.prepare(
      `UPDATE shared_routes SET available_seats = available_seats + 1, updated_at = unixepoch() WHERE id = ?`
    ).bind(routeId).run();

    await c.env.DB.prepare(
      `UPDATE users SET route_cancel_count = COALESCE(route_cancel_count, 0) + 1 WHERE id = ?`
    ).bind(user.id).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al cancelar reserva' }, 500);
  }
});

/**
 * GET /shared-routes/:id/requests
 * Conductor ve los pasajeros que pidieron puesto en su ruta activa
 */
sharedRouteRoutes.get('/:id/requests', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const routeId = c.req.param('id');

    const route = await c.env.DB.prepare(
      `SELECT id FROM shared_routes WHERE id = ? AND driver_id = ?`
    ).bind(routeId, user.id).first();

    if (!route) return c.json({ error: 'Ruta no encontrada' }, 404);

    const result = await c.env.DB.prepare(
      `SELECT rr.id, rr.passenger_name, rr.passenger_phone, rr.destination, rr.status, rr.created_at,
              rr.pickup_latitude, rr.pickup_longitude, rr.pickup_address,
              u.passenger_rating, u.route_cancel_count,
              (SELECT id FROM route_ratings WHERE request_id = rr.id AND driver_id = ?) as already_rated
       FROM route_requests rr
       LEFT JOIN users u ON u.phone = rr.passenger_phone
       WHERE rr.route_id = ? AND rr.status IN ('pending', 'confirmed', 'on_the_way')
       ORDER BY rr.created_at ASC`
    ).bind(user.id, routeId).all();

    return c.json({ requests: result.results || [] });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al obtener solicitudes' }, 500);
  }
});

/**
 * POST /shared-routes/:id/request/:requestId/rate
 * Conductor califica al pasajero tras la ruta
 */
sharedRouteRoutes.post('/:id/request/:requestId/rate', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const routeId = c.req.param('id');
    const requestId = c.req.param('requestId');
    const { rating } = await c.req.json();

    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: 'La calificación debe ser entre 1 y 5' }, 400);
    }

    // Verificar que la ruta es del conductor
    const route = await c.env.DB.prepare(
      `SELECT id FROM shared_routes WHERE id = ? AND driver_id = ?`
    ).bind(routeId, user.id).first();
    if (!route) return c.json({ error: 'Ruta no encontrada' }, 404);

    // Verificar que el request existe
    const request = await c.env.DB.prepare(
      `SELECT id, passenger_phone FROM route_requests WHERE id = ? AND route_id = ?`
    ).bind(requestId, routeId).first<{ id: string; passenger_phone: string }>();
    if (!request) return c.json({ error: 'Pasajero no encontrado' }, 404);

    // Verificar que no haya calificado ya
    const existing = await c.env.DB.prepare(
      `SELECT id FROM route_ratings WHERE request_id = ? AND driver_id = ?`
    ).bind(requestId, user.id).first();
    if (existing) return c.json({ error: 'Ya calificaste a este pasajero' }, 409);

    // Guardar calificación
    const passenger = await c.env.DB.prepare(
      `SELECT id FROM users WHERE phone = ?`
    ).bind(request.passenger_phone).first<{ id: string }>();

    await c.env.DB.prepare(
      `INSERT INTO route_ratings (id, route_id, request_id, passenger_id, driver_id, rating)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(uuidv4(), routeId, requestId, passenger?.id || '', user.id, rating).run();

    // Actualizar rating promedio del pasajero en users
    if (passenger?.id) {
      await c.env.DB.prepare(
        `UPDATE users SET passenger_rating = (
           SELECT ROUND(AVG(rating), 1) FROM route_ratings WHERE passenger_id = ?
         ) WHERE id = ?`
      ).bind(passenger.id, passenger.id).run();
    }

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al calificar' }, 500);
  }
});

/**
 * PATCH /shared-routes/:id/request/:requestId/seat-status
 * Conductor actualiza el estado del puesto de un pasajero (confirmed | on_the_way)
 */
sharedRouteRoutes.patch('/:id/request/:requestId/seat-status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const routeId = c.req.param('id');
    const requestId = c.req.param('requestId');
    const { status } = await c.req.json();

    if (!['confirmed', 'on_the_way'].includes(status)) {
      return c.json({ error: 'Estado inválido. Usa confirmed o on_the_way' }, 400);
    }

    const route = await c.env.DB.prepare(
      `SELECT id FROM shared_routes WHERE id = ? AND driver_id = ?`
    ).bind(routeId, user.id).first();
    if (!route) return c.json({ error: 'Ruta no encontrada' }, 404);

    const request = await c.env.DB.prepare(
      `SELECT id, status as current_status FROM route_requests WHERE id = ? AND route_id = ?`
    ).bind(requestId, routeId).first<{ id: string; current_status: string }>();
    if (!request) return c.json({ error: 'Reserva no encontrada' }, 404);

    // Solo avanzar, nunca retroceder: pending→confirmed→on_the_way
    const order = ['pending', 'confirmed', 'on_the_way'];
    if (order.indexOf(status) <= order.indexOf(request.current_status)) {
      return c.json({ error: 'No se puede retroceder el estado' }, 409);
    }

    await c.env.DB.prepare(
      `UPDATE route_requests SET status = ?, updated_at = unixepoch() WHERE id = ?`
    ).bind(status, requestId).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al actualizar estado' }, 500);
  }
});

/**
 * PUT /shared-routes/:id/status
 * Conductor cambia el estado de su ruta (departed | cancelled)
 */
sharedRouteRoutes.put('/:id/status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { status } = await c.req.json();

    if (!['departed', 'cancelled'].includes(status)) {
      return c.json({ error: 'Estado inválido' }, 400);
    }

    const route = await c.env.DB.prepare(
      `SELECT id FROM shared_routes WHERE id = ? AND driver_id = ?`
    ).bind(id, user.id).first();

    if (!route) {
      return c.json({ error: 'Ruta no encontrada' }, 404);
    }

    await c.env.DB.prepare(
      `UPDATE shared_routes SET status = ?, updated_at = unixepoch() WHERE id = ?`
    ).bind(status, id).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update route' }, 500);
  }
});

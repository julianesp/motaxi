import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { nanoid } from 'nanoid';

const favorites = new Hono<{
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    userId: string;
    userRole: string;
  };
}>();

// Middleware de autenticación para todas las rutas
favorites.use('/*', authMiddleware);

// Obtener todas las ubicaciones favoritas del usuario
favorites.get('/', async (c) => {
  const userId = c.get('userId');

  try {
    const result = await c.env.DB.prepare(
      `SELECT * FROM favorite_locations
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
      .bind(userId)
      .all();

    return c.json({
      success: true,
      favorites: result.results,
    });
  } catch (error: any) {
    console.error('Error fetching favorites:', error);
    return c.json(
      {
        success: false,
        error: 'Error al obtener ubicaciones favoritas',
      },
      500
    );
  }
});

// Agregar una nueva ubicación favorita
favorites.post('/', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  // Solo los pasajeros pueden guardar favoritos
  if (userRole !== 'passenger') {
    return c.json(
      {
        success: false,
        error: 'Solo los pasajeros pueden guardar ubicaciones favoritas',
      },
      403
    );
  }

  try {
    const body = await c.req.json();
    const { name, address, latitude, longitude, place_id } = body;

    // Validar campos requeridos
    if (!name || !address || !latitude || !longitude) {
      return c.json(
        {
          success: false,
          error: 'Faltan campos requeridos: name, address, latitude, longitude',
        },
        400
      );
    }

    // Validar coordenadas
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return c.json(
        {
          success: false,
          error: 'Coordenadas inválidas',
        },
        400
      );
    }

    const favoriteId = nanoid();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      `INSERT INTO favorite_locations
       (id, user_id, name, address, latitude, longitude, place_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        favoriteId,
        userId,
        name,
        address,
        latitude,
        longitude,
        place_id || null,
        now,
        now
      )
      .run();

    const favorite = await c.env.DB.prepare(
      'SELECT * FROM favorite_locations WHERE id = ?'
    )
      .bind(favoriteId)
      .first();

    return c.json(
      {
        success: true,
        favorite,
        message: 'Ubicación agregada a favoritos',
      },
      201
    );
  } catch (error: any) {
    console.error('Error adding favorite:', error);
    return c.json(
      {
        success: false,
        error: 'Error al agregar ubicación a favoritos',
      },
      500
    );
  }
});

// Actualizar una ubicación favorita
favorites.put('/:id', async (c) => {
  const userId = c.get('userId');
  const favoriteId = c.params.id;

  try {
    // Verificar que el favorito pertenece al usuario
    const existing = await c.env.DB.prepare(
      'SELECT * FROM favorite_locations WHERE id = ? AND user_id = ?'
    )
      .bind(favoriteId, userId)
      .first();

    if (!existing) {
      return c.json(
        {
          success: false,
          error: 'Ubicación favorita no encontrada',
        },
        404
      );
    }

    const body = await c.req.json();
    const { name, address, latitude, longitude, place_id } = body;

    // Construir query dinámicamente con los campos que se proporcionan
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (latitude !== undefined) {
      if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
        return c.json({ success: false, error: 'Latitud inválida' }, 400);
      }
      updates.push('latitude = ?');
      values.push(latitude);
    }
    if (longitude !== undefined) {
      if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
        return c.json({ success: false, error: 'Longitud inválida' }, 400);
      }
      updates.push('longitude = ?');
      values.push(longitude);
    }
    if (place_id !== undefined) {
      updates.push('place_id = ?');
      values.push(place_id);
    }

    if (updates.length === 0) {
      return c.json(
        {
          success: false,
          error: 'No se proporcionaron campos para actualizar',
        },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    updates.push('updated_at = ?');
    values.push(now);

    values.push(favoriteId, userId);

    await c.env.DB.prepare(
      `UPDATE favorite_locations
       SET ${updates.join(', ')}
       WHERE id = ? AND user_id = ?`
    )
      .bind(...values)
      .run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM favorite_locations WHERE id = ?'
    )
      .bind(favoriteId)
      .first();

    return c.json({
      success: true,
      favorite: updated,
      message: 'Ubicación favorita actualizada',
    });
  } catch (error: any) {
    console.error('Error updating favorite:', error);
    return c.json(
      {
        success: false,
        error: 'Error al actualizar ubicación favorita',
      },
      500
    );
  }
});

// Eliminar una ubicación favorita
favorites.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const favoriteId = c.params.id;

  try {
    // Verificar que el favorito pertenece al usuario
    const existing = await c.env.DB.prepare(
      'SELECT * FROM favorite_locations WHERE id = ? AND user_id = ?'
    )
      .bind(favoriteId, userId)
      .first();

    if (!existing) {
      return c.json(
        {
          success: false,
          error: 'Ubicación favorita no encontrada',
        },
        404
      );
    }

    await c.env.DB.prepare('DELETE FROM favorite_locations WHERE id = ? AND user_id = ?')
      .bind(favoriteId, userId)
      .run();

    return c.json({
      success: true,
      message: 'Ubicación favorita eliminada',
    });
  } catch (error: any) {
    console.error('Error deleting favorite:', error);
    return c.json(
      {
        success: false,
        error: 'Error al eliminar ubicación favorita',
      },
      500
    );
  }
});

// ─── CONDUCTORES FAVORITOS ───────────────────────────────────────────────────

// Listar conductores favoritos con su estado actual (disponible/no disponible)
favorites.get('/drivers', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  if (userRole !== 'passenger') {
    return c.json({ success: false, error: 'Solo los pasajeros pueden tener conductores favoritos' }, 403);
  }

  try {
    const result = await c.env.DB.prepare(
      `SELECT
         fd.id,
         fd.driver_id,
         fd.nickname,
         fd.created_at,
         u.full_name,
         u.phone,
         d.vehicle_model,
         d.vehicle_color,
         d.vehicle_plate,
         d.rating,
         d.total_trips,
         d.is_available,
         d.current_latitude,
         d.current_longitude
       FROM favorite_drivers fd
       JOIN users u ON fd.driver_id = u.id
       JOIN drivers d ON fd.driver_id = d.id
       WHERE fd.passenger_id = ?
       ORDER BY fd.created_at DESC`
    )
      .bind(userId)
      .all();

    return c.json({ success: true, favoriteDrivers: result.results || [] });
  } catch (error: any) {
    console.error('Error fetching favorite drivers:', error);
    return c.json({ success: false, error: 'Error al obtener conductores favoritos' }, 500);
  }
});

// Agregar conductor a favoritos
favorites.post('/drivers', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  if (userRole !== 'passenger') {
    return c.json({ success: false, error: 'Solo los pasajeros pueden agregar conductores favoritos' }, 403);
  }

  try {
    const body = await c.req.json();
    const { driver_id, nickname } = body;

    if (!driver_id) {
      return c.json({ success: false, error: 'Se requiere el ID del conductor' }, 400);
    }

    // Verificar que el conductor existe
    const driver = await c.env.DB.prepare(
      `SELECT u.id, u.full_name FROM users u JOIN drivers d ON u.id = d.id WHERE u.id = ?`
    ).bind(driver_id).first();

    if (!driver) {
      return c.json({ success: false, error: 'Conductor no encontrado' }, 404);
    }

    const favoriteId = nanoid();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      `INSERT INTO favorite_drivers (id, passenger_id, driver_id, nickname, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(favoriteId, userId, driver_id, nickname || null, now).run();

    return c.json({
      success: true,
      message: `${(driver as any).full_name} agregado a tus conductores favoritos`,
    }, 201);
  } catch (error: any) {
    // Manejar duplicado (UNIQUE constraint)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json({ success: false, error: 'Este conductor ya está en tus favoritos' }, 409);
    }
    console.error('Error adding favorite driver:', error);
    return c.json({ success: false, error: 'Error al agregar conductor favorito' }, 500);
  }
});

// Eliminar conductor de favoritos
favorites.delete('/drivers/:driverId', async (c) => {
  const userId = c.get('userId');
  const driverId = c.req.param('driverId');

  try {
    const existing = await c.env.DB.prepare(
      `SELECT id FROM favorite_drivers WHERE passenger_id = ? AND driver_id = ?`
    ).bind(userId, driverId).first();

    if (!existing) {
      return c.json({ success: false, error: 'Conductor favorito no encontrado' }, 404);
    }

    await c.env.DB.prepare(
      `DELETE FROM favorite_drivers WHERE passenger_id = ? AND driver_id = ?`
    ).bind(userId, driverId).run();

    return c.json({ success: true, message: 'Conductor eliminado de favoritos' });
  } catch (error: any) {
    console.error('Error deleting favorite driver:', error);
    return c.json({ success: false, error: 'Error al eliminar conductor favorito' }, 500);
  }
});

export default favorites;

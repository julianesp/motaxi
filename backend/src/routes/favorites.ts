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

export default favorites;

import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { nanoid } from 'nanoid';

const namedPlaces = new Hono<{
  Bindings: { DB: D1Database };
  Variables: { userId: string; userRole: string };
}>();

namedPlaces.use('/*', authMiddleware);

/**
 * GET /named-places?q=texto
 * Buscar/listar lugares conocidos de la comunidad
 */
namedPlaces.get('/', async (c) => {
  const userId = c.get('userId');
  const q = c.req.query('q') || '';

  try {
    const searchTerm = `%${q}%`;
    const result = await c.env.DB.prepare(
      `SELECT np.id, np.name, np.description, np.address, np.latitude, np.longitude,
              np.created_by, np.created_at,
              u.full_name AS creator_name,
              CASE WHEN sn.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
       FROM named_places np
       LEFT JOIN users u ON np.created_by = u.id
       LEFT JOIN saved_named_places sn ON np.id = sn.place_id AND sn.user_id = ?
       WHERE np.name LIKE ? OR np.description LIKE ?
       ORDER BY np.name ASC
       LIMIT 20`
    )
      .bind(userId, searchTerm, searchTerm)
      .all();

    return c.json({ success: true, places: result.results || [] });
  } catch (error: any) {
    return c.json({ success: false, error: 'Error al buscar lugares' }, 500);
  }
});

/**
 * GET /named-places/saved
 * Lugares guardados personalmente por el usuario autenticado
 */
namedPlaces.get('/saved', async (c) => {
  const userId = c.get('userId');

  try {
    const result = await c.env.DB.prepare(
      `SELECT np.id, np.name, np.description, np.address, np.latitude, np.longitude,
              np.created_by, np.created_at, u.full_name AS creator_name, 1 AS is_saved
       FROM saved_named_places sn
       JOIN named_places np ON sn.place_id = np.id
       LEFT JOIN users u ON np.created_by = u.id
       WHERE sn.user_id = ?
       ORDER BY sn.created_at DESC`
    )
      .bind(userId)
      .all();

    return c.json({ success: true, places: result.results || [] });
  } catch (error: any) {
    return c.json({ success: false, error: 'Error al obtener lugares guardados' }, 500);
  }
});

/**
 * POST /named-places
 * Crear un nuevo lugar conocido (cualquier usuario)
 */
namedPlaces.post('/', async (c) => {
  const userId = c.get('userId');

  try {
    const body = await c.req.json();
    const { name, address, latitude, longitude, description } = body;

    if (!name || !address || latitude === undefined || longitude === undefined) {
      return c.json({ success: false, error: 'name, address, latitude y longitude son requeridos' }, 400);
    }

    const id = nanoid();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      `INSERT INTO named_places (id, name, description, address, latitude, longitude, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, name.trim(), description?.trim() || null, address, latitude, longitude, userId, now, now)
      .run();

    const place = await c.env.DB.prepare(
      `SELECT np.*, u.full_name AS creator_name
       FROM named_places np
       LEFT JOIN users u ON np.created_by = u.id
       WHERE np.id = ?`
    )
      .bind(id)
      .first();

    return c.json({ success: true, place }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: 'Error al crear el lugar' }, 500);
  }
});

/**
 * PUT /named-places/:id
 * Editar un lugar (solo el creador)
 */
namedPlaces.put('/:id', async (c) => {
  const userId = c.get('userId');
  const placeId = c.req.param('id');

  try {
    const existing = await c.env.DB.prepare(
      `SELECT * FROM named_places WHERE id = ?`
    )
      .bind(placeId)
      .first();

    if (!existing) return c.json({ success: false, error: 'Lugar no encontrado' }, 404);
    if ((existing as any).created_by !== userId) {
      return c.json({ success: false, error: 'No tienes permiso para editar este lugar' }, 403);
    }

    const body = await c.req.json();
    const { name, description, address, latitude, longitude } = body;
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      `UPDATE named_places
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           address = COALESCE(?, address),
           latitude = COALESCE(?, latitude),
           longitude = COALESCE(?, longitude),
           updated_at = ?
       WHERE id = ?`
    )
      .bind(
        name?.trim() || null,
        description?.trim() || null,
        address || null,
        latitude ?? null,
        longitude ?? null,
        now,
        placeId
      )
      .run();

    const updated = await c.env.DB.prepare(
      `SELECT np.*, u.full_name AS creator_name
       FROM named_places np
       LEFT JOIN users u ON np.created_by = u.id
       WHERE np.id = ?`
    )
      .bind(placeId)
      .first();

    return c.json({ success: true, place: updated });
  } catch (error: any) {
    return c.json({ success: false, error: 'Error al actualizar el lugar' }, 500);
  }
});

/**
 * DELETE /named-places/:id
 * Eliminar un lugar (solo el creador)
 */
namedPlaces.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const placeId = c.req.param('id');

  try {
    const existing = await c.env.DB.prepare(
      `SELECT created_by FROM named_places WHERE id = ?`
    )
      .bind(placeId)
      .first();

    if (!existing) return c.json({ success: false, error: 'Lugar no encontrado' }, 404);
    if ((existing as any).created_by !== userId) {
      return c.json({ success: false, error: 'No tienes permiso para eliminar este lugar' }, 403);
    }

    await c.env.DB.prepare(`DELETE FROM named_places WHERE id = ?`).bind(placeId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: 'Error al eliminar el lugar' }, 500);
  }
});

/**
 * POST /named-places/:id/save
 * Guardar un lugar en la lista personal del usuario
 */
namedPlaces.post('/:id/save', async (c) => {
  const userId = c.get('userId');
  const placeId = c.req.param('id');

  try {
    const exists = await c.env.DB.prepare(
      `SELECT id FROM named_places WHERE id = ?`
    )
      .bind(placeId)
      .first();

    if (!exists) return c.json({ success: false, error: 'Lugar no encontrado' }, 404);

    const id = nanoid();
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO saved_named_places (id, user_id, place_id) VALUES (?, ?, ?)`
    )
      .bind(id, userId, placeId)
      .run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: 'Error al guardar el lugar' }, 500);
  }
});

/**
 * DELETE /named-places/:id/save
 * Quitar un lugar de la lista personal del usuario
 */
namedPlaces.delete('/:id/save', async (c) => {
  const userId = c.get('userId');
  const placeId = c.req.param('id');

  try {
    await c.env.DB.prepare(
      `DELETE FROM saved_named_places WHERE user_id = ? AND place_id = ?`
    )
      .bind(userId, placeId)
      .run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: 'Error al quitar el lugar guardado' }, 500);
  }
});

export { namedPlaces as namedPlacesRoutes };

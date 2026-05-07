import { Hono } from 'hono';
import { Env } from '../index';
import { AuthUtils } from '../utils/auth';

export const municipalityRoutes = new Hono<{ Bindings: Env }>();

const ADMIN_EMAIL = 'admin@neurai.dev';

async function getUser(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return AuthUtils.verifyToken(c.env.DB, authHeader.substring(7));
}

async function requireAuth(c: any, next: any) {
  const user = await getUser(c);
  if (!user) return c.json({ error: 'No autorizado' }, 401);
  c.set('user', user);
  await next();
}

async function requireAdmin(c: any, next: any) {
  const user = await getUser(c);
  if (!user) return c.json({ error: 'No autorizado' }, 401);
  if (user.email !== ADMIN_EMAIL) return c.json({ error: 'Solo administradores' }, 403);
  c.set('user', user);
  await next();
}

// ── IMÁGENES DE MUNICIPIO ─────────────────────────────────────────────────────

/**
 * GET /municipalities/:municipalityId/image
 * Imagen activa (aprobada) de un municipio
 */
municipalityRoutes.get('/:municipalityId/image', async (c) => {
  const municipalityId = c.req.param('municipalityId');
  const image = await c.env.DB.prepare(
    `SELECT mi.*, u.full_name as proposed_by_name
     FROM municipality_images mi
     JOIN users u ON mi.user_id = u.id
     WHERE mi.municipality_id = ? AND mi.status = 'approved'
     ORDER BY mi.reviewed_at DESC LIMIT 1`
  ).bind(municipalityId).first();
  return c.json({ image: image || null });
});

/**
 * GET /municipalities/images/approved
 * Todas las imágenes aprobadas (una por municipio, la más reciente)
 */
municipalityRoutes.get('/images/approved', async (c) => {
  const images = await c.env.DB.prepare(
    `SELECT mi.municipality_id, mi.image_url, mi.reviewed_at
     FROM municipality_images mi
     WHERE mi.status = 'approved'
     GROUP BY mi.municipality_id
     HAVING mi.reviewed_at = MAX(mi.reviewed_at)`
  ).all();
  return c.json({ images: images.results || [] });
});

/**
 * POST /municipalities/:municipalityId/image
 * Proponer nueva imagen (requiere auth)
 */
municipalityRoutes.post('/:municipalityId/image', requireAuth, async (c) => {
  const municipalityId = c.req.param('municipalityId');
  const user = c.get('user');
  const { image_url } = await c.req.json();

  if (!image_url) return c.json({ error: 'image_url es requerida' }, 400);

  const validMunicipalities = ['santiago', 'colon', 'sibundoy', 'san-francisco'];
  if (!validMunicipalities.includes(municipalityId)) {
    return c.json({ error: 'Municipio inválido' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO municipality_images (id, municipality_id, user_id, image_url, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).bind(crypto.randomUUID(), municipalityId, user.id, image_url, now).run();

  return c.json({ message: 'Propuesta enviada. El administrador la revisará pronto.' }, 201);
});

// ── LUGARES / NEGOCIOS ────────────────────────────────────────────────────────

/**
 * GET /municipalities/:municipalityId/places
 * Lugares aprobados de un municipio (público)
 */
municipalityRoutes.get('/:municipalityId/places', async (c) => {
  const municipalityId = c.req.param('municipalityId');
  const places = await c.env.DB.prepare(
    `SELECT mp.*, u.full_name as published_by_name
     FROM municipality_places mp
     JOIN users u ON mp.user_id = u.id
     WHERE mp.municipality_id = ? AND mp.status = 'approved'
     ORDER BY mp.reviewed_at DESC`
  ).bind(municipalityId).all();
  return c.json({ places: places.results || [] });
});

/**
 * POST /municipalities/:municipalityId/places
 * Publicar un lugar/negocio (requiere auth)
 */
municipalityRoutes.post('/:municipalityId/places', requireAuth, async (c) => {
  const municipalityId = c.req.param('municipalityId');
  const user = c.get('user');
  const { name, description, category, image_url, address, latitude, longitude } = await c.req.json();

  if (!name || !address) return c.json({ error: 'name y address son requeridos' }, 400);

  const validMunicipalities = ['santiago', 'colon', 'sibundoy', 'san-francisco'];
  if (!validMunicipalities.includes(municipalityId)) {
    return c.json({ error: 'Municipio inválido' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO municipality_places
       (id, municipality_id, user_id, name, description, category, image_url, address, latitude, longitude, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(
    crypto.randomUUID(), municipalityId, user.id,
    name, description || null, category || 'negocio', image_url || null,
    address, latitude || null, longitude || null,
    now, now
  ).run();

  return c.json({ message: 'Lugar enviado para revisión. El administrador lo aprobará pronto.' }, 201);
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────

/**
 * GET /municipalities/admin/images/pending
 * Imágenes pendientes de aprobación
 */
municipalityRoutes.get('/admin/images/pending', requireAdmin, async (c) => {
  const images = await c.env.DB.prepare(
    `SELECT mi.*, u.full_name as proposed_by_name, u.email as proposed_by_email
     FROM municipality_images mi
     JOIN users u ON mi.user_id = u.id
     WHERE mi.status = 'pending'
     ORDER BY mi.created_at DESC`
  ).all();
  return c.json({ images: images.results || [] });
});

/**
 * PUT /municipalities/admin/images/:imageId/approve
 * Aprobar imagen propuesta
 */
municipalityRoutes.put('/admin/images/:imageId/approve', requireAdmin, async (c) => {
  const imageId = c.req.param('imageId');
  const user = c.get('user');
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    `UPDATE municipality_images SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?`
  ).bind(user.id, now, imageId).run();

  return c.json({ message: 'Imagen aprobada' });
});

/**
 * PUT /municipalities/admin/images/:imageId/reject
 * Rechazar imagen propuesta
 */
municipalityRoutes.put('/admin/images/:imageId/reject', requireAdmin, async (c) => {
  const imageId = c.req.param('imageId');
  const user = c.get('user');
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    `UPDATE municipality_images SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ?`
  ).bind(user.id, now, imageId).run();

  return c.json({ message: 'Imagen rechazada' });
});

/**
 * GET /municipalities/admin/places/pending
 * Lugares pendientes de aprobación
 */
municipalityRoutes.get('/admin/places/pending', requireAdmin, async (c) => {
  const places = await c.env.DB.prepare(
    `SELECT mp.*, u.full_name as published_by_name, u.email as published_by_email
     FROM municipality_places mp
     JOIN users u ON mp.user_id = u.id
     WHERE mp.status = 'pending'
     ORDER BY mp.created_at DESC`
  ).all();
  return c.json({ places: places.results || [] });
});

/**
 * PUT /municipalities/admin/places/:placeId/approve
 * Aprobar lugar
 */
municipalityRoutes.put('/admin/places/:placeId/approve', requireAdmin, async (c) => {
  const placeId = c.req.param('placeId');
  const user = c.get('user');
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    `UPDATE municipality_places SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
  ).bind(user.id, now, now, placeId).run();

  return c.json({ message: 'Lugar aprobado' });
});

/**
 * PUT /municipalities/admin/places/:placeId/reject
 * Rechazar lugar
 */
municipalityRoutes.put('/admin/places/:placeId/reject', requireAdmin, async (c) => {
  const placeId = c.req.param('placeId');
  const user = c.get('user');
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    `UPDATE municipality_places SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
  ).bind(user.id, now, now, placeId).run();

  return c.json({ message: 'Lugar rechazado' });
});

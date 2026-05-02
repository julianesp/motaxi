import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';
import { v4 as uuidv4 } from 'uuid';

export const referralRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /referrals/winner
 * Ganador del concurso de referidos del mes actual (público)
 */
referralRoutes.get('/winner', async (c) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Buscar ganador ya calculado este mes
    const stored = await c.env.DB.prepare(
      `SELECT rw.*, u.full_name, u.profile_image, d.municipality, d.vehicle_model
       FROM referral_winner rw
       JOIN users u ON rw.driver_id = u.id
       LEFT JOIN drivers d ON rw.driver_id = d.id
       WHERE rw.month = ? AND rw.year = ?`
    ).bind(month, year).first() as any;

    if (stored) {
      return c.json({ winner: stored });
    }

    // Calcular en tiempo real: conductor con más referidos este mes
    const monthStart = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
    const monthEnd = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);

    const top = await c.env.DB.prepare(
      `SELECT dr.driver_id, COUNT(*) as referral_count,
              u.full_name, u.profile_image, d.municipality, d.vehicle_model
       FROM driver_referrals dr
       JOIN users u ON dr.driver_id = u.id
       LEFT JOIN drivers d ON dr.driver_id = d.id
       WHERE dr.created_at BETWEEN ? AND ?
       GROUP BY dr.driver_id
       ORDER BY referral_count DESC
       LIMIT 1`
    ).bind(monthStart, monthEnd).first() as any;

    if (!top || top.referral_count === 0) {
      return c.json({ winner: null });
    }

    return c.json({
      winner: { ...top, month, year, reward_type: 'free_month' }
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get referral winner' }, 500);
  }
});

/**
 * GET /referrals/stats
 * Estadísticas de referidos del conductor autenticado
 */
referralRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthStart = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
    const monthEnd = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);

    // Total referidos históricos
    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM driver_referrals WHERE driver_id = ?'
    ).bind(user.id).first<{ cnt: number }>();

    // Referidos este mes
    const thisMonth = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM driver_referrals WHERE driver_id = ? AND created_at BETWEEN ? AND ?'
    ).bind(user.id, monthStart, monthEnd).first<{ cnt: number }>();

    // Ranking este mes
    const ranking = await c.env.DB.prepare(
      `SELECT COUNT(*) as better_drivers FROM (
        SELECT driver_id, COUNT(*) as cnt
        FROM driver_referrals
        WHERE created_at BETWEEN ? AND ?
        GROUP BY driver_id
        HAVING cnt > (
          SELECT COUNT(*) FROM driver_referrals
          WHERE driver_id = ? AND created_at BETWEEN ? AND ?
        )
      )`
    ).bind(monthStart, monthEnd, user.id, monthStart, monthEnd).first<{ better_drivers: number }>();

    return c.json({
      total: total?.cnt ?? 0,
      this_month: thisMonth?.cnt ?? 0,
      rank: (ranking?.better_drivers ?? 0) + 1,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get referral stats' }, 500);
  }
});

/**
 * POST /referrals/register
 * Registrar un referido. Llamado internamente al crear cuenta con ?ref=<driver_id>
 * Body: { driver_ref_code: string, new_user_id: string }
 * Solo puede ser llamado desde auth flow (sin token de usuario final)
 */
referralRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { driver_ref_code, new_user_id } = body;

    if (!driver_ref_code || !new_user_id) {
      return c.json({ error: 'Missing params' }, 400);
    }

    // Verificar que el conductor existe
    const driver = await c.env.DB.prepare(
      `SELECT u.id FROM users u JOIN drivers d ON u.id = d.id WHERE u.id = ?`
    ).bind(driver_ref_code).first();

    if (!driver) {
      return c.json({ error: 'Driver not found' }, 404);
    }

    // Verificar que el nuevo usuario existe y es pasajero
    const newUser = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(new_user_id).first<{ id: string; role: string }>();

    if (!newUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Evitar auto-referido
    if (driver_ref_code === new_user_id) {
      return c.json({ error: 'Cannot refer yourself' }, 400);
    }

    const id = uuidv4();
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO driver_referrals (id, driver_id, referred_user_id) VALUES (?, ?, ?)'
    ).bind(id, driver_ref_code, new_user_id).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to register referral' }, 500);
  }
});

/**
 * POST /referrals/qr-request
 * El conductor solicita que le lleven un código QR para su moto
 */
referralRoutes.post('/qr-request', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can request QR codes' }, 403);
    }

    const id = uuidv4();
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO qr_requests (id, driver_id) VALUES (?, ?)'
    ).bind(id, user.id).run();

    // Verificar si ya existía
    const existing = await c.env.DB.prepare(
      'SELECT status FROM qr_requests WHERE driver_id = ?'
    ).bind(user.id).first<{ status: string }>();

    return c.json({ success: true, status: existing?.status ?? 'pending' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to request QR' }, 500);
  }
});

/**
 * GET /referrals/qr-request/status
 * Estado de la solicitud de QR del conductor autenticado
 */
referralRoutes.get('/qr-request/status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    const req = await c.env.DB.prepare(
      'SELECT status, created_at FROM qr_requests WHERE driver_id = ?'
    ).bind(user.id).first<{ status: string; created_at: number }>();

    return c.json({ request: req || null });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get QR status' }, 500);
  }
});

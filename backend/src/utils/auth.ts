import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

export class AuthUtils {
  /**
   * Hash de contraseña usando bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Verifica contraseña contra hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Genera un token de sesión simple (UUID)
   * En producción, considera usar JWT
   */
  static generateToken(): string {
    return uuidv4();
  }

  /**
   * Crea una sesión en la base de datos
   */
  static async createSession(
    db: D1Database,
    userId: string
  ): Promise<{ token: string; expiresAt: number }> {
    const token = this.generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 días

    await db
      .prepare(
        'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
      )
      .bind(uuidv4(), userId, token, expiresAt)
      .run();

    return { token, expiresAt };
  }

  /**
   * Verifica un token de sesión
   */
  static async verifyToken(db: D1Database, token: string): Promise<any | null> {
    const session = await db
      .prepare(
        `SELECT s.*, u.* FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > ?`
      )
      .bind(token, Math.floor(Date.now() / 1000))
      .first();

    return session;
  }

  /**
   * Elimina una sesión (logout)
   */
  static async deleteSession(db: D1Database, token: string): Promise<void> {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  /**
   * Limpia sesiones expiradas
   */
  static async cleanExpiredSessions(db: D1Database): Promise<void> {
    await db
      .prepare('DELETE FROM sessions WHERE expires_at < ?')
      .bind(Math.floor(Date.now() / 1000))
      .run();
  }
}

const EXEMPT_EMAILS = ['julii1295@gmail.com', 'alexriob@gmail.com', 'admin@neurai.dev'];

/**
 * Middleware de suscripción para rutas de conductor
 * Bloquea si el trial expiró y no tiene suscripción activa
 */
export async function subscriptionMiddleware(c: any, next: any) {
  const user = c.get('user');
  if (!user || user.role !== 'driver') {
    await next();
    return;
  }

  if (EXEMPT_EMAILS.includes(user.email?.toLowerCase())) {
    await next();
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  const subscription = await (c.env.DB as D1Database)
    .prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(user.id)
    .first() as any;

  if (!subscription) {
    await next();
    return;
  }

  const isTrialActive = subscription.status === 'trial' && now < subscription.trial_ends_at;
  const isSubscriptionActive = subscription.status === 'active' && subscription.current_period_end && now < subscription.current_period_end;

  if (!isTrialActive && !isSubscriptionActive) {
    return c.json({
      error: 'Suscripción requerida',
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Tu período de prueba ha vencido. Suscríbete para continuar usando MoTaxi.',
    }, 403);
  }

  // Enviar notificación 3 días antes de que venza el período activo
  const periodEnd = isSubscriptionActive ? subscription.current_period_end : subscription.trial_ends_at;
  const daysLeft = Math.ceil((periodEnd - now) / (24 * 60 * 60));

  if (daysLeft === 3) {
    const existing = await (c.env.DB as D1Database)
      .prepare(`SELECT id FROM notifications WHERE user_id = ? AND type = 'subscription_reminder' AND created_at > ?`)
      .bind(user.id, now - 86400)
      .first();

    if (!existing) {
      const period = isTrialActive ? 'prueba' : 'suscripción';
      await (c.env.DB as D1Database).prepare(
        `INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        user.id,
        `⚠️ Tu ${period} vence en 3 días`,
        `Tu período de ${period} vence el ${new Date(periodEnd * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}. Renueva ahora para no perder el acceso.`,
        'subscription_reminder'
      ).run();
    }
  }

  await next();
}

/**
 * Middleware de autenticación para Hono
 */
export async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }

  const token = authHeader.substring(7);
  const user = await AuthUtils.verifyToken(c.env.DB, token);

  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', user);
  c.set('userId', user.id);
  c.set('userRole', user.role);
  await next();
}

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
  await next();
}

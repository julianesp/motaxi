import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { AuthUtils } from '../utils/auth';
import { EmailService } from '../utils/email';
import { Env } from '../index';

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/register
 * Registrar nuevo usuario
 */
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, phone, full_name, role } = body;

    // Validación básica
    if (!email || !password || !phone || !full_name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (!['passenger', 'driver'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Verificar si el usuario ya existe
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? OR phone = ?'
    )
      .bind(email, phone)
      .first();

    if (existingUser) {
      return c.json({ error: 'Email or phone already registered' }, 409);
    }

    // Hash de contraseña
    const passwordHash = await AuthUtils.hashPassword(password);
    const userId = uuidv4();

    // Crear usuario
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, phone, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(userId, email, passwordHash, phone, full_name, role)
      .run();

    // Crear perfil según rol
    if (role === 'passenger') {
      await c.env.DB.prepare('INSERT INTO passengers (id) VALUES (?)')
        .bind(userId)
        .run();
    } else if (role === 'driver') {
      // Para drivers, necesitarán completar su perfil después
      // Usar valores únicos temporales basados en el userId para evitar conflictos UNIQUE
      const tempPlate = `PENDING-${userId.substring(0, 8)}`;
      const tempLicense = `PENDING-${userId.substring(0, 8)}`;

      await c.env.DB.prepare(
        'INSERT INTO drivers (id, license_number, vehicle_plate, vehicle_model, vehicle_color) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(userId, tempLicense, tempPlate, 'PENDING', 'PENDING')
        .run();
    }

    // Crear sesión
    const { token, expiresAt } = await AuthUtils.createSession(c.env.DB, userId);

    // Obtener usuario completo
    const user = await c.env.DB.prepare(
      'SELECT id, email, phone, full_name, role, created_at FROM users WHERE id = ?'
    )
      .bind(userId)
      .first();

    return c.json({
      user,
      token,
      expiresAt,
    }, 201);
  } catch (error: any) {
    console.error('Register error:', error);
    return c.json({ error: error.message || 'Registration failed' }, 500);
  }
});

/**
 * POST /auth/login
 * Iniciar sesión
 */
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    // Buscar usuario
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    )
      .bind(email)
      .first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verificar contraseña
    const isValidPassword = await AuthUtils.verifyPassword(
      password,
      user.password_hash as string
    );

    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Crear sesión
    const { token, expiresAt } = await AuthUtils.createSession(
      c.env.DB,
      user.id as string
    );

    // Remover password_hash de la respuesta
    const { password_hash, ...userWithoutPassword } = user;

    return c.json({
      user: userWithoutPassword,
      token,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return c.json({ error: error.message || 'Login failed' }, 500);
  }
});

/**
 * POST /auth/forgot-password
 * Solicitar recuperación de contraseña
 */
authRoutes.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json();
    const { emailOrPhone } = body;

    if (!emailOrPhone) {
      return c.json({ error: 'Email or phone required' }, 400);
    }

    // Buscar usuario por email o teléfono
    const user = await c.env.DB.prepare(
      'SELECT id, email, phone, full_name FROM users WHERE email = ? OR phone = ?'
    )
      .bind(emailOrPhone, emailOrPhone)
      .first();

    if (!user) {
      // Por seguridad, no revelar si el usuario existe o no
      return c.json({
        message: 'Si el correo o teléfono existe, recibirás instrucciones para recuperar tu cuenta.'
      });
    }

    // Generar código de recuperación de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    // Guardar código en la base de datos
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO password_resets (user_id, reset_code, expires_at) VALUES (?, ?, ?)'
    )
      .bind(user.id, resetCode, expiresAt)
      .run();

    // Inicializar servicio de email
    const emailService = new EmailService(
      c.env.RESEND_API_KEY,
      c.env.RESEND_FROM_EMAIL
    );

    // Intentar enviar email si existe configuración de Resend
    let emailSent = false;
    if (user.email && c.env.RESEND_API_KEY) {
      const result = await emailService.sendPasswordResetCode(
        user.email as string,
        resetCode,
        user.full_name as string
      );
      emailSent = result.success;

      if (!emailSent) {
        console.error('Failed to send email:', result.error);
      }
    }

    // Log para debugging (solo en desarrollo)
    console.log(`Reset code for ${user.email}: ${resetCode}`);

    // Respuesta base
    const response: any = {
      message: 'Si el correo o teléfono existe, recibirás instrucciones para recuperar tu cuenta.'
    };

    // Solo incluir debug info si NO se envió el email (modo desarrollo)
    if (!emailSent) {
      response.debug = {
        resetCode,
        email: user.email,
        phone: user.phone,
        note: 'Configure RESEND_API_KEY en .dev.vars para enviar emails reales'
      };
    }

    return c.json(response);
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return c.json({ error: error.message || 'Request failed' }, 500);
  }
});

/**
 * POST /auth/reset-password
 * Resetear contraseña con código
 */
authRoutes.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const { emailOrPhone, resetCode, newPassword } = body;

    if (!emailOrPhone || !resetCode || !newPassword) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Buscar usuario
    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? OR phone = ?'
    )
      .bind(emailOrPhone, emailOrPhone)
      .first();

    if (!user) {
      return c.json({ error: 'Invalid reset code' }, 400);
    }

    // Verificar código de recuperación
    const reset = await c.env.DB.prepare(
      'SELECT * FROM password_resets WHERE user_id = ? AND reset_code = ? AND expires_at > ?'
    )
      .bind(user.id, resetCode, Date.now())
      .first();

    if (!reset) {
      return c.json({ error: 'Invalid or expired reset code' }, 400);
    }

    // Actualizar contraseña
    const passwordHash = await AuthUtils.hashPassword(newPassword);
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(passwordHash, user.id)
      .run();

    // Eliminar código usado
    await c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?')
      .bind(user.id)
      .run();

    return c.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return c.json({ error: error.message || 'Reset failed' }, 500);
  }
});

/**
 * POST /auth/logout
 * Cerrar sesión
 */
authRoutes.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await AuthUtils.deleteSession(c.env.DB, token);
    }

    return c.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return c.json({ error: error.message || 'Logout failed' }, 500);
  }
});

/**
 * GET /auth/me
 * Obtener usuario actual
 */
authRoutes.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const user = await AuthUtils.verifyToken(c.env.DB, token);

    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const { password_hash, ...userWithoutPassword } = user;

    return c.json({ user: userWithoutPassword });
  } catch (error: any) {
    console.error('Get me error:', error);
    return c.json({ error: error.message || 'Failed to get user' }, 500);
  }
});

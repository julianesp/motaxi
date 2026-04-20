import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { AuthUtils } from '../utils/auth';
import { EmailService } from '../utils/email';
import { TelegramService } from '../services/telegram';
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

    // Verificar si el email o teléfono está bloqueado (conductor con trial vencido sin pago)
    if (role === 'driver') {
      const blockedByEmail = await c.env.DB.prepare(
        'SELECT id FROM blocked_emails WHERE email = ?'
      ).bind(email.toLowerCase()).first();
      if (blockedByEmail) {
        return c.json({
          error: 'Este email no puede registrarse como conductor. Tu período de prueba venció y no se realizó el pago. Contáctanos en admin@neurai.dev para regularizar tu situación.',
          code: 'EMAIL_BLOCKED'
        }, 403);
      }

      if (phone) {
        const blockedByPhone = await c.env.DB.prepare(
          'SELECT id FROM blocked_emails WHERE phone = ?'
        ).bind(phone).first();
        if (blockedByPhone) {
          return c.json({
            error: 'Este número de teléfono no puede registrarse como conductor. Tu período de prueba venció y no se realizó el pago. Contáctanos en admin@neurai.dev para regularizar tu situación.',
            code: 'PHONE_BLOCKED'
          }, 403);
        }
      }
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

      // Auto-aprobación habilitada temporalmente (sin verificación manual)
      await c.env.DB.prepare(
        'INSERT INTO drivers (id, license_number, vehicle_plate, vehicle_model, vehicle_color, rating, verification_status, is_verified, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(userId, tempLicense, tempPlate, 'PENDING', 'PENDING', null, 'approved', 1, Math.floor(Date.now() / 1000))
        .run();

      // Crear trial de 30 días al registrarse
      const trialEndsAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      await c.env.DB.prepare(
        `INSERT INTO subscriptions (id, user_id, status, plan, amount, trial_ends_at) VALUES (?, ?, 'trial', 'monthly', 14900, ?)`
      ).bind(uuidv4(), userId, trialEndsAt).run();
    }

    // Crear sesión
    const { token, expiresAt } = await AuthUtils.createSession(c.env.DB, userId);

    // Obtener usuario completo
    const user = await c.env.DB.prepare(
      'SELECT id, email, phone, full_name, role, created_at FROM users WHERE id = ?'
    )
      .bind(userId)
      .first();

    // Notificar al admin por Telegram sobre el nuevo registro
    if (c.env.TELEGRAM_BOT_TOKEN && c.env.ADMIN_TELEGRAM_CHAT_ID) {
      TelegramService.notifyAdminNewUser(
        c.env.TELEGRAM_BOT_TOKEN,
        c.env.ADMIN_TELEGRAM_CHAT_ID,
        { fullName: full_name, email, role, phone }
      ).catch(() => {});

      // Hito de pasajeros: notificar si se llega a 20, 30, 50 o 100
      if (role === 'passenger') {
        const countResult = await c.env.DB.prepare(
          "SELECT COUNT(*) as total FROM users WHERE role = 'passenger'"
        ).first() as any;
        const total = countResult?.total ?? 0;
        if ([20, 30, 50, 100].includes(total)) {
          TelegramService.notifyAdminPassengerMilestone(
            c.env.TELEGRAM_BOT_TOKEN,
            c.env.ADMIN_TELEGRAM_CHAT_ID,
            total
          ).catch(() => {});
        }
      }
    }

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
 * POST /auth/google
 * Iniciar sesión o registrarse con Google OAuth
 */
authRoutes.post('/google', async (c) => {
  try {
    const body = await c.req.json();
    const { credential } = body;

    if (!credential) {
      return c.json({ error: 'Google credential required' }, 400);
    }

    // Verificar el token de Google
    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );

    if (!googleResponse.ok) {
      return c.json({ error: 'Invalid Google token' }, 401);
    }

    const googleData: any = await googleResponse.json();

    if (!googleData.email || !googleData.sub) {
      return c.json({ error: 'Invalid Google token data' }, 401);
    }

    const { email, name, sub: googleId } = googleData;

    // Buscar si ya existe el usuario
    let user: any = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      // Crear nuevo usuario con Google (role: passenger por defecto)
      const userId = uuidv4();
      const full_name = name || email.split('@')[0];
      const phone = `G-${googleId.substring(0, 9)}`; // placeholder único

      await c.env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, phone, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, email, '', phone, full_name, 'passenger').run();

      await c.env.DB.prepare('INSERT INTO passengers (id) VALUES (?)')
        .bind(userId).run();

      user = await c.env.DB.prepare(
        'SELECT id, email, phone, full_name, role, created_at FROM users WHERE id = ?'
      ).bind(userId).first();

      // Notificar al admin por Telegram sobre el nuevo registro con Google
      if (c.env.TELEGRAM_BOT_TOKEN && c.env.ADMIN_TELEGRAM_CHAT_ID) {
        TelegramService.notifyAdminNewUser(
          c.env.TELEGRAM_BOT_TOKEN,
          c.env.ADMIN_TELEGRAM_CHAT_ID,
          { fullName: full_name, email, role: 'passenger', phone: `G-${googleId.substring(0, 9)}` }
        ).catch(() => {});

        // Hito de pasajeros al registrarse con Google
        const countResult = await c.env.DB.prepare(
          "SELECT COUNT(*) as total FROM users WHERE role = 'passenger'"
        ).first() as any;
        const total = countResult?.total ?? 0;
        if ([20, 30, 50, 100].includes(total)) {
          TelegramService.notifyAdminPassengerMilestone(
            c.env.TELEGRAM_BOT_TOKEN,
            c.env.ADMIN_TELEGRAM_CHAT_ID,
            total
          ).catch(() => {});
        }
      }
    }

    const { password_hash, ...userWithoutPassword } = user;

    // Crear sesión
    const { token, expiresAt } = await AuthUtils.createSession(c.env.DB, user.id as string);

    return c.json({ user: userWithoutPassword, token, expiresAt });
  } catch (error: any) {
    console.error('Google auth error:', error);
    return c.json({ error: error.message || 'Google authentication failed' }, 500);
  }
});

/**
 * POST /auth/google-clerk
 * Iniciar sesión o registrarse con datos de Clerk (Google OAuth via Clerk)
 */
authRoutes.post('/google-clerk', async (c) => {
  try {
    const body = await c.req.json();
    const { email, name, googleId } = body;

    if (!email || !googleId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Buscar si ya existe el usuario
    let user: any = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    const isNewUser = !user;

    if (!user) {
      const userId = uuidv4();
      const full_name = name || email.split('@')[0];
      const phone = `G-${googleId.substring(0, 9)}`;

      await c.env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, phone, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, email, '', phone, full_name, 'passenger').run();

      await c.env.DB.prepare('INSERT INTO passengers (id) VALUES (?)')
        .bind(userId).run();

      user = await c.env.DB.prepare(
        'SELECT id, email, phone, full_name, role, created_at FROM users WHERE id = ?'
      ).bind(userId).first();

      // Notificar al admin sobre el nuevo registro
      if (c.env.TELEGRAM_BOT_TOKEN && c.env.ADMIN_TELEGRAM_CHAT_ID) {
        TelegramService.notifyAdminNewUser(
          c.env.TELEGRAM_BOT_TOKEN,
          c.env.ADMIN_TELEGRAM_CHAT_ID,
          { fullName: full_name, email, role: 'passenger', phone }
        ).catch(() => {});

        const countResult = await c.env.DB.prepare(
          "SELECT COUNT(*) as total FROM users WHERE role = 'passenger'"
        ).first() as any;
        const total = countResult?.total ?? 0;
        if ([20, 30, 50, 100].includes(total)) {
          TelegramService.notifyAdminPassengerMilestone(
            c.env.TELEGRAM_BOT_TOKEN,
            c.env.ADMIN_TELEGRAM_CHAT_ID,
            total
          ).catch(() => {});
        }
      }
    }

    const { password_hash, ...userWithoutPassword } = user;
    const { token, expiresAt } = await AuthUtils.createSession(c.env.DB, user.id as string);

    return c.json({ user: userWithoutPassword, token, expiresAt, isNewUser });
  } catch (error: any) {
    console.error('Google Clerk auth error:', error);
    return c.json({ error: error.message || 'Authentication failed' }, 500);
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

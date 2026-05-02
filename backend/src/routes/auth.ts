import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { AuthUtils } from '../utils/auth';
import { EmailService } from '../utils/email';
import { TelegramService } from '../services/telegram';
import { Env } from '../index';

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/send-otp
 * Enviar código de verificación SMS al número de celular (via Twilio REST API)
 */
authRoutes.post('/send-otp', async (c) => {
  try {
    const { phone } = await c.req.json();

    if (!phone || !/^\d{10,15}$/.test(phone.replace(/\s/g, ''))) {
      return c.json({ error: 'Número de celular inválido' }, 400);
    }

    // Verificar si el teléfono ya está registrado
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE phone = ?'
    ).bind(phone).first();
    if (existing) {
      return c.json({ error: 'Este número ya está registrado' }, 409);
    }

    // Rate limiting simple: máximo 3 OTPs por número en los últimos 10 minutos
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const recentCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM phone_verifications WHERE phone = ? AND created_at > ?'
    ).bind(phone, tenMinutesAgo).first() as any;
    if ((recentCount?.count ?? 0) >= 3) {
      return c.json({ error: 'Demasiados intentos. Espera 10 minutos antes de solicitar otro código.' }, 429);
    }

    // Generar código de 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutos
    const id = uuidv4();

    // Guardar código en DB
    await c.env.DB.prepare(
      'INSERT INTO phone_verifications (id, phone, code, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(id, phone, code, expiresAt).run();

    // Enviar SMS via Twilio REST API (compatible con Cloudflare Workers)
    if (c.env.TWILIO_ACCOUNT_SID && c.env.TWILIO_AUTH_TOKEN && c.env.TWILIO_PHONE_NUMBER) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${c.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const credentials = btoa(`${c.env.TWILIO_ACCOUNT_SID}:${c.env.TWILIO_AUTH_TOKEN}`);
      const formattedPhone = phone.startsWith('+') ? phone : `+57${phone}`;

      const smsBody = new URLSearchParams({
        To: formattedPhone,
        From: c.env.TWILIO_PHONE_NUMBER,
        Body: `Tu código de verificación MoTaxi es: ${code}. Válido por 5 minutos. No lo compartas con nadie.`,
      });

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: smsBody.toString(),
      });

      if (!twilioResponse.ok) {
        const err = await twilioResponse.json() as any;
        console.error('Twilio error:', err);
        return c.json({ error: 'No se pudo enviar el SMS. Verifica el número e intenta de nuevo.' }, 500);
      }
    } else {
      console.log(`[DEV] OTP para ${phone}: ${code}`);
    }

    return c.json({ message: 'Código enviado correctamente', phone });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return c.json({ error: 'Error al enviar el código' }, 500);
  }
});

/**
 * POST /auth/verify-otp
 * Verificar el código OTP ingresado por el usuario
 */
authRoutes.post('/verify-otp', async (c) => {
  try {
    const { phone, code } = await c.req.json();

    if (!phone || !code) {
      return c.json({ error: 'Número y código son requeridos' }, 400);
    }

    const now = Math.floor(Date.now() / 1000);

    // Buscar código válido, no usado y no expirado
    const record = await c.env.DB.prepare(
      'SELECT id, code, expires_at, used FROM phone_verifications WHERE phone = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
    ).bind(phone).first() as any;

    if (!record) {
      return c.json({ error: 'No se encontró un código activo para este número' }, 400);
    }

    if (record.expires_at < now) {
      return c.json({ error: 'El código ha expirado. Solicita uno nuevo.' }, 400);
    }

    if (record.code !== String(code)) {
      return c.json({ error: 'Código incorrecto' }, 400);
    }

    // Marcar como usado
    await c.env.DB.prepare(
      'UPDATE phone_verifications SET used = 1 WHERE id = ?'
    ).bind(record.id).run();

    return c.json({ verified: true, phone });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return c.json({ error: 'Error al verificar el código' }, 500);
  }
});

/**
 * POST /auth/register
 * Registrar nuevo usuario
 */
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, phone, full_name, role, vehicle_types, ref } = body;

    // Validación básica — email es opcional, phone es obligatorio
    if (!password || !phone || !full_name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (!['passenger', 'driver'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Verificar si el usuario ya existe por teléfono (y por email si se proveyó)
    const phoneExists = await c.env.DB.prepare(
      'SELECT id FROM users WHERE phone = ?'
    ).bind(phone).first();

    if (phoneExists) {
      return c.json({ error: 'Phone already registered' }, 409);
    }

    if (email) {
      const emailExists = await c.env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email).first();
      if (emailExists) {
        return c.json({ error: 'Email already registered' }, 409);
      }
    }

    // Verificar si el teléfono o email está bloqueado (conductor con trial vencido sin pago)
    if (role === 'driver') {
      const blockedByPhone = await c.env.DB.prepare(
        'SELECT id FROM blocked_emails WHERE phone = ?'
      ).bind(phone).first();
      if (blockedByPhone) {
        return c.json({
          error: 'Este número de teléfono no puede registrarse como conductor. Tu período de prueba venció y no se realizó el pago. Contáctanos en admin@neurai.dev para regularizar tu situación.',
          code: 'PHONE_BLOCKED'
        }, 403);
      }

      if (email) {
        const blockedByEmail = await c.env.DB.prepare(
          'SELECT id FROM blocked_emails WHERE email = ?'
        ).bind(email.toLowerCase()).first();
        if (blockedByEmail) {
          return c.json({
            error: 'Este email no puede registrarse como conductor. Tu período de prueba venció y no se realizó el pago. Contáctanos en admin@neurai.dev para regularizar tu situación.',
            code: 'EMAIL_BLOCKED'
          }, 403);
        }
      }
    }

    // Hash de contraseña
    const passwordHash = await AuthUtils.hashPassword(password);
    const userId = uuidv4();

    // Si no se provee email, usar un placeholder único basado en el teléfono
    const finalEmail = email || `phone-${phone}@motaxi.local`;

    // Crear usuario
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, phone, full_name, role) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(userId, finalEmail, passwordHash, phone, full_name, role)
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

      const validVehicleTypes = ['moto', 'taxi', 'carro', 'piaggio', 'particular'];
      const finalVehicleType = vehicle_types && validVehicleTypes.includes(vehicle_types) ? vehicle_types : 'moto';

      // Auto-aprobación habilitada temporalmente (sin verificación manual)
      await c.env.DB.prepare(
        'INSERT INTO drivers (id, license_number, vehicle_plate, vehicle_model, vehicle_color, vehicle_types, rating, verification_status, is_verified, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(userId, tempLicense, tempPlate, 'PENDING', 'PENDING', finalVehicleType, null, 'approved', 1, Math.floor(Date.now() / 1000))
        .run();

      // Crear trial de 30 días al registrarse
      const trialEndsAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      await c.env.DB.prepare(
        `INSERT INTO subscriptions (id, user_id, status, plan, amount, trial_ends_at) VALUES (?, ?, 'trial', 'monthly', 14900, ?)`
      ).bind(uuidv4(), userId, trialEndsAt).run();
    }

    // Registrar referido si viene con código de conductor
    if (ref && role === 'passenger') {
      try {
        const driverExists = await c.env.DB.prepare(
          'SELECT u.id FROM users u JOIN drivers d ON u.id = d.id WHERE u.id = ?'
        ).bind(ref).first();
        if (driverExists && ref !== userId) {
          const refId = uuidv4();
          await c.env.DB.prepare(
            'INSERT OR IGNORE INTO driver_referrals (id, driver_id, referred_user_id) VALUES (?, ?, ?)'
          ).bind(refId, ref, userId).run();
        }
      } catch (refErr) {
        console.error('Referral registration failed (non-fatal):', refErr);
      }
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
        { fullName: full_name, email: email || `(sin email) ${phone}`, role, phone }
      ).catch((err) => console.error('[Telegram] notifyAdminNewUser failed:', err));

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
    const { email, phone, password } = body;
    const identifier = email || phone;

    if (!identifier || !password) {
      return c.json({ error: 'Email or phone and password required' }, 400);
    }

    // Buscar usuario por email o teléfono
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? OR phone = ?'
    )
      .bind(identifier, identifier)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
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
    // No enviar a emails placeholder @motaxi.local (usuarios registrados con teléfono)
    const hasRealEmail = user.email && !(user.email as string).endsWith('@motaxi.local');
    let emailSent = false;
    let emailError: string | undefined;

    if (hasRealEmail && c.env.RESEND_API_KEY) {
      const result = await emailService.sendPasswordResetCode(
        user.email as string,
        resetCode,
        user.full_name as string
      );
      emailSent = result.success;
      emailError = result.error;

      if (!emailSent) {
        console.error('Failed to send email:', result.error);
      }
    }

    // Si no se envió email, intentar SMS via Twilio (usuarios registrados con teléfono)
    let smsSent = false;
    if (!emailSent && user.phone && c.env.TWILIO_ACCOUNT_SID && c.env.TWILIO_AUTH_TOKEN && c.env.TWILIO_PHONE_NUMBER) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${c.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const credentials = btoa(`${c.env.TWILIO_ACCOUNT_SID}:${c.env.TWILIO_AUTH_TOKEN}`);
      const phone = user.phone as string;
      const formattedPhone = phone.startsWith('+') ? phone : `+57${phone}`;

      const smsBody = new URLSearchParams({
        To: formattedPhone,
        From: c.env.TWILIO_PHONE_NUMBER,
        Body: `Tu código de recuperación MoTaxi es: ${resetCode}. Válido por 15 minutos. No lo compartas con nadie.`,
      });

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: smsBody.toString(),
      });

      smsSent = twilioResponse.ok;
      if (!smsSent) {
        const err = await twilioResponse.json() as any;
        console.error('Twilio SMS error:', err);
      }
    }

    const codeSentViaChannel = emailSent || smsSent;
    console.log(`Reset code for ${user.email || user.phone}: ${resetCode} | emailSent=${emailSent} | smsSent=${smsSent} | error=${emailError}`);

    const response: any = {
      message: 'Si el correo o teléfono existe, recibirás instrucciones para recuperar tu cuenta.',
      emailSent,
      smsSent,
    };

    if (!codeSentViaChannel) {
      response.resetCode = resetCode;
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

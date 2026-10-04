import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { tripRoutes } from './routes/trips';
import { driverRoutes } from './routes/drivers';
import { userRoutes } from './routes/users';
import { notificationRoutes } from './routes/notifications';
import { adminRoutes } from './routes/admin';
import { emergencyRoutes } from './routes/emergency';
import { paymentRoutes } from './routes/payments';
import { chatRoutes } from './routes/chat';
import { analyticsRoutes } from './routes/analytics';
import { telegramRoutes } from './routes/telegram';
import { referralRoutes } from './routes/referrals';
import { sharedRouteRoutes } from './routes/shared_routes';
import { municipalityRoutes } from './routes/municipalities';
import { passkeyRoutes } from './routes/passkeys';
import { runSubscriptionRenewal } from './services/subscription-renewal';
import { SUBSCRIPTIONS_ENABLED } from './utils/auth';

export interface Env {
  DB: D1Database;
  IMAGES?: R2Bucket;
  CACHE?: KVNamespace;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  EPAYCO_PUBLIC_KEY?: string;
  EPAYCO_TEST_MODE?: string;
  SITE_URL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  ADMIN_TELEGRAM_CHAT_ID?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
  ADMIN_API_TOKEN?: string;
  GOOGLE_MAPS_API_KEY?: string;
  INTERNAL_API_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Middleware CORS - usar variable de entorno o permitir todos en desarrollo
app.use('*', async (c, next) => {
  const corsOrigin = c.env.CORS_ORIGIN || '*';
  const allowedOrigins = corsOrigin.split(',').map(o => o.trim());

  return cors({
    origin: (origin) => {
      // Si es '*', permitir todos
      if (corsOrigin === '*') return '*';
      // Si el origin está en la lista de permitidos
      if (allowedOrigins.includes(origin)) return origin;
      // Por defecto, permitir el primer origen configurado
      return allowedOrigins[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })(c, next);
});

// Servir imágenes desde R2 (sin autenticación)
app.get('/images/*', async (c) => {
  try {
    if (!c.env.IMAGES) return c.json({ error: 'Storage not configured' }, 500);
    const key = c.req.path.replace('/images/', '');
    const object = await c.env.IMAGES.get(key);
    if (!object) return c.json({ error: 'Not found' }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000');
    return new Response(object.body, { headers });
  } catch {
    return c.json({ error: 'Failed to serve image' }, 500);
  }
});

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'MoTaxi API - Cloudflare Workers',
    version: '1.0.0',
    status: 'healthy',
  });
});

/**
 * GET /app/version (público)
 * Última versión publicada de la app y la mínima que se exige, para que la app
 * avise a los usuarios con un aviso propio (no depende de las notificaciones).
 * Se configura desde el panel admin (PUT /admin/app-version).
 */
app.get('/app/version', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('android_latest_version_code', 'android_min_version_code', 'android_update_message')"
    ).all<{ key: string; value: string }>();
    const map = Object.fromEntries((rows.results || []).map((r) => [r.key, r.value]));
    return c.json({
      android: {
        latestVersionCode: Number(map.android_latest_version_code) || 0,
        minVersionCode: Number(map.android_min_version_code) || 0,
        message: map.android_update_message || null,
        storeUrl: 'https://play.google.com/store/apps/details?id=com.motaxi.app',
      },
    });
  } catch (error: any) {
    console.error('Get app version error:', error);
    return c.json({ error: 'Failed to get app version' }, 500);
  }
});

// Routes
app.route('/auth', authRoutes);
app.route('/trips', tripRoutes);
app.route('/drivers', driverRoutes);
app.route('/users', userRoutes);
app.route('/notifications', notificationRoutes);
app.route('/admin', adminRoutes);
app.route('/emergency', emergencyRoutes);
app.route('/payments', paymentRoutes);
app.route('/chat', chatRoutes);
app.route('/analytics', analyticsRoutes);
app.route('/telegram', telegramRoutes);
app.route('/referrals', referralRoutes);
app.route('/shared-routes', sharedRouteRoutes);
app.route('/municipalities', municipalityRoutes);
app.route('/passkeys', passkeyRoutes);

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    error: err.message || 'Internal Server Error',
  }, 500);
});

export default {
  fetch: app.fetch.bind(app),

  // Cron triggers: se diferencian por el patrón que los disparó (event.cron)
  //  - "0 13 * * *" (diario): renovación de suscripciones
  //  - "0 * * * *"  (horario): alertas de zonas con alta demanda
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === '0 * * * *') {
      ctx.waitUntil(
        import('./services/demand-alerts').then(({ runDemandAlerts }) =>
          runDemandAlerts(env)
        ).then(result => {
          console.log('[cron] Alertas de demanda:', result);
        }).catch(err => {
          console.error('[cron] Error en alertas de demanda:', err);
        })
      );
      return;
    }

    // Por defecto (cron diario): renovación de suscripciones.
    // Mientras el uso sea gratuito no se ejecuta: evita expirar/bloquear
    // cuentas y enviar avisos de cobro a conductores que hoy usan gratis.
    if (!SUBSCRIPTIONS_ENABLED) {
      console.log('[cron] Renovación de suscripciones omitida (uso gratuito).');
      return;
    }
    ctx.waitUntil(
      runSubscriptionRenewal(env).then(result => {
        console.log(`[cron] Suscripciones procesadas:`, result);
      }).catch(err => {
        console.error('[cron] Error en renovación de suscripciones:', err);
      })
    );
  },
};

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

export const paymentRoutes = new Hono<{ Bindings: Env }>();

// Todas las rutas requieren autenticación excepto webhooks
paymentRoutes.use('/subscription/*', authMiddleware);
// /epayco/create-session requiere auth; /epayco/confirmation es público (webhook de ePayco)
paymentRoutes.use('/epayco/create-session', authMiddleware);

/**
 * GET /payments/subscription/status
 * Obtener estado de suscripción del usuario
 */
// Emails exentos de pago (cuentas de prueba/admin)
const EXEMPT_EMAILS = ['julii1295@gmail.com', 'alexriob@gmail.com', 'admin@neurai.dev'];

paymentRoutes.get('/subscription/status', async (c) => {
  try {
    const user = c.get('user');
    const now = Math.floor(Date.now() / 1000);

    // Cuentas exentas: acceso ilimitado sin cobro
    if (EXEMPT_EMAILS.includes(user.email?.toLowerCase())) {
      return c.json({
        subscription: { status: 'active', plan: 'exempt', amount: 0 },
        days_left: 9999,
        is_trial_active: false,
        is_subscription_active: true,
        has_access: true,
        is_exempt: true,
      });
    }

    let subscription = await c.env.DB.prepare(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(user.id).first() as any;

    // Si no existe, crear suscripción de prueba basada en created_at del usuario
    if (!subscription) {
      const userRecord = await c.env.DB.prepare('SELECT created_at FROM users WHERE id = ?')
        .bind(user.id).first() as any;

      const registeredAt = userRecord?.created_at || now;
      const trialEndsAt = registeredAt + (30 * 24 * 60 * 60); // 30 días

      const subId = uuidv4();
      await c.env.DB.prepare(
        `INSERT INTO subscriptions (id, user_id, status, trial_ends_at) VALUES (?, ?, 'trial', ?)`
      ).bind(subId, user.id, trialEndsAt).run();

      subscription = { id: subId, user_id: user.id, status: 'trial', trial_ends_at: trialEndsAt, amount: 14900 };
    }

    const trialEndsAt = subscription.trial_ends_at as number;
    const daysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / (24 * 60 * 60)));
    const isTrialActive = subscription.status === 'trial' && now < trialEndsAt;
    const isSubscriptionActive = subscription.status === 'active' && subscription.current_period_end && now < (subscription.current_period_end as number);
    const hasAccess = isTrialActive || isSubscriptionActive;

    // Si el trial venció sin pago, bloquear email y teléfono para evitar re-registro
    if (!hasAccess && subscription.status === 'trial' && now >= trialEndsAt) {
      try {
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO blocked_emails (id, email, phone, reason, blocked_at) VALUES (?, ?, ?, 'trial_expired', ?)`
        ).bind(uuidv4(), user.email.toLowerCase(), user.phone || null, now).run();
      } catch (_) {}
    }

    // Notificación proactiva a 3 días: crear una sola vez
    if (isTrialActive && daysLeft <= 3 && daysLeft > 0) {
      try {
        const notifKey = `trial_3days_${subscription.id}`;
        const existing = await c.env.DB.prepare(
          `SELECT id FROM notifications WHERE user_id = ? AND data LIKE ? LIMIT 1`
        ).bind(user.id, `%${notifKey}%`).first();
        if (!existing) {
          const expiryDate = new Date(trialEndsAt * 1000).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
          await c.env.DB.prepare(
            `INSERT INTO notifications (id, user_id, type, title, message, data, created_at) VALUES (?, ?, 'subscription_reminder', ?, ?, ?, ?)`
          ).bind(
            uuidv4(), user.id, `⚠️ Tu prueba vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`,
            `Tu período de prueba gratuito termina el ${expiryDate}. Suscríbete por $14.900/mes para seguir usando MoTaxi sin interrupciones. ¡Puedes pagar ahora o después!`,
            JSON.stringify({ key: notifKey, days_left: daysLeft }),
            now
          ).run();
        }
      } catch (_) {}
    }

    return c.json({
      subscription,
      days_left: daysLeft,
      is_trial_active: isTrialActive,
      is_subscription_active: isSubscriptionActive,
      has_access: hasAccess,
      trial_ends_at: trialEndsAt,
    });
  } catch (error: any) {
    console.error('Get subscription status error:', error);
    return c.json({ error: error.message || 'Failed to get subscription status' }, 500);
  }
});

/**
 * POST /payments/epayco/create-session
 * Crear sesión de pago ePayco para suscripción
 */
paymentRoutes.post('/epayco/create-session', async (c) => {
  try {
    const user = c.get('user');

    if (EXEMPT_EMAILS.includes(user.email?.toLowerCase())) {
      return c.json({ error: 'Esta cuenta está exenta de pago' }, 403);
    }

    const body = await c.req.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerRegion,
      customerTypeDoc,
      customerNumberDoc,
    } = body;

    const epaycoPublicKey = c.env.EPAYCO_PUBLIC_KEY;
    const epaycoTestMode = c.env.EPAYCO_TEST_MODE === 'true';

    if (!epaycoPublicKey) {
      return c.json({ error: 'ePayco not configured' }, 500);
    }

    const amount = 14900;
    const reference = `MTX-SUB-${user.id.substring(0, 8)}-${Date.now()}`;

    const sanitize = (v: any, d = '') => String(v || d).trim();

    const config = {
      key: sanitize(epaycoPublicKey),
      test: epaycoTestMode,
      name: 'Suscripción MoTaxi',
      description: 'Suscripción mensual al servicio MoTaxi',
      invoice: reference,
      currency: 'cop',
      amount: amount.toString(),
      tax_base: '8319.33',
      tax: '1580.67',
      country: 'co',
      lang: 'es',
      name_billing: sanitize(customerName, user.full_name),
      email_billing: sanitize(customerEmail, user.email),
      mobilephone_billing: sanitize(customerPhone, user.phone),
      address_billing: sanitize(customerAddress, 'Sin especificar'),
      city_billing: sanitize(customerCity, 'Sibundoy'),
      type_doc_billing: sanitize(customerTypeDoc, 'CC'),
      number_doc_billing: sanitize(customerNumberDoc),
      name_shipping: sanitize(customerName, user.full_name),
      address_shipping: sanitize(customerAddress, 'Sin especificar'),
      city_shipping: sanitize(customerCity, 'Sibundoy'),
      type_doc_shipping: sanitize(customerTypeDoc, 'CC'),
      mobilephone_shipping: sanitize(customerPhone, user.phone),
      extra1: user.id,
      extra2: reference,
      response: `${c.env.SITE_URL || 'https://motaxi.dev'}/respuesta-pago`,
      confirmation: `${c.env.SITE_URL || 'https://motaxi.dev'}/api/payments/epayco/confirmation`,
      external: 'false',
      autoclick: false,
      method_confirmation: 'POST',
      methodsDisable: [],
    };

    // Guardar referencia pendiente en la suscripción
    await c.env.DB.prepare(
      `UPDATE subscriptions SET epayco_reference = ?, updated_at = ? WHERE user_id = ? AND status IN ('trial', 'expired')`
    ).bind(reference, Math.floor(Date.now() / 1000), user.id).run();

    return c.json({ success: true, config, reference });
  } catch (error: any) {
    console.error('ePayco create session error:', error);
    return c.json({ error: error.message || 'Failed to create session' }, 500);
  }
});

/**
 * POST /payments/epayco/confirmation
 * Webhook de confirmación de ePayco (sin auth, llamado por ePayco)
 */
paymentRoutes.post('/epayco/confirmation', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else {
      const text = await c.req.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => { body[key] = value; });
    }

    const transactionState = body.x_transaction_state || body.x_response;
    const transactionId = body.x_transaction_id || body.x_ref_payco;
    const reference = body.x_id_invoice || body.x_extra2;
    const userId = body.x_extra1;

    if (!userId || !reference) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const periodEnd = now + (30 * 24 * 60 * 60); // 30 días

    // Verificar si existe suscripción para este usuario
    const existing = await c.env.DB.prepare(
      'SELECT id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(userId).first() as any;

    if (transactionState === 'Aceptada') {
      if (existing) {
        await c.env.DB.prepare(
          `UPDATE subscriptions SET
            status = 'active',
            current_period_start = ?,
            current_period_end = ?,
            epayco_reference = ?,
            epayco_transaction_id = ?,
            updated_at = ?
          WHERE user_id = ?`
        ).bind(now, periodEnd, reference, transactionId, now, userId).run();
      } else {
        // Crear suscripción activa si no existe (raro pero posible)
        const subId = uuidv4();
        const userRecord = await c.env.DB.prepare('SELECT created_at FROM users WHERE id = ?')
          .bind(userId).first() as any;
        const trialEndsAt = (userRecord?.created_at || now) + (30 * 24 * 60 * 60);
        await c.env.DB.prepare(
          `INSERT INTO subscriptions (id, user_id, status, trial_ends_at, current_period_start, current_period_end, epayco_reference, epayco_transaction_id)
           VALUES (?, ?, 'active', ?, ?, ?, ?, ?)`
        ).bind(subId, userId, trialEndsAt, now, periodEnd, reference, transactionId).run();
      }
    } else if (transactionState === 'Rechazada' || transactionState === 'Fallida') {
      if (existing) {
        await c.env.DB.prepare(
          `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE user_id = ?`
        ).bind(now, userId).run();
      }
    }

    return c.json({ success: true, message: 'Confirmación procesada' });
  } catch (error: any) {
    console.error('ePayco confirmation error:', error);
    return c.json({ error: error.message || 'Failed to process confirmation' }, 500);
  }
});

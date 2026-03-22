import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';
import { PaymentProcessor } from '../services/payment-processor';

export const paymentRoutes = new Hono<{ Bindings: Env }>();

// Todas las rutas requieren autenticación excepto webhooks
paymentRoutes.use('/methods/*', authMiddleware);
paymentRoutes.use('/process/*', authMiddleware);
paymentRoutes.use('/wallet/*', authMiddleware);
paymentRoutes.use('/subscription/*', authMiddleware);
// /epayco/create-session requiere auth; /epayco/confirmation es público (webhook de ePayco)
paymentRoutes.use('/epayco/create-session', authMiddleware);

/**
 * GET /payments/methods
 * Obtener métodos de pago del usuario
 */
paymentRoutes.get('/methods', async (c) => {
  try {
    const user = c.get('user');

    const methods = await c.env.DB.prepare(
      'SELECT * FROM payment_methods WHERE user_id = ? AND is_active = 1 ORDER BY is_default DESC, created_at DESC'
    )
      .bind(user.id)
      .all();

    return c.json({ methods: methods.results || [] });
  } catch (error: any) {
    console.error('Get payment methods error:', error);
    return c.json({ error: error.message || 'Failed to get payment methods' }, 500);
  }
});

/**
 * POST /payments/methods
 * Agregar método de pago
 */
paymentRoutes.post('/methods', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { type, is_default, ...methodData } = body;

    // Validar tipo
    const validTypes = ['pse', 'nequi', 'daviplata', 'card', 'cash'];
    if (!validTypes.includes(type)) {
      return c.json({ error: 'Invalid payment method type' }, 400);
    }

    // Si es default, quitar flag de otros métodos
    if (is_default) {
      await c.env.DB.prepare(
        'UPDATE payment_methods SET is_default = 0 WHERE user_id = ?'
      )
        .bind(user.id)
        .run();
    }

    const methodId = uuidv4();

    await c.env.DB.prepare(
      `INSERT INTO payment_methods (
        id, user_id, type, is_default,
        card_brand, card_last_four, card_exp_month, card_exp_year, card_holder_name,
        bank_code, bank_name,
        phone_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        methodId,
        user.id,
        type,
        is_default ? 1 : 0,
        methodData.card_brand || null,
        methodData.card_last_four || null,
        methodData.card_exp_month || null,
        methodData.card_exp_year || null,
        methodData.card_holder_name || null,
        methodData.bank_code || null,
        methodData.bank_name || null,
        methodData.phone_number || null
      )
      .run();

    const method = await c.env.DB.prepare(
      'SELECT * FROM payment_methods WHERE id = ?'
    )
      .bind(methodId)
      .first();

    return c.json({ method }, 201);
  } catch (error: any) {
    console.error('Create payment method error:', error);
    return c.json({ error: error.message || 'Failed to create payment method' }, 500);
  }
});

/**
 * DELETE /payments/methods/:id
 * Eliminar método de pago
 */
paymentRoutes.delete('/methods/:id', async (c) => {
  try {
    const user = c.get('user');
    const methodId = c.req.param('id');

    // Verificar que el método pertenece al usuario
    const method = await c.env.DB.prepare(
      'SELECT * FROM payment_methods WHERE id = ? AND user_id = ?'
    )
      .bind(methodId, user.id)
      .first();

    if (!method) {
      return c.json({ error: 'Payment method not found' }, 404);
    }

    // Soft delete
    await c.env.DB.prepare('UPDATE payment_methods SET is_active = 0 WHERE id = ?')
      .bind(methodId)
      .run();

    return c.json({ message: 'Payment method deleted successfully' });
  } catch (error: any) {
    console.error('Delete payment method error:', error);
    return c.json({ error: error.message || 'Failed to delete payment method' }, 500);
  }
});

/**
 * POST /payments/process
 * Procesar pago para un viaje
 */
paymentRoutes.post('/process', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { trip_id, payment_method_id } = body;

    // Obtener información del viaje
    const trip = await c.env.DB.prepare(
      'SELECT * FROM trips WHERE id = ? AND passenger_id = ?'
    )
      .bind(trip_id, user.id)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found or unauthorized' }, 404);
    }

    if (trip.status !== 'completed') {
      return c.json({ error: 'Trip must be completed before payment' }, 400);
    }

    // Verificar si ya existe un pago aprobado
    const existingPayment = await c.env.DB.prepare(
      'SELECT * FROM payment_transactions WHERE trip_id = ? AND status = ?'
    )
      .bind(trip_id, 'approved')
      .first();

    if (existingPayment) {
      return c.json({ error: 'Trip already paid' }, 400);
    }

    // Obtener método de pago
    const paymentMethod = await c.env.DB.prepare(
      'SELECT * FROM payment_methods WHERE id = ? AND user_id = ?'
    )
      .bind(payment_method_id, user.id)
      .first();

    if (!paymentMethod) {
      return c.json({ error: 'Payment method not found' }, 404);
    }

    // Si el pago es en efectivo, marcarlo como aprobado directamente
    if (paymentMethod.type === 'cash') {
      const transactionId = uuidv4();

      await c.env.DB.prepare(
        `INSERT INTO payment_transactions (
          id, trip_id, user_id, payment_method_id, amount, status, payment_type, description
        ) VALUES (?, ?, ?, ?, ?, 'approved', 'cash', ?)`
      )
        .bind(
          transactionId,
          trip_id,
          user.id,
          payment_method_id,
          trip.fare,
          `Pago en efectivo por viaje ${trip_id}`
        )
        .run();

      // Acreditar al conductor
      await creditDriverWallet(c.env.DB, trip.driver_id as string, trip.fare as number, trip_id);

      const transaction = await c.env.DB.prepare(
        'SELECT * FROM payment_transactions WHERE id = ?'
      )
        .bind(transactionId)
        .first();

      return c.json({ transaction, message: 'Cash payment recorded' });
    }

    // Para métodos electrónicos, crear transacción con Wompi
    const transactionId = uuidv4();

    // Configuración de Wompi (en producción, usar variables de entorno)
    const wompiConfig = {
      publicKey: c.env.WOMPI_PUBLIC_KEY || 'pub_test_xxx',
      privateKey: c.env.WOMPI_PRIVATE_KEY || 'prv_test_xxx',
      environment: 'test' as 'test' | 'production',
    };

    // Crear pago con Wompi
    const paymentResult = await PaymentProcessor.createPayment(wompiConfig, {
      amount: trip.fare as number,
      currency: 'COP',
      reference: trip_id,
      customerEmail: user.email,
      paymentMethod: paymentMethod.type.toUpperCase() as any,
      redirectUrl: `https://motaxi.app/payment/callback?trip_id=${trip_id}`,
    });

    // Guardar transacción
    await c.env.DB.prepare(
      `INSERT INTO payment_transactions (
        id, trip_id, user_id, payment_method_id, amount, status, payment_type,
        provider, provider_transaction_id, payment_link, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'wompi', ?, ?, ?)`
    )
      .bind(
        transactionId,
        trip_id,
        user.id,
        payment_method_id,
        trip.fare,
        paymentResult.status,
        paymentMethod.type,
        paymentResult.transactionId || null,
        paymentResult.paymentUrl || null,
        `Pago por viaje ${trip_id}`
      )
      .run();

    const transaction = await c.env.DB.prepare(
      'SELECT * FROM payment_transactions WHERE id = ?'
    )
      .bind(transactionId)
      .first();

    return c.json({
      transaction,
      payment_url: paymentResult.paymentUrl,
      message: paymentResult.success ? 'Payment initiated' : paymentResult.message,
    });
  } catch (error: any) {
    console.error('Process payment error:', error);
    return c.json({ error: error.message || 'Failed to process payment' }, 500);
  }
});

/**
 * GET /payments/wallet
 * Obtener información del wallet del conductor
 */
paymentRoutes.get('/wallet', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers have wallets' }, 403);
    }

    const wallet = await c.env.DB.prepare(
      'SELECT * FROM driver_wallets WHERE driver_id = ?'
    )
      .bind(user.id)
      .first();

    if (!wallet) {
      return c.json({ error: 'Wallet not found' }, 404);
    }

    // Obtener transacciones recientes
    const transactions = await c.env.DB.prepare(
      'SELECT * FROM wallet_transactions WHERE driver_id = ? ORDER BY created_at DESC LIMIT 20'
    )
      .bind(user.id)
      .all();

    return c.json({
      wallet,
      recent_transactions: transactions.results || [],
    });
  } catch (error: any) {
    console.error('Get wallet error:', error);
    return c.json({ error: error.message || 'Failed to get wallet' }, 500);
  }
});

/**
 * POST /payments/wallet/withdraw
 * Solicitar retiro de fondos
 */
paymentRoutes.post('/wallet/withdraw', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can withdraw' }, 403);
    }

    const body = await c.req.json();
    const { amount, payout_method, bank_account, bank_name, account_holder_name } = body;

    // Obtener wallet
    const wallet = await c.env.DB.prepare(
      'SELECT * FROM driver_wallets WHERE driver_id = ?'
    )
      .bind(user.id)
      .first();

    if (!wallet) {
      return c.json({ error: 'Wallet not found' }, 404);
    }

    // Validar monto
    if (amount < (wallet.min_withdrawal as number)) {
      return c.json({
        error: `Minimum withdrawal is $${wallet.min_withdrawal} COP`,
      }, 400);
    }

    if (amount > (wallet.balance as number)) {
      return c.json({ error: 'Insufficient balance' }, 400);
    }

    // Crear solicitud de retiro
    const payoutId = uuidv4();

    await c.env.DB.prepare(
      `INSERT INTO driver_payouts (
        id, driver_id, amount, commission, net_amount, status, payout_method,
        bank_account, bank_name, account_holder_name, period_start, period_end
      ) VALUES (?, ?, ?, 0, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        payoutId,
        user.id,
        amount,
        amount,
        payout_method,
        bank_account || null,
        bank_name || null,
        account_holder_name || null,
        Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60, // últimos 30 días
        Math.floor(Date.now() / 1000)
      )
      .run();

    // Crear transacción de débito en wallet
    await createWalletTransaction(c.env.DB, {
      wallet_id: wallet.id as string,
      driver_id: user.id,
      type: 'debit',
      category: 'withdrawal',
      amount,
      balance_after: (wallet.balance as number) - amount,
      reference_type: 'payout',
      reference_id: payoutId,
      description: `Retiro de $${amount} COP`,
    });

    const payout = await c.env.DB.prepare('SELECT * FROM driver_payouts WHERE id = ?')
      .bind(payoutId)
      .first();

    return c.json({
      payout,
      message: 'Withdrawal request created. It will be processed within 1-2 business days.',
    }, 201);
  } catch (error: any) {
    console.error('Withdraw error:', error);
    return c.json({ error: error.message || 'Failed to create withdrawal' }, 500);
  }
});

/**
 * POST /payments/webhook
 * Webhook para recibir notificaciones de Wompi
 */
paymentRoutes.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const signature = c.req.header('X-Signature') || '';

    // Validar firma (implementar en producción)
    // const isValid = PaymentProcessor.validateWebhookSignature(JSON.stringify(body), signature, secret);

    // Procesar evento
    const event = body.event;
    const transaction = body.data?.transaction;

    if (event === 'transaction.updated' && transaction) {
      // Actualizar estado de la transacción
      await c.env.DB.prepare(
        'UPDATE payment_transactions SET status = ?, approved_at = ? WHERE provider_transaction_id = ?'
      )
        .bind(
          PaymentProcessor['mapWompiStatus'](transaction.status),
          transaction.status === 'APPROVED' ? Math.floor(Date.now() / 1000) : null,
          transaction.id
        )
        .run();

      // Si fue aprobado, acreditar al conductor
      if (transaction.status === 'APPROVED') {
        const paymentTx = await c.env.DB.prepare(
          'SELECT * FROM payment_transactions WHERE provider_transaction_id = ?'
        )
          .bind(transaction.id)
          .first();

        if (paymentTx) {
          const trip = await c.env.DB.prepare('SELECT * FROM trips WHERE id = ?')
            .bind(paymentTx.trip_id)
            .first();

          if (trip) {
            await creditDriverWallet(
              c.env.DB,
              trip.driver_id as string,
              paymentTx.amount as number,
              paymentTx.trip_id as string
            );
          }
        }
      }
    }

    return c.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

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
      const trialEndsAt = registeredAt + (15 * 24 * 60 * 60); // 15 días

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

    // Si el trial venció sin pago, bloquear email para evitar re-registro
    if (!hasAccess && subscription.status === 'trial' && now >= trialEndsAt) {
      try {
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO blocked_emails (id, email, reason, blocked_at) VALUES (?, ?, 'trial_expired', ?)`
        ).bind(uuidv4(), user.email.toLowerCase(), now).run();
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
        // Actualizar suscripción existente por user_id (no depende de epayco_reference)
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
        const trialEndsAt = (userRecord?.created_at || now) + (15 * 24 * 60 * 60);
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

// Helper functions
async function creditDriverWallet(
  db: D1Database,
  driverId: string,
  amount: number,
  tripId: string
) {
  const wallet = await db.prepare('SELECT * FROM driver_wallets WHERE driver_id = ?')
    .bind(driverId)
    .first();

  if (!wallet) return;

  // Obtener configuración de comisiones
  const config = await db.prepare(
    'SELECT * FROM commission_config WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first();

  const commission = PaymentProcessor.calculateCommission(amount, {
    percentage: (config?.platform_percentage as number) || 15,
    min: (config?.min_commission as number) || 500,
    max: (config?.max_commission as number) || 5000,
  });

  const netAmount = amount - commission;

  await createWalletTransaction(db, {
    wallet_id: wallet.id as string,
    driver_id: driverId,
    type: 'credit',
    category: 'trip_earning',
    amount: netAmount,
    balance_after: (wallet.balance as number) + netAmount,
    reference_type: 'trip',
    reference_id: tripId,
    description: `Ganancia por viaje (Comisión: $${commission})`,
  });
}

async function createWalletTransaction(db: D1Database, data: any) {
  const txId = uuidv4();

  await db.prepare(
    `INSERT INTO wallet_transactions (
      id, wallet_id, driver_id, type, category, amount, balance_after,
      reference_type, reference_id, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      txId,
      data.wallet_id,
      data.driver_id,
      data.type,
      data.category,
      data.amount,
      data.balance_after,
      data.reference_type || null,
      data.reference_id || null,
      data.description || null
    )
    .run();
}

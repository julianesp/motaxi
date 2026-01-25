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

import { v4 as uuidv4 } from 'uuid';

interface RenewalEnv {
  DB: D1Database;
  SITE_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  ADMIN_TELEGRAM_CHAT_ID?: string;
}

/**
 * Ejecutado por el cron diario: notifica vencimientos próximos y bloquea suscripciones expiradas.
 * No cobra automáticamente — ePayco estándar no soporta cobro recurrente sin tokenización.
 * El conductor debe renovar manualmente desde la app; este cron garantiza el bloqueo y los avisos.
 */
export async function runSubscriptionRenewal(env: RenewalEnv): Promise<{ notified: number; expired: number; blocked: number }> {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);
  const siteUrl = env.SITE_URL || 'https://motaxi.dev';

  let notified = 0;
  let expired = 0;
  let blocked = 0;

  // 1. Notificar conductores cuya suscripción vence en 7, 3 o 1 día
  const reminderThresholds = [
    { days: 7, label: '7 días' },
    { days: 3, label: '3 días' },
    { days: 1, label: '1 día' },
  ];

  for (const { days, label } of reminderThresholds) {
    const windowStart = now + days * 86400;
    const windowEnd = windowStart + 86400; // ventana de 24h para ese día exacto

    const expiringSoon = await db.prepare(`
      SELECT s.id, s.user_id, s.status, s.trial_ends_at, s.current_period_end,
             u.full_name, u.email, u.phone
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE (
        (s.status = 'trial' AND s.trial_ends_at >= ? AND s.trial_ends_at < ?)
        OR
        (s.status = 'active' AND s.current_period_end >= ? AND s.current_period_end < ?)
      )
      AND (s.renewal_notified_at IS NULL OR s.renewal_reminder_days != ?)
    `).bind(windowStart, windowEnd, windowStart, windowEnd, days).all();

    for (const sub of (expiringSoon.results as any[])) {
      const periodEnd = sub.status === 'trial' ? sub.trial_ends_at : sub.current_period_end;
      const tipo = sub.status === 'trial' ? 'prueba gratuita' : 'suscripción';

      try {
        await db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
          VALUES (?, ?, 'subscription_reminder', ?, ?, ?, ?)
        `).bind(
          uuidv4(),
          sub.user_id,
          `⚠️ Tu ${tipo} vence en ${label}`,
          `Tu período de ${tipo} vence el ${new Date(periodEnd * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}. Renueva ahora por $14.900/mes en ${siteUrl}/driver/profile para no perder el acceso.`,
          JSON.stringify({ days_left: days, period_end: periodEnd, renewal_url: `${siteUrl}/driver/profile` }),
          now
        ).run();

        await db.prepare(`
          UPDATE subscriptions SET renewal_notified_at = ?, renewal_reminder_days = ? WHERE id = ?
        `).bind(now, days, sub.id).run();

        notified++;
      } catch (_) {}
    }
  }

  // 2. Expirar suscripciones activas/trial vencidas
  const toExpire = await db.prepare(`
    SELECT s.id, s.user_id, s.status, s.trial_ends_at, s.current_period_end,
           u.full_name, u.email, u.phone
    FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    WHERE (
      (s.status = 'trial' AND s.trial_ends_at < ?)
      OR
      (s.status = 'active' AND s.current_period_end IS NOT NULL AND s.current_period_end < ?)
    )
  `).bind(now, now).all();

  for (const sub of (toExpire.results as any[])) {
    try {
      await db.prepare(`
        UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?
      `).bind(now, sub.id).run();

      // Notificar al conductor que fue bloqueado
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
        VALUES (?, ?, 'subscription_expired', ?, ?, ?, ?)
      `).bind(
        uuidv4(),
        sub.user_id,
        '🔒 Tu acceso ha sido suspendido',
        `Tu período ha vencido y tu cuenta ha sido suspendida. Reactiva tu suscripción por $14.900/mes para volver a usar MoTaxi.`,
        JSON.stringify({ renewal_url: `${siteUrl}/driver/profile` }),
        now
      ).run();

      expired++;

      // Bloquear email para evitar re-registro
      await db.prepare(`
        INSERT OR IGNORE INTO blocked_emails (id, email, phone, reason, blocked_at)
        VALUES (?, ?, ?, 'subscription_expired', ?)
      `).bind(uuidv4(), sub.email.toLowerCase(), sub.phone || null, now).run();

      blocked++;
    } catch (_) {}
  }

  // 3. Notificar al admin por Telegram si hay actividad relevante
  if ((expired > 0 || notified > 0) && env.TELEGRAM_BOT_TOKEN && env.ADMIN_TELEGRAM_CHAT_ID) {
    try {
      const msg = `📊 *Cron suscripciones MoTaxi*\n` +
        `• Notificados por vencer: ${notified}\n` +
        `• Expirados y bloqueados: ${expired}\n` +
        `• Fecha: ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`;

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.ADMIN_TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' }),
      });
    } catch (_) {}
  }

  return { notified, expired, blocked };
}

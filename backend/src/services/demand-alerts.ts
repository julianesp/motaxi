import { v4 as uuidv4 } from 'uuid';
import { Env } from '../index';

const DOW_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

/**
 * Calcula la zona con mayor demanda esperada para la próxima hora y notifica
 * a los conductores con el add-on premium activo, disponibles y verificados.
 *
 * Se ejecuta desde el cron de Vercel (cada hora).
 */
export async function runDemandAlerts(env: Env, opts: { daysHistory?: number } = {}) {
  const daysHistory = opts.daysHistory ?? 60;
  const now = Math.floor(Date.now() / 1000);

  // Hora objetivo = próxima hora, en hora local de Colombia (UTC-5)
  const target = new Date(Date.now() + 60 * 60 * 1000 + COLOMBIA_OFFSET_MS);
  const targetHour = target.getUTCHours();
  const targetDow = target.getUTCDay();
  const startTimestamp = now - daysHistory * 24 * 60 * 60;

  // Zona con más viajes históricos en esa franja (mismo día de semana + hora)
  const rows = await env.DB.prepare(
    `SELECT
      ROUND(pickup_latitude, 3)  AS lat,
      ROUND(pickup_longitude, 3) AS lng,
      pickup_address             AS address,
      COUNT(*)                   AS trips
     FROM trips
     WHERE created_at >= ?
       AND pickup_latitude IS NOT NULL
       AND CAST(strftime('%H', created_at, 'unixepoch', '-5 hours') AS INTEGER) = ?
       AND CAST(strftime('%w', created_at, 'unixepoch', '-5 hours') AS INTEGER) = ?
     GROUP BY lat, lng
     ORDER BY trips DESC
     LIMIT 1`
  ).bind(startTimestamp, targetHour, targetDow).all();

  const top = (rows.results || [])[0] as any;
  if (!top) {
    return { notified: 0, reason: 'sin_datos_para_la_franja' };
  }

  // Conductores con add-on activo, disponibles y verificados
  const drivers = await env.DB.prepare(
    `SELECT dp.user_id AS id
     FROM driver_premium dp
     JOIN drivers d ON d.id = dp.user_id
     WHERE dp.feature = 'demand_prediction'
       AND dp.status = 'active'
       AND dp.current_period_end > ?
       AND d.is_available = 1
       AND d.verification_status = 'approved'`
  ).bind(now).all();

  const targets = (drivers.results || []) as { id: string }[];
  if (targets.length === 0) {
    return { notified: 0, reason: 'sin_conductores_premium_activos' };
  }

  const hour12 = ((targetHour + 11) % 12) + 1;
  const ampm = targetHour < 12 ? 'a.m.' : 'p.m.';
  const address = (top.address as string) || 'una zona del Valle';
  const title = '📍 Zona con alta demanda próxima';
  const message = `Para las ${hour12} ${ampm} de hoy (${DOW_NAMES[targetDow]}), la zona de ${address} suele tener alta demanda de viajes. Acércate y espera a tus pasajeros.`;
  const data = JSON.stringify({
    type: 'demand_alert',
    latitude: top.lat,
    longitude: top.lng,
    address,
    expected_trips: top.trips,
    target_hour: targetHour,
  });

  let notified = 0;
  for (const d of targets) {
    try {
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type, data)
         VALUES (?, ?, ?, ?, 'general', ?)`
      ).bind(uuidv4(), d.id, title, message, data).run();
      await env.DB.prepare(
        `UPDATE driver_premium SET last_notified_at = ? WHERE user_id = ? AND feature = 'demand_prediction'`
      ).bind(now, d.id).run();
      notified++;
    } catch (e) {
      // continuar con el resto si uno falla
    }
  }

  return {
    notified,
    zone: { latitude: top.lat, longitude: top.lng, address, expected_trips: top.trips },
    target: { hour: targetHour, hour_label: `${hour12} ${ampm}`, day: DOW_NAMES[targetDow] },
  };
}

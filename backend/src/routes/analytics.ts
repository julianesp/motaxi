import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

const PAGE_VIEWS_PREFIX = 'page-views:';

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export const analyticsRoutes = new Hono<{ Bindings: Env }>();

// Rutas públicas (sin autenticación)
// /heatmap es público para mostrarse en la página principal
// /page-views POST es público (registra visita)

// El resto de rutas requieren autenticación
analyticsRoutes.use('/dashboard', authMiddleware);
analyticsRoutes.use('/driver-earnings', authMiddleware);
analyticsRoutes.use('/trip-trends', authMiddleware);
analyticsRoutes.use('/page-views', async (c, next) => {
  if (c.req.method === 'POST') return next();
  return authMiddleware(c, next);
});

/**
 * POST /analytics/page-views — registra una visita para hoy
 */
analyticsRoutes.post('/page-views', async (c) => {
  try {
    const today = todayKey();
    const kvKey = `${PAGE_VIEWS_PREFIX}${today}`;

    const existing = await c.env.CACHE.get(kvKey, 'json') as { date: string; count: number } | null;
    const count = (existing?.count ?? 0) + 1;

    await c.env.CACHE.put(kvKey, JSON.stringify({ date: today, count }), {
      expirationTtl: 60 * 60 * 24 * 35, // 35 días
    });

    return c.json({ ok: true, count });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to record page view' }, 500);
  }
});

/**
 * GET /analytics/page-views — devuelve los últimos 30 días (solo admin)
 */
analyticsRoutes.get('/page-views', async (c) => {
  try {
    const user = c.get('user');
    if (user?.email !== 'admin@neurai.dev') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const listed = await c.env.CACHE.list({ prefix: PAGE_VIEWS_PREFIX });
    const days = await Promise.all(
      listed.keys.map(async ({ name }) => {
        const val = await c.env.CACHE.get(name, 'json') as { date: string; count: number } | null;
        return val;
      })
    );

    const sorted = days
      .filter(Boolean)
      .sort((a, b) => (a!.date > b!.date ? -1 : 1))
      .slice(0, 30);

    return c.json({ views: sorted });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get page views' }, 500);
  }
});

/**
 * GET /analytics/dashboard
 * Estadísticas generales para admin
 */
analyticsRoutes.get('/dashboard', async (c) => {
  try {
    const user = c.get('user');

    // Por ahora, cualquier usuario puede ver stats básicas
    // En producción, agregar validación de rol admin

    // Total de usuarios
    const totalUsers = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first();

    // Total de conductores
    const totalDrivers = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM drivers'
    ).first();

    // Conductores activos (disponibles ahora)
    const activeDrivers = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM drivers WHERE is_available = 1 AND verification_status = ?'
    )
      .bind('approved')
      .first();

    // Total de viajes
    const totalTrips = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM trips'
    ).first();

    // Viajes completados
    const completedTrips = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM trips WHERE status = ?'
    )
      .bind('completed')
      .first();

    // Viajes activos
    const activeTrips = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM trips
       WHERE status IN ('requested', 'accepted', 'in_progress')`
    ).first();

    // Ingresos totales
    const totalRevenue = await c.env.DB.prepare(
      'SELECT SUM(fare) as total FROM trips WHERE status = ?'
    )
      .bind('completed')
      .first();

    // Ingresos hoy
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayRevenue = await c.env.DB.prepare(
      'SELECT SUM(fare) as total FROM trips WHERE status = ? AND completed_at >= ?'
    )
      .bind('completed', todayStart)
      .first();

    // Promedio de calificación de conductores
    const avgDriverRating = await c.env.DB.prepare(
      'SELECT AVG(rating) as avg FROM drivers WHERE rating > 0'
    ).first();

    // Top 5 conductores
    const topDrivers = await c.env.DB.prepare(
      `SELECT
        d.id,
        u.full_name,
        d.rating,
        d.total_trips,
        SUM(t.fare) as total_earnings
       FROM drivers d
       LEFT JOIN users u ON d.id = u.id
       LEFT JOIN trips t ON d.id = t.driver_id AND t.status = 'completed'
       GROUP BY d.id
       ORDER BY d.total_trips DESC
       LIMIT 5`
    ).all();

    return c.json({
      stats: {
        users: {
          total: totalUsers?.count || 0,
          drivers: totalDrivers?.count || 0,
          passengers: (totalUsers?.count as number || 0) - (totalDrivers?.count as number || 0),
          active_drivers: activeDrivers?.count || 0,
        },
        trips: {
          total: totalTrips?.count || 0,
          completed: completedTrips?.count || 0,
          active: activeTrips?.count || 0,
          completion_rate:
            ((completedTrips?.count as number || 0) / (totalTrips?.count as number || 1)) * 100,
        },
        revenue: {
          total: totalRevenue?.total || 0,
          today: todayRevenue?.total || 0,
          average_per_trip:
            (totalRevenue?.total as number || 0) / (completedTrips?.count as number || 1),
        },
        quality: {
          avg_driver_rating: avgDriverRating?.avg || 0,
        },
      },
      top_drivers: topDrivers.results || [],
    });
  } catch (error: any) {
    console.error('Get dashboard error:', error);
    return c.json({ error: error.message || 'Failed to get dashboard stats' }, 500);
  }
});

/**
 * GET /analytics/driver-earnings
 * Estadísticas de ganancias del conductor
 */
analyticsRoutes.get('/driver-earnings', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'driver') {
      return c.json({ error: 'Only drivers can view earnings stats' }, 403);
    }

    // Ganancias totales
    const totalEarnings = await c.env.DB.prepare(
      'SELECT SUM(fare) as total FROM trips WHERE driver_id = ? AND status = ?'
    )
      .bind(user.id, 'completed')
      .first();

    // Ganancias hoy
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayEarnings = await c.env.DB.prepare(
      'SELECT SUM(fare) as total FROM trips WHERE driver_id = ? AND status = ? AND completed_at >= ?'
    )
      .bind(user.id, 'completed', todayStart)
      .first();

    // Ganancias esta semana
    const weekStart = Math.floor(new Date().setDate(new Date().getDate() - 7) / 1000);
    const weekEarnings = await c.env.DB.prepare(
      'SELECT SUM(fare) as total FROM trips WHERE driver_id = ? AND status = ? AND completed_at >= ?'
    )
      .bind(user.id, 'completed', weekStart)
      .first();

    // Ganancias este mes
    const monthStart = Math.floor(new Date().setDate(1) / 1000);
    const monthEarnings = await c.env.DB.prepare(
      'SELECT SUM(fare) as total FROM trips WHERE driver_id = ? AND status = ? AND completed_at >= ?'
    )
      .bind(user.id, 'completed', monthStart)
      .first();

    // Total de viajes
    const totalTrips = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM trips WHERE driver_id = ? AND status = ?'
    )
      .bind(user.id, 'completed')
      .first();

    // Viajes hoy
    const todayTrips = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM trips WHERE driver_id = ? AND status = ? AND completed_at >= ?'
    )
      .bind(user.id, 'completed', todayStart)
      .first();

    // Promedio por viaje
    const avgPerTrip =
      (totalEarnings?.total as number || 0) / (totalTrips?.count as number || 1);

    // Ganancias por día de la última semana
    const dailyEarnings = await c.env.DB.prepare(
      `SELECT
        DATE(completed_at, 'unixepoch') as date,
        SUM(fare) as total,
        COUNT(*) as trips
       FROM trips
       WHERE driver_id = ? AND status = ? AND completed_at >= ?
       GROUP BY DATE(completed_at, 'unixepoch')
       ORDER BY date DESC`
    )
      .bind(user.id, 'completed', weekStart)
      .all();

    return c.json({
      earnings: {
        total: totalEarnings?.total || 0,
        today: todayEarnings?.total || 0,
        week: weekEarnings?.total || 0,
        month: monthEarnings?.total || 0,
        average_per_trip: avgPerTrip,
      },
      trips: {
        total: totalTrips?.count || 0,
        today: todayTrips?.count || 0,
      },
      daily_breakdown: dailyEarnings.results || [],
    });
  } catch (error: any) {
    console.error('Get driver earnings error:', error);
    return c.json({ error: error.message || 'Failed to get earnings stats' }, 500);
  }
});

/**
 * GET /analytics/trip-trends
 * Tendencias de viajes por hora/día
 */
analyticsRoutes.get('/trip-trends', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7');

    const startTimestamp = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    // Viajes por día
    const tripsByDay = await c.env.DB.prepare(
      `SELECT
        DATE(created_at, 'unixepoch') as date,
        COUNT(*) as total_trips,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_trips,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
        AVG(fare) as avg_fare
       FROM trips
       WHERE created_at >= ?
       GROUP BY DATE(created_at, 'unixepoch')
       ORDER BY date DESC`
    )
      .bind(startTimestamp)
      .all();

    // Viajes por hora del día (promedio)
    const tripsByHour = await c.env.DB.prepare(
      `SELECT
        CAST(strftime('%H', created_at, 'unixepoch') AS INTEGER) as hour,
        COUNT(*) as avg_trips,
        AVG(fare) as avg_fare
       FROM trips
       WHERE created_at >= ?
       GROUP BY hour
       ORDER BY hour`
    )
      .bind(startTimestamp)
      .all();

    return c.json({
      by_day: tripsByDay.results || [],
      by_hour: tripsByHour.results || [],
    });
  } catch (error: any) {
    console.error('Get trip trends error:', error);
    return c.json({ error: error.message || 'Failed to get trip trends' }, 500);
  }
});

/**
 * GET /analytics/top-routes
 * Rutas completas (origen → destino) más frecuentes — solo admin
 */
analyticsRoutes.get('/top-routes', authMiddleware, async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const days = parseInt(c.req.query('days') || '30');
    const startTimestamp = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    const routes = await c.env.DB.prepare(
      `SELECT
        pickup_address,
        dropoff_address,
        COUNT(*) as trip_count
       FROM trips
       WHERE created_at >= ?
         AND pickup_address IS NOT NULL
         AND dropoff_address IS NOT NULL
         AND status = 'completed'
       GROUP BY pickup_address, dropoff_address
       ORDER BY trip_count DESC
       LIMIT ?`
    )
      .bind(startTimestamp, limit)
      .all();

    return c.json({ routes: routes.results || [] });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get top routes' }, 500);
  }
});

/**
 * GET /analytics/heatmap
 * Mapa de calor de zonas con más viajes
 */
analyticsRoutes.get('/heatmap', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7');
    const startTimestamp = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    // Puntos de recogida más populares
    const pickupHotspots = await c.env.DB.prepare(
      `SELECT
        pickup_latitude,
        pickup_longitude,
        pickup_address,
        COUNT(*) as trip_count
       FROM trips
       WHERE created_at >= ? AND pickup_latitude IS NOT NULL
       GROUP BY ROUND(pickup_latitude, 3), ROUND(pickup_longitude, 3)
       ORDER BY trip_count DESC
       LIMIT 20`
    )
      .bind(startTimestamp)
      .all();

    // Puntos de destino más populares
    const dropoffHotspots = await c.env.DB.prepare(
      `SELECT
        dropoff_latitude,
        dropoff_longitude,
        dropoff_address,
        COUNT(*) as trip_count
       FROM trips
       WHERE created_at >= ? AND dropoff_latitude IS NOT NULL
       GROUP BY ROUND(dropoff_latitude, 3), ROUND(dropoff_longitude, 3)
       ORDER BY trip_count DESC
       LIMIT 20`
    )
      .bind(startTimestamp)
      .all();

    return c.json({
      pickup_hotspots: pickupHotspots.results || [],
      dropoff_hotspots: dropoffHotspots.results || [],
    });
  } catch (error: any) {
    console.error('Get heatmap error:', error);
    return c.json({ error: error.message || 'Failed to get heatmap data' }, 500);
  }
});

/**
 * GET /analytics/demand-prediction
 * "IA" de predicción de demanda por zona y hora.
 *
 * Modelo estadístico (no ML): agrupa los viajes históricos por zona geográfica
 * (lat/lng redondeado), día de la semana y hora, y predice las zonas con mayor
 * demanda esperada para la próxima hora. Explicable y funciona con pocos datos.
 *
 * Query params:
 *   - hours_ahead: para qué hora predecir (default 1 = próxima hora)
 *   - days: cuánto histórico usar (default 60)
 *   - limit: cuántas zonas devolver (default 5)
 */
analyticsRoutes.get('/demand-prediction', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    // Solo conductores con el add-on premium activo (o admin/exentos) acceden
    const EXEMPT = ['julii1295@gmail.com', 'alexriob@gmail.com', 'admin@neurai.dev'];
    const isExempt = EXEMPT.includes(user.email?.toLowerCase());
    if (!isExempt) {
      const now = Math.floor(Date.now() / 1000);
      const premium = await c.env.DB.prepare(
        `SELECT current_period_end FROM driver_premium
         WHERE user_id = ? AND feature = 'demand_prediction' AND status = 'active' LIMIT 1`
      ).bind(user.id).first() as any;
      const active = !!premium && premium.current_period_end && now < (premium.current_period_end as number);
      if (!active) {
        return c.json({ error: 'premium_required', message: 'Activa la predicción de demanda para acceder.' }, 402);
      }
    }

    const daysHistory = Math.min(parseInt(c.req.query('days') || '60'), 180);
    const hoursAhead = parseInt(c.req.query('hours_ahead') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '5'), 20);

    // Hora objetivo (la próxima hora por defecto), en hora local de Colombia (UTC-5)
    const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;
    const target = new Date(Date.now() + hoursAhead * 60 * 60 * 1000 + COLOMBIA_OFFSET_MS);
    const targetHour = target.getUTCHours();        // 0-23
    const targetDow = target.getUTCDay();           // 0=domingo ... 6=sábado

    const startTimestamp = Math.floor(Date.now() / 1000) - daysHistory * 24 * 60 * 60;

    // Agrupa viajes por zona (lat/lng redondeado ~110m) en la misma franja
    // horaria y mismo día de la semana que la hora objetivo.
    // strftime con offset '-5 hours' convierte el timestamp UTC a hora local CO.
    const rows = await c.env.DB.prepare(
      `SELECT
        ROUND(pickup_latitude, 3)  AS lat,
        ROUND(pickup_longitude, 3) AS lng,
        pickup_address             AS address,
        COUNT(*)                   AS trips,
        COUNT(DISTINCT DATE(created_at, 'unixepoch', '-5 hours')) AS active_days
       FROM trips
       WHERE created_at >= ?
         AND pickup_latitude IS NOT NULL
         AND pickup_longitude IS NOT NULL
         AND CAST(strftime('%H', created_at, 'unixepoch', '-5 hours') AS INTEGER) = ?
         AND CAST(strftime('%w', created_at, 'unixepoch', '-5 hours') AS INTEGER) = ?
       GROUP BY lat, lng
       ORDER BY trips DESC
       LIMIT ?`
    )
      .bind(startTimestamp, targetHour, targetDow, limit)
      .all();

    const results = (rows.results || []) as any[];

    // Cuántas veces ha ocurrido esa franja (mismo dow) en el histórico,
    // para estimar un promedio de viajes esperados por ocurrencia.
    const weeksInHistory = Math.max(1, Math.floor(daysHistory / 7));

    const DOW_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const hour12 = ((targetHour + 11) % 12) + 1;
    const ampm = targetHour < 12 ? 'a.m.' : 'p.m.';

    const zones = results.map((r) => {
      const trips = r.trips as number;
      // Demanda esperada = promedio de viajes en esa franja por semana
      const expected = trips / weeksInHistory;
      // Confianza: cuántas franjas distintas tuvieron actividad (más días = más fiable)
      const confidence = Math.min(1, (r.active_days as number) / weeksInHistory);
      return {
        latitude: r.lat as number,
        longitude: r.lng as number,
        address: (r.address as string) || 'Zona sin nombre',
        historical_trips: trips,
        expected_demand: Math.round(expected * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        score: Math.round(expected * (0.5 + confidence / 2) * 10) / 10,
      };
    });

    // Ordena por score (demanda ponderada por confianza)
    zones.sort((a, b) => b.score - a.score);

    const top = zones[0];
    const summary = top
      ? `Los ${DOW_NAMES[targetDow]} alrededor de las ${hour12} ${ampm}, la zona de ${top.address} suele tener la mayor demanda (${top.historical_trips} viajes históricos en esta franja).`
      : `Aún no hay suficientes datos históricos para predecir la demanda de los ${DOW_NAMES[targetDow]} a las ${hour12} ${ampm}.`;

    return c.json({
      target: {
        hour: targetHour,
        hour_label: `${hour12} ${ampm}`,
        day_of_week: targetDow,
        day_label: DOW_NAMES[targetDow],
      },
      based_on_days: daysHistory,
      zones,
      summary,
      has_data: zones.length > 0,
    });
  } catch (error: any) {
    console.error('Get demand prediction error:', error);
    return c.json({ error: error.message || 'Failed to get demand prediction' }, 500);
  }
});

/**
 * GET /analytics/ai-data-status
 * Resumen del estado de recolección de datos para la herramienta de IA.
 * Solo admin. Indica cuántos viajes/zonas/rutas hay y si ya es viable activar
 * la predicción de demanda.
 */
analyticsRoutes.get('/ai-data-status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (user?.email?.toLowerCase() !== 'admin@neurai.dev') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Umbral sugerido de viajes con GPS completados para activar la IA
    const THRESHOLD = 200;

    // Total de viajes y cuántos tienen GPS / están completados
    const totals = await c.env.DB.prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pickup_latitude IS NOT NULL THEN 1 ELSE 0 END) AS con_gps,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completados,
        SUM(CASE WHEN route_polyline IS NOT NULL THEN 1 ELSE 0 END) AS con_ruta
       FROM trips`
    ).first() as any;

    // Zonas distintas de recogida (lat/lng redondeado ~110m)
    const zonas = await c.env.DB.prepare(
      `SELECT COUNT(*) AS zonas FROM (
        SELECT 1 FROM trips
        WHERE pickup_latitude IS NOT NULL
        GROUP BY ROUND(pickup_latitude, 3), ROUND(pickup_longitude, 3)
      )`
    ).first() as any;

    // Franjas horarias cubiertas (combinación día de semana + hora con viajes)
    const franjas = await c.env.DB.prepare(
      `SELECT COUNT(*) AS franjas FROM (
        SELECT 1 FROM trips
        WHERE pickup_latitude IS NOT NULL
        GROUP BY strftime('%w', created_at, 'unixepoch', '-5 hours'),
                 strftime('%H', created_at, 'unixepoch', '-5 hours')
      )`
    ).first() as any;

    // Rutas origen→destino más frecuentes (top 10)
    const rutas = await c.env.DB.prepare(
      `SELECT pickup_address, dropoff_address, COUNT(*) AS trips
       FROM trips
       WHERE pickup_address IS NOT NULL AND dropoff_address IS NOT NULL
       GROUP BY pickup_address, dropoff_address
       ORDER BY trips DESC
       LIMIT 10`
    ).all();

    // Viajes por día (últimos 14 días) para ver la tendencia de recolección
    const porDia = await c.env.DB.prepare(
      `SELECT DATE(created_at, 'unixepoch', '-5 hours') AS dia, COUNT(*) AS trips
       FROM trips
       WHERE created_at >= ?
       GROUP BY dia
       ORDER BY dia DESC`
    ).bind(Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60).all();

    const conGps = (totals?.con_gps as number) || 0;
    const progreso = Math.min(100, Math.round((conGps / THRESHOLD) * 100));

    return c.json({
      threshold: THRESHOLD,
      progreso_porcentaje: progreso,
      listo_para_ia: conGps >= THRESHOLD,
      totales: {
        viajes_total: (totals?.total as number) || 0,
        con_gps: conGps,
        completados: (totals?.completados as number) || 0,
        con_ruta_polyline: (totals?.con_ruta as number) || 0,
        zonas_distintas: (zonas?.zonas as number) || 0,
        franjas_horarias_cubiertas: (franjas?.franjas as number) || 0,
      },
      rutas_frecuentes: rutas.results || [],
      viajes_por_dia: porDia.results || [],
    });
  } catch (error: any) {
    console.error('Get AI data status error:', error);
    return c.json({ error: error.message || 'Failed to get AI data status' }, 500);
  }
});

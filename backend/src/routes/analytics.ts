import { Hono } from 'hono';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';

export const analyticsRoutes = new Hono<{ Bindings: Env }>();

// Rutas de analytics requieren autenticación
analyticsRoutes.use('*', authMiddleware);

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

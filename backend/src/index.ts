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

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CACHE: KVNamespace;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  WOMPI_PUBLIC_KEY?: string;
  WOMPI_PRIVATE_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'MoTaxi API - Cloudflare Workers',
    version: '1.0.0',
    status: 'healthy',
  });
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

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    error: err.message || 'Internal Server Error',
  }, 500);
});

export default app;

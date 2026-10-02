import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h cache para imágenes
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '0dwas2ied3dcs14f.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
  },
  // El uso de MoTaxi (conductor y pasajero) ocurre en la app nativa. Cualquier acceso web
  // a esas pantallas lleva a /app, que abre la app o envía a la tienda del celular.
  // Las pantallas originales siguen en el código; para reactivarlas basta con quitar
  // estas redirecciones. El panel de administrador (/admin) y su ingreso se conservan:
  // /auth/login solo queda accesible con ?admin=1.
  async redirects() {
    const toApp = '/app';
    return [
      { source: '/driver', destination: toApp, permanent: false },
      { source: '/driver/:path*', destination: toApp, permanent: false },
      { source: '/passenger', destination: toApp, permanent: false },
      { source: '/passenger/:path*', destination: toApp, permanent: false },
      { source: '/conductor', destination: toApp, permanent: false },
      { source: '/auth/register', destination: toApp, permanent: false },
      { source: '/auth/role-selection', destination: toApp, permanent: false },
      { source: '/auth/complete-profile', destination: toApp, permanent: false },
      { source: '/auth/en-tramite', destination: toApp, permanent: false },
      { source: '/sso-callback', destination: toApp, permanent: false },
      {
        source: '/auth/login',
        missing: [{ type: 'query', key: 'admin' }],
        destination: toApp,
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // Imágenes y fuentes públicas
        source: '/:path*(png|jpg|jpeg|gif|svg|ico|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
  },
};

export default nextConfig;

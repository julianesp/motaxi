import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Definir rutas públicas que NO requieren autenticación de Clerk
// IMPORTANTE: Hacemos todas las rutas públicas para Clerk porque usamos autenticación personalizada
const isPublicRoute = createRouteMatcher([
  '/(.*)', // Todas las rutas son públicas para Clerk
]);

export default clerkMiddleware(async (auth, request) => {
  // No proteger ninguna ruta con Clerk, ya que usamos autenticación personalizada
  // El AuthContext se encarga de la protección de rutas
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

// Enlaces de descarga de la app nativa de MoTaxi.
// El ID de paquete es el mismo en Android (Play Store) y en los enlaces de app verificados.
export const APP_PACKAGE = 'com.motaxi.app';

// Esquema propio de la app (app.config.js -> scheme). Sirve para abrirla desde el navegador.
export const APP_SCHEME = 'motaxi';

// Google Play. Se puede sobrescribir con NEXT_PUBLIC_PLAY_STORE_URL (por ejemplo, con
// el enlace de prueba abierta mientras la ficha pública no esté disponible).
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ||
  `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;

// Todavía no hay versión para iPhone ni para Huawei (AppGallery requiere una versión con
// los servicios de Huawei: mapas y notificaciones). Se muestran avisos en su lugar.
export const IOS_STORE_URL: string | null = null;
export const HUAWEI_STORE_URL: string | null = null;

export type DevicePlatform = 'android' | 'huawei' | 'ios' | 'desktop';

/** Detecta el tipo de celular por el user agent. Huawei/Honor sin servicios de Google se separan. */
export function detectPlatform(userAgent: string): DevicePlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) {
    // Huawei/Honor (HMS): tienda propia, sin servicios de Google
    if (/huawei|honor|hmscore|hms\b|harmonyos/.test(ua)) return 'huawei';
    return 'android';
  }
  return 'desktop';
}

/**
 * Enlace "intent" de Android: abre la app si está instalada y, si no, lleva a Google Play.
 * Funciona en Chrome para Android sin esperas ni trucos de temporizador.
 */
export function androidIntentUrl(path = ''): string {
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return (
    `intent://open${path}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

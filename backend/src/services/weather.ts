/**
 * Clima actual del Alto Putumayo desde la Weather API de Google Maps Platform
 * (currentConditions:lookup). La app lo usa para que la pantalla de inicio muestre el
 * ambiente real (lluvia, niebla, despejado…). Requiere habilitar "Weather API" en el
 * proyecto de Google Cloud de la clave.
 */

// Punto de consulta: casco urbano de Sibundoy, centro del valle
const LAT = 1.2054;
const LNG = -76.916;
const CACHE_KEY = 'weather:alto-putumayo:v1';
const CACHE_TTL_S = 600; // Google actualiza las condiciones cada pocos minutos

/** Ambientes que dibuja la app. */
export type Ambience = 'clear' | 'partly_cloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm';

export interface AltoPutumayoWeather {
  ambience: Ambience;
  /** Tipo original de Google (WeatherCondition.Type) */
  type: string;
  /** Descripción en español de Google, p. ej. "Lluvia ligera" */
  description: string;
  temperature: number | null;
  isDaytime: boolean | null;
  humidity: number | null;
  cloudCover: number | null;
  visibilityKm: number | null;
  /** Hora de la observación (ISO) */
  observedAt: string | null;
  place: string;
  source: 'google';
}

const STORM = new Set([
  'THUNDERSTORM', 'THUNDERSHOWER', 'LIGHT_THUNDERSTORM_RAIN', 'SCATTERED_THUNDERSTORMS',
  'HEAVY_THUNDERSTORM',
]);
const DRIZZLE = new Set([
  'LIGHT_RAIN_SHOWERS', 'CHANCE_OF_SHOWERS', 'SCATTERED_SHOWERS', 'LIGHT_RAIN',
  'LIGHT_TO_MODERATE_RAIN',
]);
const CLOUDY = new Set(['MOSTLY_CLOUDY', 'CLOUDY', 'WINDY']);

function toAmbience(type: string, visibilityKm: number | null): Ambience {
  if (STORM.has(type)) return 'storm';
  if (DRIZZLE.has(type)) return 'drizzle';
  // Resto de lluvias, granizo y (por si acaso) nieve
  if (/RAIN|SHOWER|HAIL|SNOW/.test(type)) return 'rain';
  // Google no tiene un tipo "niebla": se deduce de la visibilidad
  if (visibilityKm != null && visibilityKm < 1.5) return 'fog';
  if (CLOUDY.has(type)) return 'cloudy';
  if (type === 'PARTLY_CLOUDY') return 'partly_cloudy';
  return 'clear';
}

export async function getAltoPutumayoWeather(
  apiKey: string | undefined,
  cache?: KVNamespace
): Promise<{ weather: AltoPutumayoWeather | null; error?: string }> {
  const cached = await cache?.get(CACHE_KEY, 'json').catch(() => null);
  if (cached) return cached as { weather: AltoPutumayoWeather | null; error?: string };

  if (!apiKey) return { weather: null, error: 'missing_api_key' };

  let result: { weather: AltoPutumayoWeather | null; error?: string };
  try {
    const params = new URLSearchParams({
      key: apiKey,
      'location.latitude': String(LAT),
      'location.longitude': String(LNG),
      languageCode: 'es',
    });
    const res = await fetch(`https://weather.googleapis.com/v1/currentConditions:lookup?${params}`);
    const data: any = await res.json();
    if (!res.ok) {
      result = { weather: null, error: data?.error?.status || `http_${res.status}` };
    } else {
      const type: string = data?.weatherCondition?.type || 'TYPE_UNSPECIFIED';
      const vis = data?.visibility?.distance;
      const visibilityKm =
        typeof vis === 'number' ? (data.visibility.unit === 'MILES' ? vis * 1.609 : vis) : null;
      result = {
        weather: {
          ambience: toAmbience(type, visibilityKm),
          type,
          description: data?.weatherCondition?.description?.text || '',
          temperature:
            typeof data?.temperature?.degrees === 'number'
              ? Math.round(data.temperature.degrees)
              : null,
          isDaytime: typeof data?.isDaytime === 'boolean' ? data.isDaytime : null,
          humidity: data?.relativeHumidity ?? null,
          cloudCover: data?.cloudCover ?? null,
          visibilityKm,
          observedAt: data?.currentTime ?? null,
          place: 'Sibundoy',
          source: 'google',
        },
      };
    }
  } catch (e: any) {
    result = { weather: null, error: 'fetch_failed' };
  }

  // Los errores se guardan poco tiempo para no consultar a Google en cada apertura
  await cache
    ?.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: result.weather ? CACHE_TTL_S : 120 })
    .catch(() => {});
  return result;
}

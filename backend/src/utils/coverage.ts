import { ALTO_PUTUMAYO_POLYGON } from './alto-putumayo-polygon';

/**
 * Cobertura geográfica de MoTaxi.
 *
 * MoTaxi opera exclusivamente en el Alto Putumayo (Valle de Sibundoy y
 * alrededores: Sibundoy, Santiago, Colón y San Francisco). Estos límites son la
 * ÚNICA fuente de verdad del backend: cualquier filtro o validación de zona debe
 * usar estas constantes en lugar de valores hardcodeados.
 *
 * Deben mantenerse en paridad con:
 *  - App:  appsMobile/motaxi/src/config/coverage.ts (ALTO_PUTUMAYO_BOUNDS)
 *  - Web:  sites/motaxi/lib/constants/municipalities.ts (VALLE_BOUNDS)
 */

// Rectángulo que encierra el polígono de los 4 municipios (con sus veredas). Sirve para
// filtros SQL y búsquedas; la validación fina la hace isWithinCoverage con el polígono.
export const COVERAGE_BOUNDS = {
  latMin: 0.9761,
  latMax: 1.3238,
  lonMin: -77.1044,
  lonMax: -76.7276,
};

/** Punto dentro del polígono del Alto Putumayo (ray casting). */
function insidePolygon(latitude: number, longitude: number): boolean {
  let inside = false;
  const poly = ALTO_PUTUMAYO_POLYGON;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [latI, lonI] = poly[i];
    const [latJ, lonJ] = poly[j];
    if (
      latI > latitude !== latJ > latitude &&
      longitude < ((lonJ - lonI) * (latitude - latI)) / (latJ - latI) + lonI
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export const COVERAGE_LABEL = 'Alto Putumayo (Valle de Sibundoy)';

/** Indica si una coordenada está dentro de la zona de cobertura. */
export function isWithinCoverage(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (
    latitude == null ||
    longitude == null ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return false;
  }
  return (
    latitude >= COVERAGE_BOUNDS.latMin &&
    latitude <= COVERAGE_BOUNDS.latMax &&
    longitude >= COVERAGE_BOUNDS.lonMin &&
    longitude <= COVERAGE_BOUNDS.lonMax &&
    insidePolygon(latitude, longitude)
  );
}

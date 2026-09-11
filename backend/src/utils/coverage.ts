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

// Bounding box del Alto Putumayo.
export const COVERAGE_BOUNDS = {
  latMin: 0.9,
  latMax: 1.35,
  lonMin: -77.05,
  lonMax: -76.65,
};

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
    longitude <= COVERAGE_BOUNDS.lonMax
  );
}

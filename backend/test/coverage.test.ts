import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isWithinCoverage, COVERAGE_BOUNDS } from '../src/utils/coverage';
import { ALTO_PUTUMAYO_POLYGON } from '../src/utils/alto-putumayo-polygon';
import { PLACES } from './helpers/fixtures';

describe('Cobertura geográfica (utils/coverage)', () => {
  it.each([
    ['Sibundoy', PLACES.sibundoy],
    ['Colón', PLACES.colon],
    ['Santiago', PLACES.santiago],
    ['San Francisco', PLACES.sanFrancisco],
  ])('PB-COB-01 acepta el casco urbano de %s', (_name, p) => {
    expect(isWithinCoverage(p.lat, p.lon)).toBe(true);
  });

  it.each([
    ['Pasto (Nariño)', PLACES.pasto],
    ['Mocoa (Bajo Putumayo)', PLACES.mocoa],
    ['Bogotá', { lat: 4.711, lon: -74.0721 }],
  ])('PB-COB-02 rechaza %s, fuera del Alto Putumayo', (_name, p) => {
    expect(isWithinCoverage(p.lat, p.lon)).toBe(false);
  });

  it('PB-COB-03 rechaza coordenadas ausentes o inválidas', () => {
    expect(isWithinCoverage(null, -76.9)).toBe(false);
    expect(isWithinCoverage(1.2, undefined)).toBe(false);
    expect(isWithinCoverage(NaN, -76.9)).toBe(false);
  });

  it('PB-COB-04 rechaza un punto dentro del rectángulo pero fuera del polígono', () => {
    // Esquina noroeste del rectángulo: está en la caja pero no en los municipios
    expect(isWithinCoverage(COVERAGE_BOUNDS.latMax - 0.001, COVERAGE_BOUNDS.lonMin + 0.001)).toBe(false);
  });

  it('PB-COB-05 el polígono es válido: más de 3 vértices y todos dentro del rectángulo', () => {
    expect(ALTO_PUTUMAYO_POLYGON.length).toBeGreaterThan(3);
    for (const [lat, lon] of ALTO_PUTUMAYO_POLYGON) {
      expect(lat).toBeGreaterThanOrEqual(COVERAGE_BOUNDS.latMin);
      expect(lat).toBeLessThanOrEqual(COVERAGE_BOUNDS.latMax);
      expect(lon).toBeGreaterThanOrEqual(COVERAGE_BOUNDS.lonMin);
      expect(lon).toBeLessThanOrEqual(COVERAGE_BOUNDS.lonMax);
    }
  });

  // La app valida la cobertura antes de enviar la solicitud con una copia del polígono:
  // si las dos copias difieren, la app y el servidor darían respuestas distintas.
  const appPolygon = join(__dirname, '../../../../appsMobile/motaxi/src/config/altoPutumayoPolygon.ts');
  it.skipIf(!existsSync(appPolygon))('PB-COB-06 el polígono de la app es idéntico al del backend', () => {
    const vertices = (src: string) => src.slice(src.indexOf('= [')).replace(/\s+/g, '');
    const backend = readFileSync(join(__dirname, '../src/utils/alto-putumayo-polygon.ts'), 'utf8');
    expect(vertices(readFileSync(appPolygon, 'utf8'))).toBe(vertices(backend));
  });
});

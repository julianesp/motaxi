import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SERVICE_PAUSED_MESSAGE, getServiceStatus } from '../src/utils/service-status';
import { call, createTestD1, createUser, PLACES, setServicePaused, getRow, type TestDB } from './helpers/fixtures';

const tripBody = {
  pickup_latitude: PLACES.sibundoy.lat,
  pickup_longitude: PLACES.sibundoy.lon,
  pickup_address: 'Parque Sibundoy',
  dropoff_latitude: PLACES.colon.lat,
  dropoff_longitude: PLACES.colon.lon,
  dropoff_address: 'Parque Colón',
  distance_km: 6,
  estimated_fare: 8000,
  trip_type: 'ride',
};

describe('Pausa del servicio de viajes', () => {
  let db: TestDB;
  beforeEach(() => {
    db = createTestD1();
  });

  it('PB-PAU-01 sin configuración el servicio se considera PAUSADO (falla segura)', async () => {
    const status = await getServiceStatus(db);
    expect(status).toEqual({ paused: true, message: DEFAULT_SERVICE_PAUSED_MESSAGE });
  });

  it('PB-PAU-02 con service_paused = 0 el servicio está activo', async () => {
    setServicePaused(db, false);
    expect((await getServiceStatus(db)).paused).toBe(false);
  });

  it('PB-PAU-03 usa el mensaje configurado por el administrador', async () => {
    setServicePaused(db, true, 'Volvemos el lunes');
    expect((await getServiceStatus(db)).message).toBe('Volvemos el lunes');
  });

  it('PB-PAU-04 GET /app/service es público y devuelve el estado', async () => {
    const res = await call(db, 'GET', '/app/service');
    expect(res.status).toBe(200);
    expect(res.body.paused).toBe(true);
  });

  it('PB-PAU-05 con el servicio pausado POST /trips responde 503 y no crea el viaje', async () => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', { token: p.token, body: tripBody });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVICE_PAUSED');
    expect(res.body.error).toBe(DEFAULT_SERVICE_PAUSED_MESSAGE);
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM trips').n).toBe(0);
  });

  it('PB-PAU-06 al reanudar el servicio POST /trips vuelve a crear viajes', async () => {
    setServicePaused(db, false);
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', { token: p.token, body: tripBody });
    expect(res.status).toBe(201);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  call,
  createTestD1,
  createTrip,
  createUser,
  getRow,
  PLACES,
  setServicePaused,
  type TestDB,
} from './helpers/fixtures';

const tripBody = (over: Record<string, unknown> = {}) => ({
  pickup_latitude: PLACES.sibundoy.lat,
  pickup_longitude: PLACES.sibundoy.lon,
  pickup_address: 'Parque Sibundoy',
  dropoff_latitude: PLACES.colon.lat,
  dropoff_longitude: PLACES.colon.lon,
  dropoff_address: 'Parque Colón',
  distance_km: 6,
  estimated_fare: 8000,
  trip_type: 'ride',
  ...over,
});

describe('Solicitud de viajes (POST /trips)', () => {
  let db: TestDB;
  beforeEach(() => {
    db = createTestD1();
    setServicePaused(db, false);
  });

  it('PB-VIA-01 un pasajero crea una solicitud dentro de la cobertura (201)', async () => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', { token: p.token, body: tripBody() });
    expect(res.status).toBe(201);
    expect(res.body.trip.status).toBe('requested');
    expect(res.body.trip.passenger_id).toBe(p.id);
    expect(res.body.trip.fare).toBe(8000);
    expect(res.body.trip.trip_type).toBe('ride');
  });

  it.each(['delivery', 'cargo'])(
    'PB-VIA-01b ya no acepta solicitudes de tipo "%s" (solo pasajeros en taxi, 422)',
    async (trip_type) => {
      const p = createUser(db, 'passenger');
      const res = await call(db, 'POST', '/trips', { token: p.token, body: tripBody({ trip_type }) });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('SERVICE_TYPE_NOT_AVAILABLE');
      expect(getRow(db, 'SELECT COUNT(*) AS n FROM trips').n).toBe(0);
    }
  );

  it('PB-VIA-01c la subida de fotos de paquetes está retirada (410)', async () => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips/package-photo', { token: p.token, body: {} });
    expect(res.status).toBe(410);
  });

  it('PB-VIA-02 la recogida a domicilio suma $1.000 a la tarifa', async () => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', { token: p.token, body: tripBody({ home_pickup: true }) });
    expect(res.status).toBe(201);
    expect(res.body.trip.fare).toBe(9000);
    expect(res.body.trip.home_pickup).toBe(1);
  });

  it('PB-VIA-03 un conductor no puede crear solicitudes (403)', async () => {
    const d = createUser(db, 'driver');
    const res = await call(db, 'POST', '/trips', { token: d.token, body: tripBody() });
    expect(res.status).toBe(403);
  });

  it('PB-VIA-04 rechaza una recogida fuera del Alto Putumayo (422)', async () => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', {
      token: p.token,
      body: tripBody({ pickup_latitude: PLACES.pasto.lat, pickup_longitude: PLACES.pasto.lon }),
    });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ out_of_coverage: true, pickup_ok: false, dropoff_ok: true });
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM trips').n).toBe(0);
  });

  it('PB-VIA-05 rechaza un destino fuera del Alto Putumayo (422)', async () => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', {
      token: p.token,
      body: tripBody({ dropoff_latitude: PLACES.mocoa.lat, dropoff_longitude: PLACES.mocoa.lon }),
    });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ pickup_ok: true, dropoff_ok: false });
  });

  it('PB-VIA-06 rechaza una solicitud sin coordenadas (422)', async () => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', {
      token: p.token,
      body: tripBody({ pickup_latitude: undefined, pickup_longitude: undefined }),
    });
    expect(res.status).toBe(422);
  });

  it.each([
    ['sin tarifa', undefined],
    ['en cero', 0],
    ['menor a $1.000', 500],
    ['como texto', '8000'],
  ])('PB-VIA-06b rechaza una solicitud con la tarifa %s (400)', async (_c, estimated_fare) => {
    const p = createUser(db, 'passenger');
    const res = await call(db, 'POST', '/trips', { token: p.token, body: tripBody({ estimated_fare }) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FARE');
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM trips').n).toBe(0);
  });
});

describe('Aceptación de viajes (PUT /trips/:id/accept)', () => {
  let db: TestDB;
  let passenger: { id: string; token: string };
  beforeEach(() => {
    db = createTestD1();
    passenger = createUser(db, 'passenger');
  });

  it('PB-VIA-07 el conductor acepta y se cobra la tarifa que el pasajero confirmó', async () => {
    const d = createUser(db, 'driver', { base_fare: 5000, per_km_fare: 2000, is_available: 1 });
    const tripId = createTrip(db, passenger.id, { distance_km: 6 }); // tarifa confirmada: 8000
    const res = await call(db, 'PUT', `/trips/${tripId}/accept`, { token: d.token });
    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('accepted');
    expect(res.body.trip.driver_id).toBe(d.id);
    expect(res.body.trip.fare).toBe(8000);
    expect(getRow(db, 'SELECT is_available FROM drivers WHERE id = ?', d.id).is_available).toBe(0);
    const n = getRow(db, "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'trip_accepted'", passenger.id);
    expect(n.n).toBe(1);
  });

  it('PB-VIA-08 la tarifa no cambia aunque el conductor tenga otras tarifas o esté lejos', async () => {
    const d = createUser(db, 'driver', {
      base_fare: 9000,
      intercity_fare: 15000,
      per_km_fare: 3000,
      current_latitude: PLACES.santiago.lat, // ~11 km de Sibundoy
      current_longitude: PLACES.santiago.lon,
    });
    const tripId = createTrip(db, passenger.id, { distance_km: 6 });
    const res = await call(db, 'PUT', `/trips/${tripId}/accept`, { token: d.token });
    expect(res.body.trip.fare).toBe(8000);
  });

  it('PB-VIA-08b la tarifa con recogida a domicilio se mantiene desde la solicitud hasta la aceptación', async () => {
    setServicePaused(db, false);
    const d = createUser(db, 'driver');
    const created = await call(db, 'POST', '/trips', {
      token: passenger.token,
      body: {
        pickup_latitude: PLACES.sibundoy.lat,
        pickup_longitude: PLACES.sibundoy.lon,
        pickup_address: 'Parque Sibundoy',
        dropoff_latitude: PLACES.colon.lat,
        dropoff_longitude: PLACES.colon.lon,
        dropoff_address: 'Parque Colón',
        distance_km: 6,
        estimated_fare: 12000,
        trip_type: 'ride',
        home_pickup: true,
      },
    });
    expect(created.body.trip.fare).toBe(13000);
    const res = await call(db, 'PUT', `/trips/${created.body.trip.id}/accept`, { token: d.token });
    expect(res.body.trip.fare).toBe(13000);
  });

  it('PB-VIA-09 un pasajero no puede aceptar viajes (403)', async () => {
    const tripId = createTrip(db, passenger.id);
    const res = await call(db, 'PUT', `/trips/${tripId}/accept`, { token: passenger.token });
    expect(res.status).toBe(403);
  });

  it.each(['moto', 'piaggio', 'carro', 'particular'])(
    'PB-VIA-10 un conductor con vehículo "%s" no puede aceptar viajes (403, solo taxis)',
    async (vehicle_types) => {
      const d = createUser(db, 'driver', { vehicle_types });
      const tripId = createTrip(db, passenger.id);
      const res = await call(db, 'PUT', `/trips/${tripId}/accept`, { token: d.token });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('VEHICLE_NOT_AUTHORIZED');
      expect(getRow(db, 'SELECT status FROM trips WHERE id = ?', tripId).status).toBe('requested');
    }
  );

  it('PB-VIA-10b un taxi sin verificar por el admin no puede aceptar viajes (403)', async () => {
    const d = createUser(db, 'driver', { verification_status: 'pending' });
    const tripId = createTrip(db, passenger.id);
    const res = await call(db, 'PUT', `/trips/${tripId}/accept`, { token: d.token });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DRIVER_NOT_VERIFIED');
  });

  it('PB-VIA-10c un vehículo no admitido no ve el tablero de solicitudes', async () => {
    const d = createUser(db, 'driver', { vehicle_types: 'moto' });
    createTrip(db, passenger.id);
    const res = await call(db, 'GET', '/trips/active', { token: d.token });
    expect(res.status).toBe(200);
    expect(res.body.trips).toEqual([]);
    expect(res.body.code).toBe('VEHICLE_NOT_AUTHORIZED');
  });

  it('PB-VIA-10d un taxi verificado sí ve las solicitudes del tablero', async () => {
    const d = createUser(db, 'driver');
    const tripId = createTrip(db, passenger.id);
    const res = await call(db, 'GET', '/trips/active', { token: d.token });
    expect(res.body.trips.map((t: any) => t.id)).toEqual([tripId]);
  });

  it('PB-VIA-10e un vehículo no admitido no puede enviar contraofertas (403)', async () => {
    const d = createUser(db, 'driver', { vehicle_types: 'particular', profile_completed: 1 });
    const tripId = createTrip(db, passenger.id);
    const res = await call(db, 'PUT', `/trips/${tripId}/offer-price`, { token: d.token, body: { custom_price: 9000 } });
    expect(res.status).toBe(403);
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM driver_price_offers').n).toBe(0);
  });

  it('PB-VIA-11 un viaje ya aceptado no lo puede tomar otro conductor (404)', async () => {
    const d1 = createUser(db, 'driver');
    const d2 = createUser(db, 'driver');
    const tripId = createTrip(db, passenger.id);
    await call(db, 'PUT', `/trips/${tripId}/accept`, { token: d1.token });
    const res = await call(db, 'PUT', `/trips/${tripId}/accept`, { token: d2.token });
    expect(res.status).toBe(404);
    expect(getRow(db, 'SELECT driver_id FROM trips WHERE id = ?', tripId).driver_id).toBe(d1.id);
  });

  it('PB-VIA-12 si dos conductores aceptan a la vez, solo uno se queda con el viaje', async () => {
    const d1 = createUser(db, 'driver');
    const d2 = createUser(db, 'driver');
    const tripId = createTrip(db, passenger.id);
    const [r1, r2] = await Promise.all([
      call(db, 'PUT', `/trips/${tripId}/accept`, { token: d1.token }),
      call(db, 'PUT', `/trips/${tripId}/accept`, { token: d2.token }),
    ]);
    const winners = [r1, r2].filter((r) => r.status === 200);
    expect(winners).toHaveLength(1);
    expect(getRow(db, 'SELECT driver_id FROM trips WHERE id = ?', tripId).driver_id).toBe(
      winners[0].body.trip.driver_id
    );
  });
});

describe('Contraofertas (PUT /trips/:id/accept-offer)', () => {
  let db: TestDB;
  beforeEach(() => {
    db = createTestD1();
  });

  const offer = (tripId: string, driverId: string, price: number) =>
    db.raw
      .prepare('INSERT INTO driver_price_offers (id, trip_id, driver_id, offered_price) VALUES (?, ?, ?, ?)')
      .run(`${tripId}-${driverId}`, tripId, driverId, price);

  it('PB-VIA-22 al aceptar la contraoferta se cobra el precio ofrecido', async () => {
    const p = createUser(db, 'passenger');
    const d = createUser(db, 'driver');
    const tripId = createTrip(db, p.id);
    offer(tripId, d.id, 11000);
    const res = await call(db, 'PUT', `/trips/${tripId}/accept-offer`, { token: p.token, body: { driver_id: d.id } });
    expect(res.status).toBe(200);
    const t = getRow(db, 'SELECT status, driver_id, fare FROM trips WHERE id = ?', tripId);
    expect(t).toMatchObject({ status: 'accepted', driver_id: d.id, fare: 11000 });
  });

  it('PB-VIA-23 si otro conductor aceptó a la vez, la contraoferta no le quita el viaje', async () => {
    const p = createUser(db, 'passenger');
    const d1 = createUser(db, 'driver');
    const d2 = createUser(db, 'driver');
    const tripId = createTrip(db, p.id);
    offer(tripId, d2.id, 11000);
    const [direct, viaOffer] = await Promise.all([
      call(db, 'PUT', `/trips/${tripId}/accept`, { token: d1.token }),
      call(db, 'PUT', `/trips/${tripId}/accept-offer`, { token: p.token, body: { driver_id: d2.id } }),
    ]);
    expect([direct.status, viaOffer.status].filter((s) => s === 200)).toHaveLength(1);
    const winner = direct.status === 200 ? d1.id : d2.id;
    expect(getRow(db, 'SELECT driver_id FROM trips WHERE id = ?', tripId).driver_id).toBe(winner);
  });
});

describe('Cambios de estado del viaje (PUT /trips/:id/status)', () => {
  let db: TestDB;
  let passenger: { id: string; token: string };
  let driver: { id: string; token: string };
  beforeEach(() => {
    db = createTestD1();
    passenger = createUser(db, 'passenger');
    driver = createUser(db, 'driver');
  });

  it('PB-VIA-13 rechaza un estado que no existe (400)', async () => {
    const tripId = createTrip(db, passenger.id, { status: 'accepted', driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: driver.token, body: { status: 'volando' } });
    expect(res.status).toBe(400);
  });

  it('PB-VIA-14 devuelve 404 para un viaje que no existe', async () => {
    const res = await call(db, 'PUT', '/trips/no-existe/status', { token: driver.token, body: { status: 'in_progress' } });
    expect(res.status).toBe(404);
  });

  it('PB-VIA-15 un conductor no puede cambiar el viaje de otro conductor (403)', async () => {
    const other = createUser(db, 'driver');
    const tripId = createTrip(db, passenger.id, { status: 'accepted', driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: other.token, body: { status: 'completed' } });
    expect(res.status).toBe(403);
  });

  it('PB-VIA-16 un pasajero no puede cambiar el viaje de otro pasajero (403)', async () => {
    const other = createUser(db, 'passenger');
    const tripId = createTrip(db, passenger.id);
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: other.token, body: { status: 'cancelled' } });
    expect(res.status).toBe(403);
  });

  it('PB-VIA-17 el pasajero cancela una solicitud que nadie ha aceptado', async () => {
    const tripId = createTrip(db, passenger.id);
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: passenger.token, body: { status: 'cancelled' } });
    expect(res.status).toBe(200);
    const t = getRow(db, 'SELECT status, cancelled_at FROM trips WHERE id = ?', tripId);
    expect(t.status).toBe('cancelled');
    expect(t.cancelled_at).toBeGreaterThan(0);
  });

  it('PB-VIA-18 el pasajero no puede cancelar un viaje ya aceptado (400)', async () => {
    const tripId = createTrip(db, passenger.id, { status: 'accepted', driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: passenger.token, body: { status: 'cancelled' } });
    expect(res.status).toBe(400);
    expect(res.body.alreadyAccepted).toBe(true);
  });

  it('PB-VIA-19 recorrido completo: en camino → en curso → completado, con sus marcas de tiempo', async () => {
    const tripId = createTrip(db, passenger.id, { status: 'accepted', driver_id: driver.id });
    for (const status of ['driver_arriving', 'in_progress', 'completed']) {
      const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: driver.token, body: { status } });
      expect(res.status).toBe(200);
      expect(res.body.trip.status).toBe(status);
    }
    const t = getRow(db, 'SELECT started_at, completed_at FROM trips WHERE id = ?', tripId);
    expect(t.started_at).toBeGreaterThan(0);
    expect(t.completed_at).toBeGreaterThan(0);
    // Al terminar el viaje el conductor vuelve a quedar disponible
    expect(getRow(db, 'SELECT is_available FROM drivers WHERE id = ?', driver.id).is_available).toBe(1);
  });

  it('PB-VIA-20 cancelar un viaje en curso avisa a la otra parte', async () => {
    const tripId = createTrip(db, passenger.id, { status: 'in_progress', driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: driver.token, body: { status: 'cancelled' } });
    expect(res.status).toBe(200);
    const n = getRow(db, "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'trip_cancelled'", passenger.id);
    expect(n.n).toBe(1);
  });

  it.each(['completed', 'cancelled'])('PB-VIA-21 un viaje %s no se puede reabrir', async (finalStatus) => {
    const tripId = createTrip(db, passenger.id, { status: finalStatus, driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: driver.token, body: { status: 'in_progress' } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRIP_FINISHED');
    expect(getRow(db, 'SELECT status FROM trips WHERE id = ?', tripId).status).toBe(finalStatus);
  });

  it('PB-VIA-24 un viaje en curso no puede volver a "en camino" (409)', async () => {
    const tripId = createTrip(db, passenger.id, { status: 'in_progress', driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: driver.token, body: { status: 'driver_arriving' } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('PB-VIA-25 una solicitud sin conductor no puede pasar a "en curso" ni a "completado" (409)', async () => {
    const tripId = createTrip(db, passenger.id);
    for (const status of ['in_progress', 'completed']) {
      const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: passenger.token, body: { status } });
      expect(res.status).toBe(409);
    }
    expect(getRow(db, 'SELECT status FROM trips WHERE id = ?', tripId).status).toBe('requested');
  });

  it('PB-VIA-26 repetir el estado actual (reintento de la app) no da error', async () => {
    const tripId = createTrip(db, passenger.id, { status: 'in_progress', driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: driver.token, body: { status: 'in_progress' } });
    expect(res.status).toBe(200);
  });

  it('PB-VIA-27 el conductor puede completar desde "aceptado" sin pasar por "en curso"', async () => {
    const tripId = createTrip(db, passenger.id, { status: 'accepted', driver_id: driver.id });
    const res = await call(db, 'PUT', `/trips/${tripId}/status`, { token: driver.token, body: { status: 'completed' } });
    expect(res.status).toBe(200);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { call, createTestD1, createUser, getRow, type TestDB } from './helpers/fixtures';

const activate = (db: TestDB, token: string, isAvailable = true) =>
  call(db, 'PUT', '/drivers/availability', { token, body: { isAvailable } });

describe('Disponibilidad del conductor (PUT /drivers/availability)', () => {
  let db: TestDB;
  beforeEach(() => {
    db = createTestD1();
  });

  it('PB-CON-01 un conductor con perfil completo y SOAT se activa', async () => {
    const d = createUser(db, 'driver');
    const res = await activate(db, d.token);
    expect(res.status).toBe(200);
    expect(getRow(db, 'SELECT is_available FROM drivers WHERE id = ?', d.id).is_available).toBe(1);
  });

  it('PB-CON-02 un conductor puede desactivarse siempre', async () => {
    const d = createUser(db, 'driver', { vehicle_plate: 'PENDING-1', is_available: 1 });
    const res = await activate(db, d.token, false);
    expect(res.status).toBe(200);
    expect(getRow(db, 'SELECT is_available FROM drivers WHERE id = ?', d.id).is_available).toBe(0);
  });

  it('PB-CON-03 un pasajero no puede cambiar disponibilidad (403)', async () => {
    const p = createUser(db, 'passenger');
    expect((await activate(db, p.token)).status).toBe(403);
  });

  it.each(['moto', 'piaggio', 'carro', 'particular'])(
    'PB-CON-04 un conductor con vehículo "%s" no puede activarse (403, solo taxis)',
    async (vehicle_types) => {
      const d = createUser(db, 'driver', { vehicle_types });
      const res = await activate(db, d.token);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('VEHICLE_NOT_AUTHORIZED');
      expect(getRow(db, 'SELECT is_available FROM drivers WHERE id = ?', d.id).is_available).toBe(0);
    }
  );

  it('PB-CON-05 con el perfil incompleto no se activa e indica qué falta (400)', async () => {
    const d = createUser(db, 'driver', {
      vehicle_plate: 'PENDING-abc',
      license_number: 'L-123',
      municipality: null,
    });
    const res = await activate(db, d.token);
    expect(res.status).toBe(400);
    expect(res.body.profileIncomplete).toBe(true);
    expect(res.body.missingFields).toEqual(['placa', 'número de licencia', 'municipio']);
    expect(getRow(db, 'SELECT is_available FROM drivers WHERE id = ?', d.id).is_available).toBe(0);
  });

  it('PB-CON-06 sin SOAT y con el plazo de gracia vencido no se activa (400)', async () => {
    const d = createUser(db, 'driver', { soat_image_url: null });
    // Registrado hace 40 días: los 30 días de gracia ya pasaron
    db.raw.prepare('UPDATE users SET created_at = ? WHERE id = ?').run(
      Math.floor(Date.now() / 1000) - 40 * 86400,
      d.id
    );
    const res = await activate(db, d.token);
    expect(res.status).toBe(400);
    expect(res.body.soatRequired).toBe(true);
  });

  it('PB-CON-07 sin SOAT pero dentro de los 30 días de gracia sí se activa', async () => {
    const d = createUser(db, 'driver', { soat_image_url: null });
    db.raw.prepare('UPDATE users SET created_at = ? WHERE id = ?').run(
      Math.floor(Date.now() / 1000) - 5 * 86400,
      d.id
    );
    expect((await activate(db, d.token)).status).toBe(200);
  });

  it('PB-CON-08 sin empresa, NIT ni tarjeta de operación no se activa (400)', async () => {
    const d = createUser(db, 'driver', { company_name: null, company_nit: '', operation_card_number: null });
    const res = await activate(db, d.token);
    expect(res.status).toBe(400);
    expect(res.body.missingFields).toEqual(['empresa de transporte', 'NIT de la empresa', 'tarjeta de operación']);
  });

  it('PB-CON-09 un taxi con todo completo pero sin verificar por el admin no se activa (403)', async () => {
    const d = createUser(db, 'driver', { verification_status: 'pending' });
    const res = await activate(db, d.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DRIVER_NOT_VERIFIED');
    expect(getRow(db, 'SELECT is_available FROM drivers WHERE id = ?', d.id).is_available).toBe(0);
  });
});

describe('Perfil del conductor (PUT /drivers/profile)', () => {
  let db: TestDB;
  beforeEach(() => {
    db = createTestD1();
  });

  const update = (token: string, body: Record<string, unknown>) =>
    call(db, 'PUT', '/drivers/profile', { token, body });

  it.each(['moto', 'piaggio', 'carro', 'particular'])(
    'PB-CON-10 no permite cambiar el vehículo a "%s" (400)',
    async (vehicle_types) => {
      const d = createUser(db, 'driver');
      const res = await update(d.token, { vehicle_types });
      expect(res.status).toBe(400);
      expect(getRow(db, 'SELECT vehicle_types FROM drivers WHERE id = ?', d.id).vehicle_types).toBe('taxi');
    }
  );

  it('PB-CON-11 registrar o cambiar la empresa deja la cuenta en revisión y desactiva al conductor', async () => {
    const d = createUser(db, 'driver', { is_available: 1 });
    const res = await update(d.token, {
      company_name: '  Taxis del Valle S.A.S. ',
      company_nit: '901234567-1',
      operation_card_number: 'TO-998877',
    });
    expect(res.status).toBe(200);
    const row = getRow(db, 'SELECT * FROM drivers WHERE id = ?', d.id);
    expect(row.company_name).toBe('Taxis del Valle S.A.S.');
    expect(row.verification_status).toBe('pending');
    expect(row.is_available).toBe(0);
  });

  it('PB-CON-11b pasar de otro vehículo a taxi deja la cuenta en revisión', async () => {
    const d = createUser(db, 'driver', { vehicle_types: 'moto' });
    const res = await update(d.token, { vehicle_types: 'taxi' });
    expect(res.status).toBe(200);
    const row = getRow(db, 'SELECT vehicle_types, verification_status FROM drivers WHERE id = ?', d.id);
    expect(row).toEqual({ vehicle_types: 'taxi', verification_status: 'pending' });
  });

  it('PB-CON-12 reenviar los mismos datos de empresa no quita la verificación', async () => {
    const d = createUser(db, 'driver');
    const current = getRow(db, 'SELECT company_name, company_nit, operation_card_number FROM drivers WHERE id = ?', d.id);
    const res = await update(d.token, { ...current, whatsapp: '3001112233' });
    expect(res.status).toBe(200);
    expect(getRow(db, 'SELECT verification_status FROM drivers WHERE id = ?', d.id).verification_status).toBe('approved');
  });

  it('PB-CON-13 el perfil devuelve los datos de la empresa', async () => {
    const d = createUser(db, 'driver');
    const res = await call(db, 'GET', '/drivers/profile', { token: d.token });
    expect(res.status).toBe(200);
    expect(res.body.driver).toMatchObject({ vehicle_types: 'taxi', company_name: 'Cootransvalle', company_nit: '800123456-7' });
  });
});

describe('Conductores visibles para los pasajeros', () => {
  let db: TestDB;
  beforeEach(() => {
    db = createTestD1();
  });

  it('PB-CON-14 /drivers/nearby solo lista taxis disponibles', async () => {
    const p = createUser(db, 'passenger');
    const taxi = createUser(db, 'driver', { is_available: 1 });
    createUser(db, 'driver', { vehicle_types: 'moto', is_available: 1 });
    createUser(db, 'driver', { vehicle_types: 'piaggio', is_available: 1 });
    const res = await call(db, 'GET', '/drivers/nearby?lat=1.2054&lng=-76.916', { token: p.token });
    expect(res.status).toBe(200);
    const list = res.body.drivers ?? res.body;
    expect(list.map((d: any) => d.id)).toEqual([taxi.id]);
  });

  it('PB-CON-15 /drivers/registered (portada) solo muestra taxis', async () => {
    const taxi = createUser(db, 'driver');
    createUser(db, 'driver', { vehicle_types: 'moto' });
    const res = await call(db, 'GET', '/drivers/registered');
    expect(res.body.drivers.map((d: any) => d.id)).toEqual([taxi.id]);
  });
});

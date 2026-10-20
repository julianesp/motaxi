import { beforeEach, describe, expect, it } from 'vitest';
import { call, createTestD1, getRow, type TestDB } from './helpers/fixtures';

const passenger = {
  full_name: 'Ana Pérez',
  phone: '3101234567',
  email: 'Ana@Test.dev',
  password: 'secreta123',
  role: 'passenger',
};

describe('Registro e inicio de sesión (/auth)', () => {
  let db: TestDB;
  beforeEach(() => {
    db = createTestD1();
  });

  it.each([
    ['sin contraseña', { ...passenger, password: undefined }],
    ['sin teléfono', { ...passenger, phone: undefined }],
    ['sin nombre', { ...passenger, full_name: undefined }],
    ['sin rol', { ...passenger, role: undefined }],
  ])('PB-AUT-01 rechaza el registro %s (400)', async (_c, body) => {
    const res = await call(db, 'POST', '/auth/register', { body });
    expect(res.status).toBe(400);
  });

  it('PB-AUT-02 rechaza un rol distinto de pasajero o conductor', async () => {
    const res = await call(db, 'POST', '/auth/register', { body: { ...passenger, role: 'admin' } });
    expect(res.status).toBe(400);
  });

  it('PB-AUT-03 exige contraseña de al menos 6 caracteres', async () => {
    const res = await call(db, 'POST', '/auth/register', { body: { ...passenger, password: '12345' } });
    expect(res.status).toBe(400);
  });

  it('PB-AUT-04 registra un pasajero, guarda la contraseña cifrada y abre sesión', async () => {
    const res = await call(db, 'POST', '/auth/register', { body: passenger });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('passenger');
    expect(res.body.user.password_hash).toBeUndefined();
    const row = getRow(db, 'SELECT password_hash FROM users WHERE phone = ?', passenger.phone);
    expect(row.password_hash).not.toBe(passenger.password);
    expect(row.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM passengers').n).toBe(1);
  });

  it('PB-AUT-05 no permite registrar dos veces el mismo teléfono (409)', async () => {
    await call(db, 'POST', '/auth/register', { body: passenger });
    const res = await call(db, 'POST', '/auth/register', { body: { ...passenger, email: 'otro@test.dev' } });
    expect(res.status).toBe(409);
  });

  it('PB-AUT-06 no permite repetir el correo aunque cambien mayúsculas (409)', async () => {
    await call(db, 'POST', '/auth/register', { body: passenger });
    const res = await call(db, 'POST', '/auth/register', {
      body: { ...passenger, phone: '3109999999', email: '  ana@test.DEV ' },
    });
    expect(res.status).toBe(409);
  });

  it('PB-AUT-07 un conductor nuevo queda como taxi, con perfil pendiente y en revisión del admin', async () => {
    const res = await call(db, 'POST', '/auth/register', { body: { ...passenger, role: 'driver' } });
    expect(res.status).toBe(201);
    const d = getRow(db, 'SELECT * FROM drivers WHERE id = ?', res.body.user.id);
    expect(d.vehicle_types).toBe('taxi');
    expect(d.verification_status).toBe('pending');
    expect(d.is_verified).toBe(0);
    expect(d.vehicle_plate).toMatch(/^PENDING-/);
    expect(d.license_number).toMatch(/^PENDING-/);
    expect(d.is_available).toBe(0);
  });

  it.each(['moto', 'piaggio', 'carro', 'particular'])(
    'PB-AUT-07b rechaza registrar un conductor con vehículo "%s" (400)',
    async (vehicle_types) => {
      const res = await call(db, 'POST', '/auth/register', {
        body: { ...passenger, role: 'driver', vehicle_types },
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VEHICLE_NOT_AUTHORIZED');
      expect(getRow(db, 'SELECT COUNT(*) AS n FROM users').n).toBe(0);
    }
  );

  it('PB-AUT-08 inicia sesión con el teléfono', async () => {
    await call(db, 'POST', '/auth/register', { body: passenger });
    const res = await call(db, 'POST', '/auth/login', {
      body: { phone: passenger.phone, password: passenger.password },
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('PB-AUT-09 inicia sesión con el correo sin importar mayúsculas ni espacios', async () => {
    await call(db, 'POST', '/auth/register', { body: passenger });
    const res = await call(db, 'POST', '/auth/login', {
      body: { email: ' ana@TEST.dev ', password: passenger.password },
    });
    expect(res.status).toBe(200);
  });

  it('PB-AUT-10 rechaza una contraseña incorrecta (401) sin abrir sesión', async () => {
    await call(db, 'POST', '/auth/register', { body: passenger });
    const before = getRow(db, 'SELECT COUNT(*) AS n FROM sessions').n;
    const res = await call(db, 'POST', '/auth/login', {
      body: { phone: passenger.phone, password: 'equivocada' },
    });
    expect(res.status).toBe(401);
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM sessions').n).toBe(before);
  });

  it('PB-AUT-11 GET /auth/me devuelve el usuario del token, sin la contraseña', async () => {
    const reg = await call(db, 'POST', '/auth/register', { body: passenger });
    const res = await call(db, 'GET', '/auth/me', { token: reg.body.token });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(reg.body.user.id);
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('PB-AUT-12 rechaza peticiones sin token o con token inválido (401)', async () => {
    expect((await call(db, 'GET', '/auth/me')).status).toBe(401);
    expect((await call(db, 'GET', '/auth/me', { token: 'no-existe' })).status).toBe(401);
    expect((await call(db, 'GET', '/trips/history')).status).toBe(401);
  });

  it('PB-AUT-13 rechaza una sesión vencida (401)', async () => {
    const reg = await call(db, 'POST', '/auth/register', { body: passenger });
    db.raw.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(
      Math.floor(Date.now() / 1000) - 1,
      reg.body.token
    );
    expect((await call(db, 'GET', '/auth/me', { token: reg.body.token })).status).toBe(401);
  });

  it('PB-AUT-14 cerrar sesión invalida el token', async () => {
    const reg = await call(db, 'POST', '/auth/register', { body: passenger });
    expect((await call(db, 'POST', '/auth/logout', { token: reg.body.token })).status).toBe(200);
    expect((await call(db, 'GET', '/auth/me', { token: reg.body.token })).status).toBe(401);
  });
});

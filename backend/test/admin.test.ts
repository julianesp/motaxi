import { beforeEach, describe, expect, it } from 'vitest';
import { call, createTestD1, createUser, getRow, type TestDB } from './helpers/fixtures';

describe('Verificación de conductores por el admin (PUT /admin/drivers/:id/verify)', () => {
  let db: TestDB;
  let admin: { id: string; token: string };
  beforeEach(() => {
    db = createTestD1();
    admin = createUser(db, 'passenger', {}, 'admin@neurai.dev');
  });

  it('PB-ADM-01 aprueba un taxi con empresa y tarjeta de operación, y le avisa', async () => {
    const d = createUser(db, 'driver', { verification_status: 'pending' });
    const res = await call(db, 'PUT', `/admin/drivers/${d.id}/verify`, { token: admin.token });
    expect(res.status).toBe(200);
    expect(getRow(db, 'SELECT verification_status FROM drivers WHERE id = ?', d.id).verification_status).toBe('approved');
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', d.id).n).toBe(1);
  });

  it('PB-ADM-02 no aprueba un taxi sin los datos de la empresa (400)', async () => {
    const d = createUser(db, 'driver', { verification_status: 'pending', company_nit: null });
    const res = await call(db, 'PUT', `/admin/drivers/${d.id}/verify`, { token: admin.token });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('COMPANY_DATA_MISSING');
    expect(getRow(db, 'SELECT verification_status FROM drivers WHERE id = ?', d.id).verification_status).toBe('pending');
  });

  it.each(['moto', 'piaggio', 'particular'])('PB-ADM-03 no aprueba un vehículo "%s" (400)', async (vehicle_types) => {
    const d = createUser(db, 'driver', { verification_status: 'pending', vehicle_types });
    const res = await call(db, 'PUT', `/admin/drivers/${d.id}/verify`, { token: admin.token });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VEHICLE_NOT_AUTHORIZED');
  });

  it('PB-ADM-04 rechazar a un conductor guarda el motivo y le avisa', async () => {
    const d = createUser(db, 'driver', { verification_status: 'pending' });
    const res = await call(db, 'PUT', `/admin/drivers/${d.id}/reject`, {
      token: admin.token,
      body: { reason: 'La tarjeta de operación está vencida' },
    });
    expect(res.status).toBe(200);
    const row = getRow(db, 'SELECT verification_status, rejection_reason FROM drivers WHERE id = ?', d.id);
    expect(row).toEqual({ verification_status: 'rejected', rejection_reason: 'La tarjeta de operación está vencida' });
    expect(getRow(db, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', d.id).n).toBe(1);
  });

  it('PB-ADM-05 un usuario que no es admin no puede aprobar conductores (403)', async () => {
    const intruso = createUser(db, 'driver');
    const d = createUser(db, 'driver', { verification_status: 'pending' });
    const res = await call(db, 'PUT', `/admin/drivers/${d.id}/verify`, { token: intruso.token });
    expect(res.status).toBe(403);
    expect(getRow(db, 'SELECT verification_status FROM drivers WHERE id = ?', d.id).verification_status).toBe('pending');
  });
});

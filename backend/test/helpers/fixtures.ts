import { randomUUID } from 'node:crypto';
import worker from '../../src/index';
import { createTestD1 } from './d1';

/** Puntos de referencia (lat, lon). Dentro: cascos urbanos del Alto Putumayo. Fuera: ciudades vecinas. */
export const PLACES = {
  sibundoy: { lat: 1.2054, lon: -76.916 },
  colon: { lat: 1.1895, lon: -76.9725 },
  santiago: { lat: 1.1468, lon: -77.0025 },
  sanFrancisco: { lat: 1.1749, lon: -76.8789 },
  pasto: { lat: 1.2136, lon: -77.2811 },
  mocoa: { lat: 1.1522, lon: -76.6469 },
};

export type TestDB = ReturnType<typeof createTestD1>;

export function createEnv(db: TestDB) {
  return { DB: db, JWT_SECRET: 'test', CORS_ORIGIN: 'https://motaxi.dev' } as any;
}

/** Llama al Worker igual que lo haría Cloudflare, con un ExecutionContext mínimo. */
export async function call(
  db: TestDB,
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const req = new Request(`https://api.motaxi.dev${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} };
  const res = await worker.fetch(req, createEnv(db), ctx as any);
  await Promise.allSettled(pending);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

let seq = 0;

/** Crea un usuario con sesión válida (30 días) y devuelve su id y token. */
export function createUser(
  db: TestDB,
  role: 'passenger' | 'driver',
  extra: Record<string, unknown> = {},
  email?: string
) {
  seq += 1;
  const id = randomUUID();
  const token = randomUUID();
  db.raw
    .prepare('INSERT INTO users (id, email, password_hash, phone, full_name, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, email ?? `user${seq}@test.dev`, 'x', `300000${String(seq).padStart(4, '0')}`, `Usuario ${seq}`, role);
  if (role === 'passenger') {
    db.raw.prepare('INSERT INTO passengers (id) VALUES (?)').run(id);
  } else {
    const d = {
      license_number: `LIC-${seq}`,
      vehicle_plate: `ABC${String(seq).padStart(3, '0')}`,
      vehicle_model: 'Chevrolet Spark',
      vehicle_color: 'Rojo',
      // Por defecto: taxi de servicio público verificado y afiliado a una empresa habilitada
      vehicle_types: 'taxi',
      municipality: 'sibundoy',
      soat_image_url: 'soat/test.jpg',
      verification_status: 'approved',
      company_name: 'Cootransvalle',
      company_nit: '800123456-7',
      operation_card_number: `TO-${seq}`,
      ...extra,
    };
    const cols = Object.keys(d);
    db.raw
      .prepare(`INSERT INTO drivers (id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`)
      .run(id, ...(Object.values(d) as any[]));
  }
  db.raw
    .prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), id, token, Math.floor(Date.now() / 1000) + 3600);
  return { id, token };
}

/** Inserta un viaje directamente en la base (para probar transiciones de estado). */
export function createTrip(
  db: TestDB,
  passengerId: string,
  extra: { status?: string; driver_id?: string | null; distance_km?: number } = {}
) {
  const id = randomUUID();
  db.raw
    .prepare(
      `INSERT INTO trips (id, passenger_id, driver_id, pickup_latitude, pickup_longitude, pickup_address,
         dropoff_latitude, dropoff_longitude, dropoff_address, status, fare, distance_km)
       VALUES (?, ?, ?, ?, ?, 'Parque Sibundoy', ?, ?, 'Parque Colón', ?, 8000, ?)`
    )
    .run(
      id,
      passengerId,
      extra.driver_id ?? null,
      PLACES.sibundoy.lat,
      PLACES.sibundoy.lon,
      PLACES.colon.lat,
      PLACES.colon.lon,
      extra.status ?? 'requested',
      extra.distance_km ?? 6
    );
  return id;
}

export function setServicePaused(db: TestDB, paused: boolean, message?: string) {
  db.raw
    .prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('service_paused', ?)")
    .run(paused ? '1' : '0');
  if (message !== undefined) {
    db.raw
      .prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('service_paused_message', ?)")
      .run(message);
  }
}

export function getRow(db: TestDB, sql: string, ...params: any[]): any {
  return db.raw.prepare(sql).get(...params);
}

export { createTestD1 };

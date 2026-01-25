-- Schema para MoTaxi - Base de datos en Cloudflare D1
-- Ejecutar este script usando: wrangler d1 execute motaxi-db --file=cloudflare_d1_schema.sql

-- Tabla de usuarios base
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('passenger', 'driver')),
  profile_image TEXT,
  push_token TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de sesiones para autenticación
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de pasajeros
CREATE TABLE IF NOT EXISTS passengers (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating REAL DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  CHECK (rating >= 0 AND rating <= 5)
);

-- Tabla de conductores (mototaxistas)
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  license_number TEXT UNIQUE NOT NULL,
  vehicle_plate TEXT UNIQUE NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_color TEXT NOT NULL,
  is_available INTEGER DEFAULT 0,
  rating REAL DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  photo_license TEXT,
  photo_vehicle TEXT,
  is_verified INTEGER DEFAULT 0,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  verified_at INTEGER,
  verified_by TEXT,
  current_latitude REAL,
  current_longitude REAL,
  last_location_update INTEGER,
  CHECK (rating >= 0 AND rating <= 5)
);

-- Tabla de viajes
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES passengers(id),
  driver_id TEXT REFERENCES drivers(id),

  -- Ubicación de recogida
  pickup_latitude REAL NOT NULL,
  pickup_longitude REAL NOT NULL,
  pickup_address TEXT,

  -- Ubicación de destino
  dropoff_latitude REAL NOT NULL,
  dropoff_longitude REAL NOT NULL,
  dropoff_address TEXT,

  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled')),

  fare REAL NOT NULL,
  distance_km REAL,
  duration_minutes INTEGER,

  requested_at INTEGER DEFAULT (strftime('%s', 'now')),
  accepted_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  cancelled_at INTEGER,
  cancellation_reason TEXT,

  passenger_rating INTEGER CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
  driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
  passenger_comment TEXT,
  driver_comment TEXT,

  route_polyline TEXT,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('trip_request', 'trip_accepted', 'trip_started', 'trip_completed', 'trip_cancelled', 'general')),
  is_read INTEGER DEFAULT 0,
  data TEXT, -- JSON string
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de métodos de pago
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cash', 'card', 'digital_wallet')),
  is_default INTEGER DEFAULT 0,
  card_last_four TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de ganancias de conductores
CREATE TABLE IF NOT EXISTS earnings (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  amount REAL NOT NULL,
  commission REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL,
  paid_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de contactos de emergencia
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de alertas SOS
CREATE TABLE IF NOT EXISTS sos_alerts (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
  resolved_at INTEGER,
  resolved_by TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de viajes compartidos
CREATE TABLE IF NOT EXISTS trip_shares (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  shared_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_phone TEXT NOT NULL,
  shared_with_name TEXT,
  share_token TEXT NOT NULL UNIQUE,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_trips_passenger ON trips(passenger_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(is_available);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(current_latitude, current_longitude);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_earnings_driver ON earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_trip ON sos_alerts(trip_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_trip_shares_token ON trip_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_trip_shares_trip ON trip_shares(trip_id);

-- Trigger para actualizar updated_at en users
CREATE TRIGGER IF NOT EXISTS update_users_timestamp
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Trigger para actualizar updated_at en trips
CREATE TRIGGER IF NOT EXISTS update_trips_timestamp
AFTER UPDATE ON trips
BEGIN
  UPDATE trips SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Trigger para actualizar rating de conductores
CREATE TRIGGER IF NOT EXISTS update_driver_rating
AFTER UPDATE OF driver_rating ON trips
WHEN NEW.driver_rating IS NOT NULL
BEGIN
  UPDATE drivers
  SET rating = (
    SELECT AVG(driver_rating)
    FROM trips
    WHERE driver_id = NEW.driver_id
      AND driver_rating IS NOT NULL
  )
  WHERE id = NEW.driver_id;
END;

-- Trigger para actualizar rating de pasajeros
CREATE TRIGGER IF NOT EXISTS update_passenger_rating
AFTER UPDATE OF passenger_rating ON trips
WHEN NEW.passenger_rating IS NOT NULL
BEGIN
  UPDATE passengers
  SET rating = (
    SELECT AVG(passenger_rating)
    FROM trips
    WHERE passenger_id = NEW.passenger_id
      AND passenger_rating IS NOT NULL
  )
  WHERE id = NEW.passenger_id;
END;

-- Trigger para incrementar total_trips de conductor
CREATE TRIGGER IF NOT EXISTS increment_driver_trips
AFTER UPDATE OF status ON trips
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
  UPDATE drivers
  SET total_trips = total_trips + 1
  WHERE id = NEW.driver_id;
END;

-- Trigger para incrementar total_trips de pasajero
CREATE TRIGGER IF NOT EXISTS increment_passenger_trips
AFTER UPDATE OF status ON trips
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
  UPDATE passengers
  SET total_trips = total_trips + 1
  WHERE id = NEW.passenger_id;
END;

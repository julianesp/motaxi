-- Tabla para almacenar ofertas de precio de conductores
CREATE TABLE IF NOT EXISTS driver_price_offers (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  offered_price REAL NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  UNIQUE(trip_id, driver_id)
);

-- Índice para consultas rápidas por trip_id
CREATE INDEX IF NOT EXISTS idx_driver_offers_trip_id ON driver_price_offers(trip_id);

-- Índice para consultas rápidas por driver_id
CREATE INDEX IF NOT EXISTS idx_driver_offers_driver_id ON driver_price_offers(driver_id);

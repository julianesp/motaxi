-- Rutas compartidas: el conductor publica una ruta con cupos disponibles
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_shared_routes.sql --remote

CREATE TABLE IF NOT EXISTS shared_routes (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,           -- municipio de origen (ej. "Colón")
  destination TEXT NOT NULL,      -- municipio de destino (ej. "Mocoa")
  departure_time TEXT NOT NULL,   -- hora de salida en formato HH:MM (ej. "08:30")
  total_seats INTEGER NOT NULL DEFAULT 4,
  available_seats INTEGER NOT NULL DEFAULT 4,
  fare_per_seat INTEGER NOT NULL DEFAULT 0,  -- precio por puesto en COP
  status TEXT NOT NULL DEFAULT 'active',     -- active | departed | cancelled
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_shared_routes_driver ON shared_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_shared_routes_status ON shared_routes(status);
CREATE INDEX IF NOT EXISTS idx_shared_routes_destination ON shared_routes(destination);

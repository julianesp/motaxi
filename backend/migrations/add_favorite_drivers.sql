-- Tabla para conductores favoritos de pasajeros
CREATE TABLE IF NOT EXISTS favorite_drivers (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT, -- Apodo opcional que el pasajero le da al conductor
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(passenger_id, driver_id) -- Un pasajero no puede tener el mismo conductor favorito dos veces
);

CREATE INDEX IF NOT EXISTS idx_favorite_drivers_passenger ON favorite_drivers(passenger_id);
CREATE INDEX IF NOT EXISTS idx_favorite_drivers_driver ON favorite_drivers(driver_id);

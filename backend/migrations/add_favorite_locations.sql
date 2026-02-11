-- Tabla de ubicaciones favoritas para pasajeros
CREATE TABLE IF NOT EXISTS favorite_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL, -- Ej: "Casa", "Trabajo", "Gimnasio"
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  place_id TEXT, -- Google Places ID para referencia
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_favorite_locations_user_id ON favorite_locations(user_id);

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_favorite_locations_created_at ON favorite_locations(created_at DESC);

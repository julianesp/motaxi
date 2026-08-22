-- Tabla para fotos del vehículo del conductor (galería pública en su perfil)
CREATE TABLE IF NOT EXISTS driver_vehicle_photos (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_key TEXT NOT NULL,
  caption TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_visible INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_photos_driver ON driver_vehicle_photos(driver_id);

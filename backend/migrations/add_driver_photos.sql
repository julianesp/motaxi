-- Tabla para fotos de lugares visitados por conductores
CREATE TABLE IF NOT EXISTS driver_photos (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_key TEXT NOT NULL,
  caption TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_visible INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_driver_photos_driver_id ON driver_photos(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_photos_created_at ON driver_photos(created_at DESC);

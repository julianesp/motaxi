-- Propuestas de imagen de municipio (usuarios registrados proponen, admin aprueba)
CREATE TABLE IF NOT EXISTS municipality_images (
  id TEXT PRIMARY KEY,
  municipality_id TEXT NOT NULL, -- 'santiago', 'colon', 'sibundoy', 'san-francisco'
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_municipality_images_status ON municipality_images(municipality_id, status);

-- Lugares/negocios publicados por usuarios en cada municipio
CREATE TABLE IF NOT EXISTS municipality_places (
  id TEXT PRIMARY KEY,
  municipality_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'negocio',
  image_url TEXT,
  address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_municipality_places_municipality ON municipality_places(municipality_id, status);
CREATE INDEX IF NOT EXISTS idx_municipality_places_user ON municipality_places(user_id);

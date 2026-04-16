-- Lugares conocidos compartidos por la comunidad
CREATE TABLE IF NOT EXISTS named_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_named_places_name ON named_places(name);
CREATE INDEX IF NOT EXISTS idx_named_places_created_at ON named_places(created_at DESC);

-- Lugares guardados personalmente por cada usuario
CREATE TABLE IF NOT EXISTS saved_named_places (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(user_id, place_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (place_id) REFERENCES named_places(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_named_places_user ON saved_named_places(user_id);

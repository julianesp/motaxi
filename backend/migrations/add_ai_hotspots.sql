-- Zonas calientes calculadas por el motor de IA (DBSCAN en Python/GitHub Actions)
CREATE TABLE IF NOT EXISTS ai_hotspots (
  id TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200,
  score REAL NOT NULL,          -- densidad normalizada 0-1
  trip_count INTEGER NOT NULL,
  hour_of_day INTEGER,          -- 0-23 (NULL = válido todo el día)
  day_of_week INTEGER,          -- 0=lunes … 6=domingo (NULL = todos los días)
  label TEXT,                   -- descripción legible ej: "Parque Sibundoy"
  computed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  valid_until INTEGER NOT NULL  -- timestamp hasta cuando es válido
);

CREATE INDEX IF NOT EXISTS idx_ai_hotspots_valid ON ai_hotspots(valid_until);
CREATE INDEX IF NOT EXISTS idx_ai_hotspots_score ON ai_hotspots(score DESC);

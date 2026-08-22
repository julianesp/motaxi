-- Puntos intermedios de ruta registrados durante cada viaje
-- Permite reconstruir el trayecto real y alimentar el motor de IA de demanda
CREATE TABLE IF NOT EXISTS trip_waypoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_trip_waypoints_trip ON trip_waypoints(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_waypoints_time ON trip_waypoints(recorded_at);

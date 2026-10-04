-- Respuestas a la encuesta de satisfacción que la app muestra tras 30 s de uso
-- Ejecutar con: cd backend && npx wrangler d1 execute motaxi-db --file=./migrations/create_app_feedback.sql --remote
CREATE TABLE IF NOT EXISTS app_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT,
  ease_rating INTEGER NOT NULL CHECK (ease_rating BETWEEN 1 AND 5),
  found_needed TEXT NOT NULL CHECK (found_needed IN ('yes', 'partly', 'no')),
  improvement TEXT,
  app_version TEXT,
  platform TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_app_feedback_created ON app_feedback (created_at DESC);

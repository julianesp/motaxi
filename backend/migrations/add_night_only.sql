-- Agregar campo de conductor nocturno
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_night_only.sql --remote
ALTER TABLE drivers ADD COLUMN night_only INTEGER DEFAULT 0; -- 1 = solo hace viajes nocturnos (6pm-6am)

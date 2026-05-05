-- Agregar campo para conductores que trabajan de noche entre semana pero también de día los fines de semana
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_weekend_daytime.sql --remote
ALTER TABLE drivers ADD COLUMN weekend_daytime INTEGER DEFAULT 0; -- 1 = trabaja de día también los sábados y domingos

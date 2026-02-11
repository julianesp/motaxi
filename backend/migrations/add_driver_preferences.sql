-- Agregar campos de preferencias y ubicación del conductor
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_driver_preferences.sql --remote

-- Agregar columna de municipio
ALTER TABLE drivers ADD COLUMN municipality TEXT;

-- Agregar columnas para preferencias de ruta
ALTER TABLE drivers ADD COLUMN accepts_intercity_trips INTEGER DEFAULT 1; -- 1 = acepta viajes a otros pueblos, 0 = no acepta
ALTER TABLE drivers ADD COLUMN accepts_rural_trips INTEGER DEFAULT 1; -- 1 = acepta viajes a veredas, 0 = no acepta

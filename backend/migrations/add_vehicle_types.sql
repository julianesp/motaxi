-- Agregar columna de tipo de vehículo al conductor
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./migrations/add_vehicle_types.sql --remote

ALTER TABLE drivers ADD COLUMN vehicle_types TEXT DEFAULT 'moto';

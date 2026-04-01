-- Agregar soporte para envío de paquetes/domicilios
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_delivery_type.sql --remote

-- trip_type: 'ride' (viaje normal) o 'delivery' (envío de paquete)
ALTER TABLE trips ADD COLUMN trip_type TEXT DEFAULT 'ride';

-- delivery_note: instrucciones del pasajero para el conductor (descripción del paquete, etc.)
ALTER TABLE trips ADD COLUMN delivery_note TEXT;

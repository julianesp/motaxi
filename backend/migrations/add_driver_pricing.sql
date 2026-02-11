-- Agregar campos de tarifas personalizadas del conductor
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_driver_pricing.sql --remote

-- Tarifa base (dentro del mismo municipio)
ALTER TABLE drivers ADD COLUMN base_fare INTEGER DEFAULT 5000;

-- Tarifa para viajes a otros pueblos (intermunicipales)
ALTER TABLE drivers ADD COLUMN intercity_fare INTEGER DEFAULT 10000;

-- Tarifa para viajes a veredas (zonas rurales)
ALTER TABLE drivers ADD COLUMN rural_fare INTEGER DEFAULT 8000;

-- Tarifa por kilómetro adicional
ALTER TABLE drivers ADD COLUMN per_km_fare INTEGER DEFAULT 2000;

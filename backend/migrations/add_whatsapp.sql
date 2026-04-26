-- Agregar campo de WhatsApp al conductor
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_whatsapp.sql --remote
ALTER TABLE drivers ADD COLUMN whatsapp TEXT;

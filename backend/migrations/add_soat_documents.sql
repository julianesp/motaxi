-- Migración para agregar el documento SOAT del conductor
-- Ejecutar: wrangler d1 execute motaxi-db --file=./migrations/add_soat_documents.sql --remote

-- URL/clave de la imagen del SOAT en R2
ALTER TABLE drivers ADD COLUMN soat_image_url TEXT;

-- Fecha de vencimiento del SOAT (timestamp unixepoch)
ALTER TABLE drivers ADD COLUMN soat_expiry INTEGER;

-- Estado de revisión del SOAT: pending, approved, rejected
ALTER TABLE drivers ADD COLUMN soat_status TEXT DEFAULT 'pending' CHECK (soat_status IN ('pending', 'approved', 'rejected'));

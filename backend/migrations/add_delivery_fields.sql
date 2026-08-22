-- Campos adicionales para envíos de paquetes
ALTER TABLE trips ADD COLUMN recipient_name TEXT;
ALTER TABLE trips ADD COLUMN recipient_phone TEXT;
ALTER TABLE trips ADD COLUMN package_size TEXT DEFAULT 'small' CHECK (package_size IN ('small', 'medium', 'large'));
ALTER TABLE trips ADD COLUMN package_photo_key TEXT;

-- Agregar funcionalidades de seguridad a la tabla trips

-- Código PIN de verificación (4 dígitos)
ALTER TABLE trips ADD COLUMN verification_pin TEXT;

-- Link de compartir viaje (UUID único)
ALTER TABLE trips ADD COLUMN share_link TEXT;

-- Timestamp cuando se activó el botón de pánico
ALTER TABLE trips ADD COLUMN panic_activated_at INTEGER;

-- Detalles del pánico (ubicación, etc.)
ALTER TABLE trips ADD COLUMN panic_details TEXT;

-- Crear índice único para share_link (no se puede hacer en ALTER TABLE ADD COLUMN)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_share_link ON trips(share_link);

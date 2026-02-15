-- Agregar campo para verificar si el conductor completó su perfil inicial
ALTER TABLE drivers ADD COLUMN profile_completed INTEGER DEFAULT 0;

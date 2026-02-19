-- Agregar campo de género a la tabla users
-- Este campo permite identificar el género del usuario para mostrar iconos apropiados en el mapa
ALTER TABLE users ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other'));

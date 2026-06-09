-- Agrega campo para que conductores de taxi indiquen que aceptan carreras
ALTER TABLE drivers ADD COLUMN accepts_rides INTEGER DEFAULT 0;

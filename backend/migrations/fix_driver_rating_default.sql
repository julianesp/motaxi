-- Corregir calificación de conductores sin viajes completados
-- Los conductores sin viajes no deberían tener calificación (debe ser NULL)

-- Actualizar conductores existentes que tienen rating pero 0 viajes completados
UPDATE drivers
SET rating = NULL
WHERE total_trips = 0;

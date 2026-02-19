-- Marcar como perfil completo a conductores existentes que ya tienen todos los campos reales
UPDATE drivers
SET profile_completed = 1
WHERE vehicle_model IS NOT NULL
  AND vehicle_model != 'PENDING'
  AND vehicle_color IS NOT NULL
  AND vehicle_plate IS NOT NULL
  AND license_number IS NOT NULL
  AND vehicle_plate != 'PENDING'
  AND license_number != 'PENDING';

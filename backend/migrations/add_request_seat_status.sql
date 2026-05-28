-- Ampliar estados de route_requests para confirmar puesto y estado en camino
-- Ejecutar con: wrangler d1 execute motaxi-db --file=./backend/migrations/add_request_seat_status.sql --remote

-- La columna status ya existe con valores 'pending' | 'cancelled'
-- Ampliamos el uso a: 'pending' | 'confirmed' | 'on_the_way' | 'cancelled'
-- No requiere ALTER TABLE ya que SQLite no valida CHECK constraints en columnas existentes

-- Agregar columna updated_at a route_requests si no existe
ALTER TABLE route_requests ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Agrega campo para indicar si el pasajero solicita recogida a domicilio
-- El conductor cobra $1.000 COP adicionales por ir a recoger al pasajero a su casa
ALTER TABLE trips ADD COLUMN home_pickup INTEGER NOT NULL DEFAULT 0;

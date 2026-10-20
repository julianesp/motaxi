-- MoTaxi solo intermedia con taxis de servicio público (placa blanca) afiliados a una empresa
-- de transporte legalmente habilitada. Datos que el conductor registra y el admin verifica.
ALTER TABLE drivers ADD COLUMN company_name TEXT;          -- Razón social de la empresa
ALTER TABLE drivers ADD COLUMN company_nit TEXT;           -- NIT de la empresa
ALTER TABLE drivers ADD COLUMN operation_card_number TEXT; -- N.º de la tarjeta de operación del vehículo

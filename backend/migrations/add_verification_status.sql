-- Migración para agregar campos de estado de verificación
-- Ejecutar: wrangler d1 execute motaxi-db --local --file=backend/migrations/add_verification_status.sql

-- verification_status: pending, approved, rejected
ALTER TABLE drivers ADD COLUMN verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected'));

-- Razón de rechazo (si fue rechazado)
ALTER TABLE drivers ADD COLUMN rejection_reason TEXT;

-- Fecha de verificación
ALTER TABLE drivers ADD COLUMN verified_at INTEGER;

-- ID del admin que verificó
ALTER TABLE drivers ADD COLUMN verified_by TEXT;

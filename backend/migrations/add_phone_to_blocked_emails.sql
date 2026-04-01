-- Agregar columna phone a blocked_emails para bloquear también por número de teléfono
-- Evita que conductores con trial vencido se re-registren cambiando solo el email
ALTER TABLE blocked_emails ADD COLUMN phone TEXT;

CREATE INDEX IF NOT EXISTS idx_blocked_emails_phone ON blocked_emails(phone);

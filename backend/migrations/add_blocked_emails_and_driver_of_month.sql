-- Tabla para emails bloqueados (conductores con trial vencido que no pagaron)
-- Evita que se re-registren con el mismo email para evadir el pago
CREATE TABLE IF NOT EXISTS blocked_emails (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'trial_expired',
  blocked_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_blocked_emails_email ON blocked_emails(email);

-- Tabla para conductor del mes
CREATE TABLE IF NOT EXISTS driver_of_month (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  avg_rating REAL NOT NULL,
  total_trips INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT DEFAULT 'free_month', -- 'free_month' = mes gratis
  reward_applied INTEGER DEFAULT 0, -- 0 = pendiente, 1 = aplicado
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(month, year)
);

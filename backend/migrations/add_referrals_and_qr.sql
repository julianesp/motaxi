-- Tabla para rastrear referidos de conductores
-- Cada conductor tiene un ref_code único (= su user ID por simplicidad)
-- Cuando un pasajero se registra con ?ref=<codigo>, se registra aquí

CREATE TABLE IF NOT EXISTS driver_referrals (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(referred_user_id)  -- un pasajero solo puede ser referido una vez
);

CREATE INDEX IF NOT EXISTS idx_driver_referrals_driver ON driver_referrals(driver_id);

-- Ganador mensual del concurso de referidos (mes gratis)
CREATE TABLE IF NOT EXISTS referral_winner (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  referral_count INTEGER NOT NULL DEFAULT 0,
  reward_applied INTEGER NOT NULL DEFAULT 0,  -- 1 = mes gratis ya aplicado
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(month, year)
);

-- Solicitudes de código QR para motos
CREATE TABLE IF NOT EXISTS qr_requests (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | contacted | delivered
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(driver_id)  -- un conductor, una solicitud activa
);

CREATE INDEX IF NOT EXISTS idx_qr_requests_status ON qr_requests(status);

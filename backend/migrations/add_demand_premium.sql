-- Add-on premium: predicción de demanda con IA para conductores
-- El conductor paga un extra (vía ePayco) para recibir alertas de zonas
-- con mayor demanda esperada. Es independiente de la suscripción base.
CREATE TABLE IF NOT EXISTS driver_premium (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL DEFAULT 'demand_prediction'
    CHECK (feature IN ('demand_prediction')),
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'active', 'expired', 'cancelled')),
  amount INTEGER NOT NULL DEFAULT 9900,
  current_period_start INTEGER,
  current_period_end INTEGER,
  epayco_reference TEXT,
  epayco_transaction_id TEXT,
  last_notified_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (user_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_driver_premium_user ON driver_premium(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_premium_status ON driver_premium(status);

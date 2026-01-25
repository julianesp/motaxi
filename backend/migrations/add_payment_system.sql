-- Migration: Add Payment System
-- Created: 2025-12-29
-- Description: Tables for payment processing, methods, and transactions

-- Tabla de métodos de pago del usuario
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pse', 'nequi', 'daviplata', 'card', 'cash')),
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,

  -- Para tarjetas
  card_brand TEXT, -- visa, mastercard, amex
  card_last_four TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_holder_name TEXT,

  -- Para PSE
  bank_code TEXT,
  bank_name TEXT,

  -- Para Nequi/Daviplata
  phone_number TEXT,

  -- Token de Wompi (encriptado)
  wompi_token TEXT,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de transacciones de pago
CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method_id TEXT REFERENCES payment_methods(id),

  amount REAL NOT NULL,
  currency TEXT DEFAULT 'COP',

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'declined', 'failed', 'refunded')),

  -- Información del procesador de pagos
  provider TEXT DEFAULT 'wompi', -- wompi, mercadopago, stripe
  provider_transaction_id TEXT UNIQUE,
  provider_reference TEXT,

  -- Detalles de la transacción
  payment_type TEXT, -- pse, nequi, card, cash
  description TEXT,

  -- Metadata del pago
  payment_link TEXT, -- Para pagos con redirección
  payment_url TEXT,

  -- Timestamps
  approved_at INTEGER,
  declined_at INTEGER,
  refunded_at INTEGER,

  -- Razón de rechazo/error
  decline_reason TEXT,
  error_message TEXT,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de retiros/pagos a conductores
CREATE TABLE IF NOT EXISTS driver_payouts (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  amount REAL NOT NULL,
  commission REAL NOT NULL,
  net_amount REAL NOT NULL,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Método de retiro
  payout_method TEXT, -- bank_transfer, nequi, daviplata
  bank_account TEXT,
  bank_name TEXT,
  account_holder_name TEXT,

  -- Referencia del pago
  reference_id TEXT,
  provider_payout_id TEXT,

  -- Período del pago
  period_start INTEGER,
  period_end INTEGER,

  -- Trips incluidos en este pago
  trip_ids TEXT, -- JSON array de trip IDs

  processed_at INTEGER,
  completed_at INTEGER,

  notes TEXT,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de configuración de comisiones
CREATE TABLE IF NOT EXISTS commission_config (
  id TEXT PRIMARY KEY,

  -- Comisión de la plataforma
  platform_percentage REAL DEFAULT 15.0, -- 15% de comisión
  min_commission REAL DEFAULT 500, -- Mínimo $500 COP
  max_commission REAL DEFAULT 5000, -- Máximo $5000 COP

  -- Comisión por método de pago
  pse_fee REAL DEFAULT 0, -- Sin cargo adicional
  card_fee_percentage REAL DEFAULT 2.5, -- 2.5% adicional
  nequi_fee REAL DEFAULT 0,
  daviplata_fee REAL DEFAULT 0,

  -- Configuración activa
  is_active INTEGER DEFAULT 1,

  effective_from INTEGER,
  effective_until INTEGER,

  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Insertar configuración inicial de comisiones
INSERT OR IGNORE INTO commission_config (
  id,
  platform_percentage,
  min_commission,
  max_commission,
  effective_from,
  is_active
) VALUES (
  'default_config',
  15.0,
  500,
  5000,
  strftime('%s', 'now'),
  1
);

-- Tabla de wallet/billetera del conductor
CREATE TABLE IF NOT EXISTS driver_wallets (
  id TEXT PRIMARY KEY,
  driver_id TEXT UNIQUE NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  balance REAL DEFAULT 0.0,
  total_earned REAL DEFAULT 0.0,
  total_withdrawn REAL DEFAULT 0.0,

  -- Límites
  min_withdrawal REAL DEFAULT 10000, -- Mínimo $10,000 COP para retirar

  -- Estado
  is_active INTEGER DEFAULT 1,
  is_locked INTEGER DEFAULT 0,

  last_transaction_at INTEGER,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de transacciones de wallet
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES driver_wallets(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  category TEXT NOT NULL CHECK (category IN ('trip_earning', 'withdrawal', 'refund', 'bonus', 'penalty', 'adjustment')),

  amount REAL NOT NULL,
  balance_after REAL NOT NULL,

  -- Referencia
  reference_type TEXT, -- trip, payout, manual
  reference_id TEXT,

  description TEXT,
  notes TEXT,

  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_trip ON payment_transactions(trip_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver ON driver_payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_status ON driver_payouts(status);
CREATE INDEX IF NOT EXISTS idx_driver_wallets_driver ON driver_wallets(driver_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_driver ON wallet_transactions(driver_id);

-- Trigger para actualizar balance de wallet
CREATE TRIGGER IF NOT EXISTS update_wallet_balance
AFTER INSERT ON wallet_transactions
BEGIN
  UPDATE driver_wallets
  SET
    balance = NEW.balance_after,
    last_transaction_at = NEW.created_at,
    total_earned = CASE
      WHEN NEW.type = 'credit' AND NEW.category = 'trip_earning'
      THEN total_earned + NEW.amount
      ELSE total_earned
    END,
    total_withdrawn = CASE
      WHEN NEW.type = 'debit' AND NEW.category = 'withdrawal'
      THEN total_withdrawn + NEW.amount
      ELSE total_withdrawn
    END
  WHERE id = NEW.wallet_id;
END;

-- Trigger para crear wallet automáticamente para nuevos conductores
CREATE TRIGGER IF NOT EXISTS create_driver_wallet
AFTER INSERT ON drivers
BEGIN
  INSERT INTO driver_wallets (id, driver_id)
  VALUES (NEW.id || '_wallet', NEW.id);
END;

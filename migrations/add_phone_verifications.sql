-- Tabla para códigos OTP de verificación de número de celular
CREATE TABLE IF NOT EXISTS phone_verifications (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- Unix timestamp
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);

-- Credenciales WebAuthn (Passkeys / huella digital)
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id TEXT PRIMARY KEY,                    -- credential ID en base64url
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,               -- clave pública COSE en base64url
  counter INTEGER NOT NULL DEFAULT 0,     -- contador de firmas (anti-replay)
  device_name TEXT,                       -- nombre descriptivo del dispositivo
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkey_credentials(user_id);

-- Challenges temporales WebAuthn (expiran en 5 minutos)
CREATE TABLE IF NOT EXISTS passkey_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,                -- challenge en base64url
  user_id TEXT,                           -- NULL durante login (se desconoce el usuario)
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_challenge ON passkey_challenges(challenge);

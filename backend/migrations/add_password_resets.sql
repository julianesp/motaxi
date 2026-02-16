-- Agregar tabla para códigos de recuperación de contraseña
-- Esta tabla almacena códigos temporales de 6 dígitos para resetear contraseñas

CREATE TABLE IF NOT EXISTS password_resets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reset_code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Índice para búsquedas rápidas por código
CREATE INDEX IF NOT EXISTS idx_password_resets_code ON password_resets(reset_code);

-- Índice para limpiar códigos expirados
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);

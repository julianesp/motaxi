-- Agrega campos de Telegram a la tabla users
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN telegram_link_token TEXT;

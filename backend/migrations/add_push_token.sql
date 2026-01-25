-- Migración para agregar campo push_token a la tabla users
-- Ejecutar: wrangler d1 execute motaxi-db --local --file=backend/migrations/add_push_token.sql

ALTER TABLE users ADD COLUMN push_token TEXT;

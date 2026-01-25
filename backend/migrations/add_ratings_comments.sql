-- Migración para agregar campos de comentarios en ratings
-- Ejecutar: wrangler d1 execute motaxi-db --local --file=backend/migrations/add_ratings_comments.sql

ALTER TABLE trips ADD COLUMN passenger_comment TEXT;
ALTER TABLE trips ADD COLUMN driver_comment TEXT;

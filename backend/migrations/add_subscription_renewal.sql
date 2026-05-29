-- Campos para manejo de renovación automática de suscripciones
ALTER TABLE subscriptions ADD COLUMN renewal_notified_at INTEGER DEFAULT NULL;
ALTER TABLE subscriptions ADD COLUMN renewal_reminder_days INTEGER DEFAULT NULL;

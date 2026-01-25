-- Migration: Add Chat System
-- Created: 2025-12-29
-- Description: Tables for real-time chat between driver and passenger

-- Tabla de conversaciones (una por viaje)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  trip_id TEXT UNIQUE NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  passenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),

  last_message_at INTEGER,
  last_message_text TEXT,
  last_message_sender_id TEXT,

  -- Contadores de mensajes no leídos
  passenger_unread_count INTEGER DEFAULT 0,
  driver_unread_count INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('passenger', 'driver')),

  -- Contenido del mensaje
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'location', 'system')),
  text_content TEXT,

  -- Para imágenes
  image_url TEXT,

  -- Para ubicaciones compartidas
  location_latitude REAL,
  location_longitude REAL,
  location_address TEXT,

  -- Estado del mensaje
  is_read INTEGER DEFAULT 0,
  read_at INTEGER,

  -- Metadata
  is_deleted INTEGER DEFAULT 0,
  deleted_at INTEGER,

  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tabla de typing indicators (quién está escribiendo)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  is_typing INTEGER DEFAULT 1,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER NOT NULL,

  UNIQUE(conversation_id, user_id)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_conversations_trip ON conversations(trip_id);
CREATE INDEX IF NOT EXISTS idx_conversations_passenger ON conversations(passenger_id);
CREATE INDEX IF NOT EXISTS idx_conversations_driver ON conversations(driver_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_trip ON messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read);

CREATE INDEX IF NOT EXISTS idx_typing_conversation ON typing_indicators(conversation_id);
CREATE INDEX IF NOT EXISTS idx_typing_expires ON typing_indicators(expires_at);

-- Trigger para actualizar conversación cuando llega un mensaje
CREATE TRIGGER IF NOT EXISTS update_conversation_on_message
AFTER INSERT ON messages
WHEN NEW.message_type = 'text' OR NEW.message_type = 'image'
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_text = CASE
      WHEN NEW.message_type = 'text' THEN NEW.text_content
      WHEN NEW.message_type = 'image' THEN '📷 Imagen'
      ELSE 'Mensaje'
    END,
    last_message_sender_id = NEW.sender_id,
    updated_at = NEW.created_at,
    -- Incrementar contador de no leídos del destinatario
    passenger_unread_count = CASE
      WHEN NEW.sender_role = 'driver' THEN passenger_unread_count + 1
      ELSE passenger_unread_count
    END,
    driver_unread_count = CASE
      WHEN NEW.sender_role = 'passenger' THEN driver_unread_count + 1
      ELSE driver_unread_count
    END
  WHERE id = NEW.conversation_id;
END;

-- Trigger para decrementar contador cuando se marca como leído
CREATE TRIGGER IF NOT EXISTS update_unread_on_read
AFTER UPDATE OF is_read ON messages
WHEN NEW.is_read = 1 AND OLD.is_read = 0
BEGIN
  UPDATE conversations
  SET
    passenger_unread_count = CASE
      WHEN NEW.sender_role = 'driver' AND passenger_unread_count > 0
      THEN passenger_unread_count - 1
      ELSE passenger_unread_count
    END,
    driver_unread_count = CASE
      WHEN NEW.sender_role = 'passenger' AND driver_unread_count > 0
      THEN driver_unread_count - 1
      ELSE driver_unread_count
    END
  WHERE id = NEW.conversation_id;
END;

-- Trigger para crear conversación automáticamente cuando se acepta un viaje
CREATE TRIGGER IF NOT EXISTS create_conversation_on_trip_accepted
AFTER UPDATE OF status ON trips
WHEN NEW.status = 'accepted' AND OLD.status = 'requested'
BEGIN
  INSERT OR IGNORE INTO conversations (id, trip_id, passenger_id, driver_id)
  VALUES (
    NEW.id || '_chat',
    NEW.id,
    NEW.passenger_id,
    NEW.driver_id
  );
END;

-- Trigger para cerrar conversación cuando se completa el viaje
CREATE TRIGGER IF NOT EXISTS close_conversation_on_trip_completed
AFTER UPDATE OF status ON trips
WHEN NEW.status = 'completed' OR NEW.status = 'cancelled'
BEGIN
  UPDATE conversations
  SET status = 'closed'
  WHERE trip_id = NEW.id;
END;

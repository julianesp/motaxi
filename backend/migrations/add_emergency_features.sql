-- Migration: Add Emergency Features
-- Created: 2025-12-29
-- Description: Tables for SOS alerts, emergency contacts, and trip sharing

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SOS alerts table
CREATE TABLE IF NOT EXISTS sos_alerts (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
  resolved_at INTEGER,
  resolved_by TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trip sharing table
CREATE TABLE IF NOT EXISTS trip_shares (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  shared_by_user_id TEXT NOT NULL,
  shared_with_phone TEXT NOT NULL,
  shared_with_name TEXT,
  share_token TEXT NOT NULL UNIQUE,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_trip_id ON sos_alerts(trip_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_trip_shares_token ON trip_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_trip_shares_trip_id ON trip_shares(trip_id);

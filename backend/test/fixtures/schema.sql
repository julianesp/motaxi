PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('passenger', 'driver')),
  profile_image TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
, push_token TEXT, gender TEXT CHECK (gender IN ('male', 'female', 'other')), telegram_chat_id TEXT, telegram_link_token TEXT, passenger_rating REAL DEFAULT NULL, route_cancel_count INTEGER DEFAULT 0);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE passengers (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating REAL DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  CHECK (rating >= 0 AND rating <= 5)
);
CREATE TABLE drivers (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  license_number TEXT UNIQUE NOT NULL,
  vehicle_plate TEXT UNIQUE NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_color TEXT NOT NULL,
  is_available INTEGER DEFAULT 0,
  rating REAL DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  photo_license TEXT,
  photo_vehicle TEXT,
  is_verified INTEGER DEFAULT 0,
  current_latitude REAL,
  current_longitude REAL,
  last_location_update INTEGER, municipality TEXT, accepts_intercity_trips INTEGER DEFAULT 1, accepts_rural_trips INTEGER DEFAULT 1, base_fare INTEGER DEFAULT 5000, intercity_fare INTEGER DEFAULT 10000, rural_fare INTEGER DEFAULT 8000, per_km_fare INTEGER DEFAULT 2000, verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')), rejection_reason TEXT, verified_at INTEGER, verified_by TEXT, profile_completed INTEGER DEFAULT 0, vehicle_types TEXT NOT NULL DEFAULT 'moto', profile_skipped_at INTEGER DEFAULT NULL, night_only INTEGER DEFAULT 0, whatsapp TEXT, weekend_daytime INTEGER DEFAULT 0, default_route_fares TEXT DEFAULT NULL, nequi_qr_key TEXT DEFAULT NULL, nequi_phone TEXT, usual_hours TEXT DEFAULT NULL, usual_origin TEXT DEFAULT NULL, usual_destination TEXT DEFAULT NULL, accepts_rides INTEGER DEFAULT 0, soat_image_url TEXT, soat_expiry INTEGER, soat_status TEXT DEFAULT 'pending' CHECK (soat_status IN ('pending', 'approved', 'rejected')),
  CHECK (rating >= 0 AND rating <= 5)
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('trip_request', 'trip_accepted', 'trip_started', 'trip_completed', 'trip_cancelled', 'general')),
  is_read INTEGER DEFAULT 0,
  data TEXT, -- JSON string
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cash', 'card', 'digital_wallet')),
  is_default INTEGER DEFAULT 0,
  card_last_four TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE password_resets (
  user_id TEXT PRIMARY KEY,
  reset_code TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE emergency_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE sos_alerts (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
  resolved_at INTEGER,
  resolved_by TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE trip_shares (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  shared_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_phone TEXT NOT NULL,
  shared_with_name TEXT,
  share_token TEXT NOT NULL UNIQUE,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE conversations (
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
CREATE TABLE messages (
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
CREATE TABLE typing_indicators (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  is_typing INTEGER DEFAULT 1,

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER NOT NULL,

  UNIQUE(conversation_id, user_id)
);
CREATE TABLE payment_transactions (
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
CREATE TABLE driver_payouts (
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
CREATE TABLE commission_config (
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
CREATE TABLE driver_wallets (
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
CREATE TABLE wallet_transactions (
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
CREATE TABLE favorite_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL, -- Ej: "Casa", "Trabajo", "Gimnasio"
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  place_id TEXT, -- Google Places ID para referencia
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE favorite_drivers (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT, -- Apodo opcional que el pasajero le da al conductor
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(passenger_id, driver_id) -- Un pasajero no puede tener el mismo conductor favorito dos veces
);
CREATE TABLE driver_price_offers (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  offered_price REAL NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  UNIQUE(trip_id, driver_id)
);
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  plan TEXT NOT NULL DEFAULT 'monthly',
  amount INTEGER NOT NULL DEFAULT 9900,
  trial_ends_at INTEGER NOT NULL,
  current_period_start INTEGER,
  current_period_end INTEGER,
  epayco_reference TEXT,
  epayco_transaction_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
, renewal_notified_at INTEGER DEFAULT NULL, renewal_reminder_days INTEGER DEFAULT NULL);
CREATE TABLE web_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE blocked_emails (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'trial_expired',
  blocked_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
, phone TEXT);
CREATE TABLE driver_of_month (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  avg_rating REAL NOT NULL,
  total_trips INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT DEFAULT 'free_month', -- 'free_month' = mes gratis
  reward_applied INTEGER DEFAULT 0, -- 0 = pendiente, 1 = aplicado
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(month, year)
);
CREATE TABLE named_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE saved_named_places (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(user_id, place_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (place_id) REFERENCES named_places(id) ON DELETE CASCADE
);
CREATE TABLE phone_verifications (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- Unix timestamp
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE earnings (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  commission REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL,
  paid_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_latitude REAL NOT NULL,
  pickup_longitude REAL NOT NULL,
  pickup_address TEXT,
  dropoff_latitude REAL NOT NULL,
  dropoff_longitude REAL NOT NULL,
  dropoff_address TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled')),
  fare REAL NOT NULL,
  distance_km REAL,
  duration_minutes INTEGER,
  requested_at INTEGER DEFAULT (strftime('%s', 'now')),
  accepted_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  cancelled_at INTEGER,
  cancellation_reason TEXT,
  passenger_rating INTEGER CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
  driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
  route_polyline TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  passenger_comment TEXT,
  driver_comment TEXT,
  verification_pin TEXT,
  share_link TEXT,
  panic_activated_at INTEGER,
  panic_details TEXT,
  trip_type TEXT DEFAULT 'ride',
  delivery_note TEXT
, home_pickup INTEGER NOT NULL DEFAULT 0, recipient_name TEXT, recipient_phone TEXT, package_size TEXT DEFAULT 'small' CHECK (package_size IN ('small', 'medium', 'large')), package_photo_key TEXT);
CREATE TABLE driver_photos (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_key TEXT NOT NULL,
  caption TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_visible INTEGER NOT NULL DEFAULT 1
, likes INTEGER NOT NULL DEFAULT 0);
CREATE TABLE driver_referrals (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(referred_user_id)  -- un pasajero solo puede ser referido una vez
);
CREATE TABLE referral_winner (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  referral_count INTEGER NOT NULL DEFAULT 0,
  reward_applied INTEGER NOT NULL DEFAULT 0,  -- 1 = mes gratis ya aplicado
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(month, year)
);
CREATE TABLE qr_requests (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | contacted | delivered
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(driver_id)  -- un conductor, una solicitud activa
);
CREATE TABLE shared_routes (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,           -- municipio de origen (ej. "Colón")
  destination TEXT NOT NULL,      -- municipio de destino (ej. "Mocoa")
  departure_time TEXT NOT NULL,   -- hora de salida en formato HH:MM (ej. "08:30")
  total_seats INTEGER NOT NULL DEFAULT 4,
  available_seats INTEGER NOT NULL DEFAULT 4,
  fare_per_seat INTEGER NOT NULL DEFAULT 0,  -- precio por puesto en COP
  status TEXT NOT NULL DEFAULT 'active',     -- active | departed | cancelled
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
, intermediate_fares TEXT DEFAULT NULL);
CREATE TABLE municipality_images (
  id TEXT PRIMARY KEY,
  municipality_id TEXT NOT NULL, -- 'santiago', 'colon', 'sibundoy', 'san-francisco'
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE municipality_places (
  id TEXT PRIMARY KEY,
  municipality_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'negocio',
  image_url TEXT,
  address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE passkey_credentials (
  id TEXT PRIMARY KEY,                    -- credential ID en base64url
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,               -- clave pública COSE en base64url
  counter INTEGER NOT NULL DEFAULT 0,     -- contador de firmas (anti-replay)
  device_name TEXT,                       -- nombre descriptivo del dispositivo
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_used_at INTEGER
);
CREATE TABLE passkey_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,                -- challenge en base64url
  user_id TEXT,                           -- NULL durante login (se desconoce el usuario)
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE route_requests (id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES shared_routes(id) ON DELETE CASCADE, passenger_name TEXT NOT NULL, passenger_phone TEXT NOT NULL, destination TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL DEFAULT (unixepoch()), pickup_latitude REAL DEFAULT NULL, pickup_longitude REAL DEFAULT NULL, pickup_address TEXT DEFAULT NULL, updated_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE route_ratings (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    passenger_id TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
CREATE TABLE driver_premium (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL DEFAULT 'demand_prediction'
    CHECK (feature IN ('demand_prediction')),
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'active', 'expired', 'cancelled')),
  amount INTEGER NOT NULL DEFAULT 9900,
  current_period_start INTEGER,
  current_period_end INTEGER,
  epayco_reference TEXT,
  epayco_transaction_id TEXT,
  last_notified_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (user_id, feature)
);
CREATE TABLE trip_waypoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE driver_vehicle_photos (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_key TEXT NOT NULL,
  caption TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_visible INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE app_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT,
  ease_rating INTEGER NOT NULL CHECK (ease_rating BETWEEN 1 AND 5),
  found_needed TEXT NOT NULL CHECK (found_needed IN ('yes', 'partly', 'no')),
  improvement TEXT,
  app_version TEXT,
  platform TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
DELETE FROM sqlite_sequence;
CREATE INDEX idx_drivers_available ON drivers(is_available);
CREATE INDEX idx_drivers_location ON drivers(current_latitude, current_longitude);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);
CREATE INDEX idx_sos_alerts_trip ON sos_alerts(trip_id);
CREATE INDEX idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX idx_trip_shares_token ON trip_shares(share_token);
CREATE INDEX idx_trip_shares_trip ON trip_shares(trip_id);
CREATE INDEX idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX idx_sos_alerts_trip_id ON sos_alerts(trip_id);
CREATE INDEX idx_trip_shares_trip_id ON trip_shares(trip_id);
CREATE INDEX idx_conversations_trip ON conversations(trip_id);
CREATE INDEX idx_conversations_passenger ON conversations(passenger_id);
CREATE INDEX idx_conversations_driver ON conversations(driver_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_trip ON messages(trip_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read);
CREATE INDEX idx_typing_conversation ON typing_indicators(conversation_id);
CREATE INDEX idx_typing_expires ON typing_indicators(expires_at);
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(user_id, is_default);
CREATE INDEX idx_payment_transactions_trip ON payment_transactions(trip_id);
CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_provider ON payment_transactions(provider_transaction_id);
CREATE INDEX idx_driver_payouts_driver ON driver_payouts(driver_id);
CREATE INDEX idx_driver_payouts_status ON driver_payouts(status);
CREATE INDEX idx_driver_wallets_driver ON driver_wallets(driver_id);
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_driver ON wallet_transactions(driver_id);
CREATE INDEX idx_favorite_locations_user_id ON favorite_locations(user_id);
CREATE INDEX idx_favorite_locations_created_at ON favorite_locations(created_at DESC);
CREATE INDEX idx_password_resets_code ON password_resets(reset_code);
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);
CREATE INDEX idx_favorite_drivers_passenger ON favorite_drivers(passenger_id);
CREATE INDEX idx_favorite_drivers_driver ON favorite_drivers(driver_id);
CREATE INDEX idx_driver_offers_trip_id ON driver_price_offers(trip_id);
CREATE INDEX idx_driver_offers_driver_id ON driver_price_offers(driver_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_web_push_user ON web_push_subscriptions(user_id);
CREATE INDEX idx_blocked_emails_email ON blocked_emails(email);
CREATE INDEX idx_blocked_emails_phone ON blocked_emails(phone);
CREATE INDEX idx_named_places_name ON named_places(name);
CREATE INDEX idx_named_places_created_at ON named_places(created_at DESC);
CREATE INDEX idx_saved_named_places_user ON saved_named_places(user_id);
CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone);
CREATE INDEX idx_driver_photos_driver_id ON driver_photos(driver_id);
CREATE INDEX idx_driver_photos_created_at ON driver_photos(created_at DESC);
CREATE INDEX idx_driver_referrals_driver ON driver_referrals(driver_id);
CREATE INDEX idx_qr_requests_status ON qr_requests(status);
CREATE INDEX idx_shared_routes_driver ON shared_routes(driver_id);
CREATE INDEX idx_shared_routes_status ON shared_routes(status);
CREATE INDEX idx_shared_routes_destination ON shared_routes(destination);
CREATE INDEX idx_municipality_images_status ON municipality_images(municipality_id, status);
CREATE INDEX idx_municipality_places_municipality ON municipality_places(municipality_id, status);
CREATE INDEX idx_municipality_places_user ON municipality_places(user_id);
CREATE INDEX idx_passkeys_user ON passkey_credentials(user_id);
CREATE INDEX idx_passkey_challenges_challenge ON passkey_challenges(challenge);
CREATE INDEX idx_driver_premium_user ON driver_premium(user_id);
CREATE INDEX idx_driver_premium_status ON driver_premium(status);
CREATE INDEX idx_trip_waypoints_trip ON trip_waypoints(trip_id);
CREATE INDEX idx_trip_waypoints_time ON trip_waypoints(recorded_at);
CREATE INDEX idx_driver_vehicle_photos_driver ON driver_vehicle_photos(driver_id);
CREATE INDEX idx_app_feedback_created ON app_feedback (created_at DESC);
CREATE TRIGGER update_users_timestamp
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER update_conversation_on_message
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
CREATE TRIGGER update_unread_on_read
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
CREATE TRIGGER update_wallet_balance
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
CREATE TRIGGER create_driver_wallet
AFTER INSERT ON drivers
BEGIN
  INSERT INTO driver_wallets (id, driver_id)
  VALUES (NEW.id || '_wallet', NEW.id);
END;

-- Multi-user isolation for cached order state and events.
-- Existing single-CRM cache/event rows are intentionally cleared because they
-- cannot be safely attributed to a Telegram user. Reports themselves continue
-- to come from KeyCRM and the cache will repopulate per client on next sync.

DROP TABLE IF EXISTS orders_state_v2;
CREATE TABLE orders_state_v2 (
  telegram_user_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  status_id INTEGER,
  status_name TEXT,
  payment_status TEXT,
  grand_total REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  source_id INTEGER,
  manager_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  last_seen_at TEXT,
  PRIMARY KEY (telegram_user_id, order_id)
);

DROP TABLE IF EXISTS order_events_v2;
CREATE TABLE order_events_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  amount REAL DEFAULT 0,
  event_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS orders_state;
ALTER TABLE orders_state_v2 RENAME TO orders_state;
DROP TABLE IF EXISTS order_events;
ALTER TABLE order_events_v2 RENAME TO order_events;

CREATE INDEX IF NOT EXISTS idx_orders_state_user_seen ON orders_state(telegram_user_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_order_events_user_order ON order_events(telegram_user_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_user_event_at ON order_events(telegram_user_id, event_at);

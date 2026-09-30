CREATE TABLE IF NOT EXISTS crm_connections (
  telegram_user_id INTEGER PRIMARY KEY,
  telegram_chat_id INTEGER NOT NULL,
  telegram_username TEXT,
  display_name TEXT,
  keycrm_token TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UAH',
  timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_connections_chat_id
ON crm_connections(telegram_chat_id);

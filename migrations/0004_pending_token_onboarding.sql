CREATE TABLE IF NOT EXISTS pending_token_onboarding (
  telegram_user_id INTEGER PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_token_onboarding_expires_at
  ON pending_token_onboarding(expires_at);

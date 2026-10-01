const TOKEN_WAIT_MS = 10 * 60 * 1000;

function db(env) {
  if (!env?.DB) throw new Error("D1 binding DB is not configured");
  return env.DB;
}

export async function startTokenOnboarding(env, userId) {
  const now = Date.now();
  const expiresAt = now + TOKEN_WAIT_MS;
  await db(env)
    .prepare(`INSERT INTO pending_token_onboarding (telegram_user_id, expires_at, created_at, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(telegram_user_id) DO UPDATE SET
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at`)
    .bind(Number(userId), expiresAt, new Date(now).toISOString(), new Date(now).toISOString())
    .run();
  return expiresAt;
}

export async function stopTokenOnboarding(env, userId) {
  await db(env)
    .prepare("DELETE FROM pending_token_onboarding WHERE telegram_user_id = ?")
    .bind(Number(userId))
    .run();
}

export async function isWaitingForToken(env, userId) {
  const row = await db(env)
    .prepare("SELECT expires_at FROM pending_token_onboarding WHERE telegram_user_id = ? LIMIT 1")
    .bind(Number(userId))
    .first();

  if (!row) return false;

  const expiresAt = Number(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    await stopTokenOnboarding(env, userId);
    return false;
  }

  return true;
}

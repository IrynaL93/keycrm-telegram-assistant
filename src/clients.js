import { decryptToken, encryptToken, isEncryptedToken } from "./crypto.js";

function requireDb(env) {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  return env.DB;
}

async function migrateTokenIfNeeded(env, client) {
  if (!client?.keycrm_token || isEncryptedToken(client.keycrm_token)) return client;

  const encrypted = await encryptToken(env, client.keycrm_token);
  await requireDb(env)
    .prepare(`UPDATE crm_connections SET keycrm_token = ?, updated_at = ? WHERE telegram_user_id = ?`)
    .bind(encrypted, new Date().toISOString(), Number(client.telegram_user_id))
    .run();

  return { ...client, keycrm_token: encrypted };
}

export async function getClient(env, telegramUserId) {
  const client = await requireDb(env)
    .prepare(`SELECT telegram_user_id, telegram_chat_id, telegram_username, display_name, keycrm_token, currency, timezone, is_active, created_at, updated_at FROM crm_connections WHERE telegram_user_id = ? AND is_active = 1 LIMIT 1`)
    .bind(Number(telegramUserId))
    .first();

  return migrateTokenIfNeeded(env, client);
}

export async function listActiveClients(env) {
  const result = await requireDb(env)
    .prepare(`SELECT telegram_user_id, telegram_chat_id, telegram_username, display_name, keycrm_token, currency, timezone, is_active, created_at, updated_at FROM crm_connections WHERE is_active = 1 ORDER BY telegram_user_id`)
    .all();
  const clients = [];
  for (const client of result.results || []) clients.push(await migrateTokenIfNeeded(env, client));
  return clients;
}

export async function saveClient(env, client) {
  const now = new Date().toISOString();
  const encryptedToken = await encryptToken(env, client.keycrmToken);

  await requireDb(env).prepare(`
    INSERT INTO crm_connections
      (telegram_user_id, telegram_chat_id, telegram_username, display_name, keycrm_token, currency, timezone, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      telegram_chat_id = excluded.telegram_chat_id,
      telegram_username = excluded.telegram_username,
      display_name = excluded.display_name,
      keycrm_token = excluded.keycrm_token,
      currency = excluded.currency,
      timezone = excluded.timezone,
      is_active = 1,
      updated_at = excluded.updated_at
  `).bind(
    Number(client.telegramUserId),
    Number(client.telegramChatId),
    client.telegramUsername || null,
    client.displayName || null,
    encryptedToken,
    client.currency || "UAH",
    client.timezone || "Europe/Kyiv",
    now,
    now
  ).run();
  return getClient(env, client.telegramUserId);
}

export async function disconnectClient(env, telegramUserId) {
  await requireDb(env).prepare(`UPDATE crm_connections SET is_active = 0, updated_at = ? WHERE telegram_user_id = ?`)
    .bind(new Date().toISOString(), Number(telegramUserId)).run();
}

export async function envForClient(env, client) {
  if (!client?.keycrm_token) throw new Error("KeyCRM is not connected for this Telegram user");
  const token = await decryptToken(env, client.keycrm_token);
  return {
    ...env,
    KEYCRM_TOKEN: token,
    KEYCRM_API_TOKEN: token,
    CLIENT_USER_ID: Number(client.telegram_user_id),
    CLIENT_CHAT_ID: Number(client.telegram_chat_id),
    CURRENCY: client.currency || env.CURRENCY || "UAH",
    TIMEZONE: client.timezone || env.TIMEZONE || "Europe/Kyiv"
  };
}

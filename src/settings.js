import { getOrderStatuses } from "./keycrm.js";

export const STATUS_GROUPS = ["delivered", "delivery", "cancelled"];

function statusId(status) {
  return String(status?.id ?? status?.alias ?? status?.code ?? status?.key ?? status?.slug ?? "");
}

function statusName(status) {
  return status?.name || status?.title || status?.label || status?.display_name || statusId(status);
}

export async function getStatusSettings(env, chatId) {
  const groups = { delivered: [], delivery: [], cancelled: [] };
  if (!env.DB) return groups;
  const result = await env.DB.prepare(
    `SELECT setting_key, setting_value FROM report_settings WHERE chat_id = ? AND setting_key LIKE 'status_%'`
  ).bind(String(chatId)).all();
  for (const row of result.results || []) {
    const key = String(row.setting_key || "").replace(/^status_/, "");
    if (!STATUS_GROUPS.includes(key)) continue;
    try {
      const parsed = JSON.parse(row.setting_value || "[]");
      groups[key] = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      groups[key] = [];
    }
  }
  return groups;
}

export async function saveStatusGroup(env, chatId, groupKey, ids) {
  if (!env.DB) throw new Error("D1 database is not configured");
  if (!STATUS_GROUPS.includes(groupKey)) throw new Error("Unknown status group");
  await env.DB.prepare(
    `INSERT INTO report_settings (chat_id, setting_key, setting_value, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(chat_id, setting_key) DO UPDATE SET
       setting_value = excluded.setting_value,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(String(chatId), `status_${groupKey}`, JSON.stringify((ids || []).map(String))).run();
}

export async function toggleStatus(env, chatId, groupKey, id) {
  const groups = await getStatusSettings(env, chatId);
  const current = new Set(groups[groupKey] || []);
  const value = String(id);
  if (current.has(value)) current.delete(value); else current.add(value);
  const ids = [...current];
  await saveStatusGroup(env, chatId, groupKey, ids);
  groups[groupKey] = ids;
  return groups;
}

export async function loadStatuses(env) {
  const statuses = await getOrderStatuses(env);
  return (statuses || []).map(status => ({ ...status, _id: statusId(status), _name: statusName(status) })).filter(s => s._id);
}

export function settingsSummary(groups, statuses) {
  const names = new Map((statuses || []).map(s => [String(s._id), s._name]));
  const line = (label, ids) => {
    const values = (ids || []).map(id => names.get(String(id)) || `#${id}`);
    return `<b>${label}</b>\n${values.length ? values.map(v => `• ${v}`).join("\n") : "• не налаштовано"}`;
  };
  return [
    "⚙️ <b>Налаштування статусів звіту</b>",
    "",
    "Оберіть групу та позначте статуси KeyCRM, які мають входити до неї.",
    "",
    line("📥 Отримано / виконано", groups.delivered),
    "",
    line("🚚 В доставці", groups.delivery),
    "",
    line("❌ Скасовано / відмови", groups.cancelled)
  ].join("\n");
}

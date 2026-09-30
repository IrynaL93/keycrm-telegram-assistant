import { getOrderStatuses } from "./keycrm.js";

export const STATUS_GROUPS = ["new", "work", "production", "delivery", "delivered", "cancelled"];
export const PAYMENT_GROUPS = ["paid", "partial", "unpaid"];

export const STATUS_LABELS = {
  new: "🆕 Нові",
  work: "🤝 Погодження / в роботі",
  production: "🏭 Виробництво",
  delivery: "🚚 В доставці",
  delivered: "📥 Отримано / виконано",
  cancelled: "❌ Скасовано / відмови"
};

export const PAYMENT_LABELS = {
  paid: "✅ Повністю оплачено",
  partial: "🟡 Частково оплачено",
  unpaid: "⚪ Не оплачено"
};

function statusId(status) {
  return String(status?.id ?? status?.alias ?? status?.code ?? status?.key ?? status?.slug ?? "");
}

function statusName(status) {
  return status?.name || status?.title || status?.label || status?.display_name || statusId(status);
}

function emptyStatusGroups() {
  return Object.fromEntries(STATUS_GROUPS.map(key => [key, []]));
}

export async function getStatusSettings(env, chatId) {
  const groups = emptyStatusGroups();
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

export async function getPaymentSettings(env, chatId) {
  const defaults = { paid: true, partial: true, unpaid: true };
  if (!env.DB) return defaults;
  const result = await env.DB.prepare(
    `SELECT setting_key, setting_value FROM report_settings WHERE chat_id = ? AND setting_key LIKE 'payment_%'`
  ).bind(String(chatId)).all();
  for (const row of result.results || []) {
    const key = String(row.setting_key || "").replace(/^payment_/, "");
    if (!PAYMENT_GROUPS.includes(key)) continue;
    defaults[key] = String(row.setting_value).toLowerCase() !== "false";
  }
  return defaults;
}

export async function togglePaymentSetting(env, chatId, key) {
  if (!env.DB) throw new Error("D1 database is not configured");
  if (!PAYMENT_GROUPS.includes(key)) throw new Error("Unknown payment setting");
  const current = await getPaymentSettings(env, chatId);
  const next = !current[key];
  await env.DB.prepare(
    `INSERT INTO report_settings (chat_id, setting_key, setting_value, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(chat_id, setting_key) DO UPDATE SET
       setting_value = excluded.setting_value,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(String(chatId), `payment_${key}`, String(next)).run();
  current[key] = next;
  return current;
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
    "📦 <b>Статуси замовлень</b>",
    "",
    "Оберіть групу та позначте статуси KeyCRM, які мають входити до неї.",
    "",
    ...STATUS_GROUPS.flatMap((key, index) => [line(STATUS_LABELS[key], groups[key]), ...(index < STATUS_GROUPS.length - 1 ? [""] : [])])
  ].join("\n");
}

export function paymentSettingsSummary(settings) {
  return [
    "💳 <b>Налаштування оплати</b>",
    "",
    "Оплата в KeyCRM рахується за фактичними платежами, а не за статусом замовлення.",
    "Тут можна обрати, які категорії показувати у звіті:",
    "",
    ...PAYMENT_GROUPS.map(key => `${settings[key] ? "✅" : "▫️"} ${PAYMENT_LABELS[key]}`)
  ].join("\n");
}

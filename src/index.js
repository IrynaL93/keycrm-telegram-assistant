import { buildOrdersReport } from "./reports.js";
import { syncOrderState } from "./order-state.js";
import { answerCallback, mainKeyboard, sendMessage, statusSettingsKeyboard, statusGroupKeyboard } from "./telegram.js";
import { getStatusSettings, loadStatuses, settingsSummary, toggleStatus } from "./settings.js";

function validWebhook(request, env) {
  if (!env.WEBHOOK_SECRET) return true;
  return request.headers.get("X-Telegram-Bot-Api-Secret-Token") === env.WEBHOOK_SECRET;
}

async function telegramApi(env, method, body = {}) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram API error (${response.status})`);
  return data;
}

async function setupWebhook(request, env) {
  try {
    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/webhook`;
    const body = { url: webhookUrl, allowed_updates: ["message", "callback_query"], drop_pending_updates: true };
    if (env.WEBHOOK_SECRET) body.secret_token = env.WEBHOOK_SECRET;
    await telegramApi(env, "setWebhook", body);
    const info = await telegramApi(env, "getWebhookInfo");
    return Response.json({ ok: true, message: "Telegram webhook configured", webhook_url: info.result?.url || webhookUrl, pending_update_count: info.result?.pending_update_count ?? 0, last_error_message: info.result?.last_error_message || null, secret_token_enabled: Boolean(env.WEBHOOK_SECRET) });
  } catch (error) {
    console.error("Webhook setup failed", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

async function buildSyncedReport(env, period) {
  try { await syncOrderState(env); }
  catch (error) { console.error("Order state sync failed", error); }
  return buildOrdersReport(env, period);
}

async function showStatusSettings(env, chatId) {
  const [groups, statuses] = await Promise.all([getStatusSettings(env, chatId), loadStatuses(env)]);
  return sendMessage(env, chatId, settingsSummary(groups, statuses), statusSettingsKeyboard(groups));
}

async function showStatusGroup(env, chatId, groupKey) {
  const [groups, statuses] = await Promise.all([getStatusSettings(env, chatId), loadStatuses(env)]);
  const labels = { delivered: "📥 Отримано / виконано", delivery: "🚚 В доставці", cancelled: "❌ Скасовано / відмови" };
  return sendMessage(env, chatId, `⚙️ <b>${labels[groupKey] || groupKey}</b>\n\nНатисніть на статус, щоб додати або прибрати його з цієї групи.`, statusGroupKeyboard(groupKey, statuses, groups[groupKey] || []));
}

async function handleUpdate(update, env) {
  console.log("TG update", JSON.stringify({ update_id: update.update_id, has_message: Boolean(update.message), has_callback_query: Boolean(update.callback_query), callback_data: update.callback_query?.data || null }));

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    if (text === "/start") return sendMessage(env, chatId, `👋 <b>${env.COMPANY_NAME || "KeyCRM"} Telegram Assistant</b>\n\nОберіть звіт:`, mainKeyboard());
    if (text === "/getreport" || text === "/report") {
      try { return sendMessage(env, chatId, await buildSyncedReport(env, "yesterday"), mainKeyboard()); }
      catch (error) { console.error("Report command failed", error); return sendMessage(env, chatId, `⚠️ Помилка формування звіту: ${error.message}`, mainKeyboard()); }
    }
    return sendMessage(env, chatId, "Натисніть /start, щоб відкрити меню.", mainKeyboard());
  }

  if (update.callback_query) {
    const callback = update.callback_query;
    const chatId = callback.message?.chat?.id;
    const data = callback.data || "";
    try { await answerCallback(env, callback.id); } catch (error) { console.error("answerCallback failed", error); }
    if (!chatId) return;

    if (data === "settings_statuses") {
      try { return await showStatusSettings(env, chatId); }
      catch (error) { console.error("Settings failed", error); return sendMessage(env, chatId, `⚠️ Помилка налаштувань: ${error.message}`, mainKeyboard()); }
    }
    if (data === "settings_back") return sendMessage(env, chatId, "Оберіть звіт:", mainKeyboard());
    if (data.startsWith("settings_group_")) {
      const groupKey = data.slice("settings_group_".length);
      try { return await showStatusGroup(env, chatId, groupKey); }
      catch (error) { console.error("Settings group failed", error); return sendMessage(env, chatId, `⚠️ Помилка налаштувань: ${error.message}`, mainKeyboard()); }
    }
    if (data.startsWith("settings_toggle_")) {
      const rest = data.slice("settings_toggle_".length);
      const separator = rest.indexOf("_");
      const groupKey = separator >= 0 ? rest.slice(0, separator) : "";
      const statusId = separator >= 0 ? rest.slice(separator + 1) : "";
      try {
        await toggleStatus(env, chatId, groupKey, statusId);
        return await showStatusGroup(env, chatId, groupKey);
      } catch (error) {
        console.error("Settings toggle failed", error);
        return sendMessage(env, chatId, `⚠️ Не вдалося зберегти статус: ${error.message}`, mainKeyboard());
      }
    }

    if (data.startsWith("orders_")) {
      const period = data.slice("orders_".length);
      console.log("Building report", JSON.stringify({ chatId, period }));
      try {
        const report = await buildSyncedReport(env, period);
        console.log("Report built", JSON.stringify({ period, length: report?.length || 0 }));
        return sendMessage(env, chatId, report, mainKeyboard());
      } catch (error) {
        console.error("Callback report failed", error);
        return sendMessage(env, chatId, `⚠️ Помилка формування звіту (${period}): ${error.message}`, mainKeyboard());
      }
    }
    return sendMessage(env, chatId, `⚠️ Невідома команда кнопки: ${data}`, mainKeyboard());
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return Response.json({ ok: true, service: "keycrm-telegram-assistant", version: "3.5.0", d1: Boolean(env.DB) });
    if (request.method === "GET" && url.pathname === "/setup") return setupWebhook(request, env);
    if (request.method !== "POST" || url.pathname !== "/webhook") return new Response("Not found", { status: 404 });
    if (!validWebhook(request, env)) return new Response("Unauthorized", { status: 401 });
    try {
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update, env).catch(error => console.error("handleUpdate failed", error)));
      return new Response("OK");
    } catch (error) {
      console.error("Webhook JSON parsing failed", error);
      return new Response("Bad request", { status: 400 });
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      syncOrderState(env)
        .then(result => console.log("Scheduled order-state sync", JSON.stringify({ cron: controller.cron, ...result })))
        .catch(error => console.error("Scheduled order-state sync failed", error))
    );
  }
};

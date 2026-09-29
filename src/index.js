import { buildOrdersReport } from "./reports.js";
import { syncOrderState } from "./order-state.js";
import { answerCallback, mainKeyboard, sendMessage } from "./telegram.js";

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
    if (request.method === "GET" && url.pathname === "/health") return Response.json({ ok: true, service: "keycrm-telegram-assistant", version: "3.3.0", d1: Boolean(env.DB) });
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
  }
};

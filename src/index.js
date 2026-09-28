import { buildOrdersReport } from "./reports.js";
import { answerCallback, mainKeyboard, sendMessage } from "./telegram.js";

function validWebhook(request, env) {
  if (!env.WEBHOOK_SECRET) return true;
  return request.headers.get("X-Telegram-Bot-Api-Secret-Token") === env.WEBHOOK_SECRET;
}

async function handleUpdate(update, env) {
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || "";

    if (text === "/start") {
      return sendMessage(env, chatId, `👋 <b>${env.COMPANY_NAME || "KeyCRM"} Telegram Assistant</b>\n\nОберіть звіт:`, mainKeyboard());
    }

    if (text === "/getreport" || text === "/report") {
      const report = await buildOrdersReport(env, "yesterday");
      return sendMessage(env, chatId, report, mainKeyboard());
    }

    return sendMessage(env, chatId, "Натисніть /start, щоб відкрити меню.", mainKeyboard());
  }

  if (update.callback_query) {
    const callback = update.callback_query;
    await answerCallback(env, callback.id);
    const chatId = callback.message.chat.id;
    const data = callback.data || "";

    if (data.startsWith("orders_")) {
      const period = data.slice("orders_".length);
      const report = await buildOrdersReport(env, period);
      return sendMessage(env, chatId, report, mainKeyboard());
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "keycrm-telegram-assistant", version: "3.0.0" });
    }

    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("Not found", { status: 404 });
    }

    if (!validWebhook(request, env)) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update, env).catch(console.error));
      return new Response("OK");
    } catch (error) {
      console.error(error);
      return new Response("Bad request", { status: 400 });
    }
  }
};

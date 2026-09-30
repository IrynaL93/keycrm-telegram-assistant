function apiUrl(env, method) {
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function telegram(env, method, payload) {
  const response = await fetch(apiUrl(env, method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || response.status}`);
  return data.result;
}

export function sendMessage(env, chatId, text, replyMarkup) {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export function answerCallback(env, callbackQueryId) {
  return telegram(env, "answerCallbackQuery", { callback_query_id: callbackQueryId });
}

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📊 Звіт за вчора", callback_data: "orders_yesterday" }],
      [{ text: "📅 Сьогодні", callback_data: "orders_today" }],
      [{ text: "📅 Цей тиждень", callback_data: "orders_this_week" }],
      [{ text: "📅 Цей місяць", callback_data: "orders_this_month" }],
      [{ text: "⚙️ Налаштування звітів", callback_data: "settings_home" }]
    ]
  };
}

export function settingsHomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📦 Статуси замовлень", callback_data: "settings_statuses" }],
      [{ text: "💳 Оплата", callback_data: "settings_payments" }],
      [{ text: "⬅️ До звітів", callback_data: "settings_back" }]
    ]
  };
}

export function statusSettingsKeyboard(groups) {
  const labels = {
    new: "🆕 Нові",
    work: "🤝 Погодження / в роботі",
    production: "🏭 Виробництво",
    delivery: "🚚 В доставці",
    delivered: "📥 Отримано / виконано",
    cancelled: "❌ Скасовано / відмови"
  };
  return {
    inline_keyboard: [
      ...Object.keys(labels).map(key => [{
        text: `${labels[key]} (${groups[key]?.length || 0})`,
        callback_data: `settings_group_${key}`
      }]),
      [{ text: "⬅️ Налаштування", callback_data: "settings_home" }]
    ]
  };
}

export function statusGroupKeyboard(groupKey, statuses, selectedIds) {
  const selected = new Set((selectedIds || []).map(String));
  const rows = (statuses || []).map(status => {
    const id = String(status.id ?? status.alias ?? status.code ?? status.key ?? status.slug ?? "");
    const name = status.name || status.title || status.label || status.display_name || id;
    return [{
      text: `${selected.has(id) ? "✅" : "▫️"} ${name}`,
      callback_data: `settings_toggle_${groupKey}_${id}`
    }];
  });
  rows.push([{ text: "⬅️ Статуси замовлень", callback_data: "settings_statuses" }]);
  return { inline_keyboard: rows };
}

export function paymentSettingsKeyboard(settings) {
  const labels = {
    paid: "Повністю оплачено",
    partial: "Частково оплачено",
    unpaid: "Не оплачено"
  };
  return {
    inline_keyboard: [
      ...Object.keys(labels).map(key => [{
        text: `${settings[key] ? "✅" : "▫️"} ${labels[key]}`,
        callback_data: `settings_payment_${key}`
      }]),
      [{ text: "⬅️ Налаштування", callback_data: "settings_home" }]
    ]
  };
}

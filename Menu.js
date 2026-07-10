/**
 * KEYCRM TELEGRAM ASSISTANT
 * Menu.gs
 */

/**
 * Показати головне меню (нове повідомлення, реакція на /start)
 */
function showMainMenu(chatId) {
  const keyboard = createKeyboard([
    [{ text: "📦 Замовлення", callback_data: "menu_orders" }],
    [{ text: "📊 Звіти", callback_data: "menu_reports" }],
    [{ text: "⚙️ Налаштування", callback_data: "menu_settings" }]
  ]);

  return sendMessage(chatId, "👋 *Головне меню*\n\nОберіть розділ:", keyboard);
}

/**
 * Редагувати існуюче повідомлення під головне меню (при натисканні "Назад")
 */
function editMainMenu(chatId, messageId) {
  const keyboard = createKeyboard([
    [{ text: "📦 Замовлення", callback_data: "menu_orders" }],
    [{ text: "📊 Звіти", callback_data: "menu_reports" }],
    [{ text: "⚙️ Налаштування", callback_data: "menu_settings" }]
  ]);

  return editMessage(chatId, messageId, "👋 *Головне меню*\n\nОберіть розділ:", keyboard);
}

/**
 * Меню замовлень (з твого коду)
 */
function editOrdersMenu(chatId, messageId) {
  const keyboard = createKeyboard([
    [{ text: "📅 Сьогодні", callback_data: "orders_today" }, { text: "📅 Вчора", callback_data: "orders_yesterday" }],
    [{ text: "📅 Цей тиждень", callback_data: "orders_this_week" }],
    [{ text: "📅 Минулий тиждень", callback_data: "orders_last_week" }],
    [{ text: "📅 Цей місяць", callback_data: "orders_this_month" }],
    [{ text: "📅 Минулий місяць", callback_data: "orders_last_month" }],
    [{ text: "⬇️ Експорт (Google Sheets)", callback_data: "orders_export_menu" }], 
    [{ text: "⬅️ Назад", callback_data: "menu_main" }]
  ]);

  return editMessage(chatId, messageId, "📦 *Замовлення*\n\nОберіть період для перегляду або експорту:", keyboard);
}

/**
 * Меню вибору формату експорту (з твого коду)
 */
function editExportMenu(chatId, messageId, period) {
  const keyboard = createKeyboard([
    [{ text: "🔗 Google Sheets", callback_data: "export_gs_" + period }, 
     { text: "💾 Excel", callback_data: "export_xlsx_" + period }],
    [{ text: "⬅️ Назад", callback_data: "menu_orders" }]
  ]);

  return editMessage(chatId, messageId, "📥 *Експорт замовлень*\n\nОберіть формат файлу:", keyboard);
}

/**
 * Меню звітів (щоб не було помилок, якщо натиснеш на кнопку)
 */
function editReportsMenu(chatId, messageId) {
  const keyboard = createKeyboard([
    [{ text: "📊 Статуси замовлень", callback_data: "reports_statuses" }],
    [{ text: "⬅️ Назад", callback_data: "menu_main" }]
  ]);
  
  return editMessage(chatId, messageId, "📊 *Звіти*\n\nОберіть тип звіту:", keyboard);
}

/**
 * Меню налаштувань (щоб не було помилок)
 */
function editSettingsMenu(chatId, messageId) {
  const keyboard = createKeyboard([
    [{ text: "⬅️ Назад", callback_data: "menu_main" }]
  ]);
  
  return editMessage(chatId, messageId, "⚙️ *Налаштування*\n\nТут поки нічого немає.", keyboard);
}
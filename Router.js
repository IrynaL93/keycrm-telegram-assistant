/*************************************************
 * KEYCRM TELEGRAM ASSISTANT
 * Router.gs (Оновлений для динамічних періодів)
 *************************************************/

function route(update) {
  if (update.message) return handleMessage(update.message);
  if (update.callback_query) return handleCallback(update.callback_query);
}

function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || "";

  switch (text) {
    case "/start": 
      showMainMenu(chatId); 
      break;
    default: 
      sendMessage(chatId, "Натисніть /start для головного меню.");
  }
}

function handleCallback(callback) {
  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;
  const data = callback.data;

  answerCallback(callback.id);

  // 1. Статичні маршрути меню
  if (data === "menu_main") return editMainMenu(chatId, messageId);
  if (data === "menu_orders") return editOrdersMenu(chatId, messageId);
  if (data === "menu_reports") return editReportsMenu(chatId, messageId);
  if (data === "menu_settings") return editSettingsMenu(chatId, messageId);

  // 2. ДИНАМІЧНА ОБРОБКА ВСІХ ЗВІТІВ (за періодами)
  // Працює для: orders_today, orders_yesterday, orders_this_week, etc.
  if (data.startsWith("orders_") && data !== "orders_export_menu") {
    const period = data.replace("orders_", "");
    return sendPeriodReport(chatId, period);
  }

  // 3. Меню експорту (вибір формату)
  if (data === "orders_export_menu") return editExportMenu(chatId, messageId, "today"); // За замовчуванням today

  if (data.startsWith("export_menu_")) {
    const period = data.split("_")[2];
    return editExportMenu(chatId, messageId, period);
  }

  // 4. Виконання експорту
  if (data.startsWith("export_gs_") || data.startsWith("export_xlsx_")) {
    const parts = data.split("_");
    const type = parts[1]; // gs або xlsx
    const period = parts[2];
    
    if (type === "gs") {
      return exportOrdersByPeriod(chatId, period);
    } else if (type === "xlsx") {
      // Логіка створення Excel
      const orders = getOrdersByPeriod(period);
      const blob = createExcelFile(orders);
      return sendDocument(chatId, blob, "Orders_" + period + ".xlsx");
    }
  }

  Logger.log("Невідомий callback: " + data);
}
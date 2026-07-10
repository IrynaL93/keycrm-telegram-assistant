/**
 * KEYCRM TELEGRAM ASSISTANT
 * Reports.gs
 */

/**
 * Універсальна відправка звіту за будь-який період
 */
function sendPeriodReport(chatId, period) {
  // Словник для гарного відображення тексту
  const periodNames = {
    "today": "сьогодні",
    "yesterday": "вчора",
    "this_week": "цей тиждень",
    "last_week": "минулий тиждень",
    "this_month": "цей місяць",
    "last_month": "минулий місяць"
  };
  
  const periodName = periodNames[period] || period;

  // 1. Повідомлення очікування
  const loadingResponse = sendMessage(
    chatId, 
    `⏳ *Підключаюсь до KeyCRM...*\nРахую замовлення за ${periodName}, зачекайте...`
  );
  
  if (!loadingResponse || !loadingResponse.result) return;
  const messageId = loadingResponse.result.message_id;

  try {
    // 2. Отримуємо замовлення (функцію getOrdersByPeriod додамо в KeyCRM.gs)
    const orders = getOrdersByPeriod(period); 
    const reportText = buildOrdersReport(orders, periodName);

    // 3. Відправляємо готовий звіт
    const keyboard = createKeyboard([
      [{ text: "⬅️ Назад до меню", callback_data: "menu_orders" }]
    ]);
    editMessage(chatId, messageId, reportText, keyboard);
    
  } catch (error) {
    editMessage(chatId, messageId, "❌ *Помилка при завантаженні звіту:*\n" + error.message);
  }
}

/**
 * Тут має бути твоя функція buildOrdersReport, 
 * яка формує текст (залишаю шаблон, якщо він у тебе був тут)
 */
function buildOrdersReport(orders, periodName) {
  if (!orders || orders.length === 0) {
    return `📊 *Звіт за ${periodName}*\n\nЗамовлень не знайдено.`;
  }
  
  // Твоя логіка підрахунку сум та кількості...
  return `📊 *Звіт за ${periodName}*\n\nЗнайдено замовлень: ${orders.length}`; 
}
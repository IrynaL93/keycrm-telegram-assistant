/*************************************************
 *        KEYCRM TELEGRAM ASSISTANT
 *               Orders.gs
 *************************************************/

/**
 * Звіт за сьогодні
 */
function sendTodayReport(chatId) {

  const orders = getTodayOrders();

  const report = buildOrdersReport(orders);

  sendMessage(chatId, report);

}


/**
 * Звіт за вчора
 */
function sendYesterdayReport(chatId) {

  const orders = getYesterdayOrders();

  const report = buildOrdersReport(orders);

  sendMessage(chatId, report);

}
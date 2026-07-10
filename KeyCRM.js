/*************************************************
 *        KEYCRM TELEGRAM ASSISTANT
 *              KeyCRM.gs
 *************************************************/

/**
 * Виконати GET запит до KeyCRM
 */
function keycrmGet(endpoint, params = {}) {

  const query = Object.keys(params)
    .map(key => key + "=" + encodeURIComponent(params[key]))
    .join("&");

  const url = KEYCRM_API + endpoint + (query ? "?" + query : "");

  const response = UrlFetchApp.fetch(url, {

    method: "get",

    headers: {
      Authorization: "Bearer " + KEYCRM_TOKEN,
      Accept: "application/json"
    },

    muteHttpExceptions: true

  });

  const code = response.getResponseCode();

  if (code !== 200) {

    throw new Error(
      "KeyCRM API Error " +
      code +
      "\n\n" +
      response.getContentText()
    );

  }

  return JSON.parse(response.getContentText());

}


/**
 * Отримати всі замовлення
 */
/**
 * Отримати всі замовлення (Оптимізовано)
 */
function getOrders(params = {}) {
  let page = 1;
  let orders = [];
  const MAX_PAGES = 10; // Запобіжник: максимум 500 замовлень за раз (10 сторінок по 50)

  while (page <= MAX_PAGES) {
    const response = keycrmGet("/order", {
      page: page,
      limit: 50, // В KeyCRM 50 - це зазвичай максимум, але переконайся, чи не дозволяє API 100
      ...params
    });

    if (response && response.data) {
      orders = orders.concat(response.data);
    }

    // Якщо наступної сторінки немає або масив порожній - зупиняємо цикл
    if (!response.next_page_url || response.data.length === 0) {
      break;
    }

    page++;
  }

  return orders;
}


/**
 * Отримати замовлення по періоду
 */
function getOrdersByPeriod(period) {

  let from = "";
  let to = "";

  switch (period) {

    case "today":

      from = today();
      to = today();

      break;


    case "yesterday":

      from = yesterday();
      to = yesterday();

      break;


    case "this_week":

      const w1 = thisWeek();

      from = w1.from;
      to = w1.to;

      break;


    case "last_week":

      const w2 = lastWeek();

      from = w2.from;
      to = w2.to;

      break;


    case "this_month":

      const m1 = thisMonth();

      from = m1.from;
      to = m1.to;

      break;


    case "last_month":

      const m2 = lastMonth();

      from = m2.from;
      to = m2.to;

      break;

  }

  return getOrders({

    ordered_at_from: from + " 00:00:00",

    ordered_at_to: to + " 23:59:59"

  });

}


/**
 * Отримати інформацію про одне замовлення
 */
function getOrder(orderId) {

  return keycrmGet("/order/" + orderId);

}

/**
 * Замовлення за сьогодні
 */
function getTodayOrders() {

  const todayDate = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

  return getOrders({
    ordered_at_from: todayDate + " 00:00:00",
    ordered_at_to: todayDate + " 23:59:59"
  });

}


/**
 * Замовлення за вчора
 */
function getYesterdayOrders() {

  const d = new Date();
  d.setDate(d.getDate() - 1);

  const yesterdayDate = Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

  return getOrders({
    ordered_at_from: yesterdayDate + " 00:00:00",
    ordered_at_to: yesterdayDate + " 23:59:59"
  });

}
// Допоміжні функції для роботи з датами
function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function thisWeek() {
  const d = new Date();
  const day = d.getDay() || 7; // Понеділок = 1, неділя = 7
  const start = new Date(d);
  start.setDate(d.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: formatDate(start), to: formatDate(end) };
}

function lastWeek() {
  const d = new Date();
  const day = d.getDay() || 7;
  const start = new Date(d);
  start.setDate(d.getDate() - day - 6);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: formatDate(start), to: formatDate(end) };
}

function thisMonth() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: formatDate(from), to: formatDate(to) };
}

function lastMonth() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const to = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: formatDate(from), to: formatDate(to) };
}

// Службова функція форматування
function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}
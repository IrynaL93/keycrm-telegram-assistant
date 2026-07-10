/*************************************************
 *        KEYCRM TELEGRAM ASSISTANT
 *                Utils.gs
 *************************************************/

/**
 * Поточна дата YYYY-MM-DD
 */
function today() {
  return Utilities.formatDate(
    new Date(),
    TIMEZONE,
    DATE_FORMAT
  );
}

/**
 * Вчора
 */
function yesterday() {

  const d = new Date();
  d.setDate(d.getDate() - 1);

  return Utilities.formatDate(
    d,
    TIMEZONE,
    DATE_FORMAT
  );

}


/**
 * Початок та кінець поточного тижня
 */
function thisWeek() {

  const now = new Date();

  const day = now.getDay() || 7;

  const start = new Date(now);
  start.setDate(now.getDate() - day + 1);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    from: formatDate(start),
    to: formatDate(end)
  };

}


/**
 * Початок та кінець минулого тижня
 */
function lastWeek() {

  const range = thisWeek();

  const start = new Date(range.from);
  start.setDate(start.getDate() - 7);

  const end = new Date(range.to);
  end.setDate(end.getDate() - 7);

  return {
    from: formatDate(start),
    to: formatDate(end)
  };

}


/**
 * Поточний місяць
 */
function thisMonth() {

  const now = new Date();

  return {

    from: Utilities.formatDate(
      new Date(now.getFullYear(), now.getMonth(), 1),
      TIMEZONE,
      DATE_FORMAT
    ),

    to: Utilities.formatDate(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
      TIMEZONE,
      DATE_FORMAT
    )

  };

}


/**
 * Минулий місяць
 */
function lastMonth() {

  const now = new Date();

  return {

    from: Utilities.formatDate(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      TIMEZONE,
      DATE_FORMAT
    ),

    to: Utilities.formatDate(
      new Date(now.getFullYear(), now.getMonth(), 0),
      TIMEZONE,
      DATE_FORMAT
    )

  };

}


/**
 * Форматувати дату
 */
function formatDate(date) {

  return Utilities.formatDate(
    new Date(date),
    TIMEZONE,
    DATE_FORMAT
  );

}


/**
 * Формат суми
 */
function formatMoney(value) {

  return Number(value || 0)
    .toLocaleString("uk-UA");

}


/**
 * Лог
 */
function log(data) {

  Logger.log(
    JSON.stringify(data, null, 2)
  );

}
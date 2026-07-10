function doPost(e) {
  // Захист від порожніх запитів
  if (!e || typeof e.postData === 'undefined') return ContentService.createTextOutput("OK");

  try {
    let update = JSON.parse(e.postData.contents);
    let updateId = update.update_id.toString();
    let cache = CacheService.getScriptCache();
    
    // Захист від дублів (кеш на 15 хв)
    if (cache.get(updateId)) return ContentService.createTextOutput("OK");
    cache.put(updateId, "processed", 900);
    
    route(update);
  } catch (error) {
    Logger.log("Помилка: " + error.toString());
  }
  
  // ЗАВЖДИ повертаємо 200 OK, щоб Telegram не повторював запит
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
}

// ФУНКЦІЯ ДЛЯ ОЧИЩЕННЯ: Виконати один раз, щоб зупинити старі циклічні запити
function resetWebhook() {
  UrlFetchApp.fetch(TELEGRAM_API + "/deleteWebhook");
  const payload = { url: ScriptApp.getService().getUrl(), drop_pending_updates: true };
  UrlFetchApp.fetch(TELEGRAM_API + "/setWebhook", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}
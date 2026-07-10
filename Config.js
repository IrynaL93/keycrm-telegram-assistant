/*************************************************
 *           KEYCRM TELEGRAM ASSISTANT
 *                Config.gs
 *************************************************/

// =====================================
// TELEGRAM
// =====================================

// Telegram Bot Token
const TELEGRAM_TOKEN = "8869729606:AAHxmtX7S-ZM6oMmPrTJxRd4lbRlROOs01k";

// Telegram API
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;


// =====================================
// WEB APP
// =====================================

// Після першого Deploy сюди вставимо URL Web App
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyQ6umVvKPdmyuM77cKBaAGkPrOfhiJSLdamDBGW-mLztPezx_N2HjfCG_lZq8nPQR3Yg/exec";


// =====================================
// KEYCRM
// =====================================

// API Token KeyCRM
const KEYCRM_TOKEN = "NWQ4MzMwOWNiNmU5MTgyY2NmNWUwMWFiMTAwOWRkMWNlZjE0ZGM4Mw";

// API URL
const KEYCRM_API = "https://openapi.keycrm.app/v1";


// =====================================
// GOOGLE SHEETS
// =====================================

// Назва аркуша
const SHEET_NAME = "Orders";


// =====================================
// PROJECT
// =====================================

const PROJECT_NAME = "KeyCRM Telegram Assistant";

const VERSION = "2.0.0";

const TIMEZONE = Session.getScriptTimeZone();

const DATE_FORMAT = "yyyy-MM-dd";


// =====================================
// TELEGRAM WEBHOOK
// =====================================

function setWebhook() {

  const response = UrlFetchApp.fetch(
    TELEGRAM_API + "/setWebhook",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({

        url: WEB_APP_URL,

        drop_pending_updates: true

      })
    }
  );

  Logger.log(response.getContentText());

}


function deleteWebhook() {

  const response = UrlFetchApp.fetch(
    TELEGRAM_API + "/deleteWebhook"
  );

  Logger.log(response.getContentText());

}


function getWebhookInfo() {

  const response = UrlFetchApp.fetch(
    TELEGRAM_API + "/getWebhookInfo"
  );

  Logger.log(response.getContentText());
}

function killEverything() {
  // 1. Видаляємо вебхук зовсім
  UrlFetchApp.fetch(TELEGRAM_API + "/deleteWebhook");
  
  // 2. Ставимо новий з drop_pending_updates, щоб "вбити" всі старі повідомлення в черзі
  const payload = {
    url: ScriptApp.getService().getUrl(),
    drop_pending_updates: true
  };
  
  UrlFetchApp.fetch(TELEGRAM_API + "/setWebhook", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
  
  Logger.log("Вебхук скинуто. Всі старі повідомлення видалено.");

}
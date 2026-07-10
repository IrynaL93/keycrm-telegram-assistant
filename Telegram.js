/*************************************************
 * KEYCRM TELEGRAM ASSISTANT
 * Telegram.gs (Очищена версія)
 *************************************************/

/**
 * Надіслати повідомлення
 */
function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  };

  if (keyboard) {
    payload.reply_markup = JSON.stringify(keyboard);
  }

  const response = UrlFetchApp.fetch(
    TELEGRAM_API + "/sendMessage",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  Logger.log("SendMessage Response: " + response.getContentText());
  return JSON.parse(response.getContentText());
}

/**
 * Редагувати повідомлення
 */
function editMessage(chatId, messageId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "Markdown"
  };

  if (keyboard) {
    payload.reply_markup = JSON.stringify(keyboard);
  }

  const response = UrlFetchApp.fetch(
    TELEGRAM_API + "/editMessageText",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  Logger.log("EditMessage Response: " + response.getContentText());
  return JSON.parse(response.getContentText());
}

/**
 * Відповідь на натискання кнопки
 */
function answerCallback(callbackQueryId) {
  UrlFetchApp.fetch(
    TELEGRAM_API + "/answerCallbackQuery",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ callback_query_id: callbackQueryId }),
      muteHttpExceptions: true
    }
  );
}

/**
 * Видалити повідомлення
 */
function deleteMessage(chatId, messageId) {
  UrlFetchApp.fetch(
    TELEGRAM_API + "/deleteMessage",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      muteHttpExceptions: true
    }
  );
}

/**
 * Побудова клавіатури
 */
function createKeyboard(buttonsArray) {
  return { inline_keyboard: buttonsArray };
}

/**
 * Відправка файлу (Excel)
 */
function sendDocument(chatId, blob, filename) {
  const url = TELEGRAM_API + "/sendDocument?chat_id=" + chatId;
  const payload = {
    document: blob
  };
  
  UrlFetchApp.fetch(url, {
    method: "post",
    payload: payload
  });
}
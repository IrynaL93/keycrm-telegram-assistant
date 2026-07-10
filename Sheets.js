/**
 * Створити файл Excel (.xlsx) з даних замовлень
 */
function createExcelFile(orders) {
  // 1. Створюємо тимчасову таблицю
  const tempSpreadsheet = SpreadsheetApp.create("Export_" + new Date().getTime());
  const sheet = tempSpreadsheet.getActiveSheet();
  
  // 2. Визначаємо заголовки
  const headers = ["ID", "Дата", "Статус", "Клієнт", "Сума", "Статус оплати", "Коментар клієнта", "Коментар менеджера"];
  sheet.appendRow(headers);
  
  // 3. Формуємо масив рядків
  const rows = orders.map(order => [
    order.id,
    order.ordered_at || "",
    order.status_on_source || "",
    order.client_id || "",
    Number(order.grand_total || 0),
    order.payment_status || "",
    order.client_comment || "",
    order.manager_comment || ""
  ]);
  
  // 4. Записуємо дані, якщо вони є
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  // 5. Отримуємо файл як blob і перетворюємо в Excel
  const file = DriveApp.getFileById(tempSpreadsheet.getId());
  const blob = file.getBlob().setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  
  // 6. Видаляємо тимчасовий файл
  file.setTrashed(true);
  
  return blob;
}
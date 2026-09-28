import { getAllOrders } from "./keycrm.js";
import { periodDates } from "./periods.js";

const money = (value, currency = "UAH") => {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(number)} ${currency}`;
};

function addCount(map, name) {
  const key = name || "Не вказано";
  map.set(key, (map.get(key) || 0) + 1);
}

function formatCounts(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `• ${name}: ${count}`)
    .join("\n");
}

function managerName(order) {
  const manager = order.manager || order.assigned || order.user;
  if (manager?.full_name) return manager.full_name;
  if (manager?.name) return manager.name;
  if (order.manager_id) return `Менеджер #${order.manager_id}`;
  return "Не призначено";
}

function sourceName(order) {
  if (order.source?.name) return order.source.name;
  if (order.source_name) return order.source_name;
  if (order.source_id) return `Джерело #${order.source_id}`;
  return "Не вказано";
}

export async function buildOrdersReport(env, period = "yesterday") {
  const range = periodDates(period, env.TIMEZONE || "Europe/Kyiv");

  // KeyCRM returns only the base order entity unless associations are requested.
  // Request source and manager data when the API exposes them for the account.
  const orders = await getAllOrders(env, {
    ordered_at_from: range.utcFrom,
    ordered_at_to: range.utcTo,
    include: "source,manager"
  });

  const total = orders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const average = orders.length ? total / orders.length : 0;

  const statusCounts = new Map();
  const sourceCounts = new Map();
  const managerCounts = new Map();

  for (const order of orders) {
    addCount(statusCounts, order.status?.name || (order.status_id ? `Status #${order.status_id}` : "Без статусу"));
    addCount(sourceCounts, sourceName(order));
    addCount(managerCounts, managerName(order));
  }

  const statuses = formatCounts(statusCounts);
  const sources = formatCounts(sourceCounts);
  const managers = formatCounts(managerCounts);

  return [
    `📊 <b>Звіт за ${range.label}</b>`,
    `<code>${range.from}${range.from !== range.to ? ` — ${range.to}` : ""}</code>`,
    "",
    `📦 Замовлень: <b>${orders.length}</b>`,
    `💰 Продажі: <b>${money(total, env.CURRENCY || "UAH")}</b>`,
    `🧾 Середній чек: <b>${money(average, env.CURRENCY || "UAH")}</b>`,
    statuses ? `\n<b>Статуси</b>\n${statuses}` : "",
    sources ? `\n<b>Джерела</b>\n${sources}` : "",
    managers ? `\n<b>Менеджери</b>\n${managers}` : ""
  ].filter(Boolean).join("\n");
}

import { getAllOrders, getOrderStatuses } from "./keycrm.js";
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

function makeStatusMap(statuses) {
  const map = new Map();
  for (const status of statuses) {
    if (status?.id === undefined || status?.id === null) continue;
    const name = status.name || status.title;
    if (name) map.set(String(status.id), name);
  }
  return map;
}

function statusName(order, statusMap) {
  if (order.status?.name) return order.status.name;
  if (order.status?.title) return order.status.title;

  if (order.status_id !== undefined && order.status_id !== null) {
    return statusMap.get(String(order.status_id)) || `Status #${order.status_id}`;
  }

  return "Без статусу";
}

export async function buildOrdersReport(env, period = "yesterday") {
  const range = periodDates(period, env.TIMEZONE || "Europe/Kyiv");

  // KeyCRM Orders API does not support include=source.
  // Status names are loaded separately so reports work with each client's custom statuses.
  const [orders, statusesList] = await Promise.all([
    getAllOrders(env, {
      ordered_at_from: range.utcFrom,
      ordered_at_to: range.utcTo,
      include: "manager"
    }),
    getOrderStatuses(env)
  ]);

  const statusMap = makeStatusMap(statusesList);
  const total = orders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const average = orders.length ? total / orders.length : 0;

  const statusCounts = new Map();
  const sourceCounts = new Map();
  const managerCounts = new Map();

  for (const order of orders) {
    addCount(statusCounts, statusName(order, statusMap));
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

import { getAllOrders, getOrderStatuses, getOrderSources } from "./keycrm.js";
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

function makeDictionaryMap(items) {
  const map = new Map();
  for (const item of items || []) {
    const name = item?.name || item?.title;
    if (!name) continue;

    const keys = [item.id, item.alias, item.code, item.key, item.slug];
    for (const key of keys) {
      if (key !== undefined && key !== null && String(key).trim() !== "") {
        map.set(String(key), name);
      }
    }
  }
  return map;
}

function sourceName(order, sourceMap) {
  if (order.source?.name) return order.source.name;
  if (order.source?.title) return order.source.title;
  if (order.source_name) return order.source_name;

  const sourceKey = order.source_id ?? order.source_uuid ?? order.source_alias;
  if (sourceKey !== undefined && sourceKey !== null) {
    return sourceMap.get(String(sourceKey)) || `Джерело #${sourceKey}`;
  }
  return "Не вказано";
}

function statusName(order, statusMap) {
  const candidates = [
    order.status_id,
    order.status_uuid,
    order.status_alias,
    order.status?.id,
    order.status?.alias,
    order.status?.code,
    order.status?.key,
    order.status?.slug,
    typeof order.status === "string" ? order.status : null
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const resolved = statusMap.get(String(candidate));
    if (resolved) return resolved;
  }

  if (order.status?.name) {
    return statusMap.get(String(order.status.name)) || order.status.name;
  }
  if (order.status?.title) return order.status.title;

  const raw = order.status_id ?? order.status_alias ?? order.status;
  if (raw !== undefined && raw !== null && typeof raw !== "object") {
    return statusMap.get(String(raw)) || String(raw);
  }
  return "Без статусу";
}

function parseKeycrmDate(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

function orderReportDate(order) {
  return parseKeycrmDate(order.ordered_at || order.created_at);
}

function filterOrdersByRange(orders, range) {
  const from = parseKeycrmDate(range.utcFrom);
  const to = parseKeycrmDate(range.utcTo);
  if (!from || !to) return orders;

  return orders.filter((order) => {
    const date = orderReportDate(order);
    return date && date >= from && date <= to;
  });
}

export async function buildOrdersReport(env, period = "yesterday") {
  const range = periodDates(period, env.TIMEZONE || "Europe/Kyiv");

  const [allOrders, statusesList, sourcesList] = await Promise.all([
    getAllOrders(env, { include: "manager" }),
    getOrderStatuses(env),
    getOrderSources(env)
  ]);

  const orders = filterOrdersByRange(allOrders, range);

  // TEMP diagnostics: needed to learn the exact KeyCRM status dictionary schema.
  console.log("KEYCRM STATUS DICTIONARY", JSON.stringify(statusesList));
  console.log("KEYCRM ORDER STATUS SAMPLES", JSON.stringify(
    orders.slice(0, 10).map((order) => ({
      id: order.id,
      status_id: order.status_id,
      status_uuid: order.status_uuid,
      status_alias: order.status_alias,
      status: order.status
    }))
  ));

  console.log("Report date filter", JSON.stringify({
    period,
    utcFrom: range.utcFrom,
    utcTo: range.utcTo,
    fetched: allOrders.length,
    matched: orders.length,
    statusesLoaded: statusesList.length,
    sourcesLoaded: sourcesList.length
  }));

  const statusMap = makeDictionaryMap(statusesList);
  const sourceMap = makeDictionaryMap(sourcesList);
  const total = orders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const average = orders.length ? total / orders.length : 0;

  const statusCounts = new Map();
  const sourceCounts = new Map();
  const managerCounts = new Map();

  for (const order of orders) {
    addCount(statusCounts, statusName(order, statusMap));
    addCount(sourceCounts, sourceName(order, sourceMap));
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

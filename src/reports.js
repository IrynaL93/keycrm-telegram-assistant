import { getAllOrders } from "./keycrm.js";
import { periodDates } from "./periods.js";

const money = (value, currency = "UAH") => {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(number)} ${currency}`;
};

export async function buildOrdersReport(env, period = "yesterday") {
  const range = periodDates(period, env.TIMEZONE || "Europe/Kyiv");

  const orders = await getAllOrders(env, {
    ordered_at_from: range.utcFrom,
    ordered_at_to: range.utcTo
  });

  const total = orders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const average = orders.length ? total / orders.length : 0;

  const statusCounts = new Map();
  for (const order of orders) {
    const status = order.status?.name || `Status #${order.status_id ?? "?"}`;
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }

  const statuses = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `• ${name}: ${count}`)
    .join("\n");

  return [
    `📊 <b>Звіт за ${range.label}</b>`,
    `<code>${range.from}${range.from !== range.to ? ` — ${range.to}` : ""}</code>`,
    "",
    `📦 Замовлень: <b>${orders.length}</b>`,
    `💰 Продажі: <b>${money(total, env.CURRENCY || "UAH")}</b>`,
    `🧾 Середній чек: <b>${money(average, env.CURRENCY || "UAH")}</b>`,
    statuses ? `\n<b>Статуси</b>\n${statuses}` : ""
  ].filter(Boolean).join("\n");
}

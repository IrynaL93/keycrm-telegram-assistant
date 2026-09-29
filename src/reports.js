import { getAllOrders, getOrderStatuses, getOrderSources } from "./keycrm.js";
import { periodDates } from "./periods.js";

const STANDARD_STATUS_LABELS = {
  new: "Новий",
  presence_confirmed: "Наявність підтверджено",
  waiting_for_email_response: "Очікування відповіді",
  waiting_for_prepayment: "Очікування передоплати",
  transferred_to_production: "Передано у виробництво",
  manufacturing: "У виробництві",
  manufactured: "Виготовлено",
  delivered_to_delivery: "Передано в доставку",
  delivered: "Доставлено",
  departing: "Відправляється",
  in_transit: "В дорозі",
  completed: "Виконано",
  incorrect_data: "Некоректні дані",
  underbid: "Не вдалося додзвонитися",
  not_available: "Немає в наявності",
  bought_elsewhere: "Купили в іншому місці",
  delivery_did_not_arrange: "Не влаштувала доставка",
  did_not_arrange_price: "Не влаштувала ціна",
  canceled: "Скасовано"
};

const money = (value, currency = "UAH") => `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(Number(value || 0))} ${currency}`;

function addCount(map, name) {
  const key = name || "Не вказано";
  map.set(key, (map.get(key) || 0) + 1);
}
function formatCounts(map) {
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`• ${n}: ${c}`).join("\n");
}
function managerName(order) {
  const m = order.manager || order.assigned || order.user;
  if (m?.full_name) return m.full_name;
  if (m?.name) return m.name;
  if (order.manager_id) return `Менеджер #${order.manager_id}`;
  return "Не призначено";
}
function dictionaryDisplayName(item) { return item?.name || item?.title || item?.label || item?.display_name || null; }
function makeDictionaryMap(items) {
  const map = new Map();
  for (const item of items || []) {
    const name = dictionaryDisplayName(item); if (!name) continue;
    for (const key of [item.id,item.alias,item.code,item.key,item.slug]) if (key !== undefined && key !== null && String(key).trim() !== "") map.set(String(key), name);
  }
  return map;
}
function humanizeTechnicalName(value) {
  if (!value) return null; const text=String(value).trim(); if(!text) return null;
  if(!/^[a-z0-9_-]+$/i.test(text)) return text;
  const s=text.replace(/[_-]+/g," ").replace(/\s+/g," ").trim(); return s.charAt(0).toUpperCase()+s.slice(1);
}
function displayStatusName(rawName) {
  if(!rawName) return "Без статусу"; const key=String(rawName).trim();
  return STANDARD_STATUS_LABELS[key] || humanizeTechnicalName(key) || key;
}
function sourceName(order, sourceMap) {
  const k=order.source_id ?? order.source_uuid ?? order.source_alias;
  if(k!==undefined&&k!==null){const r=sourceMap.get(String(k)); if(r) return r;}
  return order.source?.name || order.source?.title || order.source_name || (k!==undefined&&k!==null?`Джерело #${k}`:"Не вказано");
}
function rawStatus(order,statusMap){
  for(const c of [order.status_id,order.status_uuid,order.status_alias,order.status?.id,order.status?.alias,order.status?.code,order.status?.key,order.status?.slug,typeof order.status==="string"?order.status:null]){
    if(c===undefined||c===null) continue; const r=statusMap.get(String(c)); if(r) return String(r);
  }
  return String(order.status?.name || order.status?.title || order.status_alias || (typeof order.status==="string"?order.status:"") || order.status_id || "");
}
function statusName(order,statusMap){ return displayStatusName(rawStatus(order,statusMap)); }
function parseKeycrmDate(value){
  if(!value) return null; const n=String(value).trim().replace(" ","T"); const z=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(n)?n:`${n}Z`; const d=new Date(z); return Number.isNaN(d.getTime())?null:d;
}
function orderReportDate(order){ return parseKeycrmDate(order.ordered_at || order.created_at); }
function filterOrdersByRange(orders,range){
  const from=parseKeycrmDate(range.utcFrom),to=parseKeycrmDate(range.utcTo); if(!from||!to) return orders;
  return orders.filter(o=>{const d=orderReportDate(o); return d&&d>=from&&d<=to;});
}

function paymentAmount(payment){
  for(const v of [payment?.amount,payment?.value,payment?.sum,payment?.total]){
    const n=Number(v); if(Number.isFinite(n)) return n;
  }
  return 0;
}
function paymentIsSuccessful(payment){
  if(!payment) return false;
  if(payment.status === true || payment.paid === true || payment.is_paid === true) return true;
  const s=String(payment.status ?? payment.payment_status ?? "").toLowerCase();
  return ["paid","success","successful","completed","complete","confirmed","approved"].includes(s);
}
function paidAmount(order){
  const payments=Array.isArray(order.payments)?order.payments:[];
  if(payments.length){
    const successful=payments.filter(paymentIsSuccessful);
    // KeyCRM payments may already represent confirmed CRM payment records without a textual status.
    const usable=successful.length?successful:payments.filter(p=>p?.canceled!==true&&p?.is_canceled!==true);
    return usable.reduce((sum,p)=>sum+paymentAmount(p),0);
  }
  const direct=Number(order.paid_amount ?? order.payment_amount ?? 0);
  return Number.isFinite(direct)?direct:0;
}
function isCancelledStatus(raw){ return /cancel|canceled|cancelled|скас|відмов|incorrect_data|underbid|not_available|bought_elsewhere|did_not_arrange/i.test(raw||""); }
function isDeliveredStatus(raw){ return /(^|_)(delivered|completed|received|done)(_|$)|отрим|викон/i.test(raw||""); }
function isDeliveryStatus(raw){ return /delivery|delivered_to_delivery|departing|in_transit|shipping|достав|відправ|дороз/i.test(raw||"") && !isDeliveredStatus(raw); }

export async function buildOrdersReport(env, period="yesterday") {
  const range=periodDates(period,env.TIMEZONE||"Europe/Kyiv");
  const [allOrders,statusesList,sourcesList]=await Promise.all([
    getAllOrders(env,{include:"manager,payments"}), getOrderStatuses(env), getOrderSources(env)
  ]);
  const orders=filterOrdersByRange(allOrders,range);
  const statusMap=makeDictionaryMap(statusesList),sourceMap=makeDictionaryMap(sourcesList);
  const total=orders.reduce((s,o)=>s+Number(o.grand_total||0),0), average=orders.length?total/orders.length:0;
  const paid=orders.reduce((s,o)=>s+paidAmount(o),0);
  const fullyPaid=orders.filter(o=>Number(o.grand_total||0)>0 && paidAmount(o)>=Number(o.grand_total||0)-0.01);
  const partialPaid=orders.filter(o=>paidAmount(o)>0 && paidAmount(o)<Number(o.grand_total||0)-0.01);
  const cancelled=orders.filter(o=>isCancelledStatus(rawStatus(o,statusMap)));
  const delivered=orders.filter(o=>isDeliveredStatus(rawStatus(o,statusMap)));
  const inDelivery=orders.filter(o=>isDeliveryStatus(rawStatus(o,statusMap)));
  const sumOrders=arr=>arr.reduce((s,o)=>s+Number(o.grand_total||0),0);

  const statusCounts=new Map(),sourceCounts=new Map(),managerCounts=new Map();
  for(const o of orders){addCount(statusCounts,statusName(o,statusMap));addCount(sourceCounts,sourceName(o,sourceMap));addCount(managerCounts,managerName(o));}
  const statuses=formatCounts(statusCounts),sources=formatCounts(sourceCounts),managers=formatCounts(managerCounts);

  console.log("Report metrics",JSON.stringify({period,orders:orders.length,total,paid,fullyPaid:fullyPaid.length,partialPaid:partialPaid.length,delivered:delivered.length,inDelivery:inDelivery.length,cancelled:cancelled.length}));

  return [
    `📊 <b>Звіт за ${range.label}</b>`, `<code>${range.from}${range.from!==range.to?` — ${range.to}`:""}</code>`, "",
    `📦 Замовлень: <b>${orders.length}</b>`,
    `💰 Сума замовлень: <b>${money(total,env.CURRENCY||"UAH")}</b>`,
    `💳 Оплачено: <b>${money(paid,env.CURRENCY||"UAH")}</b>`,
    `✅ Повністю оплачені: <b>${fullyPaid.length}</b>`,
    partialPaid.length?`🟡 Частково оплачені: <b>${partialPaid.length}</b>`:"",
    `📥 Отримано / виконано: <b>${delivered.length}</b> · ${money(sumOrders(delivered),env.CURRENCY||"UAH")}`,
    `🚚 В доставці: <b>${inDelivery.length}</b> · ${money(sumOrders(inDelivery),env.CURRENCY||"UAH")}`,
    `❌ Скасовано / відмови: <b>${cancelled.length}</b> · ${money(sumOrders(cancelled),env.CURRENCY||"UAH")}`,
    `🧾 Середній чек: <b>${money(average,env.CURRENCY||"UAH")}</b>`,
    statuses?`\n<b>Статуси</b>\n${statuses}`:"", sources?`\n<b>Джерела</b>\n${sources}`:"", managers?`\n<b>Менеджери</b>\n${managers}`:""
  ].filter(Boolean).join("\n");
}

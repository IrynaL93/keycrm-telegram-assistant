import { getAllOrders, getOrderStatuses, getOrderSources } from "./keycrm.js";
import { periodDates } from "./periods.js";

const STANDARD_STATUS_LABELS = {
  new: "Новий", presence_confirmed: "Наявність підтверджено", waiting_for_email_response: "Очікування відповіді",
  waiting_for_prepayment: "Очікування передоплати", transferred_to_production: "Передано у виробництво",
  manufacturing: "У виробництві", manufactured: "Виготовлено", delivered_to_delivery: "Передано в доставку",
  delivered: "Доставлено", departing: "Відправляється", in_transit: "В дорозі", completed: "Виконано",
  incorrect_data: "Некоректні дані", underbid: "Не вдалося додзвонитися", not_available: "Немає в наявності",
  bought_elsewhere: "Купили в іншому місці", delivery_did_not_arrange: "Не влаштувала доставка",
  did_not_arrange_price: "Не влаштувала ціна", canceled: "Скасовано"
};

const money=(v,c="UAH")=>`${new Intl.NumberFormat("uk-UA",{maximumFractionDigits:2}).format(Number(v||0))} ${c}`;
function addCount(m,n){const k=n||"Не вказано";m.set(k,(m.get(k)||0)+1);}
function formatCounts(m){return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`• ${n}: ${c}`).join("\n");}
function managerName(o){const m=o.manager||o.assigned||o.user;return m?.full_name||m?.name||(o.manager_id?`Менеджер #${o.manager_id}`:"Не призначено");}
function dictionaryDisplayName(i){return i?.name||i?.title||i?.label||i?.display_name||null;}
function makeDictionaryMap(items){const m=new Map();for(const i of items||[]){const n=dictionaryDisplayName(i);if(!n)continue;for(const k of [i.id,i.alias,i.code,i.key,i.slug])if(k!==undefined&&k!==null&&String(k).trim()!=="")m.set(String(k),n);}return m;}
function humanizeTechnicalName(v){if(!v)return null;const t=String(v).trim();if(!t)return null;if(!/^[a-z0-9_-]+$/i.test(t))return t;const s=t.replace(/[_-]+/g," ").replace(/\s+/g," ").trim();return s.charAt(0).toUpperCase()+s.slice(1);}
function displayStatusName(r){if(!r)return "Без статусу";const k=String(r).trim();return STANDARD_STATUS_LABELS[k]||humanizeTechnicalName(k)||k;}
function sourceName(o,m){const k=o.source_id??o.source_uuid??o.source_alias;if(k!==undefined&&k!==null){const r=m.get(String(k));if(r)return r;}return o.source?.name||o.source?.title||o.source_name||(k!==undefined&&k!==null?`Джерело #${k}`:"Не вказано");}
function rawStatus(o,m){for(const c of [o.status_id,o.status_uuid,o.status_alias,o.status?.id,o.status?.alias,o.status?.code,o.status?.key,o.status?.slug,typeof o.status==="string"?o.status:null]){if(c===undefined||c===null)continue;const r=m.get(String(c));if(r)return String(r);}return String(o.status?.name||o.status?.title||o.status_alias||(typeof o.status==="string"?o.status:"")||o.status_id||"");}
function statusName(o,m){return displayStatusName(rawStatus(o,m));}
function parseKeycrmDate(v){if(!v)return null;const n=String(v).trim().replace(" ","T"),z=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(n)?n:`${n}Z`,d=new Date(z);return Number.isNaN(d.getTime())?null:d;}
function filterOrdersByRange(os,r){const f=parseKeycrmDate(r.utcFrom),t=parseKeycrmDate(r.utcTo);if(!f||!t)return os;return os.filter(o=>{const d=parseKeycrmDate(o.ordered_at||o.created_at);return d&&d>=f&&d<=t;});}

function paymentAmount(p){for(const v of [p?.amount,p?.value,p?.sum,p?.total]){const n=Number(v);if(Number.isFinite(n))return n;}return 0;}
function paymentIsSuccessful(p){if(!p)return false;if(p.paid===true||p.is_paid===true||p.status===true)return true;const s=String(p.status??p.payment_status??"").trim().toLowerCase();return ["paid","success","successful","completed","complete","confirmed","approved"].includes(s);}
function paidAmount(o){const ps=Array.isArray(o.payments)?o.payments:[];if(ps.length)return ps.filter(paymentIsSuccessful).reduce((s,p)=>s+paymentAmount(p),0);for(const v of [o.paid_amount,o.payment_amount]){if(v!==undefined&&v!==null&&v!==""){const n=Number(v);if(Number.isFinite(n))return n;}}return 0;}

function normalizedStatus(r){return String(r||"").trim().toLowerCase();}
function isCancelledStatus(r){return /cancel|canceled|cancelled|скас|відмов|incorrect_data|underbid|not_available|bought_elsewhere|did_not_arrange/i.test(r||"");}
function isDeliveredStatus(r){
  const s=normalizedStatus(r);
  // delivered_to_delivery means "Передано в доставку", not delivered/completed.
  if(s==="delivered_to_delivery"||/передано\s+(в|у)\s+достав/i.test(s))return false;
  return ["delivered","completed","received","done"].includes(s)||/отримано|отриманий|виконано|виконаний/i.test(s);
}
function isDeliveryStatus(r){
  const s=normalizedStatus(r);
  if(isDeliveredStatus(s))return false;
  return ["delivered_to_delivery","departing","in_transit","shipping"].includes(s)||/передано\s+(в|у)\s+достав|доставц|відправ|дороз/i.test(s);
}

export async function buildOrdersReport(env,period="yesterday"){
  const range=periodDates(period,env.TIMEZONE||"Europe/Kyiv");
  const [allOrders,statusesList,sourcesList]=await Promise.all([getAllOrders(env,{include:"manager,payments"}),getOrderStatuses(env),getOrderSources(env)]);
  const orders=filterOrdersByRange(allOrders,range),statusMap=makeDictionaryMap(statusesList),sourceMap=makeDictionaryMap(sourcesList);
  const total=orders.reduce((s,o)=>s+Number(o.grand_total||0),0),average=orders.length?total/orders.length:0,paid=orders.reduce((s,o)=>s+paidAmount(o),0);
  const fullyPaid=orders.filter(o=>Number(o.grand_total||0)>0&&paidAmount(o)>=Number(o.grand_total||0)-0.01),partialPaid=orders.filter(o=>paidAmount(o)>0&&paidAmount(o)<Number(o.grand_total||0)-0.01);
  const cancelled=orders.filter(o=>isCancelledStatus(rawStatus(o,statusMap))),delivered=orders.filter(o=>isDeliveredStatus(rawStatus(o,statusMap))),inDelivery=orders.filter(o=>isDeliveryStatus(rawStatus(o,statusMap)));
  const sumOrders=a=>a.reduce((s,o)=>s+Number(o.grand_total||0),0),statusCounts=new Map(),sourceCounts=new Map(),managerCounts=new Map();
  for(const o of orders){addCount(statusCounts,statusName(o,statusMap));addCount(sourceCounts,sourceName(o,sourceMap));addCount(managerCounts,managerName(o));}
  const statuses=formatCounts(statusCounts),sources=formatCounts(sourceCounts),managers=formatCounts(managerCounts);
  console.log("Report metrics",JSON.stringify({period,orders:orders.length,total,paid,fullyPaid:fullyPaid.length,partialPaid:partialPaid.length,delivered:delivered.length,inDelivery:inDelivery.length,cancelled:cancelled.length,paymentSamples:orders.slice(0,3).map(o=>({id:o.id,payments:o.payments}))}));
  return [`📊 <b>Звіт за ${range.label}</b>`,`<code>${range.from}${range.from!==range.to?` — ${range.to}`:""}</code>`,"",`📦 Замовлень: <b>${orders.length}</b>`,`💰 Дохід: <b>${money(total,env.CURRENCY||"UAH")}</b>`,`💳 Оплачено: <b>${money(paid,env.CURRENCY||"UAH")}</b>`,`✅ Повністю оплачені: <b>${fullyPaid.length}</b>`,partialPaid.length?`🟡 Частково оплачені: <b>${partialPaid.length}</b>`:"",`📥 Отримано / виконано: <b>${delivered.length}</b> · ${money(sumOrders(delivered),env.CURRENCY||"UAH")}`,`🚚 В доставці: <b>${inDelivery.length}</b> · ${money(sumOrders(inDelivery),env.CURRENCY||"UAH")}`,`❌ Скасовано / відмови: <b>${cancelled.length}</b> · ${money(sumOrders(cancelled),env.CURRENCY||"UAH")}`,`🧾 Середній чек: <b>${money(average,env.CURRENCY||"UAH")}</b>`,statuses?`\n<b>Статуси</b>\n${statuses}`:"",sources?`\n<b>Джерела</b>\n${sources}`:"",managers?`\n<b>Менеджери</b>\n${managers}`:""].filter(Boolean).join("\n");
}

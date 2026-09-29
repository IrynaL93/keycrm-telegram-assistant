import { getAllOrders, getOrderStatuses, getOrderSources } from "./keycrm.js";
import { periodDates } from "./periods.js";

const money=(v,c="UAH")=>`${new Intl.NumberFormat("uk-UA",{maximumFractionDigits:2}).format(Number(v||0))} ${c}`;
function addCount(m,n){const k=n||"Не вказано";m.set(k,(m.get(k)||0)+1);}
function formatCounts(m){return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`• ${n}: ${c}`).join("\n");}
function managerName(o){const m=o.manager||o.assigned||o.user;return m?.full_name||m?.name||(o.manager_id?`Менеджер #${o.manager_id}`:"Не призначено");}
function dictionaryDisplayName(i){return i?.name||i?.title||i?.label||i?.display_name||null;}
function makeDictionaryMap(items){const m=new Map();for(const i of items||[]){const n=dictionaryDisplayName(i);if(!n)continue;for(const k of [i.id,i.alias,i.code,i.key,i.slug])if(k!==undefined&&k!==null&&String(k).trim()!=="")m.set(String(k),n);}return m;}
function sourceName(o,m){const k=o.source_id??o.source_uuid??o.source_alias;if(k!==undefined&&k!==null){const r=m.get(String(k));if(r)return r;}return o.source?.name||o.source?.title||o.source_name||(k!==undefined&&k!==null?`Джерело #${k}`:"Не вказано");}
function parseKeycrmDate(v){if(!v)return null;const n=String(v).trim().replace(" ","T"),z=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(n)?n:`${n}Z`,d=new Date(z);return Number.isNaN(d.getTime())?null:d;}
function rangeBounds(r){return {from:parseKeycrmDate(r.utcFrom),to:parseKeycrmDate(r.utcTo)};}
function dateInRange(v,r){const d=parseKeycrmDate(v),{from,to}=rangeBounds(r);return !!(d&&from&&to&&d>=from&&d<=to);}
function filterOrdersByRange(os,r){return os.filter(o=>dateInRange(o.ordered_at||o.created_at,r));}

function paymentAmount(p){for(const v of [p?.amount,p?.value,p?.sum,p?.total]){const n=Number(v);if(Number.isFinite(n))return n;}return 0;}
function paymentIsSuccessful(p){if(!p)return false;if(p.paid===true||p.is_paid===true||p.status===true)return true;const s=String(p.status??p.payment_status??"").trim().toLowerCase();return ["paid","success","successful","completed","complete","confirmed","approved"].includes(s);}
function paymentDate(p){return p?.payment_date||p?.paid_at||p?.paid_date||p?.date||p?.created_at||p?.updated_at||null;}
function successfulPayments(o){return (Array.isArray(o.payments)?o.payments:[]).filter(paymentIsSuccessful);}
function paymentsInRange(o,r){return successfulPayments(o).filter(p=>dateInRange(paymentDate(p),r));}
function paidInRange(o,r){return paymentsInRange(o,r).reduce((s,p)=>s+paymentAmount(p),0);}
function becameFullyPaidInRange(o,r){
  const total=Number(o.grand_total||0); if(total<=0)return false;
  const ps=successfulPayments(o).map(p=>({p,d:parseKeycrmDate(paymentDate(p))})).filter(x=>x.d).sort((a,b)=>a.d-b.d);
  const {from,to}=rangeBounds(r); if(!from||!to)return false;
  let before=0,during=0;
  for(const {p,d} of ps){if(d<from)before+=paymentAmount(p);else if(d<=to)during+=paymentAmount(p);}
  return before<total-0.01 && before+during>=total-0.01;
}

function normalizedStatus(r){return String(r||"").trim().toLowerCase();}
function isCancelledStatus(r){return /cancel|canceled|cancelled|скас|відмов|incorrect_data|underbid|not_available|bought_elsewhere|did_not_arrange/i.test(r||"");}
function isDeliveredStatus(r){
  const s=normalizedStatus(r);
  if(["delivered","delivered_to_delivery","departing","in_transit","shipping","delivering"].includes(s)||/передано\s+(в|у)\s+достав|доставля|доставц|відправ|дороз/i.test(s))return false;
  return ["completed","received","done"].includes(s)||/отримано|отриманий|виконано|виконаний/i.test(s);
}
function isDeliveryStatus(r){
  const s=normalizedStatus(r);
  if(isDeliveredStatus(s))return false;
  return ["delivered","delivered_to_delivery","departing","in_transit","shipping","delivering"].includes(s)||/передано\s+(в|у)\s+достав|доставля|доставц|відправ|дороз/i.test(s);
}

async function statusEventsInRange(env,range){
  if(!env.DB)return [];
  const {from,to}=rangeBounds(range); if(!from||!to)return [];
  const result=await env.DB.prepare(`SELECT e.order_id,e.old_value,e.new_value,e.event_at,s.grand_total
    FROM order_events e LEFT JOIN orders_state s ON s.order_id=e.order_id
    WHERE e.event_type='status_changed' AND e.event_at>=? AND e.event_at<=?
    ORDER BY e.event_at ASC`).bind(from.toISOString(),to.toISOString()).all();
  return result.results||[];
}

// One order may change status several times during the same period.
// For the status breakdown we use only its LAST status transition in that period,
// so the same order cannot simultaneously appear as completed, in delivery and cancelled.
function latestStatusEvents(events){
  const latest=new Map();
  for(const e of events)latest.set(Number(e.order_id),e);
  return [...latest.values()];
}
function eventMetric(events,predicate){
  const rows=events.filter(e=>predicate(e.new_value));
  return {count:rows.length,sum:rows.reduce((s,e)=>s+Number(e.grand_total||0),0)};
}

export async function buildOrdersReport(env,period="yesterday"){
  const range=periodDates(period,env.TIMEZONE||"Europe/Kyiv");
  const [allOrders,statusesList,sourcesList,events]=await Promise.all([getAllOrders(env,{include:"manager,payments"}),getOrderStatuses(env),getOrderSources(env),statusEventsInRange(env,range)]);
  const orders=filterOrdersByRange(allOrders,range),sourceMap=makeDictionaryMap(sourcesList);
  const total=orders.reduce((s,o)=>s+Number(o.grand_total||0),0),average=orders.length?total/orders.length:0;
  const paid=allOrders.reduce((s,o)=>s+paidInRange(o,range),0);
  const fullyPaid=allOrders.filter(o=>becameFullyPaidInRange(o,range));
  const partialPaidOrders=allOrders.filter(o=>paidInRange(o,range)>0&&!becameFullyPaidInRange(o,range));
  const finalStatusEvents=latestStatusEvents(events);
  const delivered=eventMetric(finalStatusEvents,isDeliveredStatus),inDelivery=eventMetric(finalStatusEvents,isDeliveryStatus),cancelled=eventMetric(finalStatusEvents,isCancelledStatus);
  const sourceCounts=new Map(),managerCounts=new Map();
  for(const o of orders){addCount(sourceCounts,sourceName(o,sourceMap));addCount(managerCounts,managerName(o));}
  const sources=formatCounts(sourceCounts),managers=formatCounts(managerCounts);
  console.log("Report metrics",JSON.stringify({period,orders:orders.length,total,paid,fullyPaid:fullyPaid.length,partialPaid:partialPaidOrders.length,delivered:delivered.count,inDelivery:inDelivery.count,cancelled:cancelled.count,statusEvents:events.length,uniqueStatusOrders:finalStatusEvents.length}));
  return [`📊 <b>Звіт за ${range.label}</b>`,`<code>${range.from}${range.from!==range.to?` — ${range.to}`:""}</code>`,"",`📦 Замовлень: <b>${orders.length}</b>`,`💰 Сума замовлень: <b>${money(total,env.CURRENCY||"UAH")}</b>`,`💳 Оплачено: <b>${money(paid,env.CURRENCY||"UAH")}</b>`,`✅ Повністю оплачені: <b>${fullyPaid.length}</b>`,partialPaidOrders.length?`🟡 Оплати без повного закриття: <b>${partialPaidOrders.length}</b>`:"",`📥 Отримано / виконано: <b>${delivered.count}</b> · ${money(delivered.sum,env.CURRENCY||"UAH")}`,`🚚 В доставці: <b>${inDelivery.count}</b> · ${money(inDelivery.sum,env.CURRENCY||"UAH")}`,`❌ Скасовано / відмови: <b>${cancelled.count}</b> · ${money(cancelled.sum,env.CURRENCY||"UAH")}`,`🧾 Середній чек: <b>${money(average,env.CURRENCY||"UAH")}</b>`,sources?`\n<b>Джерела</b>\n${sources}`:"",managers?`\n<b>Менеджери</b>\n${managers}`:""].filter(Boolean).join("\n");
}

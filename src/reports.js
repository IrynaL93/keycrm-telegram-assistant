import { getAllOrders, getOrderStatuses, getOrderSources } from "./keycrm.js";
import { periodDates } from "./periods.js";
import { getStatusSettings, getPaymentSettings, STATUS_GROUPS, STATUS_LABELS, PAYMENT_LABELS } from "./settings.js";

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

function orderStatusKeys(o,statusMap){
  const raw=[o.status_id,o.status?.id,o.status,o.status_alias,o.status_code,o.status_key,o.status_slug]
    .filter(v=>v!==undefined&&v!==null&&typeof v!=="object")
    .map(v=>String(v).trim().toLowerCase())
    .filter(Boolean);
  for(const k of [...raw]){
    const name=statusMap.get(k);
    if(name)raw.push(String(name).trim().toLowerCase());
  }
  return new Set(raw);
}
function orderMatchesStatuses(o,selectedIds,statusMap){
  const selected=new Set((selectedIds||[]).map(v=>String(v).trim().toLowerCase()));
  if(!selected.size)return false;
  const keys=orderStatusKeys(o,statusMap);
  for(const id of selected)if(keys.has(id))return true;
  return false;
}
function currentStatusMetric(orders,selectedIds,statusMap){
  const rows=orders.filter(o=>orderMatchesStatuses(o,selectedIds,statusMap));
  return {count:rows.length,sum:rows.reduce((s,o)=>s+Number(o.grand_total||0),0)};
}

export async function buildOrdersReport(env,period="yesterday",chatId=null){
  const range=periodDates(period,env.TIMEZONE||"Europe/Kyiv");
  const settingsPromise=chatId!==null?getStatusSettings(env,chatId):Promise.resolve(Object.fromEntries(STATUS_GROUPS.map(k=>[k,[]])));
  const paymentSettingsPromise=chatId!==null?getPaymentSettings(env,chatId):Promise.resolve({paid:true,partial:true,unpaid:true});
  const [allOrders,statusesList,sourcesList,statusSettings,paymentSettings]=await Promise.all([
    getAllOrders(env,{include:"manager,payments"}),getOrderStatuses(env),getOrderSources(env),settingsPromise,paymentSettingsPromise
  ]);
  const orders=filterOrdersByRange(allOrders,range),sourceMap=makeDictionaryMap(sourcesList),statusMap=makeDictionaryMap(statusesList);
  const cancelledStatusIds=statusSettings.cancelled||[];
  const kpiOrders=orders.filter(o=>!orderMatchesStatuses(o,cancelledStatusIds,statusMap));
  const total=kpiOrders.reduce((s,o)=>s+Number(o.grand_total||0),0),average=kpiOrders.length?total/kpiOrders.length:0;
  const paid=allOrders.reduce((s,o)=>s+paidInRange(o,range),0);
  const fullyPaid=allOrders.filter(o=>becameFullyPaidInRange(o,range));
  const partialPaidOrders=allOrders.filter(o=>paidInRange(o,range)>0&&!becameFullyPaidInRange(o,range));
  const unpaidOrders=kpiOrders.filter(o=>successfulPayments(o).reduce((s,p)=>s+paymentAmount(p),0)<=0.01);
  const statusMetrics=Object.fromEntries(STATUS_GROUPS.map(key=>[key,currentStatusMetric(orders,statusSettings[key],statusMap)]));
  const sourceCounts=new Map(),managerCounts=new Map();
  for(const o of kpiOrders){addCount(sourceCounts,sourceName(o,sourceMap));addCount(managerCounts,managerName(o));}
  const sources=formatCounts(sourceCounts),managers=formatCounts(managerCounts),currency=env.CURRENCY||"UAH";
  const statusLines=STATUS_GROUPS.map(key=>`${STATUS_LABELS[key]}: <b>${statusMetrics[key].count}</b> · ${money(statusMetrics[key].sum,currency)}`);
  const paymentLines=[];
  if(paymentSettings.paid)paymentLines.push(`${PAYMENT_LABELS.paid}: <b>${fullyPaid.length}</b>`);
  if(paymentSettings.partial)paymentLines.push(`${PAYMENT_LABELS.partial}: <b>${partialPaidOrders.length}</b>`);
  if(paymentSettings.unpaid)paymentLines.push(`${PAYMENT_LABELS.unpaid}: <b>${unpaidOrders.length}</b>`);
  console.log("Report metrics",JSON.stringify({period,orders:orders.length,kpiOrders:kpiOrders.length,total,paid,statusMetrics,paymentSettings}));
  return [`📊 <b>Звіт за ${range.label}</b>`,`<code>${range.from}${range.from!==range.to?` — ${range.to}`:""}</code>`,"",`📦 Замовлень: <b>${kpiOrders.length}</b>`,`💰 Дохід: <b>${money(total,currency)}</b>`,`💳 Оплачено: <b>${money(paid,currency)}</b>`,...paymentLines,"",...statusLines,`🧾 Середній чек: <b>${money(average,currency)}</b>`,sources?`\n<b>Джерела</b>\n${sources}`:"",managers?`\n<b>Менеджери</b>\n${managers}`:""].filter(v=>v!=="").join("\n");
}

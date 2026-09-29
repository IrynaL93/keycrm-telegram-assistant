import { getAllOrders, getOrderStatuses } from "./keycrm.js";

function dictionaryDisplayName(item) {
  return item?.name || item?.title || item?.label || item?.display_name || null;
}

function makeStatusMap(items) {
  const map = new Map();
  for (const item of items || []) {
    const name = dictionaryDisplayName(item);
    if (!name) continue;
    for (const key of [item.id, item.alias, item.code, item.key, item.slug]) {
      if (key !== undefined && key !== null && String(key).trim() !== "") map.set(String(key), name);
    }
  }
  return map;
}

function statusIdentity(order) {
  for (const value of [order.status_id, order.status_uuid, order.status_alias, order.status?.id, order.status?.alias, order.status?.code, order.status?.key, order.status?.slug]) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return typeof order.status === "string" ? order.status : "";
}

function statusName(order, map) {
  const id = statusIdentity(order);
  return map.get(id) || order.status?.name || order.status?.title || order.status_alias || id || "Без статусу";
}

function successfulPaymentAmount(order) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  return payments.reduce((sum, p) => {
    const status = String(p?.status ?? p?.payment_status ?? "").trim().toLowerCase();
    const paid = p?.paid === true || p?.is_paid === true || p?.status === true || ["paid", "success", "successful", "completed", "complete", "confirmed", "approved"].includes(status);
    if (!paid) return sum;
    for (const value of [p?.amount, p?.value, p?.sum, p?.total]) {
      const amount = Number(value);
      if (Number.isFinite(amount)) return sum + amount;
    }
    return sum;
  }, 0);
}

export async function syncOrderState(env) {
  if (!env.DB) {
    console.warn("D1 binding DB is not configured; order-state sync skipped");
    return { initialized: 0, changed: 0 };
  }

  const [orders, statuses] = await Promise.all([
    getAllOrders(env, { include: "manager,payments" }),
    getOrderStatuses(env)
  ]);
  const statusMap = makeStatusMap(statuses);
  const now = new Date().toISOString();
  let initialized = 0;
  let changed = 0;

  for (const order of orders) {
    const orderId = Number(order.id);
    if (!Number.isFinite(orderId)) continue;

    const current = {
      statusId: statusIdentity(order),
      statusName: statusName(order, statusMap),
      grandTotal: Number(order.grand_total || 0),
      paidAmount: successfulPaymentAmount(order),
      sourceId: order.source_id == null ? null : Number(order.source_id),
      managerId: order.manager_id == null ? null : Number(order.manager_id),
      createdAt: order.created_at || order.ordered_at || null,
      updatedAt: order.updated_at || null
    };

    const previous = await env.DB.prepare("SELECT * FROM orders_state WHERE order_id = ?").bind(orderId).first();

    if (!previous) {
      await env.DB.prepare(`INSERT INTO orders_state
        (order_id, status_id, status_name, payment_status, grand_total, paid_amount, source_id, manager_id, created_at, updated_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(orderId, current.statusId, current.statusName, current.paidAmount > 0 ? "paid" : "unpaid", current.grandTotal, current.paidAmount, current.sourceId, current.managerId, current.createdAt, current.updatedAt, now).run();
      initialized += 1;
      continue;
    }

    if (String(previous.status_id ?? "") !== current.statusId) {
      await env.DB.prepare(`INSERT INTO order_events (order_id, event_type, old_value, new_value, amount, event_at)
        VALUES (?, 'status_changed', ?, ?, 0, ?)`)
        .bind(orderId, previous.status_name || String(previous.status_id || ""), current.statusName, now).run();
      changed += 1;
    }

    const previousPaid = Number(previous.paid_amount || 0);
    if (current.paidAmount > previousPaid + 0.009) {
      await env.DB.prepare(`INSERT INTO order_events (order_id, event_type, old_value, new_value, amount, event_at)
        VALUES (?, 'payment_added', ?, ?, ?, ?)`)
        .bind(orderId, String(previousPaid), String(current.paidAmount), current.paidAmount - previousPaid, now).run();
      changed += 1;
    }

    await env.DB.prepare(`UPDATE orders_state SET
      status_id=?, status_name=?, payment_status=?, grand_total=?, paid_amount=?, source_id=?, manager_id=?, created_at=?, updated_at=?, last_seen_at=?
      WHERE order_id=?`)
      .bind(current.statusId, current.statusName, current.paidAmount > 0 ? "paid" : "unpaid", current.grandTotal, current.paidAmount, current.sourceId, current.managerId, current.createdAt, current.updatedAt, now, orderId).run();
  }

  console.log("Order state sync", JSON.stringify({ orders: orders.length, initialized, changed }));
  return { initialized, changed };
}

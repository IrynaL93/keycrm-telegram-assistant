const API_BASE = "https://openapi.keycrm.app/v1";

function getKeycrmToken(env) {
  const token = env.KEYCRM_TOKEN || env.KEYCRM_API_TOKEN;
  if (!token) throw new Error("KeyCRM token is not configured");
  return token;
}

async function requestWithToken(token, endpoint, params = {}) {
  const url = new URL(API_BASE + endpoint);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`KeyCRM API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

export async function validateKeycrmToken(token) {
  const normalizedToken = String(token || "").trim();
  if (normalizedToken.length < 10) {
    throw new Error("KeyCRM token is too short");
  }

  // A successful authenticated request proves that the token is valid.
  // Important: validation errors must propagate to the onboarding handler,
  // otherwise an invalid token could be saved as an active CRM connection.
  await requestWithToken(normalizedToken, "/order", { page: 1, limit: 1 });
  return true;
}

export async function keycrmGet(env, endpoint, params = {}) { return requestWithToken(getKeycrmToken(env), endpoint, params); }

export async function getAllOrders(env, params = {}) {
  const orders = []; let page = 1;
  while (page <= 100) {
    const response = await keycrmGet(env, "/order", { page, limit: 50, ...params });
    const data = Array.isArray(response.data) ? response.data : [];
    orders.push(...data);
    if (!response.next_page_url || data.length === 0) break;
    page += 1;
  }
  return orders;
}

async function getPagedDictionary(env, endpoint, label) {
  const items = []; let page = 1;
  try {
    while (page <= 100) {
      const response = await keycrmGet(env, endpoint, { page, limit: 50 });
      const data = Array.isArray(response.data) ? response.data : Array.isArray(response) ? response : [];
      items.push(...data);
      if (!response.next_page_url || data.length === 0) break;
      page += 1;
    }
  } catch (error) { console.error(`Unable to load KeyCRM ${label}:`, error); }
  return items;
}
export async function getOrderStatuses(env) { return getPagedDictionary(env, "/order/status", "order statuses"); }
export async function getOrderSources(env) { return getPagedDictionary(env, "/order/source", "order sources"); }

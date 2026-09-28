const API_BASE = "https://openapi.keycrm.app/v1";

function getKeycrmToken(env) {
  const token = env.KEYCRM_TOKEN || env.KEYCRM_API_TOKEN;
  if (!token) {
    throw new Error("KeyCRM token is not configured. Add KEYCRM_TOKEN in Cloudflare Worker secrets.");
  }
  return token;
}

export async function keycrmGet(env, endpoint, params = {}) {
  const url = new URL(API_BASE + endpoint);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getKeycrmToken(env)}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`KeyCRM API ${response.status}: ${body.slice(0, 500)}`);
  }

  return response.json();
}

export async function getAllOrders(env, params = {}) {
  const orders = [];
  let page = 1;

  while (page <= 100) {
    const response = await keycrmGet(env, "/order", {
      page,
      limit: 50,
      ...params
    });

    const data = Array.isArray(response.data) ? response.data : [];
    orders.push(...data);

    if (!response.next_page_url || data.length === 0) break;
    page += 1;
  }

  return orders;
}

export async function getOrderStatuses(env) {
  const statuses = [];
  let page = 1;

  try {
    while (page <= 100) {
      const response = await keycrmGet(env, "/order/status", {
        page,
        limit: 50
      });

      const data = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

      statuses.push(...data);

      if (!response.next_page_url || data.length === 0) break;
      page += 1;
    }
  } catch (error) {
    console.error("Unable to load KeyCRM order statuses:", error);
  }

  return statuses;
}

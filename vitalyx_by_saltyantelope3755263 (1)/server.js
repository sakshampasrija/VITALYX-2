export const schema = `
  CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, kind)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    customer_name TEXT,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
  );
  CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at);
  CREATE TABLE IF NOT EXISTS catalog (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const json = (data, status = 200) => Response.json(data, { status });
const readBody = async (request) => {
  try { return await request.json(); } catch { return null; }
};
const signedIn = (request) => request.headers.get("x-websim-user-id");
const isOwner = (request) => {
  const userId = signedIn(request);
  return Boolean(userId && userId === request.headers.get("x-websim-project-owner-id"));
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/data") {
      const userId = signedIn(request);
      if (!userId) return json({ error: "Sign in required" }, 401);
      const { results } = await env.DB.prepare("SELECT kind, payload, updated_at FROM user_data WHERE user_id = ?").bind(userId).all();
      const data = {};
      for (const row of results) { try { data[row.kind] = JSON.parse(row.payload); } catch {} }
      return json({ data });
    }
    if (request.method === "PUT" && url.pathname === "/api/data") {
      const userId = signedIn(request);
      if (!userId) return json({ error: "Sign in required" }, 401);
      const body = await readBody(request);
      if (!body || typeof body.kind !== "string" || !/^[a-zA-Z0-9_-]{1,48}$/.test(body.kind) || typeof body.value !== "object") return json({ error: "Invalid data" }, 400);
      const payload = JSON.stringify(body.value);
      if (payload.length > 50000) return json({ error: "Data too large" }, 413);
      await env.DB.prepare("INSERT INTO user_data (user_id, kind, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, kind) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at")
        .bind(userId, body.kind, payload, new Date().toISOString()).run();
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/api/orders") {
      const userId = signedIn(request);
      if (!userId) return json({ error: "Sign in required" }, 401);
      const body = await readBody(request);
      if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 30 || typeof body.total !== "number" || !Number.isFinite(body.total) || body.total < 0 || body.total > 1000000) return json({ error: "Invalid order" }, 400);
      const items = body.items.map((item) => ({ name: String(item.name || "Item").slice(0, 100), quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)), price: Math.max(0, Number(item.price) || 0) }));
      await env.DB.prepare("INSERT INTO orders (user_id, customer_name, items, total, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(userId, String(body.name || "").slice(0, 100), JSON.stringify(items), body.total, new Date().toISOString()).run();
      return json({ ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/catalog") {
      const { results } = await env.DB.prepare("SELECT id, kind, payload FROM catalog ORDER BY kind, id").all();
      return json({ items: results.map((row) => ({ id: row.id, kind: row.kind, ...JSON.parse(row.payload) })) });
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (!isOwner(request)) return json({ error: "Forbidden" }, 403);
      if (request.method === "GET" && url.pathname === "/api/admin/catalog") {
        const { results } = await env.DB.prepare("SELECT id, kind, payload FROM catalog ORDER BY kind, id").all();
        return json({ items: results.map((row) => ({ id: row.id, kind: row.kind, ...JSON.parse(row.payload) })) });
      }
      if (request.method === "POST" && url.pathname === "/api/admin/catalog") {
        const body = await readBody(request);
        if (!body || !["workout", "product", "video"].includes(body.kind) || !body.item || typeof body.item !== "object") return json({ error: "Invalid catalog item" }, 400);
        const id = String(body.item.id || crypto.randomUUID()).slice(0, 80);
        await env.DB.prepare("INSERT INTO catalog (id, kind, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload, updated_at = excluded.updated_at")
          .bind(id, body.kind, JSON.stringify({ ...body.item, id }), new Date().toISOString()).run();
        return json({ ok: true, id });
      }
      if (request.method === "DELETE" && url.pathname === "/api/admin/catalog") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "Missing id" }, 400);
        await env.DB.prepare("DELETE FROM catalog WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
      return json({ error: "Not found" }, 404);
    }
    return json({ error: "Not found" }, 404);
  },
};
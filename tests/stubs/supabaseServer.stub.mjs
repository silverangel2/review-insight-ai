// In-memory Supabase stand-in for keeper tests.
// Implements the small PostgREST surface the real modules use:
//   select with eq filters + order + limit + column projection,
//   insert, upsert (conflict column), update (id=eq.X), count.
// Table state is resettable via __reset() and seedable via __seed().
const tables = new Map();
let seq = 0;

function rowsOf(table) {
  if (!tables.has(table)) tables.set(table, []);
  return tables.get(table);
}

function parseQuery(query) {
  const filters = [];
  let order = null;
  let limit = null;
  for (const part of String(query || "").split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    if (key === "select") continue; // projection: cosmetic for tests
    if (key === "order") {
      const [col, dir] = value.split(".");
      order = { col, desc: dir === "desc" };
      continue;
    }
    if (key === "limit") {
      limit = Math.max(0, Number(value) || 0);
      continue;
    }
    if (value.startsWith("eq.")) filters.push({ col: key, op: "eq", value: value.slice(3) });
    else if (value.startsWith("gte.")) filters.push({ col: key, op: "gte", value: value.slice(4) });
    else if (value.startsWith("lte.")) filters.push({ col: key, op: "lte", value: value.slice(4) });
  }
  return { filters, order, limit };
}

function applyQuery(rows, query) {
  const { filters, order, limit } = parseQuery(query);
  let out = rows.filter((row) =>
    filters.every((f) => {
      const v = row[f.col];
      if (f.op === "eq") return String(v ?? "") === String(f.value);
      if (f.op === "gte") return Number(v) >= Number(f.value);
      if (f.op === "lte") return Number(v) <= Number(f.value);
      return true;
    })
  );
  if (order) {
    out = [...out].sort((a, b) => {
      const av = a[order.col];
      const bv = b[order.col];
      const cmp = String(av ?? "") < String(bv ?? "") ? -1 : String(av ?? "") > String(bv ?? "") ? 1 : 0;
      return order.desc ? -cmp : cmp;
    });
  }
  if (limit !== null) out = out.slice(0, limit);
  return out;
}

export function __reset() {
  tables.clear();
  seq = 0;
}
export function __seed(table, rows) {
  rowsOf(table).push(...rows.map((r) => ({ ...r })));
}
export function __tables() {
  return tables;
}

export function isSupabaseConfigured() {
  return true;
}
export function hasSupabaseServiceEnv() {
  return true;
}

export async function supabaseSelect(table, query = "select=*") {
  return applyQuery(rowsOf(table), query).map((r) => ({ ...r }));
}

export async function supabaseInsert(table, rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  const now = new Date().toISOString();
  const inserted = list.map((r) => {
    seq += 1;
    const row = { id: r.id || `stub-${seq}`, created_at: r.created_at || now, ...r };
    rowsOf(table).push(row);
    return { ...row };
  });
  return inserted;
}

export async function supabaseUpsert(table, rows, conflict = "email") {
  const list = Array.isArray(rows) ? rows : [rows];
  const store = rowsOf(table);
  const out = [];
  for (const r of list) {
    seq += 1;
    const idx = store.findIndex((x) => String(x[conflict] ?? "") === String(r[conflict] ?? "") && conflict in x);
    const row = { id: r.id || `stub-${seq}`, created_at: new Date().toISOString(), ...r };
    if (idx >= 0) store[idx] = { ...store[idx], ...row };
    else store.push(row);
    out.push({ ...row });
  }
  return out;
}

export async function supabaseUpdate(table, query, patch) {
  const matched = applyQuery(rowsOf(table), query);
  for (const row of matched) Object.assign(row, patch);
  return matched.map((r) => ({ ...r }));
}

export async function supabaseDelete(table, query) {
  const store = rowsOf(table);
  const matched = applyQuery(store, query);
  for (const row of matched) store.splice(store.indexOf(row), 1);
  return matched.length;
}

export async function supabaseCount(table, query = "select=*") {
  return applyQuery(rowsOf(table), query).length;
}

export async function supabaseRpc() {
  return null;
}

import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";

type FinanceEntry = {
  id?: string;
  created_at?: string;
  updated_at?: string;
  entry_date?: string;
  type?: "income" | "expense";
  category?: string;
  amount?: number | string;
  currency?: string;
  description?: string | null;
  tax_note?: string | null;
  receipt_url?: string | null;
  status?: string | null;
};

type FinanceLog = {
  id?: string;
  created_at?: string;
  action?: string;
  entry_id?: string | null;
  entry_type?: string | null;
  category?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

const ENTRIES_TABLE = "admin_finance_entries";
const LOGS_TABLE = "admin_finance_logs";

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function supabaseServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    ""
  );
}

function hasFinanceStorage() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

function headers(extra?: Record<string, string>) {
  const key = supabaseServiceKey();

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function moneyNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeEntry(input: Record<string, unknown>) {
  const type = String(input.type || "expense") === "income" ? "income" : "expense";
  const amount = Math.abs(moneyNumber(input.amount));
  const category = String(input.category || "General").trim() || "General";
  const currency = String(input.currency || "CAD").trim().toUpperCase() || "CAD";
  const entryDate = String(input.entry_date || new Date().toISOString().slice(0, 10)).slice(0, 10);

  return {
    entry_date: entryDate,
    type,
    category,
    amount,
    currency,
    description: String(input.description || "").trim() || null,
    tax_note: String(input.tax_note || "").trim() || null,
    receipt_url: String(input.receipt_url || "").trim() || null,
    status: String(input.status || "logged").trim() || "logged",
    updated_at: new Date().toISOString(),
  };
}

function summarize(entries: FinanceEntry[]) {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + moneyNumber(entry.amount), 0);

  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + moneyNumber(entry.amount), 0);

  const categoryMap = new Map<string, { category: string; income: number; expense: number; net: number; total: number }>();
  const monthlyMap = new Map<string, { month: string; income: number; expenses: number; net: number; total: number }>();

  for (const entry of entries) {
    const amount = moneyNumber(entry.amount);
    const category = entry.category || "General";
    const month = String(entry.entry_date || "").slice(0, 7) || "No date";

    const categoryRow =
      categoryMap.get(category) || { category, income: 0, expense: 0, net: 0, total: 0 };

    const monthRow =
      monthlyMap.get(month) || { month, income: 0, expenses: 0, net: 0, total: 0 };

    if (entry.type === "income") {
      categoryRow.income += amount;
      monthRow.income += amount;
    } else {
      categoryRow.expense += amount;
      monthRow.expenses += amount;
    }

    categoryRow.net = categoryRow.income - categoryRow.expense;
    categoryRow.total += 1;

    monthRow.net = monthRow.income - monthRow.expenses;
    monthRow.total += 1;

    categoryMap.set(category, categoryRow);
    monthlyMap.set(month, monthRow);
  }

  return {
    summary: {
      income,
      expenses,
      net: income - expenses,
      total: entries.length,
    },
    categorySummary: Array.from(categoryMap.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    monthlySummary: Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month)),
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text().catch(() => "");
  let data: T | null = null;

  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? undefined : text,
  };
}

async function readEntries() {
  const result = await fetchJson<FinanceEntry[]>(
    `${supabaseUrl()}/rest/v1/${ENTRIES_TABLE}?select=*&order=entry_date.desc,created_at.desc&limit=500`
  );

  if (!result.ok) {
    throw new Error(`Finance entries read failed: ${result.status} ${result.error || ""}`);
  }

  return Array.isArray(result.data) ? result.data : [];
}

async function readLogs() {
  const result = await fetchJson<FinanceLog[]>(
    `${supabaseUrl()}/rest/v1/${LOGS_TABLE}?select=*&order=created_at.desc&limit=80`
  );

  if (!result.ok) {
    return [];
  }

  return Array.isArray(result.data) ? result.data : [];
}

async function writeLog(input: FinanceLog) {
  if (!hasFinanceStorage()) return;

  await fetchJson<FinanceLog[]>(
    `${supabaseUrl()}/rest/v1/${LOGS_TABLE}`,
    {
      method: "POST",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        action: input.action,
        entry_id: input.entry_id || null,
        entry_type: input.entry_type || null,
        category: input.category || null,
        amount: input.amount ?? null,
        currency: input.currency || null,
        note: input.note || null,
        metadata: input.metadata || {},
      }),
    }
  );
}

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (!hasFinanceStorage()) {
    return NextResponse.json({
      ok: false,
      error: "Supabase service role env is missing for finance storage.",
      entries: [],
      logs: [],
      summary: { income: 0, expenses: 0, net: 0, total: 0 },
      categorySummary: [],
      monthlySummary: [],
      deploymentReady: false,
    });
  }

  try {
    const entries = await readEntries();
    const logs = await readLogs();
    const calculated = summarize(entries);

    return NextResponse.json({
      ok: true,
      entries,
      logs,
      ...calculated,
      deploymentReady: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Finance could not be loaded.",
        entries: [],
        logs: [],
        summary: { income: 0, expenses: 0, net: 0, total: 0 },
        categorySummary: [],
        monthlySummary: [],
        deploymentReady: false,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (!hasFinanceStorage()) {
    return NextResponse.json({ error: "Supabase service role env is missing for finance storage." }, { status: 500 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const entry = normalizeEntry(body);

    if (!entry.amount || entry.amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }

    const result = await fetchJson<FinanceEntry[]>(
      `${supabaseUrl()}/rest/v1/${ENTRIES_TABLE}`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(entry),
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: `Finance entry save failed: ${result.status} ${result.error || ""}` },
        { status: 500 }
      );
    }

    const savedEntry = Array.isArray(result.data) ? result.data[0] : null;

    await writeLog({
      action: "created",
      entry_id: savedEntry?.id || null,
      entry_type: entry.type,
      category: entry.category,
      amount: entry.amount,
      currency: entry.currency,
      note: `${entry.type === "income" ? "Income" : "Expense"} logged: ${entry.category}`,
      metadata: {
        description: entry.description,
        entry_date: entry.entry_date,
        tax_note: entry.tax_note,
        receipt_url: entry.receipt_url,
      },
    });

    const entries = await readEntries();
    const logs = await readLogs();
    const calculated = summarize(entries);

    return NextResponse.json({
      ok: true,
      entry: savedEntry,
      entries,
      logs,
      ...calculated,
      deploymentReady: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finance entry could not be saved." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || "");

    if (!id) {
      return NextResponse.json({ error: "Finance entry id is required." }, { status: 400 });
    }

    const patch = normalizeEntry(body);

    const result = await fetchJson<FinanceEntry[]>(
      `${supabaseUrl()}/rest/v1/${ENTRIES_TABLE}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(patch),
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: `Finance entry update failed: ${result.status} ${result.error || ""}` },
        { status: 500 }
      );
    }

    await writeLog({
      action: "updated",
      entry_id: id,
      entry_type: patch.type,
      category: patch.category,
      amount: patch.amount,
      currency: patch.currency,
      note: `Finance entry updated: ${patch.category}`,
      metadata: patch,
    });

    const entries = await readEntries();
    const logs = await readLogs();

    return NextResponse.json({
      ok: true,
      entries,
      logs,
      ...summarize(entries),
      deploymentReady: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finance entry could not be updated." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "");

    if (!id) {
      return NextResponse.json({ error: "Finance entry id is required." }, { status: 400 });
    }

    const result = await fetchJson<FinanceEntry[]>(
      `${supabaseUrl()}/rest/v1/${ENTRIES_TABLE}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=representation",
        },
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: `Finance entry delete failed: ${result.status} ${result.error || ""}` },
        { status: 500 }
      );
    }

    const deleted = Array.isArray(result.data) ? result.data[0] : null;

    await writeLog({
      action: "deleted",
      entry_id: id,
      entry_type: deleted?.type || null,
      category: deleted?.category || null,
      amount: deleted?.amount || null,
      currency: deleted?.currency || null,
      note: `Finance entry deleted: ${deleted?.category || id}`,
      metadata: deleted ? { deleted } : {},
    });

    const entries = await readEntries();
    const logs = await readLogs();

    return NextResponse.json({
      ok: true,
      entries,
      logs,
      ...summarize(entries),
      deploymentReady: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finance entry could not be deleted." },
      { status: 500 }
    );
  }
}

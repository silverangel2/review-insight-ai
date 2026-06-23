import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";

type FinanceEntry = {
  id?: string;
  created_at?: string;
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

const TABLE = "admin_finance_entries";

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

function headers() {
  const key = supabaseServiceKey();

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function money(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCurrency(value: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value);
}


function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function canadaTaxLineFor(entry: FinanceEntry) {
  const category = String(entry.category || "").toLowerCase();
  const description = String(entry.description || "").toLowerCase();
  const taxNote = String(entry.tax_note || "").toLowerCase();
  const combined = `${category} ${description} ${taxNote}`;

  if (combined.includes("advertising") || combined.includes("marketing") || combined.includes("google ads") || combined.includes("canva")) {
    return {
      line: "8521",
      label: "Advertising",
      note: "Suggested T2125 grouping for advertising, promotion, and marketing expenses.",
    };
  }

  if (combined.includes("meal") || combined.includes("entertainment")) {
    return {
      line: "8523",
      label: "Meals and entertainment",
      note: "CRA commonly limits meals and entertainment claims to the allowable portion.",
    };
  }

  if (combined.includes("insurance")) {
    return {
      line: "8690",
      label: "Insurance",
      note: "Suggested T2125 grouping for business insurance.",
    };
  }

  if (combined.includes("bank") || combined.includes("stripe") || combined.includes("payment fee") || combined.includes("interest")) {
    return {
      line: "8710",
      label: "Interest and bank charges",
      note: "Suggested T2125 grouping for bank charges and payment-processing fees.",
    };
  }

  if (combined.includes("licence") || combined.includes("license") || combined.includes("membership")) {
    return {
      line: "8760",
      label: "Business taxes, licences, and memberships",
      note: "Suggested T2125 grouping for business licences, dues, and memberships.",
    };
  }

  if (combined.includes("office")) {
    return {
      line: "8810",
      label: "Office expenses",
      note: "Suggested T2125 grouping for office expenses.",
    };
  }

  if (combined.includes("stationery") || combined.includes("supplies")) {
    return {
      line: "8811",
      label: "Office stationery and supplies",
      note: "Suggested T2125 grouping for office stationery and supplies.",
    };
  }

  if (combined.includes("accounting") || combined.includes("legal") || combined.includes("professional")) {
    return {
      line: "8860",
      label: "Professional fees",
      note: "Suggested T2125 grouping for legal, accounting, and professional fees.",
    };
  }

  if (combined.includes("admin") || combined.includes("management")) {
    return {
      line: "8871",
      label: "Management and administration fees",
      note: "Suggested T2125 grouping for management and admin fees.",
    };
  }

  if (combined.includes("rent")) {
    return {
      line: "8910",
      label: "Rent",
      note: "Suggested T2125 grouping for business rent.",
    };
  }

  if (combined.includes("travel") || combined.includes("hotel") || combined.includes("flight") || combined.includes("transportation")) {
    return {
      line: "9200",
      label: "Travel expenses",
      note: "Suggested T2125 grouping for business travel expenses.",
    };
  }

  if (combined.includes("vehicle") || combined.includes("car") || combined.includes("fuel") || combined.includes("mileage")) {
    return {
      line: "9281",
      label: "Motor vehicle expenses",
      note: "Suggested T2125 grouping for business-use motor vehicle expenses.",
    };
  }

  if (
    combined.includes("vercel") ||
    combined.includes("domain") ||
    combined.includes("hosting") ||
    combined.includes("supabase") ||
    combined.includes("resend") ||
    combined.includes("openai") ||
    combined.includes("api") ||
    combined.includes("software") ||
    combined.includes("subscription") ||
    combined.includes("database") ||
    combined.includes("email")
  ) {
    return {
      line: "9270",
      label: "Other business expenses",
      note: "Suggested T2125 grouping for cloud, SaaS, domain, API, and software expenses. List these clearly.",
    };
  }

  return {
    line: "9270",
    label: "Other business expenses",
    note: "Suggested catch-all T2125 grouping. Review before filing.",
  };
}

function buildCanadaTaxGroups(entries: FinanceEntry[]) {
  const expenseEntries = entries.filter((entry) => entry.type === "expense");
  const groups = new Map<
    string,
    {
      line: string;
      label: string;
      note: string;
      total: number;
      count: number;
      entries: FinanceEntry[];
    }
  >();

  for (const entry of expenseEntries) {
    const taxLine = canadaTaxLineFor(entry);
    const key = `${taxLine.line}-${taxLine.label}`;
    const current =
      groups.get(key) || {
        line: taxLine.line,
        label: taxLine.label,
        note: taxLine.note,
        total: 0,
        count: 0,
        entries: [],
      };

    current.total += money(entry.amount);
    current.count += 1;
    current.entries.push(entry);
    groups.set(key, current);
  }

  return Array.from(groups.values()).sort((a, b) => a.line.localeCompare(b.line));
}

function buildSummary(entries: FinanceEntry[]) {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + money(entry.amount), 0);

  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + money(entry.amount), 0);

  const categoryMap = new Map<string, { category: string; income: number; expenses: number; net: number }>();
  const monthMap = new Map<string, { month: string; income: number; expenses: number; net: number }>();

  for (const entry of entries) {
    const amount = money(entry.amount);
    const category = entry.category || "General";
    const month = String(entry.entry_date || "").slice(0, 7) || "No date";

    const categoryRow = categoryMap.get(category) || {
      category,
      income: 0,
      expenses: 0,
      net: 0,
    };

    const monthRow = monthMap.get(month) || {
      month,
      income: 0,
      expenses: 0,
      net: 0,
    };

    if (entry.type === "income") {
      categoryRow.income += amount;
      monthRow.income += amount;
    } else {
      categoryRow.expenses += amount;
      monthRow.expenses += amount;
    }

    categoryRow.net = categoryRow.income - categoryRow.expenses;
    monthRow.net = monthRow.income - monthRow.expenses;

    categoryMap.set(category, categoryRow);
    monthMap.set(month, monthRow);
  }

  return {
    income,
    expenses,
    net: income - expenses,
    categoryTotals: Array.from(categoryMap.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    monthlyTotals: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

function buildCsv(reportType: string, year: string, entries: FinanceEntry[]) {
  const summary = buildSummary(entries);

  const rows = [
    ["ReviewIntel Finance Report"],
    ["Report Type", reportType],
    ["Year", year],
    ["Generated At", new Date().toISOString()],
    [],
    ["Summary"],
    ["Income", summary.income],
    ["Expenses", summary.expenses],
    ["Net", summary.net],
    [],
    ["Canada T2125-Style Expense Grouping"],
    ["Line", "Category", "Total", "Entry Count", "Note"],
    ...buildCanadaTaxGroups(entries).map((row) => [row.line, row.label, row.total, row.count, row.note]),
    [],
    ["Monthly Totals"],
    ["Month", "Income", "Expenses", "Net"],
    ...summary.monthlyTotals.map((row) => [row.month, row.income, row.expenses, row.net]),
    [],
    ["Category Totals"],
    ["Category", "Income", "Expenses", "Net"],
    ...summary.categoryTotals.map((row) => [row.category, row.income, row.expenses, row.net]),
    [],
    ["Entries"],
    ["Date", "Type", "Category", "Suggested T2125 Line", "Suggested T2125 Category", "Amount", "Currency", "Description", "Tax Note", "Receipt URL", "Status"],
    ...entries.map((entry) => {
      const taxLine = canadaTaxLineFor(entry);

      return [
        entry.entry_date || "",
        entry.type || "",
        entry.category || "",
        entry.type === "expense" ? taxLine.line : "",
        entry.type === "expense" ? taxLine.label : "",
        money(entry.amount),
        entry.currency || "CAD",
        entry.description || "",
        entry.tax_note || "",
        entry.receipt_url || "",
        entry.status || "",
      ];
    }),
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function buildHtml(reportType: string, year: string, entries: FinanceEntry[]) {
  const summary = buildSummary(entries);
  const title = reportType === "tax" ? "Tax Preparation Report" : "Personal Finance Report";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ReviewIntel ${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #101828; padding: 32px; }
    .wrap { max-width: 1100px; margin: 0 auto; background: white; border: 1px solid #e6eaf2; border-radius: 24px; padding: 32px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .muted { color: #667085; font-size: 14px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 28px 0; }
    .card { border: 1px solid #e6eaf2; border-radius: 18px; padding: 18px; background: #f8fafc; }
    .label { font-size: 11px; text-transform: uppercase; font-weight: 900; color: #667085; letter-spacing: .12em; }
    .value { margin-top: 8px; font-size: 26px; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e6eaf2; text-align: left; padding: 10px; vertical-align: top; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    section { margin-top: 32px; }
    @media print { body { background: white; padding: 0; } .wrap { border: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="label">ReviewIntel Finance</p>
    <h1>${title}</h1>
    <p class="muted">Year: ${year} · Generated: ${new Date().toLocaleString("en-CA")}</p>
    <p class="muted">For business/tax organization only. Review with a qualified tax professional before filing.</p>

    <div class="cards">
      <div class="card"><div class="label">Income</div><div class="value">${formatCurrency(summary.income)}</div></div>
      <div class="card"><div class="label">Expenses</div><div class="value">${formatCurrency(summary.expenses)}</div></div>
      <div class="card"><div class="label">Net</div><div class="value">${formatCurrency(summary.net)}</div></div>
    </div>

    <section>
      <h2>Canada T2125-Style Expense Grouping</h2>
      <p class="muted">Suggested grouping pattern for Canadian self-employed/business expense organization. Review with a qualified tax professional before filing.</p>
      <table>
        <thead><tr><th>T2125 Line</th><th>Category</th><th>Total</th><th>Entries</th><th>Note</th></tr></thead>
        <tbody>
          ${buildCanadaTaxGroups(entries).map((row) => `<tr><td>${row.line}</td><td>${htmlEscape(row.label)}</td><td>${formatCurrency(row.total)}</td><td>${row.count}</td><td>${htmlEscape(row.note)}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Monthly Totals</h2>
      <table>
        <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead>
        <tbody>
          ${summary.monthlyTotals.map((row) => `<tr><td>${row.month}</td><td>${formatCurrency(row.income)}</td><td>${formatCurrency(row.expenses)}</td><td>${formatCurrency(row.net)}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Category Totals</h2>
      <table>
        <thead><tr><th>Category</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead>
        <tbody>
          ${summary.categoryTotals.map((row) => `<tr><td>${row.category}</td><td>${formatCurrency(row.income)}</td><td>${formatCurrency(row.expenses)}</td><td>${formatCurrency(row.net)}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Entries</h2>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Suggested T2125</th><th>Amount</th><th>Description</th><th>Tax Note</th></tr></thead>
        <tbody>
          ${entries.map((entry) => {
            const taxLine = canadaTaxLineFor(entry);
            return `<tr><td>${htmlEscape(entry.entry_date || "")}</td><td>${htmlEscape(entry.type || "")}</td><td>${htmlEscape(entry.category || "")}</td><td>${entry.type === "expense" ? `${taxLine.line} — ${htmlEscape(taxLine.label)}` : ""}</td><td>${formatCurrency(money(entry.amount), entry.currency || "CAD")}</td><td>${htmlEscape(entry.description || "")}</td><td>${htmlEscape(entry.tax_note || "")}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (!hasFinanceStorage()) {
    return NextResponse.json({ error: "Supabase service role env is missing for finance reports." }, { status: 500 });
  }

  const url = new URL(request.url);
  const reportType = url.searchParams.get("type") === "personal" ? "personal" : "tax";
  const format = url.searchParams.get("format") || "json";
  const year = url.searchParams.get("year") || String(new Date().getFullYear());

  const response = await fetch(
    `${supabaseUrl()}/rest/v1/${TABLE}?select=*&entry_date=gte.${year}-01-01&entry_date=lte.${year}-12-31&order=entry_date.asc,created_at.asc`,
    {
      method: "GET",
      headers: headers(),
      cache: "no-store",
    }
  );

  const text = await response.text().catch(() => "");
  const entries = text ? (JSON.parse(text) as FinanceEntry[]) : [];

  if (!response.ok) {
    return NextResponse.json(
      { error: `Finance report read failed: ${response.status} ${text}` },
      { status: 500 }
    );
  }

  const summary = buildSummary(entries);

  if (format === "csv") {
    const csv = buildCsv(reportType, year, entries);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reviewintel-${reportType}-finance-report-${year}.csv"`,
      },
    });
  }

  if (format === "html") {
    return new Response(buildHtml(reportType, year, entries), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    reportType,
    year,
    generatedAt: new Date().toISOString(),
    entries,
    ...summary,
  });
}

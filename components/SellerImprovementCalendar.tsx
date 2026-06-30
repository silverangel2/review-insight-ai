"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { canUseSellerProJournal, readSellerJournal, readSellerJournalNotes, saveSellerJournalNote, type SellerJournalScan } from "@/lib/sellerJournal";
import { getClientAccount } from "@/lib/clientAccount";
function formatPercent(value: number | undefined | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function sellerCalendarText(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "No detail saved yet.";

  const normalized = raw.toLowerCase();

  const replacements: Array<[string, string]> = [
    [
      "main recurring complaint theme: fit or compatibility clarity",
      "Buyers may be unsure if this product is the right fit for their exact need."
    ],
    [
      "fit or compatibility clarity",
      "Clarify fit, size, compatibility, and use limits before checkout."
    ],
    [
      "price-to-quality value proof",
      "Show why the product is worth the price using real customer proof."
    ],
    [
      "fix first: remove or reduce the root cause behind the leading complaint",
      "Fix first: address the concern buyers are repeating most."
    ],
    [
      "use satisfaction at 71% as the operating benchmark for the next product revision",
      "Use the current satisfaction score as the benchmark for the next improvement."
    ],
    [
      "reduce the highest-severity complaint before increasing traffic",
      "Reduce the biggest buyer concern before sending more traffic to the product."
    ],
    [
      "today: fix or explain the leading complaint in the listing and product experience",
      "Today: explain or fix the main buyer concern in the listing and product experience."
    ],
    [
      "this week: turn material quality perception into a proof-led listing section with one clear claim, one photo cue, and one buyer expectation note",
      "This week: turn the strongest quality signal into one clear listing proof point."
    ],
    [
      "track satisfaction weekly and keep shopper score and seller score within the same evidence model",
      "Track satisfaction weekly and compare it against future seller scans."
    ],
    [
      "71% satisfaction: demand exists, but the leading complaint theme is limiting confidence",
      "Demand is present, but one concern is still holding back buyer confidence."
    ],
    [
      "the clearest pain point is reducing trust before purchase and after delivery",
      "The clearest pain point is creating doubt before purchase and after delivery."
    ],
    [
      "material quality perception",
      "Buyers are paying attention to material quality."
    ],
    [
      "durability and long-term reliability proof",
      "Show stronger proof that the product lasts through real use."
    ],
    [
      "setup and instruction clarity",
      "Make setup and instructions easier to understand."
    ],
    [
      "packaging and unboxing expectation",
      "Set clearer expectations for packaging and unboxing."
    ],
    [
      "perfect for international flights",
      "Customers see this as useful for international travel."
    ]
  ];

  for (const [oldText, newText] of replacements) {
    if (normalized === oldText || normalized.includes(oldText)) {
      return newText;
    }
  }

  return raw;
}

function sellerCalendarBrief(value: string | undefined | null, max = 150) {
  const clean = sellerCalendarText(value).replace(/\s+/g, " ").trim();
  if (!clean) return "No clear signal saved yet.";
  return clean.length > max ? `${clean.slice(0, Math.max(12, max - 1)).trim()}…` : clean;
}

function sellerCalendarProductName(value: string | undefined | null) {
  const clean = String(value || "Saved product")
    .replace(/\.(csv|xlsx|xls|txt)$/i, "")
    .replace(/^seller[_\s-]*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > 46 ? `${clean.slice(0, 45).trim()}…` : clean;
}

function compactScore(value: number | undefined | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function isCompareScan(scan: SellerJournalScan) {
  const record = scan as unknown as Record<string, unknown>;
  const type = String(record.type ?? record.kind ?? record.mode ?? "").toLowerCase();
  return type.includes("compare") || type.includes("comparison") || Boolean(record.competitorName);
}

function normalScans(scans: SellerJournalScan[]) {
  return scans.filter((scan) => !isCompareScan(scan));
}

function compareScanCount(scans: SellerJournalScan[]) {
  return scans.filter(isCompareScan).length;
}

function averageProductScore(scans: SellerJournalScan[]) {
  const scores = normalScans(scans)
    .map((scan) => scan.productScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}


function uniqueList(items: string[], limit = 8) {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function productAverageRows(scans: SellerJournalScan[]) {
  const groups = new Map<string, number[]>();

  for (const scan of normalScans(scans)) {
    const name = scan.productName || "Unnamed product";
    if (typeof scan.productScore !== "number" || !Number.isFinite(scan.productScore)) continue;
    const current = groups.get(name) ?? [];
    current.push(scan.productScore);
    groups.set(name, current);
  }

  return Array.from(groups.entries())
    .map(([name, scores]) => ({
      name,
      average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      count: scores.length
    }))
    .sort((a, b) => a.average - b.average);
}



type CalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  scans: SellerJournalScan[];
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthTitle(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function average(items: number[]) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item, 0) / items.length;
}

function sentimentLabel(value: number) {
  if (value >= 0.35) return "Positive";
  if (value <= -0.2) return "Risk";
  return "Mixed";
}

function sentimentTone(value: number): "good" | "warn" | "bad" {
  if (value >= 0.35) return "good";
  if (value <= -0.2) return "bad";
  return "warn";
}

function buildCalendar(month: Date, scans: SellerJournalScan[]) {
  const first = monthStart(month);
  const year = first.getFullYear();
  const monthIndex = first.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leading = first.getDay();
  const cells: CalendarDay[] = [];
  const grouped = scans.reduce<Record<string, SellerJournalScan[]>>((acc, scan) => {
    acc[scan.date] = [...(acc[scan.date] ?? []), scan];
    return acc;
  }, {});

  for (let index = 0; index < leading; index += 1) {
    const date = new Date(year, monthIndex, index - leading + 1);
    cells.push({ date: dateKey(date), dayNumber: date.getDate(), inMonth: false, scans: [] });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = dateKey(new Date(year, monthIndex, day));
    cells.push({ date, dayNumber: day, inMonth: true, scans: grouped[date] ?? [] });
  }

  while (cells.length % 7 !== 0) {
    const date = new Date(year, monthIndex, daysInMonth + (cells.length % 7));
    cells.push({ date: dateKey(date), dayNumber: date.getDate(), inMonth: false, scans: [] });
  }

  return cells;
}

function dayMetrics(scans: SellerJournalScan[]) {
  const score = clamp(average(scans.map((scan) => scan.productScore)));
  const sentiment = average(scans.map((scan) => scan.sentimentScore));
  const progress = clamp(score * 0.7 + (sentiment + 1) * 15);
  const complaint = scans[0]?.mainComplaint ?? "No scan yet";
  return { score, sentiment, progress, complaint };
}


type SupabaseAnalysisRow = {
  id?: string;
  profile_email?: string | null;
  mode?: string | null;
  product_name?: string | null;
  platform?: string | null;
  product_score?: number | null;
  recommendation?: unknown;
  summary?: string | null;
  analysis_json?: Record<string, unknown> | null;
  created_at?: string | null;
};

function asNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function mapAnalysisRowToSellerScan(row: SupabaseAnalysisRow): SellerJournalScan {
  const analysis = row.analysis_json && typeof row.analysis_json === "object" ? row.analysis_json : {};
  const sellerInsights = analysis.seller_insights && typeof analysis.seller_insights === "object"
    ? analysis.seller_insights as Record<string, unknown>
    : {};

  const complaints = Array.isArray(analysis.top_complaints) ? analysis.top_complaints : [];
  const praise = Array.isArray(analysis.top_praises) ? analysis.top_praises : [];

  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  const score = asNumber(row.product_score ?? analysis.product_score, 0);

  return {
    id: String(row.id ?? row.created_at ?? crypto.randomUUID()),
    date: dateKey(createdAt),
    productName: String(row.product_name ?? analysis.product_name ?? "Saved seller scan"),
    productScore: score,
    sentimentScore: asNumber(analysis.sentiment_score ?? sellerInsights.sentiment_score, 0),
    reviewCount: asNumber(analysis.review_count ?? analysis.reviewCount, 0),
    topComplaints: complaints.map((item) => String(item)),
    topPositiveFeedback: praise.map((item) => String(item)),
    recommendations: Array.isArray(analysis.recommendations)
      ? analysis.recommendations.map((item) => String(item))
      : Array.isArray(sellerInsights.recommendations)
        ? sellerInsights.recommendations.map((item) => String(item))
        : [],
    mainComplaint: String(
      complaints[0] ??
      sellerInsights.main_complaint ??
      sellerInsights.top_risk ??
      row.summary ??
      "Saved seller scan"
    ),
    strongestPraise: String(
      praise[0] ??
      sellerInsights.strongest_praise ??
      sellerInsights.best_strength ??
      "Review scan saved"
    ),
    recommendation: String(
      analysis.seller_recommendation ??
      sellerInsights.recommendation ??
      row.summary ??
      "Review saved for Seller Pro calendar."
    ),
    actionPlan: Array.isArray(analysis.action_plan)
      ? analysis.action_plan.map((item) => String(item))
      : Array.isArray(analysis.actionPlan)
        ? analysis.actionPlan.map((item) => String(item))
        : Array.isArray(sellerInsights.action_plan)
          ? sellerInsights.action_plan.map((item) => String(item))
          : [],
    summary: String(
      row.summary ??
      analysis.summary ??
      sellerInsights.summary ??
      "Saved seller scan"
    ),
    productHealth: score,
    createdAt: String(row.created_at ?? createdAt.toISOString()),
    source: "saved"
  } as SellerJournalScan;
}


export function SellerImprovementCalendar() {
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [savedScans, setSavedScans] = useState<SellerJournalScan[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const sellerProJournalEnabled = canUseSellerProJournal();

  useEffect(() => {
    let cancelled = false;

    async function loadSellerScans() {
      if (!canUseSellerProJournal()) {
        setSavedScans([]);
        setNotes({});
        return;
      }

      const fallbackScans = readSellerJournal();
      const fallbackNotes = readSellerJournalNotes();

      setSavedScans(fallbackScans);
      setNotes(fallbackNotes);

      const account = getClientAccount();
      const email = account?.email?.toLowerCase().trim();

      if (!email) return;

      try {
        const query = new URLSearchParams({
          email,
          plan: String(account?.plan || ""),
          role: String(account?.role || ""),
        });
        const response = await fetch(`/api/account/analyses?${query.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          console.warn("Seller Supabase calendar load failed:", data?.error ?? response.status);
          return;
        }

        const supabaseScans = Array.isArray(data.analyses)
          ? data.analyses.map(mapAnalysisRowToSellerScan)
          : [];

        if (!cancelled && supabaseScans.length) {
          setSavedScans(supabaseScans);
        }
      } catch (error) {
        console.warn("Seller calendar Supabase fallback used:", error);
      }
    }

    void loadSellerScans();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedDate(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedDate]);

  const scans = useMemo(() => savedScans, [savedScans]);
  const cells = useMemo(() => buildCalendar(month, scans), [month, scans]);
  const monthScans = useMemo(() => scans.filter((scan) => scan.date.startsWith(dateKey(month).slice(0, 7))), [month, scans]);
  const selectedScans = selectedDate ? scans.filter((scan) => scan.date === selectedDate) : [];
  const selectedMetrics = dayMetrics(selectedScans);
  const selectedNote = selectedDate ? notes[selectedDate] ?? "" : "";
  const firstScore = selectedScans[0]?.productScore ?? 0;
  const lastScore = selectedScans[selectedScans.length - 1]?.productScore ?? firstScore;
  const scoreDelta = lastScore - firstScore;

  function moveMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDate(null);
  }

  function updateNote(value: string) {
    if (!selectedDate) return;
    setNotes((current) => ({ ...current, [selectedDate]: value }));
    saveSellerJournalNote(selectedDate, value);
  }

  if (!sellerProJournalEnabled) {
    return (
      <section className="rounded-[2rem] border border-dashed border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <Badge tone="warn">Seller Pro feature</Badge>
        <h2 className="mt-4 text-3xl font-black text-ink dark:text-white">Daily product improvement journal</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          The saved scan calendar is reserved for Seller Pro. Seller Premium keeps product tracking, while Seller Pro adds scan history, dated notes, and improvement journaling.
        </p>
      </section>
    );
  }

  return (
    <section className="seller-calendar-shell rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="info">Seller Pro calendar</Badge>
          <h2 className="mt-4 text-3xl font-black text-ink dark:text-white">Daily product improvement journal</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Track real seller scans by date. Click any scan day to open the full product insight, buyer concern, score, and next action.
          </p>
        </div>
        <div className="seller-calendar-controls flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
            Prev
          </button>
          <div className="seller-calendar-month-label min-w-44 rounded-xl bg-ink px-5 py-3 text-center text-sm font-black text-white dark:bg-white dark:text-ink">
            {monthTitle(month)}
          </div>
          <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
            Next
          </button>
        </div>
      </div>

      <div className="seller-calendar-stats mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Scans this month</p>
          <p className="mt-2 text-3xl font-black text-ocean dark:text-cyan-300">{monthScans.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Avg score</p>
          <p className="mt-2 text-3xl font-black text-teal">{formatPercent(average(monthScans.map((scan) => scan.productScore)))}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Sentiment</p>
          <p className="mt-2 text-3xl font-black text-amber">{sentimentLabel(average(monthScans.map((scan) => scan.sentimentScore)))}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Improvement</p>
          <p className="mt-2 text-3xl font-black text-plum dark:text-purple-300">{clamp(average(monthScans.map((scan) => scan.productScore)) * 0.82)}%</p>
        </div>
      </div>

      <div className="seller-calendar-box mt-5 overflow-hidden rounded-[1.5rem] border border-line dark:border-white/10">
        <div className="seller-calendar-weekdays grid grid-cols-7 bg-ink text-white dark:bg-white dark:text-ink">
          {dayNames.map((day) => (
            <div key={day} className="px-3 py-3 text-center text-xs font-black uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>
        <div className="seller-calendar-month-grid grid grid-cols-7 bg-white dark:bg-slate-950">
          {cells.map((cell) => {
            const metrics = dayMetrics(cell.scans);
            const hasScans = cell.scans.length > 0;
            const mobileStatus = !hasScans
              ? "No scan"
              : cell.scans.length >= 5
                ? "Active"
                : metrics.score >= 70
                  ? "Up"
                  : metrics.score < 45
                    ? "Risk"
                    : "Fix";
            const mobileStatusClass = !hasScans
              ? "seller-calendar-mobile-status-empty"
              : mobileStatus === "Up"
                ? "seller-calendar-mobile-status-up"
                : mobileStatus === "Risk"
                  ? "seller-calendar-mobile-status-risk"
                  : mobileStatus === "Fix"
                    ? "seller-calendar-mobile-status-fix"
                    : "seller-calendar-mobile-status-active";
            return (
              <button
                key={cell.date}
                type="button"
                aria-label={`${cell.date}: ${mobileStatus}${hasScans ? `, ${cell.scans.length} scans` : ""}`}
                onClick={() => setSelectedDate(cell.date)}
                className={`seller-calendar-day-cell min-h-36 border-b border-r border-line p-3 text-left transition hover:bg-cyan-50 dark:border-white/10 dark:hover:bg-white/[0.04] ${
                  cell.inMonth ? "bg-white dark:bg-slate-950" : "bg-slate-50 text-slate-400 dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-black ${cell.inMonth ? "text-ink dark:text-white" : "text-slate-400"}`}>{cell.dayNumber}</span>
                  {hasScans ? <span className="seller-calendar-scan-count rounded-full bg-teal/10 px-2 py-1 text-[10px] font-black uppercase text-teal">{cell.scans.length} scan{cell.scans.length === 1 ? "" : "s"}</span> : null}
                </div>
                <div className={`seller-calendar-mobile-status ${mobileStatusClass}`}>
                  {mobileStatus}
                </div>
                {hasScans ? (
                  <div className="seller-calendar-full-details mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-slate-500 dark:text-slate-400">Score</span>
                      <span className="text-ocean dark:text-cyan-300">{formatPercent(metrics.score)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#08b7a8,#ffb238)]" style={{ width: `${metrics.progress}%` }} />
                    </div>
                    <div className="seller-calendar-chip-row flex flex-wrap gap-1">
                      <span className="seller-calendar-chip inline-flex items-center gap-1 rounded-full bg-ocean/10 px-2 py-1 text-[10px] font-black uppercase text-ocean">
                        📊 {normalScans(cell.scans).length} scan{normalScans(cell.scans).length === 1 ? "" : "s"}
                      </span>
                      <span className="seller-calendar-chip inline-flex items-center gap-1 rounded-full bg-teal/10 px-2 py-1 text-[10px] font-black uppercase text-teal">
                        ⭐ Today {compactScore(averageProductScore(cell.scans))}
                      </span>
                      <span className="seller-calendar-chip inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        📦 {productAverageRows(cell.scans).length} product{productAverageRows(cell.scans).length === 1 ? "" : "s"}
                      </span>
                      {compareScanCount(cell.scans) > 0 ? (
                        <span className="seller-calendar-chip inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                          ⚖️ {compareScanCount(cell.scans)} compare
                        </span>
                      ) : null}
                    </div>
                    
                  </div>
                ) : (
                  <p className="mt-8 text-xs font-semibold text-slate-400">No scan</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate ? (
        <div className="seller-calendar-modal-overlay fixed inset-0 z-40 grid place-items-center bg-slate-950/70 px-5 py-8 backdrop-blur-lg">
          <div className="seller-calendar-modal-panel max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-white/15 bg-white p-6 shadow-[0_40px_140px_rgba(0,0,0,0.4)] dark:bg-slate-950">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <Badge tone={selectedScans.length ? sentimentTone(selectedMetrics.sentiment) : "neutral"}>{selectedScans.length ? `${selectedScans.length} scan day` : "Open planning day"}</Badge>
                <h3 className="mt-3 text-3xl font-black text-ink dark:text-white">{selectedDate}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {selectedScans.length ? "A clean daily view of product scores, buyer concerns, and the next seller move." : "No scans are stored for this day yet. Add a note or run a seller analysis."}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedDate(null)} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-coral hover:text-coral dark:border-white/10 dark:text-white">
                Close
              </button>
            </div>

            <div className="seller-calendar-modal-stats mt-6 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500">Rating overview</p>
                <p className="mt-2 text-2xl font-black text-ocean dark:text-cyan-300">{selectedScans.length ? formatPercent(selectedMetrics.score) : "No scan yet"}</p>
              </div>
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500">Sentiment</p>
                <p className="mt-2 text-2xl font-black text-teal">{selectedScans.length ? sentimentLabel(selectedMetrics.sentiment) : "Waiting"}</p>
              </div>
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500">Main complaint</p>
                <p className="mt-2 text-sm font-black text-coral">{selectedScans.length ? selectedMetrics.complaint : "Run a scan"}</p>
              </div>
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500">Before/after</p>
                <p className={`mt-2 text-2xl font-black ${scoreDelta >= 0 ? "text-teal" : "text-coral"}`}>{selectedScans.length > 1 ? `${scoreDelta >= 0 ? "+" : ""}${scoreDelta}` : "Track"}</p>
              </div>
            </div>

            <div className="seller-calendar-modal-main-grid mt-6 grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <h4 className="text-lg font-black text-ink dark:text-white">Products reviewed today</h4>
                {productAverageRows(selectedScans).length ? (
                  <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Product score by item</p>
                    <div className="mt-3 grid gap-2">
                      {productAverageRows(selectedScans).map((product) => (
                        <div key={product.name} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-black/20">
                          <span className="font-bold text-ink dark:text-white">{sellerCalendarProductName(product.name)}</span>
                          <span className="font-black text-ocean">{formatPercent(product.average)} · {product.count} scan{product.count === 1 ? "" : "s"}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Compare results are kept separate so product improvement scores stay fair.
                    </p>
                  </div>
                ) : null}
                {selectedScans.length ? selectedScans.slice(0, 4).map((scan) => (
                  <article key={scan.id} className="rounded-2xl border border-line p-4 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-ink dark:text-white">{sellerCalendarProductName(scan.productName)}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{scan.reviewCount.toLocaleString()} reviews scanned</p>
                      </div>
                      <Badge tone={scan.productScore >= 75 ? "good" : scan.productScore >= 55 ? "warn" : "bad"}>{formatPercent(scan.productScore)}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{sellerCalendarBrief(scan.mainComplaint, 135)}</p>
                  </article>
                )) : <p className="rounded-2xl border border-line p-4 text-sm text-slate-500 dark:border-white/10">No products scanned on this date.</p>}
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-black text-ink dark:text-white">Next best seller moves</h4>
                {uniqueList(
                  selectedScans.flatMap((scan) => [
                    ...(scan.recommendations ?? []),
                    ...(scan.actionPlan ?? []),
                    scan.mainComplaint ? `Fix or explain: ${sellerCalendarBrief(scan.mainComplaint, 120)}` : ""
                  ]),
                  5
                ).length ? uniqueList(
                  selectedScans.flatMap((scan) => [
                    ...(scan.recommendations ?? []),
                    ...(scan.actionPlan ?? []),
                    scan.mainComplaint ? `Fix or explain: ${sellerCalendarBrief(scan.mainComplaint, 120)}` : ""
                  ]),
                  5
                ).map((item) => (
                  <div key={item} className="rounded-2xl border border-teal/20 bg-teal/10 p-4 text-sm font-bold text-ink dark:text-white">
                    {sellerCalendarBrief(item, 155)}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-teal/20 bg-teal/10 p-4 text-sm font-bold text-ink dark:text-white">
                    Run another seller scan to build a clearer improvement plan.
                  </div>
                )}
              </div>
            </div>

            <div className="seller-calendar-modal-signal-grid mt-6 grid gap-5 lg:grid-cols-3">
              {[
                ["Buyer hesitation points", selectedScans.flatMap((scan) => scan.topComplaints)],
                ["What buyers liked", selectedScans.flatMap((scan) => scan.topPositiveFeedback)],
                ["Action plan", selectedScans.flatMap((scan) => scan.actionPlan)]
              ].map(([title, items]) => (
                <div key={title as string} className="rounded-2xl border border-line p-4 dark:border-white/10">
                  <h4 className="font-black text-ink dark:text-white">{title as string}</h4>
                  <div className="mt-3 grid gap-2">
                    {((items as string[]).length ? (items as string[]) : ["No clear signal saved yet."]).slice(0, 3).map((item) => (
                      <p key={item} className="rounded-xl bg-mist px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">{sellerCalendarBrief(item, 115)}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="seller-calendar-modal-note mt-6 block">
              <span className="text-sm font-black text-ink dark:text-white">Progress note/comment for this day</span>
              <textarea
                value={selectedNote}
                onChange={(event) => updateNote(event.target.value)}
                className="mt-3 min-h-32 w-full resize-y rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-6 text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                placeholder="Example: Updated photos, contacted supplier about lid seal, and will compare complaint movement after tomorrow's scan."
              />
            </label>
          </div>
        </div>
      ) : null}
      <style jsx global>{`
        @media (max-width: 640px) {
          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-shell {
            padding: 0.9rem !important;
            border-radius: 1rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-shell h2 {
            margin-top: 0.65rem !important;
            font-size: 1.3rem !important;
            line-height: 1.18 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-controls {
            display: grid !important;
            grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem !important;
            width: 100% !important;
            gap: 0.45rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-controls button {
            width: 2.75rem !important;
            min-width: 2.75rem !important;
            min-height: 2.75rem !important;
            padding: 0 !important;
            overflow: hidden !important;
            font-size: 0 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-controls button:first-child::after {
            content: "‹";
            font-size: 1.35rem;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-controls button:last-child::after {
            content: "›";
            font-size: 1.35rem;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-month-label {
            min-width: 0 !important;
            min-height: 2.75rem !important;
            padding: 0.8rem 0.45rem !important;
            font-size: 0.82rem !important;
            line-height: 1.1 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.55rem !important;
            margin-top: 0.8rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-stats > div {
            min-height: 5.2rem !important;
            padding: 0.75rem !important;
            border-radius: 0.85rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .reviewintel-route-dashboard-seller
            .seller-calendar-stats > div > p:last-child {
            margin-top: 0.35rem !important;
            font-size: 1.35rem !important;
            line-height: 1.05 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-box {
            margin-top: 0.8rem !important;
            border-radius: 0.85rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-weekdays {
            height: auto !important;
            min-height: 2rem !important;
            max-height: none !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-weekdays > div {
            height: 2rem !important;
            min-height: 2rem !important;
            max-height: none !important;
            padding: 0.5rem 0 !important;
            font-size: 0.62rem !important;
            line-height: 1 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-month-grid {
            grid-auto-rows: 3.35rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-day-cell {
            min-height: 3.35rem !important;
            height: 3.35rem !important;
            max-height: 3.35rem !important;
            padding: 0.35rem 0.2rem !important;
            border-radius: 0 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-day-cell > div:first-child {
            display: flex !important;
            height: 1rem !important;
            max-height: 1rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-day-cell > div:first-child span:first-child {
            display: inline !important;
            font-size: 0.7rem !important;
            line-height: 1 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-day-cell > .seller-calendar-mobile-status {
            display: inline-flex !important;
            margin-top: 0.35rem !important;
            padding: 0.2rem 0.3rem !important;
            font-size: 0.55rem !important;
            line-height: 1 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-day-cell .seller-calendar-scan-count,
          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-day-cell .seller-calendar-full-details {
            display: none !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-overlay {
            align-items: end !important;
            justify-items: stretch !important;
            padding: 0 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-panel {
            width: 100% !important;
            max-width: none !important;
            max-height: 88dvh !important;
            padding: 1rem !important;
            border-radius: 1.25rem 1.25rem 0 0 !important;
            box-shadow: 0 -18px 60px rgba(15, 23, 42, 0.28) !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-panel :is(p, span, div, li) {
            font-size: 0.78rem !important;
            line-height: 1.45 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-panel h3 {
            margin-top: 0.45rem !important;
            font-size: 1.45rem !important;
            line-height: 1.15 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-panel button {
            min-height: 2.75rem !important;
            padding: 0.7rem 1rem !important;
            font-size: 0.8rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.55rem !important;
            margin-top: 0.8rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-stats > div {
            min-height: 5.5rem !important;
            padding: 0.75rem !important;
            border-radius: 0.85rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            :is(.seller-calendar-modal-main-grid, .seller-calendar-modal-signal-grid) {
            grid-template-columns: 1fr !important;
            gap: 0.65rem !important;
            margin-top: 0.85rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            :is(.seller-calendar-modal-main-grid, .seller-calendar-modal-signal-grid) > * {
            min-width: 0 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-main-grid h4 {
            font-size: 1rem !important;
            line-height: 1.2 !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-main-grid :is(article, div[class*="rounded-2xl"], p[class*="rounded"]),
          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-signal-grid > div {
            max-height: none !important;
            padding: 0.75rem !important;
            border-radius: 0.85rem !important;
            overflow: visible !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-main-grid article,
          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-main-grid div[class*="bg-teal"] {
            font-size: 0.82rem !important;
            line-height: 1.38 !important;
            overflow-wrap: anywhere !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-main-grid div[class*="rounded-xl"][class*="bg-white"] {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 0.2rem !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-signal-grid p {
            display: block !important;
            max-height: none !important;
            font-size: 0.78rem !important;
            line-height: 1.38 !important;
            overflow-wrap: anywhere !important;
          }

          html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
            .seller-calendar-modal-note textarea {
            min-height: 6rem !important;
            max-height: 10rem !important;
            padding: 0.8rem !important;
            font-size: 0.82rem !important;
            line-height: 1.45 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-shell {
            padding: 0.9rem !important;
            border-radius: 1rem !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-shell h2 {
            margin-top: 0.65rem !important;
            font-size: 1.3rem !important;
            line-height: 1.18 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-controls {
            display: grid !important;
            grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem !important;
            width: 100% !important;
            gap: 0.45rem !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-controls button {
            width: 2.75rem !important;
            min-width: 2.75rem !important;
            min-height: 2.75rem !important;
            padding: 0 !important;
            overflow: hidden !important;
            font-size: 0 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-controls button:first-child::after {
            content: "‹";
            font-size: 1.35rem;
          }

          html[data-layout-mode="mobile"] .seller-calendar-controls button:last-child::after {
            content: "›";
            font-size: 1.35rem;
          }

          html[data-layout-mode="mobile"] .seller-calendar-month-label {
            min-width: 0 !important;
            min-height: 2.75rem !important;
            padding: 0.8rem 0.45rem !important;
            font-size: 0.82rem !important;
            line-height: 1.1 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.55rem !important;
            margin-top: 0.8rem !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-stats > div {
            min-height: 5.2rem !important;
            padding: 0.75rem !important;
            border-radius: 0.85rem !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-stats > div > p:last-child {
            margin-top: 0.35rem !important;
            font-size: 1.35rem !important;
            line-height: 1.05 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-box {
            margin-top: 0.8rem !important;
            border-radius: 0.85rem !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-weekdays > div {
            height: 2rem !important;
            min-height: 2rem !important;
            padding: 0.5rem 0 !important;
            font-size: 0.62rem !important;
            line-height: 1 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-month-grid {
            grid-auto-rows: 3.35rem !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-day-cell {
            min-height: 3.35rem !important;
            height: 3.35rem !important;
            max-height: 3.35rem !important;
            padding: 0.35rem 0.2rem !important;
            border-radius: 0 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-day-cell .seller-calendar-scan-count,
          html[data-layout-mode="mobile"] .seller-calendar-day-cell .seller-calendar-full-details {
            display: none !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-modal-overlay {
            align-items: end !important;
            justify-items: stretch !important;
            padding: 0 !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-modal-panel {
            width: 100% !important;
            max-width: none !important;
            max-height: 88dvh !important;
            padding: 1rem !important;
            border-radius: 1.25rem 1.25rem 0 0 !important;
            box-shadow: 0 -18px 60px rgba(15, 23, 42, 0.28) !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-modal-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.55rem !important;
            margin-top: 0.8rem !important;
          }

          html[data-layout-mode="mobile"] :is(.seller-calendar-modal-main-grid, .seller-calendar-modal-signal-grid) {
            grid-template-columns: 1fr !important;
            gap: 0.65rem !important;
            margin-top: 0.85rem !important;
          }

          html[data-layout-mode="mobile"] .seller-calendar-modal-main-grid > *,
          html[data-layout-mode="mobile"] .seller-calendar-modal-signal-grid > * {
            min-width: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}

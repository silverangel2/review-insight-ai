"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { formatPercent } from "@/lib/analysisScoring";
import {
  canUseSellerProJournal,
  readSellerJournal,
  readSellerJournalNotes,
  saveSellerJournalNote,
  type SellerJournalScan
} from "@/lib/sellerJournal";

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
  const complaint = scans[0]?.mainComplaint ?? "No scan";
  return { score, sentiment, progress, complaint };
}

export function SellerImprovementCalendar() {
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [savedScans, setSavedScans] = useState<SellerJournalScan[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const sellerProJournalEnabled = canUseSellerProJournal();

  useEffect(() => {
    if (!canUseSellerProJournal()) {
      setSavedScans([]);
      setNotes({});
      return;
    }

    setSavedScans(readSellerJournal());
    setNotes(readSellerJournalNotes());
  }, []);

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
          The saved scan calendar is reserved for Seller Pro. Seller Starter keeps product tracking, while Seller Pro adds scan history, dated notes, and improvement journaling.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="info">Seller Pro calendar</Badge>
          <h2 className="mt-4 text-3xl font-black text-ink dark:text-white">Daily product improvement journal</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Track every scan by date, spot complaint movement, and turn review intelligence into a daily seller action plan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => moveMonth(-1)} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
            Prev
          </button>
          <div className="min-w-44 rounded-xl bg-ink px-5 py-3 text-center text-sm font-black text-white dark:bg-white dark:text-ink">
            {monthTitle(month)}
          </div>
          <button type="button" onClick={() => moveMonth(1)} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
            Next
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Monthly scans</p>
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

      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-line dark:border-white/10">
        <div className="grid grid-cols-7 bg-ink text-white dark:bg-white dark:text-ink">
          {dayNames.map((day) => (
            <div key={day} className="px-3 py-3 text-center text-xs font-black uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-white dark:bg-slate-950">
          {cells.map((cell) => {
            const metrics = dayMetrics(cell.scans);
            const hasScans = cell.scans.length > 0;
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelectedDate(cell.date)}
                className={`min-h-36 border-b border-r border-line p-3 text-left transition hover:bg-cyan-50 dark:border-white/10 dark:hover:bg-white/[0.04] ${
                  cell.inMonth ? "bg-white dark:bg-slate-950" : "bg-slate-50 text-slate-400 dark:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-black ${cell.inMonth ? "text-ink dark:text-white" : "text-slate-400"}`}>{cell.dayNumber}</span>
                  {hasScans ? <span className="rounded-full bg-teal/10 px-2 py-1 text-[10px] font-black uppercase text-teal">{cell.scans.length} scan{cell.scans.length === 1 ? "" : "s"}</span> : null}
                </div>
                {hasScans ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-slate-500 dark:text-slate-400">Score</span>
                      <span className="text-ocean dark:text-cyan-300">{formatPercent(metrics.score)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#08b7a8,#ffb238)]" style={{ width: `${metrics.progress}%` }} />
                    </div>
                    <span className="line-clamp-1 inline-flex max-w-full rounded-full bg-coral/10 px-2 py-1 text-[10px] font-black uppercase text-coral">{metrics.complaint}</span>
                    <p className="line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{cell.scans[0].summary}</p>
                  </div>
                ) : (
                  <p className="mt-8 text-xs font-semibold text-slate-400">No scan stored</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/70 px-5 py-8 backdrop-blur-lg">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-white/15 bg-white p-6 shadow-[0_40px_140px_rgba(0,0,0,0.4)] dark:bg-slate-950">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <Badge tone={selectedScans.length ? sentimentTone(selectedMetrics.sentiment) : "neutral"}>{selectedScans.length ? `${selectedScans.length} scan day` : "Open planning day"}</Badge>
                <h3 className="mt-3 text-3xl font-black text-ink dark:text-white">{selectedDate}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {selectedScans.length ? "Full daily scan detail, action planning, and progress notes." : "No scans are stored for this day yet. Add a note or run Seller analysis."}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedDate(null)} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-coral hover:text-coral dark:border-white/10 dark:text-white">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500">Rating overview</p>
                <p className="mt-2 text-2xl font-black text-ocean dark:text-cyan-300">{selectedScans.length ? formatPercent(selectedMetrics.score) : "No scan"}</p>
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

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <h4 className="text-lg font-black text-ink dark:text-white">Products scanned</h4>
                {selectedScans.length ? selectedScans.map((scan) => (
                  <article key={scan.id} className="rounded-2xl border border-line p-4 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-ink dark:text-white">{scan.productName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{scan.reviewCount.toLocaleString()} reviews analyzed</p>
                      </div>
                      <Badge tone={scan.productScore >= 75 ? "good" : scan.productScore >= 55 ? "warn" : "bad"}>{formatPercent(scan.productScore)}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{scan.summary}</p>
                  </article>
                )) : <p className="rounded-2xl border border-line p-4 text-sm text-slate-500 dark:border-white/10">No products scanned on this date.</p>}
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-black text-ink dark:text-white">What to improve today</h4>
                {(selectedScans[0]?.recommendations ?? ["Run a Seller Pro scan, then write the next product improvement action here."]).slice(0, 4).map((item) => (
                  <div key={item} className="rounded-2xl border border-teal/20 bg-teal/10 p-4 text-sm font-bold text-ink dark:text-white">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {[
                ["Top complaints", selectedScans.flatMap((scan) => scan.topComplaints)],
                ["Top positive feedback", selectedScans.flatMap((scan) => scan.topPositiveFeedback)],
                ["Suggested action plan", selectedScans.flatMap((scan) => scan.actionPlan)]
              ].map(([title, items]) => (
                <div key={title as string} className="rounded-2xl border border-line p-4 dark:border-white/10">
                  <h4 className="font-black text-ink dark:text-white">{title as string}</h4>
                  <div className="mt-3 grid gap-2">
                    {((items as string[]).length ? (items as string[]) : ["No detail stored yet."]).slice(0, 5).map((item) => (
                      <p key={item} className="rounded-xl bg-mist px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">{item}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="mt-6 block">
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
    </section>
  );
}

// Admin analytics summarised from EXISTING data only (analyses + site_traffic_events). No estimates.
type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type AdminAnalytics = {
  scans: number; buyerScans: number; sellerScans: number;
  verdictMix: Array<{ verdict: string; count: number }>;
  affiliateClicks: number; affiliateImpressions: number;
  clicksByKind: Array<{ kind: string; count: number }>;
  topProducts: Array<{ title: string; scans: number }>;
  days: number;
};

function verdictLabel(result: Rec): string {
  const v = s(result.verdict || result.customerVerdict).toUpperCase();
  if (/NOT ENOUGH/.test(v) || !v) return "Not enough reviews";
  if (v === "BUY") return "Buy";
  if (/DO NOT BUY YET|WAIT/.test(v)) return "Wait";
  if (/AVOID|SKIP/.test(v)) return "Skip";
  return "Other";
}

const tally = (items: string[]) => [...items.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map<string, number>())].map(([k, count]) => ({ k, count })).sort((a, b) => b.count - a.count);

export function summarizeAdminAnalytics(analyses: Rec[], traffic: Rec[], days = 30): AdminAnalytics {
  const verdicts: string[] = []; const titles: string[] = [];
  let buyer = 0, seller = 0;
  for (const row of analyses) {
    const json = obj(row.analysis_json);
    const result = obj(json.result && typeof json.result === "object" ? json.result : json);
    if (s(row.mode) === "seller") seller += 1; else buyer += 1;
    verdicts.push(verdictLabel(result));
    const title = s(obj(result.product).title) || s(obj(result.product).name) || s(row.product_name);
    if (title) titles.push(title.slice(0, 120));
  }
  const clicks = traffic.filter(t => s(t.event_type) === "affiliate_click");
  return {
    days, scans: analyses.length, buyerScans: buyer, sellerScans: seller,
    verdictMix: tally(verdicts).map(({ k, count }) => ({ verdict: k, count })),
    affiliateClicks: clicks.length,
    affiliateImpressions: traffic.filter(t => s(t.event_type) === "affiliate_impression").length,
    clicksByKind: tally(clicks.map(t => { const m = obj(t.metadata); return `${s(m.source) || "unknown"}${s(m.kind) ? ` · ${s(m.kind)}` : ""}`; })).map(({ k, count }) => ({ kind: k, count })),
    topProducts: tally(titles).slice(0, 10).map(({ k, count }) => ({ title: k, scans: count })),
  };
}

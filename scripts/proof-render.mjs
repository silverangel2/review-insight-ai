// Proof renderer: 4 corpora through the REAL pipeline — parse, bucket themes,
// score (buyingScoreFromReviews), analyze (deriveReviewAnalysis), render HTML
// pages + verbatim text blocks. No invented facts: every number comes from a
// tool result below.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const require = createRequire("/home/hatch/workspace/ri-findings/tests/x.js");
const ROOT = "/home/hatch/workspace/ri-findings/";
const jiti = require("jiti")(ROOT + "x.js", { alias: { "@": ROOT } });

const { parseInboxMarkdown, bucketThemes } = await import("./proof-corpus.mjs");
const { deriveReviewAnalysis } = jiti(ROOT + "lib/reviewAnalysis.ts");
const { buyingScoreFromReviews } = jiti(ROOT + "lib/buyingScore.ts");

const clean = (s) =>
  String(s ?? "").replace(/\r/g, "").replace(/\s+/g, " ").trim();

function parseSteam() {
  const d = JSON.parse(readFileSync(ROOT + "proof-corpus/steam-stardew.json", "utf8"));
  const qs = d.query_summary || {};
  const reviews = (d.reviews || [])
    .map((r) => ({
      id: `steam-${r.recommendationid}`,
      stars: r.voted_up ? 5 : 2,
      body: clean(r.review).slice(0, 2500),
      url: "https://store.steampowered.com/app/413150/",
    }))
    .filter((r) => r.body.length >= 40);
  return {
    reviews,
    meta: {
      slug: "stardew-valley",
      title: "Stardew Valley",
      store: "Steam",
      rating: (qs.total_positive / qs.total_reviews) * 5,
      count: qs.total_reviews,
      pulled: "Steam Store public reviews API (store.steampowered.com/appreviews/413150?json=1), 100 most recent English reviews, pulled 2026-10-17 ~01:35 ADT via VM curl",
    },
  };
}

function parseDuolingo() {
  const reviews = [];
  for (const p of [1, 2]) {
    const d = JSON.parse(readFileSync(ROOT + `proof-corpus/duolingo-p${p}.json`, "utf8"));
    for (const e of d.feed.entry || []) {
      if (!e["im:rating"]) continue; // entry[0] is app metadata
      const body = clean(`${e.title?.label || ""}. ${e.content?.label || ""}`);
      if (body.length < 40) continue;
      reviews.push({
        id: `duo-${e.id?.label || reviews.length}`,
        stars: parseInt(e["im:rating"].label, 10),
        body: body.slice(0, 2500),
        url: "https://apps.apple.com/app/id570060128",
      });
    }
  }
  const lookup = JSON.parse(
    require("node:child_process")
      .execSync(`curl -s --compressed -A "Mozilla/5.0" "https://itunes.apple.com/lookup?id=570060128"`, { encoding: "utf8" })
  ).results[0];
  return {
    reviews,
    meta: {
      slug: "duolingo",
      title: "Duolingo: Learn Languages",
      store: "App Store",
      rating: lookup.averageUserRating,
      count: lookup.userRatingCount,
      pulled: "Apple App Store public RSS review feeds (itunes.apple.com/rss/customerreviews, pages 1-2, 100 most recent), aggregate rating/count from iTunes lookup API, pulled 2026-10-17 ~01:35 ADT via VM curl",
    },
  };
}

function parseInbox(file, slug, title, store, rating, count, pulled) {
  const md = readFileSync(file, "utf8");
  const reviews = parseInboxMarkdown(md, slug)
    .map((r, i) => ({ id: `${slug}-${i + 1}`, stars: r.stars, body: clean(r.body).slice(0, 2500), url: null }))
    .filter((r) => r.body.length >= 40);
  return { reviews, meta: { slug, title, store, rating, count, pulled } };
}

function parseFreshMd(file, slug, title, store, rating, count, pulled) {
  const md = readFileSync(file, "utf8");
  const reviews = [];
  const chunks = md.split(/^## \d+\. /m).slice(1);
  for (const chunk of chunks) {
    const nl = chunk.indexOf("\n");
    const header = chunk.slice(0, nl);
    const starMatch = header.match(/(\d)\s+out of 5 stars/i);
    const body = chunk.slice(nl + 1).trim();
    if (body.length < 40) continue;
    reviews.push({
      id: `${slug}-${reviews.length + 1}`,
      stars: starMatch ? parseInt(starMatch[1], 10) : null,
      body: clean(body).slice(0, 2500),
      url: null,
    });
  }
  return { reviews, meta: { slug, title, store, rating, count, pulled } };
}

const corpora = [
  parseInbox(
    "/home/hatch/workspace/review-library-inbox/2026-10-15-1412-amazon.ca-apple-airpods-4.md",
    "airpods4", "Apple AirPods 4 Wireless Earbuds", "amazon.ca", 4.4, 2341,
    "Owner-fed library paste (Junel, 2026-10-15): 80 verified-purchase amazon.ca reviews, aggregate 4.4/2,341 from the paste header"
  ),
  parseInbox(
    "/home/hatch/workspace/review-library-inbox/2026-10-15-1418-amazon.ca-dreo-space-heater-1500w.md",
    "dreo1500w", "DREO Space Heater 1500W", "amazon.ca", 4.5, 28820,
    "Owner-fed library paste (Junel, 2026-10-15): 50 verified-purchase amazon.ca reviews, aggregate 4.5/28,820 from the paste header"
  ),
  parseFreshMd(
    ROOT + "proof-corpus/fresh-fullstar.md",
    "fullstar", "Fullstar Vegetable Chopper (PRO 4-in-1)", "amazon", 4.4, 118335,
    "Fresh pull 2026-10-17 by Dylan: 35 verbatim Amazon buyer-review excerpts (amazon.ca/.com/.co.uk/.au) quoted in public search-result snippets; amazon review pages are bot-walled for this VM's curl (verified), so excerpts were harvested from the public search index. Aggregate 4.4/118,335 from amazon.ca listing."
  ),
  parseFreshMd(
    ROOT + "proof-corpus/fresh-cerave.md",
    "cerave", "CeraVe Moisturizing Cream, Face & Body, 19 oz", "amazon", 4.7, 137653,
    "Fresh pull 2026-10-17 by Dylan: 30 verbatim buyer-review excerpts (amazon.com, desertcart.tn quoting Amazon, target.com, cvs.com — same product); harvested from the public search index because Amazon review pages are bot-walled for this VM's curl (verified). Aggregate 4.7/137,653 from amazon.com listing."
  ),
];

// ---- pipeline per corpus ----
function buildFixture(corpus) {
  const { reviews, meta } = corpus;
  const buckets = bucketThemes(reviews, meta.title);
  const toClaim = (b) => ({
    claim: b.themeLabel,
    supportCount: b.supportCount,
    sourceIds: reviews.filter((r) => b.texts.some((t) => r.body.includes(t))).map((r) => r.id),
    sourceHashes: [],
  });
  const strengths = buckets.filter((b) => b.side === "for").map(toClaim);
  const complaints = buckets.filter((b) => b.side === "against").map(toClaim);

  const scored = buyingScoreFromReviews({
    marketplace: { rating: meta.rating, count: meta.count, matchesExactModel: true },
    reviews: reviews.map((r) => ({ body: r.body, rating: r.stars, source: meta.store })),
    primaryStore: meta.store,
  });

  const fixture = {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: reviews.map((r) => ({ id: r.id, body: r.body, sourceUrl: r.url })),
      },
      commentsAnalyzed: reviews.length,
      listingEvidence: { rating: meta.rating, reviewCount: meta.count },
    },
    product: { title: meta.title, store: meta.store },
    strengths,
    complaints,
    verdict: scored.verdict,
  };
  const analysis = deriveReviewAnalysis(fixture);
  return { fixture, analysis, scored, buckets };
}

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function verdictPill(v) {
  const c = v === "BUY" ? "#059669" : v === "WAIT" ? "#d97706" : "#e11d48";
  const bg = v === "BUY" ? "#d1fae5" : v === "WAIT" ? "#fef3c7" : "#ffe4e6";
  return `<span style="display:inline-block;background:${bg};color:${c};font-weight:800;letter-spacing:.08em;font-size:13px;padding:6px 16px;border-radius:999px;">${v}</span>`;
}

function renderPage(corpus, built) {
  const { meta } = corpus;
  const { analysis, scored } = built;
  const score = Math.round(scored.score);
  const forF = analysis.forFactors || [];
  const agF = analysis.againstFactors || [];
  const factorHtml = (f) => `
    <div style="margin:0 0 18px;">
      <div style="font-weight:700;font-size:15px;color:#1e1b4b;margin-bottom:6px;">${esc(f.title)}</div>
      <div style="font-size:15px;line-height:1.55;color:#312e81;">${esc(f.summary)}</div>
      <div style="font-size:12px;color:#818cf8;margin-top:4px;">${esc(f.basis || "")}</div>
    </div>`;
  const checked = [
    `Evidence: ${corpus.reviews.length} written reviews read; aggregate ${meta.rating.toFixed(2)} / 5 from ${meta.count.toLocaleString("en-US")} ${meta.store} ratings.`,
    `Method: deterministic — reviews grouped by theme, for/against segregated, findings written by RI's own engine from review-supported specifics. No AI, no pasted buyer quotes.`,
    `Pulled: ${esc(meta.pulled)}`,
  ];
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ReviewIntel proof — ${esc(meta.title)}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,'Segoe UI',sans-serif;color:#1e1b4b;
background:
 radial-gradient(900px 480px at 12% -4%, rgba(99,102,241,.20), transparent 60%),
 radial-gradient(760px 420px at 88% 6%, rgba(168,85,247,.16), transparent 60%),
 radial-gradient(700px 500px at 50% 110%, rgba(79,70,229,.10), transparent 60%),
 #f6f7fb;">
<div style="max-width:1060px;margin:0 auto;padding:40px 20px 80px;">
  <div style="font-size:12px;letter-spacing:.14em;color:#6366f1;font-weight:700;margin-bottom:10px;">REVIEWINTEL · LOCAL PROOF RENDER</div>
  <h1 style="font-size:30px;margin:0 0 6px;letter-spacing:-.01em;">${esc(meta.title)}</h1>
  <div style="color:#6d6a9e;font-size:14px;margin-bottom:26px;">${esc(meta.store)} · proof render ${esc(new Date().toISOString().slice(0, 10))}</div>

  <div style="background:rgba(255,255,255,.82);backdrop-filter:blur(8px);border-radius:20px;padding:30px 32px;
    box-shadow:0 18px 50px -18px rgba(79,70,229,.35);border-top:4px solid;border-image:linear-gradient(90deg,#6366f1,#a855f7) 1;margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">
      <div style="font-size:64px;font-weight:800;background:linear-gradient(135deg,#4f46e5,#9333ea);-webkit-background-clip:text;background-clip:text;color:transparent;">${score}</div>
      <div>
        <div style="margin-bottom:8px;">${verdictPill(String(scored.verdict || "").toUpperCase())}</div>
        <div style="font-size:14px;color:#6d6a9e;">Buying score · ${esc(String(scored.confidence || ""))} confidence · from ${corpus.reviews.length} reviews read</div>
      </div>
    </div>
    <div style="margin-top:16px;font-size:15px;line-height:1.6;color:#312e81;">${esc(analysis.bottomLine || analysis.answerLine || "")}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;">
    <div style="background:rgba(255,255,255,.78);border-radius:18px;padding:26px 28px;box-shadow:0 12px 34px -16px rgba(5,150,105,.30);">
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;color:#059669;margin-bottom:16px;">WHY YOU'D BUY IT</div>
      ${forF.length ? forF.map(factorHtml).join("") : '<div style="color:#6d6a9e;font-size:14px;">No qualifying findings.</div>'}
    </div>
    <div style="background:rgba(255,255,255,.78);border-radius:18px;padding:26px 28px;box-shadow:0 12px 34px -16px rgba(225,29,72,.28);">
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;color:#e11d48;margin-bottom:16px;">WHY YOU MIGHT NOT</div>
      ${agF.length ? agF.map(factorHtml).join("") : '<div style="color:#6d6a9e;font-size:14px;">No qualifying findings.</div>'}
    </div>
  </div>

  <details style="margin-top:26px;background:rgba(255,255,255,.7);border-radius:16px;padding:20px 24px;">
    <summary style="cursor:pointer;font-weight:700;font-size:14px;color:#4f46e5;">How we checked</summary>
    <ul style="font-size:13.5px;color:#55528a;line-height:1.65;padding-left:20px;">
      ${checked.map((c) => `<li style="margin:6px 0;">${c}</li>`).join("")}
    </ul>
  </details>
  <div style="margin-top:22px;font-size:12px;color:#9a97c7;">Static proof render of real pipeline output (buyingScoreFromReviews + deriveReviewAnalysis). No live Next.js server involved.</div>
</div></body></html>`;
}

function verbatimBlock(corpus, built) {
  const { meta } = corpus;
  const { analysis, scored } = built;
  const L = [];
  L.push(`PRODUCT: ${meta.title} (${meta.store})`);
  L.push(`SCORE: ${Math.round(scored.score)} / 100 · VERDICT: ${String(scored.verdict).toUpperCase()} · REVIEWS READ: ${corpus.reviews.length}`);
  L.push("");
  L.push("WHY YOU'D BUY IT");
  for (const f of analysis.forFactors || []) L.push(`• ${f.title} — ${f.summary}`);
  L.push("");
  L.push("WHY YOU MIGHT NOT");
  for (const f of analysis.againstFactors || []) L.push(`• ${f.title} — ${f.summary}`);
  L.push("");
  if (analysis.bottomLine) { L.push(`BOTTOM LINE: ${analysis.bottomLine}`); L.push(""); }
  return L.join("\n");
}

mkdirSync(ROOT + "proof", { recursive: true });
for (const corpus of corpora) {
  const built = buildFixture(corpus);
  const html = renderPage(corpus, built);
  const txt = verbatimBlock(corpus, built);
  writeFileSync(`${ROOT}proof/${corpus.meta.slug}.html`, html);
  writeFileSync(`${ROOT}proof/${corpus.meta.slug}.txt`, txt);
  console.log("=".repeat(72));
  console.log(txt);
  console.log(`[wrote proof/${corpus.meta.slug}.html + .txt]`);
}

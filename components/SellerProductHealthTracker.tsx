"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { formatPercent } from "@/lib/analysisScoring";
import { planLabel } from "@/lib/account";
import { getClientAccount } from "@/lib/clientAccount";
import { REVIEW_PLATFORMS, platformLabel } from "@/lib/platforms";
import {
  activeSellerProductId,
  createSellerProduct,
  deleteSellerProduct,
  productLimitForPlan,
  readSellerProducts,
  saveActiveSellerProductId,
  updateSellerProduct,
  type SellerProduct,
  type SellerProductScan,
  type SellerProductScanTone
} from "@/lib/sellerProducts";
import type { ReviewPlatform, SubscriptionPlan } from "@/lib/types";

const toneClasses: Record<SellerProductScanTone, string> = {
  positive: "border-teal/25 bg-teal/10 text-teal",
  mixed: "border-amber/25 bg-amber/10 text-amber",
  negative: "border-coral/25 bg-coral/10 text-coral",
  improvement: "border-ocean/25 bg-ocean/10 text-ocean dark:text-cyan-300"
};

const toneLabels: Record<SellerProductScanTone, string> = {
  positive: "Positive scan",
  mixed: "Mixed scan",
  negative: "Negative scan",
  improvement: "Improvement detected"
};

type ProductForm = {
  name: string;
  imageUrl: string;
  platform: ReviewPlatform;
  productUrl: string;
  category: string;
  notes: string;
};

const emptyForm: ProductForm = {
  name: "",
  imageUrl: "",
  platform: "amazon",
  productUrl: "",
  category: "",
  notes: ""
};

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function latestScan(product: SellerProduct) {
  return product.scans[0] ?? null;
}

function trendValue(scans: SellerProductScan[], key: keyof Pick<SellerProductScan, "productHealthScore" | "customerSatisfactionScore" | "complaintSeverityScore">) {
  if (scans.length < 2) return 0;
  return scans[0][key] - scans[Math.min(scans.length - 1, 5)][key];
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 5);
}

function scanToneBadge(tone: SellerProductScanTone) {
  return `rounded-full border px-3 py-1 text-[10px] font-black uppercase ${toneClasses[tone]}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthDays(scans: SellerProductScan[]) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = monthKey(now);
  const grouped = scans.reduce<Record<string, SellerProductScan[]>>((acc, scan) => {
    if (scan.date.startsWith(monthPrefix)) acc[scan.date] = [...(acc[scan.date] ?? []), scan];
    return acc;
  }, {});

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${monthPrefix}-${String(index + 1).padStart(2, "0")}`;
    return { date, day: index + 1, scans: grouped[date] ?? [] };
  });
}

export function SellerProductHealthTracker() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [plan, setPlan] = useState<SubscriptionPlan>("free_buyer");
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const account = getClientAccount();
    const nextProducts = readSellerProducts();
    const savedId = activeSellerProductId();
    setPlan(account?.plan ?? "free_buyer");
    setProducts(nextProducts);
    setSelectedId(savedId && nextProducts.some((product) => product.id === savedId) ? savedId : nextProducts[0]?.id ?? "");
  }, []);

  const limit = productLimitForPlan(plan);
  const selectedProduct = products.find((product) => product.id === selectedId) ?? products[0] ?? null;
  const selectedScan = selectedProduct ? latestScan(selectedProduct) : null;
  const productHealth = selectedScan?.productHealthScore ?? average(selectedProduct?.scans.map((scan) => scan.productHealthScore) ?? []);
  const satisfaction = selectedScan?.customerSatisfactionScore ?? average(selectedProduct?.scans.map((scan) => scan.customerSatisfactionScore) ?? []);
  const complaintSeverity = selectedScan?.complaintSeverityScore ?? average(selectedProduct?.scans.map((scan) => scan.complaintSeverityScore) ?? []);
  const positiveTrend = selectedProduct ? trendValue(selectedProduct.scans, "customerSatisfactionScore") : 0;
  const negativeTrend = selectedProduct ? trendValue(selectedProduct.scans, "complaintSeverityScore") : 0;
  const monthDays = useMemo(() => buildMonthDays(selectedProduct?.scans ?? []), [selectedProduct]);
  const topStrengths = uniqueItems(selectedProduct?.scans.flatMap((scan) => scan.strengths) ?? []);
  const topComplaints = uniqueItems(selectedProduct?.scans.flatMap((scan) => scan.complaints) ?? []);
  const actionPlan = uniqueItems(selectedProduct?.scans.flatMap((scan) => scan.actionPlan) ?? []);

  function refresh(nextSelectedId = selectedId) {
    const nextProducts = readSellerProducts();
    setProducts(nextProducts);
    const safeId = nextSelectedId && nextProducts.some((product) => product.id === nextSelectedId) ? nextSelectedId : nextProducts[0]?.id ?? "";
    setSelectedId(safeId);
    saveActiveSellerProductId(safeId);
  }

  function createProduct() {
    setMessage("");
    try {
      const product = createSellerProduct(form, plan);
      setForm(emptyForm);
      setMessage(`${product.name} was added to the Product Health Tracker.`);
      refresh(product.id);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not add product.");
    }
  }

  function selectProduct(productId: string) {
    setSelectedId(productId);
    saveActiveSellerProductId(productId);
  }

  function removeProduct(productId: string) {
    const product = products.find((item) => item.id === productId);
    deleteSellerProduct(productId);
    setMessage(product ? `${product.name} was removed from the tracker.` : "Product removed.");
    refresh("");
  }

  function updateNotes(value: string) {
    if (!selectedProduct) return;
    updateSellerProduct(selectedProduct.id, { notes: value });
    refresh(selectedProduct.id);
  }

  return (
    <section className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="good">Seller Pro Product Health Tracker</Badge>
          <h2 className="mt-4 text-3xl font-black text-ink dark:text-white">Products, scans, and progress in one command view.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Save every seller scan under a product so health, complaints, positive trends, and improvement work are tracked over time instead of disappearing after one analysis.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 text-sm font-black text-ink dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
          {planLabel(plan)}: {products.length}/{limit || 0} products
        </div>
      </div>

      {message ? <p className="mt-5 rounded-2xl border border-ocean/20 bg-ocean/10 px-4 py-3 text-sm font-bold text-ocean dark:text-cyan-300">{message}</p> : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.4fr]">
        <div className="space-y-5">
          <article className="rounded-3xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <h3 className="text-lg font-black text-ink dark:text-white">Add product</h3>
            <div className="mt-4 grid gap-3">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Product name"
                className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={form.platform}
                  onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as ReviewPlatform }))}
                  className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  {REVIEW_PLATFORMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="Category"
                  className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <input
                value={form.productUrl}
                onChange={(event) => setForm((current) => ({ ...current, productUrl: event.target.value }))}
                placeholder="Product URL"
                className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <input
                value={form.imageUrl}
                onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="Product image URL"
                className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Internal product notes"
                className="min-h-24 resize-y rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={createProduct}
                disabled={!form.name.trim() || limit <= 0 || products.length >= limit}
                className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-ink"
              >
                Add Product
              </button>
            </div>
          </article>

          <article className="rounded-3xl border border-line bg-white p-5 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <h3 className="text-lg font-black text-ink dark:text-white">Products</h3>
            <div className="mt-4 grid gap-3">
              {products.length ? products.map((product) => {
                const scan = latestScan(product);
                const active = selectedProduct?.id === product.id;
                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => selectProduct(product.id)}
                    className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                      active ? "border-ocean bg-ocean/10 shadow-glow" : "border-line bg-mist dark:border-white/10 dark:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink text-xs font-black text-white">
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : product.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-ink dark:text-white">{product.name}</p>
                        <p className="mt-1 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{platformLabel(product.platform)} · {product.scans.length} scans</p>
                        <p className="mt-2 text-sm font-black text-ocean dark:text-cyan-300">{scan ? formatPercent(scan.productHealthScore) : "No scan yet"}</p>
                      </div>
                    </div>
                  </button>
                );
              }) : <p className="rounded-2xl border border-line bg-mist p-4 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">No products yet. Add your first product, then attach the next Seller analysis to it.</p>}
            </div>
          </article>
        </div>

        <div className="space-y-5">
          {selectedProduct ? (
            <>
              <article className="overflow-hidden rounded-3xl border border-line bg-[linear-gradient(135deg,#172033,#2356a3_52%,#08b7a8)] p-6 text-white shadow-glow dark:border-white/10">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <p className="text-xs font-black uppercase text-cyan-100">{platformLabel(selectedProduct.platform)} product</p>
                    <h3 className="mt-2 text-4xl font-black">{selectedProduct.name}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">{selectedScan?.aiSummary ?? "Run a Seller analysis and attach it to this product to start the health timeline."}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(selectedProduct.id)}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black uppercase text-white transition hover:bg-coral/25"
                  >
                    Remove product
                  </button>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-xs font-black uppercase text-cyan-100">Product Health Score</p>
                    <p className="mt-2 text-4xl font-black">{formatPercent(productHealth)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-xs font-black uppercase text-cyan-100">Customer Satisfaction</p>
                    <p className="mt-2 text-4xl font-black">{formatPercent(satisfaction)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-xs font-black uppercase text-cyan-100">Complaint Severity</p>
                    <p className="mt-2 text-4xl font-black">{formatPercent(complaintSeverity)}</p>
                  </div>
                </div>
              </article>

              <section className="grid gap-4 md:grid-cols-2">
                <article className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
                  <h4 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Review trend</h4>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-teal/20 bg-teal/10 p-4">
                      <p className="text-sm font-black text-ink dark:text-white">Positive Review Trend</p>
                      <p className={`mt-2 text-3xl font-black ${positiveTrend >= 0 ? "text-teal" : "text-coral"}`}>{positiveTrend >= 0 ? "+" : ""}{positiveTrend}%</p>
                    </div>
                    <div className="rounded-2xl border border-coral/20 bg-coral/10 p-4">
                      <p className="text-sm font-black text-ink dark:text-white">Negative Review Trend</p>
                      <p className={`mt-2 text-3xl font-black ${negativeTrend <= 0 ? "text-teal" : "text-coral"}`}>{negativeTrend > 0 ? "+" : ""}{negativeTrend}%</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
                  <h4 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Product notes</h4>
                  <textarea
                    value={selectedProduct.notes}
                    onChange={(event) => updateNotes(event.target.value)}
                    className="mt-4 min-h-36 w-full resize-y rounded-2xl border border-line bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                    placeholder="Track supplier changes, listing updates, packaging fixes, or customer service experiments."
                  />
                </article>
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                {[
                  ["Top Strengths", topStrengths.length ? topStrengths : ["Run a scan to capture positive themes."], "good"],
                  ["Top Complaints", topComplaints.length ? topComplaints : ["Run a scan to capture complaint themes."], "bad"],
                  ["Seller Action Plan", actionPlan.length ? actionPlan : ["Attach a scan to generate action recommendations."], "info"]
                ].map(([title, items, tone]) => (
                  <article key={title as string} className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
                    <Badge tone={tone as "good" | "bad" | "info"}>{title as string}</Badge>
                    <div className="mt-4 grid gap-2">
                      {(items as string[]).map((item) => (
                        <p key={item} className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-semibold leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">{item}</p>
                      ))}
                    </div>
                  </article>
                ))}
              </section>

              <article className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h4 className="text-xl font-black text-ink dark:text-white">Calendar Progress Tracker</h4>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Green positive, yellow mixed, red negative, blue improvement.</p>
                  </div>
                  <p className="text-sm font-black text-ocean dark:text-cyan-300">{selectedProduct.scans.length} saved scans</p>
                </div>
                <div className="mt-5 grid grid-cols-7 gap-2">
                  {monthDays.map((day) => {
                    const scan = day.scans[0];
                    return (
                      <div
                        key={day.date}
                        className={`min-h-20 rounded-2xl border p-2 ${
                          scan ? toneClasses[scan.tone] : "border-line bg-mist text-slate-500 dark:border-white/10 dark:bg-white/[0.04]"
                        }`}
                        title={scan ? `${toneLabels[scan.tone]} · ${scan.topComplaint}` : "No product scan"}
                      >
                        <p className="text-xs font-black">{day.day}</p>
                        {scan ? (
                          <div className="mt-2">
                            <p className="text-lg font-black">{formatPercent(scan.productHealthScore)}</p>
                            <p className="line-clamp-1 text-[10px] font-bold uppercase">{scan.topComplaint}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
                <h4 className="text-xl font-black text-ink dark:text-white">Review Scan History</h4>
                <div className="mt-4 grid gap-3">
                  {selectedProduct.scans.length ? selectedProduct.scans.slice(0, 8).map((scan) => (
                    <div key={scan.id} className="rounded-2xl border border-line p-4 dark:border-white/10">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <span className={scanToneBadge(scan.tone)}>{toneLabels[scan.tone]}</span>
                          <p className="mt-3 text-sm font-black text-ink dark:text-white">{scan.date} · {scan.reviewCount.toLocaleString()} reviews</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{scan.aiSummary}</p>
                        </div>
                        <div className="grid min-w-44 grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-mist p-2 dark:bg-white/[0.04]">
                            <p className="text-[10px] font-black uppercase text-slate-500">Health</p>
                            <p className="font-black text-ocean dark:text-cyan-300">{formatPercent(scan.productHealthScore)}</p>
                          </div>
                          <div className="rounded-xl bg-mist p-2 dark:bg-white/[0.04]">
                            <p className="text-[10px] font-black uppercase text-slate-500">Sat</p>
                            <p className="font-black text-teal">{formatPercent(scan.customerSatisfactionScore)}</p>
                          </div>
                          <div className="rounded-xl bg-mist p-2 dark:bg-white/[0.04]">
                            <p className="text-[10px] font-black uppercase text-slate-500">Risk</p>
                            <p className="font-black text-coral">{formatPercent(scan.complaintSeverityScore)}</p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 rounded-xl border border-line bg-mist px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">{scan.actionRecommendation}</p>
                    </div>
                  )) : <p className="rounded-2xl border border-line bg-mist p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">No scan history yet. Select this product on the Analyze page before running a Seller scan.</p>}
                </div>
              </article>
            </>
          ) : (
            <article className="rounded-3xl border border-line bg-mist p-8 text-center shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
              <Badge tone="warn">No products</Badge>
              <h3 className="mt-4 text-3xl font-black text-ink dark:text-white">Start with one product.</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Add a product here, then go to Analyze, choose Seller mode, and attach the scan to that product.
              </p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

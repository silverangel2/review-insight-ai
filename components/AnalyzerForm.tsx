"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { planLabel } from "@/lib/account";
import { estimateReviewCount } from "@/lib/localAnalyzer";
import { REVIEW_PLATFORMS } from "@/lib/platforms";
import { accountHeaders, getClientAccount, getStoredQuota, quotaText, saveActiveMode, saveQuota } from "@/lib/clientAccount";
import { saveSellerJournalScan } from "@/lib/sellerJournal";
import {
  activeSellerProductId,
  createSellerProduct,
  productLimitForPlan,
  readSellerProducts,
  saveActiveSellerProductId,
  saveSellerProductScan,
  type SellerProduct
} from "@/lib/sellerProducts";
import {
  combineReviewSections,
  MAX_BULK_REVIEW_CHARS,
  MAX_TEXT_UPLOAD_BYTES,
  normalizeUploadedReviewText,
  ratingBreakdownFromText,
  REVIEW_INGESTION_METHODS
} from "@/lib/reviewIngestion";
import type {
  AnalysisAudience,
  AnalyzeResponse,
  QuotaInfo,
  ReviewIngestionMode,
  ReviewPlatform,
  ReviewTextSection,
  UploadedReviewImage,
  UserRole
} from "@/lib/types";

const SAMPLE_SECTION_ID = "sample-section";
const INITIAL_QUOTA: QuotaInfo = {
  plan: "free_buyer",
  limit: 3,
  used: 0,
  remaining: 3,
  resets_at: ""
};

const audienceOptions: Array<{ value: AnalysisAudience; label: string; roles: Array<"guest" | "buyer" | "seller" | "admin"> }> = [
  { value: "buyer", label: "Shopper recommendation", roles: ["guest", "buyer", "admin"] },
  { value: "seller", label: "Seller analytics", roles: ["seller", "admin"] },
  { value: "both", label: "Shopper + seller intelligence", roles: ["admin"] }
];

const scanSteps = [
  "Reading reviews...",
  "Detecting fake review patterns...",
  "Finding complaints...",
  "Measuring sentiment...",
  "Preparing results..."
];

const copySources = ["Amazon", "Walmart", "Temu", "TikTok Shop", "Etsy", "eBay", "Shopify"];

const instructionSteps = [
  ["1", "Open reviews", "Go to Amazon, Walmart, Temu, TikTok Shop, Etsy, or any product page."],
  ["2", "Copy review text", "Copy the customer reviews, good and bad. More reviews means stronger confidence."],
  ["3", "Paste here", "Drop the text into Deep Analysis, or upload screenshots for Quick Scan."],
  ["4", "Run AI scan", "ReviewIntel finds fake-risk signals, complaints, value, and the buying verdict."]
];

const modeMeta: Record<
  AnalysisAudience,
  {
    eyebrow: string;
    title: string;
    summary: string;
    accent: string;
    chips: string[];
  }
> = {
  buyer: {
    eyebrow: "Shopper Mode",
    title: "Instant shopper answer",
    summary: "Fast verdict, product score, fake-risk read, pros, cons, and value call.",
    accent: "from-teal/20 via-ocean/10 to-white dark:to-slate-950",
    chips: ["Worth buying", "Fake risk", "Best for"]
  },
  seller: {
    eyebrow: "Seller Mode",
    title: "Deep customer intelligence",
    summary: "Complaint mining, keyword signals, product gaps, and operational next moves.",
    accent: "from-plum/20 via-ocean/10 to-white dark:to-slate-950",
    chips: ["Pain points", "Clusters", "Improvements"]
  },
  both: {
    eyebrow: "Dual Mode",
    title: "Dual output preview",
    summary: "Preview shopper verdict and seller intelligence from the same review set.",
    accent: "from-amber/20 via-plum/10 to-white dark:to-slate-950",
    chips: ["Verdict", "Strategy", "Report"]
  }
};

function ModeOption({
  value,
  active,
  onSelect
}: {
  value: AnalysisAudience;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = modeMeta[value];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group rounded-3xl border p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-ocean/50 ${
        active
          ? "border-ocean bg-ink text-white dark:border-cyan-300"
          : `border-line bg-gradient-to-br ${meta.accent} text-ink dark:border-white/10 dark:text-white`
      }`}
    >
      <span className={`text-xs font-black uppercase ${active ? "text-teal" : "text-ocean dark:text-cyan-300"}`}>
        {meta.eyebrow}
      </span>
      <span className="mt-3 block text-2xl font-black">{meta.title}</span>
      <span className={`mt-3 block text-sm leading-6 ${active ? "text-slate-200" : "text-slate-600 dark:text-slate-300"}`}>{meta.summary}</span>
      <span className="mt-5 flex flex-wrap gap-2">
        {meta.chips.map((chip) => (
          <span
            key={chip}
            className={`rounded-full px-3 py-1 text-xs font-black ${
              active ? "bg-white/10 text-white" : "bg-white text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-200"
            }`}
          >
            {chip}
          </span>
        ))}
      </span>
    </button>
  );
}

function WorkflowCard({
  icon,
  eyebrow,
  title,
  points,
  active,
  tone,
  cta,
  onSelect
}: {
  icon: string;
  eyebrow: string;
  title: string;
  points: string[];
  active: boolean;
  tone: "quick" | "deep";
  cta: string;
  onSelect: () => void;
}) {
  const activeClass = tone === "quick" ? "border-amber bg-amber/10" : "border-teal bg-teal/10";
  const labelClass = tone === "quick" ? "text-amber" : "text-teal";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group rounded-[2rem] border p-6 text-left shadow-soft transition hover:-translate-y-1 hover:shadow-glow ${active ? activeClass : "border-line bg-white dark:border-white/10 dark:bg-slate-950"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-black uppercase ${labelClass}`}>{eyebrow}</p>
          <h3 className="mt-3 text-3xl font-black text-ink dark:text-white">{title}</h3>
        </div>
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-2xl text-white shadow-glow dark:bg-white dark:text-ink">{icon}</span>
      </div>
      <div className="mt-6 grid gap-2">
        {points.map((point) => (
          <div key={point} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
            {point}
          </div>
        ))}
      </div>
      <span className={`mt-6 inline-flex rounded-2xl px-5 py-3 text-sm font-black text-white transition group-hover:scale-[1.02] ${tone === "quick" ? "bg-amber" : "bg-teal"}`}>
        {cta}
      </span>
    </button>
  );
}

function AnalyzeCta({
  audience,
  isLoading,
  disabled,
  stats,
  images,
  quotaSummary,
  requiresLogin,
  label = "Run AI Analysis",
  onAnalyze
}: {
  audience: AnalysisAudience;
  isLoading: boolean;
  disabled: boolean;
  stats: { chars: number; estimatedReviews: number; sections: number; ratingBreakdown: Record<"1" | "2" | "3" | "4" | "5", number> };
  images: UploadedReviewImage[];
  quotaSummary: string;
  requiresLogin: boolean;
  label?: string;
  onAnalyze: () => void;
}) {
  const ratingCount = Object.values(stats.ratingBreakdown).reduce((sum, value) => sum + value, 0);
  const destination = audience === "seller" ? "Seller Pro intelligence" : audience === "both" ? "Shopper + Seller report" : "Shopper verdict";

  return (
    <div className="mt-5 rounded-[1.75rem] border border-white/70 bg-[linear-gradient(135deg,rgba(35,86,163,0.96),rgba(8,183,168,0.96)_48%,rgba(255,178,56,0.98))] p-4 text-white shadow-[0_24px_80px_rgba(8,183,168,0.28)] dark:border-white/10">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-100">{destination}</p>
          <h4 className="mt-2 text-2xl font-black">{requiresLogin ? "Create a free account to scan." : "Ready to scan this review set."}</h4>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={disabled}
          className="min-h-16 rounded-2xl bg-white px-8 py-4 text-base font-black text-ink shadow-[0_18px_60px_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-white/45 disabled:text-slate-500"
        >
          {requiresLogin ? "Sign up or log in to scan" : isLoading ? "Scanning..." : label}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black uppercase text-white/90">
        <span className="rounded-full bg-white/16 px-3 py-1">{stats.estimatedReviews.toLocaleString()} valid reviews</span>
        <span className="rounded-full bg-white/16 px-3 py-1">{stats.chars.toLocaleString()} chars</span>
        <span className="rounded-full bg-white/16 px-3 py-1">{stats.sections.toLocaleString()} sections</span>
        <span className="rounded-full bg-white/16 px-3 py-1">{images.length} screens</span>
        <span className="rounded-full bg-white/16 px-3 py-1">{ratingCount.toLocaleString()} ratings</span>
      </div>
      {!requiresLogin ? <p className="mt-3 text-xs font-bold text-white/78">{quotaSummary}</p> : (
        <p className="mt-3 text-xs font-bold text-white/78">Free scans are saved to your account so your usage and results stay private.</p>
      )}
    </div>
  );
}

function AnalysisOverlay({ activeStep }: { activeStep: number }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-5 py-8 backdrop-blur-xl" role="status" aria-live="polite">
      <div className="ri-scan-grid absolute inset-0 opacity-20" />
      <div className="ri-scan-fog absolute inset-0" aria-hidden="true" />
      <div className="ri-energy-wave ri-energy-wave-one" aria-hidden="true" />
      <div className="ri-energy-wave ri-energy-wave-two" aria-hidden="true" />
      <div className="ri-loading-particles absolute inset-0" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, index) => (
          <span
            key={index}
            style={{
              left: `${(index * 19 + 7) % 96}%`,
              top: `${(index * 31 + 11) % 88}%`,
              animationDelay: `${index * 0.16}s`,
              animationDuration: `${4.8 + (index % 5) * 0.55}s`
            }}
          />
        ))}
      </div>
      <div className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/10 p-7 text-center text-white shadow-[0_40px_140px_rgba(0,0,0,0.52)]">
        <div className="ri-scan-corner ri-scan-corner-a" aria-hidden="true" />
        <div className="ri-scan-corner ri-scan-corner-b" aria-hidden="true" />
        <div className="ri-scan-corner ri-scan-corner-c" aria-hidden="true" />
        <div className="ri-scan-corner ri-scan-corner-d" aria-hidden="true" />
        <div className="ri-orb-haze absolute inset-0 opacity-80" />
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">ReviewIntel scan</p>
          <div className="relative mx-auto mt-8 grid size-56 place-items-center">
            <div className="ri-progress-ring absolute inset-0">
              {Array.from({ length: 32 }).map((_, index) => (
                <span
                  key={index}
                  className="ri-progress-segment"
                  style={{
                    transform: `rotate(${index * 11.25}deg) translateY(-104px)`,
                    animationDelay: `${index * 0.09}s`
                  }}
                />
              ))}
            </div>
            <div className="ri-ai-orb">
              <span className="ri-ai-orb-core" />
              <span className="ri-ai-orb-ring" />
              <span className="ri-ai-orb-ring ri-ai-orb-ring-delay" />
            </div>
          </div>
          <h3 className="mt-8 text-3xl font-black">Analyzing review intelligence</h3>
          <p className="mt-3 text-lg font-black text-teal">{scanSteps[activeStep]}</p>
          <div className="mt-6 grid gap-2">
            {scanSteps.map((step, index) => (
              <div key={step} className={`rounded-2xl border px-4 py-3 text-left text-xs font-black transition ${
                index <= activeStep
                  ? "border-teal/50 bg-teal/15 text-cyan-50"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}>
                {String(index + 1).padStart(2, "0")} / {step}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold text-slate-300">Preparing a clean result page. Please keep this tab open.</p>
        </div>
      </div>
    </div>
  );
}

function createSection(title: string, text = "", source: ReviewTextSection["source"] = "paste", size?: number): ReviewTextSection {
  return {
    id: `${source}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    text,
    source,
    size
  };
}

function isTextUpload(file: File) {
  return file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".csv");
}

function fileSource(file: File): ReviewTextSection["source"] {
  return file.name.endsWith(".csv") ? "csv_upload" : "txt_upload";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not prepare screenshot stitching."));
    image.src = dataUrl;
  });
}

async function compressImage(file: File): Promise<UploadedReviewImage> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    throw new Error("Only JPG and PNG screenshots are supported.");
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Could not prepare screenshot preview.");
  context.drawImage(bitmap, 0, 0, width, height);

  const mime = file.type as UploadedReviewImage["type"];
  const dataUrl = canvas.toDataURL(mime, mime === "image/jpeg" ? 0.78 : undefined);
  return {
    name: file.name,
    type: mime,
    dataUrl,
    size: Math.round((dataUrl.length * 3) / 4)
  };
}

async function stitchUploadedImages(images: UploadedReviewImage[]): Promise<UploadedReviewImage> {
  const loaded = await Promise.all(images.map((image) => loadImage(image.dataUrl)));
  const gap = 20;
  const baseWidth = Math.min(1200, Math.max(...loaded.map((image) => image.naturalWidth || image.width)));
  const estimatedHeight = loaded.reduce((total, image) => total + Math.round(((image.naturalHeight || image.height) * baseWidth) / (image.naturalWidth || image.width)) + gap, 0);
  const heightScale = Math.min(1, 9000 / Math.max(estimatedHeight, 1));
  const width = Math.max(320, Math.round(baseWidth * heightScale));
  const heights = loaded.map((image) => Math.round(((image.naturalHeight || image.height) * width) / (image.naturalWidth || image.width)));
  const height = heights.reduce((total, item) => total + item, gap * Math.max(0, heights.length - 1));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Could not stitch screenshots.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  let y = 0;
  loaded.forEach((image, index) => {
    context.drawImage(image, 0, y, width, heights[index]);
    y += heights[index] + gap;
  });

  const dataUrl = canvas.toDataURL("image/jpeg", 0.76);
  return {
    name: "stitched-review-screenshots.jpg",
    type: "image/jpeg",
    dataUrl,
    size: Math.round((dataUrl.length * 3) / 4)
  };
}

export function AnalyzerForm() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [platform, setPlatform] = useState<ReviewPlatform>("other");
  const [audience, setAudience] = useState<AnalysisAudience>("buyer");
  const [entryMode, setEntryMode] = useState<"quick" | "deep">("deep");
  const [reviewSections, setReviewSections] = useState<ReviewTextSection[]>([
    { id: SAMPLE_SECTION_ID, title: "Review batch 1", text: "", source: "paste" }
  ]);
  const [images, setImages] = useState<UploadedReviewImage[]>([]);
  const [stitchScreenshots, setStitchScreenshots] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<QuotaInfo>(INITIAL_QUOTA);
  const [role, setRole] = useState<UserRole>("guest");
  const [isHydrated, setIsHydrated] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [selectedSellerProductId, setSelectedSellerProductId] = useState("");
  const [productSaveNotice, setProductSaveNotice] = useState("");

  useEffect(() => {
    setQuota(getStoredQuota());
    const accountRole = getClientAccount()?.role ?? "guest";
    setRole(accountRole);
    setAudience((currentAudience) =>
      audienceOptions.some((option) => option.value === currentAudience && option.roles.includes(accountRole))
        ? currentAudience
        : accountRole === "seller"
          ? "seller"
          : "buyer"
    );
    const products = readSellerProducts();
    const activeProduct = activeSellerProductId();
    setSellerProducts(products);
    setSelectedSellerProductId(activeProduct && products.some((product) => product.id === activeProduct) ? activeProduct : products[0]?.id ?? "");
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) saveActiveMode(audience);
  }, [audience, isHydrated]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStep((current) => Math.min(scanSteps.length - 1, current + 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  const combinedReviews = useMemo(() => combineReviewSections(reviewSections), [reviewSections]);
  const stats = useMemo(() => {
    const chars = combinedReviews.trim().length;
    const lines = combinedReviews.split(/\n+/).filter((line) => line.trim().length > 20).length;
    const sections = reviewSections.filter((section) => section.text.trim().length > 0).length;
    const estimatedReviews = estimateReviewCount(combinedReviews);
    const ratingBreakdown = ratingBreakdownFromText(combinedReviews);
    return { chars, lines, sections, estimatedReviews, ratingBreakdown };
  }, [combinedReviews, reviewSections]);

  const ingestionMode: ReviewIngestionMode = useMemo(() => {
    const hasText = stats.chars >= 80;
    if (hasText && images.length > 0) return "mixed_upload";
    if (hasText) return "deep_paste";
    if (images.length > 0) return "quick_screenshot";
    return "deep_paste";
  }, [images.length, stats.chars]);
  const visibleAudienceOptions = audienceOptions.filter((option) => option.roles.includes(role));
  const sellerProductLimit = productLimitForPlan(quota.plan);
  const canAttachSellerProduct = audience !== "buyer" && (role === "seller" || role === "admin") && sellerProductLimit > 0;

  function updateSection(id: string, patch: Partial<ReviewTextSection>) {
    if (patch.text !== undefined) setEntryMode("deep");
    setReviewSections((current) => current.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  function removeSection(id: string) {
    setReviewSections((current) => {
      const next = current.filter((section) => section.id !== id);
      return next.length ? next : [createSection("Review batch 1")];
    });
  }

  function addSection() {
    setReviewSections((current) => [...current, createSection(`Review batch ${current.length + 1}`)]);
  }

  function replaceSampleOrAppend(sections: ReviewTextSection[]) {
    setReviewSections((current) => {
      const untouchedSample = current.length === 1 && current[0].id === SAMPLE_SECTION_ID && current[0].text.trim().length === 0;
      return untouchedSample ? sections : [...current, ...sections];
    });
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;

    setError("");
    setUploadStatus("Preparing uploads...");

    try {
      const nextImages: UploadedReviewImage[] = [];
      const nextSections: ReviewTextSection[] = [];

      for (const file of files) {
        if (file.type.startsWith("image/")) {
          setEntryMode("quick");
          nextImages.push(await compressImage(file));
        } else if (isTextUpload(file)) {
          setEntryMode("deep");
          if (file.size > MAX_TEXT_UPLOAD_BYTES) {
            throw new Error(`TXT and CSV uploads must be under ${Math.round(MAX_TEXT_UPLOAD_BYTES / 1000).toLocaleString()} KB each. Split seller exports into smaller batches.`);
          }
          const source = fileSource(file);
          const normalizedUpload = normalizeUploadedReviewText(file.name, await file.text());
          if (source === "csv_upload" && normalizedUpload.validReviewCount === 0) {
            throw new Error("No valid review/comment text was found in that CSV. Check for a review, comment, body, or content column.");
          }
          nextSections.push(createSection(file.name, normalizedUpload.text, source, file.size));
        } else {
          throw new Error("Upload TXT, CSV, JPG, or PNG files for this version.");
        }
      }

      if (nextSections.length) replaceSampleOrAppend(nextSections);
      if (nextImages.length) setImages((current) => [...current, ...nextImages].slice(0, 8));

      const parts = [
        nextSections.length ? `${nextSections.length} text batch${nextSections.length === 1 ? "" : "es"} loaded` : "",
        nextImages.length ? `${nextImages.length} screenshot${nextImages.length === 1 ? "" : "s"} ready` : ""
      ].filter(Boolean);
      setUploadStatus(parts.join(" and ") || "Upload ready.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    }
  }

  function selectSellerProduct(productId: string) {
    setSelectedSellerProductId(productId);
    saveActiveSellerProductId(productId);
    const product = sellerProducts.find((item) => item.id === productId);
    if (product) {
      setProductName(product.name);
      setProductUrl(product.productUrl);
      setPlatform(product.platform);
    }
  }

  function createTrackerProductFromInput() {
    setProductSaveNotice("");
    setError("");

    try {
      const product = createSellerProduct(
        {
          name: productName || "Untitled product",
          platform,
          productUrl,
          category: "",
          imageUrl: "",
          notes: "Created from the Analyze page."
        },
        quota.plan
      );
      const nextProducts = readSellerProducts();
      setSellerProducts(nextProducts);
      selectSellerProduct(product.id);
      setProductSaveNotice(`${product.name} is ready for scan history.`);
    } catch (caught) {
      setProductSaveNotice(caught instanceof Error ? caught.message : "Could not create product.");
    }
  }

  async function analyze() {
    setError("");

    if (!getClientAccount()) {
      setError("Please sign up or log in to use a free scan.");
      router.push("/login");
      return;
    }

    setIsLoading(true);
    const scanStartedAt = performance.now();

    try {
      let imagesForAnalysis = images;
      let imageAggregation: "individual" | "stitched" = "individual";

      if (stitchScreenshots && images.length > 1) {
        setUploadStatus("Stitching screenshots into one OCR batch...");
        imagesForAnalysis = [await stitchUploadedImages(images)];
        imageAggregation = "stitched";
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...accountHeaders() },
        body: JSON.stringify({
          productName,
          productUrl,
          platform,
          audience,
          reviewSections,
          images: imagesForAnalysis,
          ingestionMode,
          imageAggregation
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.quota) {
          saveQuota(data.quota);
          setQuota(data.quota);
        }
        throw new Error(data.error || "Analysis failed.");
      }

      if (data.meta?.quota) {
        saveQuota(data.meta.quota);
        setQuota(data.meta.quota);
      }

      saveSellerJournalScan(data as AnalyzeResponse, productName);
      if (selectedSellerProductId) {
        const updatedProduct = saveSellerProductScan(selectedSellerProductId, data as AnalyzeResponse);
        if (updatedProduct) {
          setSellerProducts(readSellerProducts());
          setProductSaveNotice(`Saved scan to ${updatedProduct.name}.`);
        }
      }
      sessionStorage.setItem("reviewintel:last-result", JSON.stringify(data as AnalyzeResponse));
      await wait(Math.max(0, 5000 - (performance.now() - scanStartedAt)));
      router.push("/results");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const account = getClientAccount();
  const requiresLogin = !account;
  const canAnalyze = (stats.chars >= 80 && stats.chars <= MAX_BULK_REVIEW_CHARS) || images.length > 0;
  const isTooLarge = stats.chars > MAX_BULK_REVIEW_CHARS;
  const quotaLocked = !requiresLogin && role !== "admin" && quota.limit !== null && (quota.remaining ?? 0) <= 0;
  const quotaSummary = requiresLogin ? "Sign up or log in to use a free scan" : isHydrated ? quotaText(quota) : "";
  const analyzeDisabled = isLoading || requiresLogin || !canAnalyze || isTooLarge || quotaLocked;
  const ctaStats = {
    chars: stats.chars,
    estimatedReviews: stats.estimatedReviews,
    sections: stats.sections,
    ratingBreakdown: stats.ratingBreakdown
  };

  return (
    <section className="space-y-6">
      {isLoading ? <AnalysisOverlay activeStep={loadingStep} /> : null}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#10133b_0%,#164bcd_34%,#10c6a3_67%,#ffb238_100%)] p-6 text-white shadow-[0_34px_120px_rgba(35,86,163,0.30)] dark:bg-slate-950">
        <div className="ri-scan-grid absolute inset-0 opacity-35" />
        <div className="ri-scan-beam absolute inset-x-0 top-0 h-24" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase text-cyan-100">Choose the result you want</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-black md:text-5xl">Shopper answer or seller intelligence.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Shopper mode stays fast and decisive. Seller mode becomes a deeper Pro report with complaints, fixes, charts, and positioning moves.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Shopper", "Score + verdict", audience === "buyer" ? "Active" : "Fast"],
              ["Seller", "Graphs + fixes", audience === "seller" ? "Active" : "Pro"],
              ["Quick", "Screenshot beta", entryMode === "quick" ? "Active" : "Mobile"]
            ].map(([title, detail, state]) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-[0_18px_55px_rgba(255,255,255,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
                <p className="text-2xl font-black">{title}</p>
                <p className="mt-2 text-sm font-semibold text-slate-200">{detail}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase text-cyan-100">
                  <span className="size-2 rounded-full bg-amber shadow-[0_0_18px_rgba(255,178,56,0.9)]" />
                  {state}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <section className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <Badge tone="info">Concrete steps</Badge>
            <h3 className="mt-4 text-3xl font-black text-ink dark:text-white">Copy, paste, scan.</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {copySources.map((source) => (
                <span key={source} className="inline-flex items-center gap-2 text-xs font-black uppercase text-slate-600 dark:text-slate-300">
                  <span className="size-1.5 rounded-full bg-teal" />
                  {source}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {instructionSteps.map(([step, title, detail]) => (
              <article key={step} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-black text-white dark:bg-white dark:text-ink">{step}</span>
                  <div>
                    <p className="font-black text-ink dark:text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setEntryMode("deep");
              document.getElementById("review-paste-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Paste reviews below
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode("quick");
              document.getElementById("quick-scan-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-amber dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            Upload screenshots instead
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <WorkflowCard
          icon="QS"
          eyebrow="Quick Scan Beta"
          title="Upload screenshots"
          points={["Screenshots", "Fast shopper verdict", "Mobile friendly"]}
          active={entryMode === "quick"}
          tone="quick"
          cta="Use Quick Scan"
          onSelect={() => setEntryMode("quick")}
        />
        <WorkflowCard
          icon="DA"
          eyebrow="Deep Analysis"
          title="Paste reviews or upload CSV/TXT"
          points={audience === "buyer" ? ["Paste reviews", "Strongest confidence", "Cleaner verdict"] : ["CSV/TXT batches", "Valid unique reviews", "Seller intelligence"]}
          active={entryMode === "deep"}
          tone="deep"
          cta="Use Deep Analysis"
          onSelect={() => setEntryMode("deep")}
        />
      </div>

      {visibleAudienceOptions.length > 1 ? (
        <div className="rounded-3xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Analysis mode switcher</p>
            <h3 className="mt-1 text-xl font-black text-ink dark:text-white">Test Shopper, Seller, or Dual output.</h3>
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{modeMeta[audience].summary}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {visibleAudienceOptions.map((option) => (
              <ModeOption
                key={option.value}
                value={option.value}
                active={audience === option.value}
                onSelect={() => setAudience(option.value)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Locked workspace</p>
              <h3 className="mt-1 text-xl font-black text-ink dark:text-white">{modeMeta[audience].title}</h3>
            </div>
            <Badge tone={audience === "seller" ? "info" : "good"}>{modeMeta[audience].eyebrow}</Badge>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-bold text-ink dark:text-white">Product or business name</span>
                <input
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  placeholder="Optional"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-ink dark:text-white">Review platform</span>
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as ReviewPlatform)}
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  {REVIEW_PLATFORMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-ink dark:text-white">Product URL</span>
                <input
                  value={productUrl}
                  onChange={(event) => setProductUrl(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  placeholder="Optional reference"
                />
              </label>
            </div>
          </section>

          <section id="review-paste-area" className="rounded-3xl border border-teal/20 bg-white p-5 shadow-soft dark:border-teal/20 dark:bg-slate-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-teal">Deep Analysis</p>
                <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">
                  {audience === "buyer" ? "Paste reviews for the strongest shopper verdict." : "Load review batches for seller intelligence."}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addSection}
                  className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  Add section
                </button>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-ink px-4 py-2 text-xs font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
                  Upload TXT/CSV
                  <input
                    type="file"
                    accept=".txt,.csv,text/plain,text/csv"
                    multiple
                    className="sr-only"
                    onChange={(event) => void handleFiles(event.target.files ?? [])}
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {reviewSections.map((section, index) => (
                <div key={section.id} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <input
                      value={section.title}
                      onChange={(event) => updateSection(section.id, { title: event.target.value })}
                      className="w-full rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white sm:max-w-sm"
                      placeholder={`Review batch ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSection(section.id)}
                      className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-coral transition hover:border-coral/40 dark:border-white/10"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={section.text}
                    onChange={(event) => updateSection(section.id, { text: event.target.value })}
                    className="mt-3 min-h-[150px] w-full resize-y rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                    placeholder={audience === "buyer" ? "Paste a compact review batch here." : "Paste seller review exports here, or upload CSV/TXT."}
                  />
                </div>
              ))}
            </div>
            <AnalyzeCta
              audience={audience}
              isLoading={isLoading}
              disabled={analyzeDisabled}
              stats={ctaStats}
              images={images}
              quotaSummary={quotaSummary}
                requiresLogin={requiresLogin}
              onAnalyze={analyze}
            />
            {isTooLarge ? (
              <p className="mt-4 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
                This batch is over {MAX_BULK_REVIEW_CHARS.toLocaleString()} characters. Split it into another analysis for stability.
              </p>
            ) : null}
            {entryMode === "deep" && error ? <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
          </section>

          <section
            id="quick-scan-area"
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void handleFiles(event.dataTransfer.files);
            }}
            className={`rounded-3xl border border-dashed p-6 shadow-soft transition ${
              isDragging
                ? "border-amber bg-amber/10"
                : "border-line bg-white dark:border-white/10 dark:bg-slate-950"
            }`}
          >
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-black uppercase text-amber">Quick Scan Beta</p>
                <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">Drop screenshots for a fast check.</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use this for a few mobile screenshots. Use Deep Analysis for real volume.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-line bg-white px-5 py-4 text-sm font-black text-ink shadow-soft transition hover:border-amber dark:border-white/10 dark:bg-white/5 dark:text-white">
                Upload screenshots
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className="sr-only"
                  onChange={(event) => void handleFiles(event.target.files ?? [])}
                />
              </label>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-mist p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
              <input
                type="checkbox"
                checked={stitchScreenshots}
                onChange={(event) => setStitchScreenshots(event.target.checked)}
                className="mt-1 h-4 w-4 accent-ocean"
              />
              <span>Stitch multiple screenshots into one OCR batch.</span>
            </label>

            {images.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {images.map((image, index) => (
                  <div key={`${image.name}-${index}`} className="overflow-hidden rounded-xl border border-line bg-white dark:border-white/10 dark:bg-slate-900">
                    <img src={image.dataUrl} alt={`${image.name} preview`} className="h-32 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 p-3">
                      <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{image.name}</p>
                      <button
                        type="button"
                        onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-coral dark:border-white/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {uploadStatus ? <p className="mt-3 text-xs font-semibold text-teal">{uploadStatus}</p> : null}
            <AnalyzeCta
              audience={audience}
              isLoading={isLoading}
              disabled={analyzeDisabled}
              stats={ctaStats}
              images={images}
              quotaSummary={quotaSummary}
                requiresLogin={requiresLogin}
              label="Run Screenshot Analysis"
              onAnalyze={analyze}
            />
            {entryMode === "quick" && error ? <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
          </section>
        </div>

        <aside className="space-y-5">
          <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <Badge tone={quota.limit === null ? "good" : "warn"}>{planLabel(quota.plan)}</Badge>
            <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">{modeMeta[audience].title}</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-line p-4 dark:border-white/10">
                <p className="text-2xl font-black text-teal">{stats.estimatedReviews.toLocaleString()}</p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Reviews</p>
              </div>
              <div className="rounded-2xl border border-line p-4 dark:border-white/10">
                <p className="text-2xl font-black text-ocean dark:text-cyan-300">{images.length}</p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Screens</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">{quotaSummary}</p>
          </article>

          {canAttachSellerProduct ? (
            <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
              <p className="text-xs font-black uppercase text-ocean dark:text-cyan-300">Product Health Tracker</p>
              <h2 className="mt-3 text-xl font-black text-ink dark:text-white">Attach this Seller scan.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Choose the product this analysis belongs to so Seller Pro can build history, trend, and calendar progress.
              </p>
              <div className="mt-4 grid gap-3">
                {sellerProducts.length ? (
                  <select
                    value={selectedSellerProductId}
                    onChange={(event) => selectSellerProduct(event.target.value)}
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">Do not attach</option>
                    {sellerProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.scans.length} scans
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-2xl border border-line bg-mist p-4 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    No products yet. Create one from the product name above.
                  </p>
                )}
                <button
                  type="button"
                  onClick={createTrackerProductFromInput}
                  disabled={!productName.trim() || sellerProducts.length >= sellerProductLimit}
                  className="rounded-2xl border border-ocean/25 bg-ocean/10 px-4 py-3 text-left text-sm font-black text-ocean transition hover:border-ocean dark:text-cyan-300 disabled:cursor-not-allowed disabled:border-line disabled:bg-mist disabled:text-slate-400"
                >
                  Create product from current name
                </button>
              </div>
              <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                Limit: {sellerProducts.length}/{sellerProductLimit} products on this plan.
              </p>
              {productSaveNotice ? <p className="mt-3 rounded-xl border border-teal/25 bg-teal/10 px-3 py-2 text-xs font-black text-teal">{productSaveNotice}</p> : null}
            </article>
          ) : null}

          {quotaLocked || (quota.limit !== null && (quota.remaining ?? 0) <= 1) ? (
            <article className="rounded-3xl border border-plum/20 bg-plum/10 p-6 shadow-glow">
              <p className="text-xs font-black uppercase text-plum dark:text-purple-300">Upgrade unlock</p>
              <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
                {quotaLocked ? "Free scans are used." : "You are almost at the free limit."}
              </h2>
              <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <span>Unlimited product analyses</span>
                <span>Saved history and comparisons</span>
                <span>Seller intelligence and exports</span>
              </div>
              <Link href="/pricing" className="mt-5 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
                View upgrade plans
              </Link>
            </article>
          ) : null}

          <article className="rounded-3xl border border-line bg-ink p-6 text-white shadow-soft dark:border-white/10">
            <p className="text-xs font-black uppercase text-teal">What happens next</p>
            <div className="mt-5 grid gap-3">
              {(audience === "buyer"
                ? ["Product score", "Worth buying verdict", "Fake review risk", "Best-for match"]
                : ["Complaint clusters", "Customer pain map", "Keyword intelligence", "Business recommendations"]
              ).map((item) => (
                <div key={item} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm font-bold">{item}</span>
                  <span className="text-xs font-black uppercase text-teal">ready</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <h2 className="text-lg font-black text-ink dark:text-white">Future imports</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {REVIEW_INGESTION_METHODS.map((item) => (
                <span
                  key={item.key}
                  className={`rounded-full border px-3 py-2 text-xs font-black uppercase ${
                    item.availability === "live"
                      ? "border-teal/20 bg-teal/10 text-teal"
                      : "border-line bg-mist text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400"
                  }`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </article>
        </aside>
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-ocean dark:text-cyan-300">Analysis readiness</p>
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            <span>1 product analyzed</span>
            <span>{stats.chars.toLocaleString()} chars</span>
            <span>{stats.estimatedReviews.toLocaleString()} valid reviews</span>
            <span>{stats.sections.toLocaleString()} sections</span>
            <span>{Object.values(stats.ratingBreakdown).reduce((sum, value) => sum + value, 0).toLocaleString()} ratings</span>
            <span>{quotaSummary}</span>
          </div>
        </div>
      </section>
    </section>
  );
}

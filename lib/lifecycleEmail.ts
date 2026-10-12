import { shopperBenefits, SELLER_BENEFITS } from "@/lib/upsell";
import { pricingLabelForPlan } from "@/lib/pricing";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { emailActionLinks, emailLinkSecret, normalizeMailbox, publicEmailSiteUrl, unsubscribeHeaders } from "@/lib/emailLinks";
import { renderBrandedEmail } from "@/lib/emailTemplate";
import { claimEmailStamp, countAnalysisEvents, readStoredEmailPrefs } from "@/lib/emailPreferenceStore";

const PAID_PLANS = new Set(["buyer_pro", "buyer_beta", "seller_premium", "seller_beta", "seller_pro"]);

export type LifecycleProfile = {
  name?: string | null;
  role?: string | null;
  plan?: string | null;
  productUpdates: boolean;
  upgradeTips: boolean;
  welcomeSentAt?: string | null;
  upgradeSentAt?: string | null;
};

export type LifecycleSendInput = {
  emailType: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

export type LifecycleDeps = {
  siteUrl: string;
  secret: string;
  postalAddress?: string | null;
  load: (email: string) => Promise<LifecycleProfile | null>;
  claimWelcome: (email: string) => Promise<boolean>;
  claimUpgrade: (email: string) => Promise<boolean>;
  countScans: (email: string) => Promise<number>;
  send: (input: LifecycleSendInput) => Promise<{ ok: boolean; error?: string }>;
};

export type LifecycleResult = { sent: boolean; reason: string };

function greetingName(name?: string | null) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed || trimmed.includes("@")) return "";
  return trimmed.slice(0, 80);
}

export function cleanProductLabel(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || /^https?:/i.test(text) || /product scan/i.test(text)) return "";
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

export function plainVerdict(value: unknown) {
  const verdict = String(value ?? "").trim().toUpperCase();
  if (verdict === "BUY") return "The answer on this scan was Buy.";
  if (verdict === "REVIEW FIRST" || verdict === "WAIT") return "The answer on this scan was to look closer before buying.";
  if (verdict === "AVOID" || verdict === "DO NOT BUY YET" || verdict === "SKIP") return "The answer on this scan was to skip this one.";
  return "";
}

function linksFor(email: string, deps: Pick<LifecycleDeps, "siteUrl" | "secret">) {
  return emailActionLinks(email, deps.siteUrl, deps.secret);
}

export function buildWelcomeEmail(input: {
  name?: string | null;
  role?: string | null;
  preferencesUrl: string;
  unsubscribeUrl: string;
  oneClickUrl?: string;
  siteUrl: string;
  postalAddress?: string | null;
}) {
  const seller = input.role === "seller";
  const rendered = renderBrandedEmail({
    preheader: "Your ReviewIntel account is ready.",
    eyebrow: "Welcome",
    title: "Your account is ready",
    greetingName: greetingName(input.name),
    paragraphs: [
      "ReviewIntel reads public buyer reviews and turns them into one clear answer: buy, look closer, or skip. We do not invent reviews. If there is not enough real review evidence, the scan says so.",
      seller
        ? "You signed up as a seller. Seller tools open after you choose a seller plan."
        : "A free account includes 3 scans a day. Shopper Premium adds more room when you want it.",
    ],
    bullets: seller
      ? ["Seller tools for your own products", "Prices are on the pricing page before you pay", "You can change these emails any time"]
      : ["Run a scan from a product link or a screenshot", "Free includes 3 scans a day", "You can change these emails any time"],
    cta: seller
      ? { label: "See seller plans", href: `${input.siteUrl}/pricing?plan=seller_premium` }
      : { label: "Start a scan", href: `${input.siteUrl}/analyze` },
    reason: "You are receiving this because you created a ReviewIntel account. Account and billing messages can still be sent when they are needed.",
    preferencesUrl: input.preferencesUrl,
    unsubscribeUrl: input.unsubscribeUrl,
    postalAddress: input.postalAddress,
  });
  return {
    subject: "Welcome to ReviewIntel",
    ...rendered,
    headers: unsubscribeHeaders(input.oneClickUrl || ""),
  };
}

export function buildFirstScanUpgradeEmail(input: {
  name?: string | null;
  role?: string | null;
  productName?: string | null;
  verdict?: string | null;
  preferencesUrl: string;
  unsubscribeUrl: string;
  oneClickUrl?: string;
  siteUrl: string;
  postalAddress?: string | null;
  env?: Record<string, string | undefined>;
}) {
  const seller = input.role === "seller";
  const product = cleanProductLabel(input.productName);
  const verdictLine = plainVerdict(input.verdict);
  const env = input.env || process.env;
  const paragraphs = [
    product ? `You finished your first scan of ${product}.` : "You finished your first scan.",
    verdictLine,
    seller
      ? "This note is only about what a seller plan adds. It does not change the scan."
      : "Free stays at 3 scans a day. This note is only about what Shopper Premium adds. It does not change the scan.",
  ].filter(Boolean);
  const bullets = seller
    ? [
        ...SELLER_BENEFITS.seller_premium,
        `${pricingLabelForPlan("seller_premium", "CAD")} for Seller Starter`,
        ...SELLER_BENEFITS.seller_pro,
        `${pricingLabelForPlan("seller_pro", "CAD")} for Seller Pro`,
      ]
    : [
        ...shopperBenefits(env),
        `${pricingLabelForPlan("buyer_pro", "CAD")} for Shopper Premium`,
      ];
  const rendered = renderBrandedEmail({
    preheader: "What a paid plan adds after your first scan. No deadline.",
    eyebrow: "After your first scan",
    title: seller ? "Seller plans, when you want them" : "Shopper Premium, when you want it",
    greetingName: greetingName(input.name),
    paragraphs,
    bullets,
    cta: {
      label: seller ? "See seller plans" : "See Shopper Premium",
      href: seller ? `${input.siteUrl}/pricing?plan=seller_premium` : `${input.siteUrl}/pricing?plan=shopper_premium`,
    },
    reason: "You are receiving this once, after your first completed scan. Turn it off any time. Account and billing messages can still be sent when they are needed.",
    preferencesUrl: input.preferencesUrl,
    unsubscribeUrl: input.unsubscribeUrl,
    postalAddress: input.postalAddress,
  });
  return {
    subject: seller ? "Your first seller scan is done" : "Your first scan is done",
    ...rendered,
    headers: unsubscribeHeaders(input.oneClickUrl || ""),
  };
}

function skipped(reason: string): LifecycleResult {
  return { sent: false, reason };
}

export async function deliverWelcomeEmail(
  input: { email: string; name?: string | null; role?: string | null },
  deps: LifecycleDeps
): Promise<LifecycleResult> {
  const email = normalizeMailbox(input.email);
  if (!email) return skipped("missing-email");
  if (email.endsWith("@reviewintel.test")) return skipped("test-account");
  const profile = await deps.load(email);
  if (profile?.welcomeSentAt) return skipped("already-sent");
  const claimed = await deps.claimWelcome(email);
  if (!claimed) return skipped("not-claimed");
  const links = linksFor(email, deps);
  const message = buildWelcomeEmail({
    name: input.name || profile?.name,
    role: input.role || profile?.role,
    preferencesUrl: links.preferencesUrl,
    unsubscribeUrl: links.unsubscribeUrl,
    oneClickUrl: links.oneClickUrl,
    siteUrl: deps.siteUrl,
    postalAddress: deps.postalAddress,
  });
  const sent = await deps.send({
    emailType: "welcome",
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: message.headers,
    metadata: { source: "signup" },
  });
  return sent.ok ? { sent: true, reason: "sent" } : skipped("send-failed");
}

export async function deliverFirstScanUpgrade(
  input: { email: string; name?: string | null; role?: string | null; plan?: string | null; productName?: string | null; verdict?: string | null },
  deps: LifecycleDeps
): Promise<LifecycleResult> {
  const email = normalizeMailbox(input.email);
  if (!email) return skipped("missing-email");
  if (email.endsWith("@reviewintel.test")) return skipped("test-account");
  const profile = await deps.load(email);
  const plan = String(input.plan || profile?.plan || "free_buyer");
  if (PAID_PLANS.has(plan)) return skipped("paid-plan");
  if (profile && profile.upgradeTips === false) return skipped("opted-out");
  if (profile?.upgradeSentAt) return skipped("already-sent");
  const scans = await deps.countScans(email);
  if (scans !== 1) return skipped(scans < 1 ? "scan-not-recorded" : "not-first");
  const claimed = await deps.claimUpgrade(email);
  if (!claimed) return skipped("not-claimed");
  const links = linksFor(email, deps);
  const message = buildFirstScanUpgradeEmail({
    name: input.name || profile?.name,
    role: input.role || profile?.role,
    productName: input.productName,
    verdict: input.verdict,
    preferencesUrl: links.preferencesUrl,
    unsubscribeUrl: links.unsubscribeUrl,
    oneClickUrl: links.oneClickUrl,
    siteUrl: deps.siteUrl,
    postalAddress: deps.postalAddress,
  });
  const sent = await deps.send({
    emailType: "first_scan_upgrade",
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: message.headers,
    metadata: { source: "first_scan", plan, role: input.role || profile?.role || "buyer" },
  });
  return sent.ok ? { sent: true, reason: "sent" } : skipped("send-failed");
}

function productionDeps(): LifecycleDeps {
  return {
    siteUrl: publicEmailSiteUrl(),
    secret: emailLinkSecret(),
    postalAddress: process.env.REVIEWINTEL_POSTAL_ADDRESS || "",
    load: async (email) => {
      const profile = await readStoredEmailPrefs(email);
      if (!profile?.found) return null;
      return profile;
    },
    claimWelcome: (email) => claimEmailStamp(email, "welcome_email_sent_at"),
    claimUpgrade: (email) => claimEmailStamp(email, "first_scan_upgrade_sent_at"),
    countScans: countAnalysisEvents,
    send: (message) => sendReviewIntelEmail(message),
  };
}

export function queueWelcomeEmail(input: { email: string; name?: string | null; role?: string | null }) {
  void deliverWelcomeEmail(input, productionDeps()).catch((error) => {
    console.error("Welcome email was not sent:", error);
  });
}

export function queueFirstScanUpgrade(input: {
  email: string;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
  productName?: string | null;
  verdict?: string | null;
}) {
  void deliverFirstScanUpgrade(input, productionDeps()).catch((error) => {
    console.error("First-scan upgrade email was not sent:", error);
  });
}

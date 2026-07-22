import { buildAmazonAffiliateUrl } from "@/lib/affiliate";
import type { AdPlacement, AffiliatePartner, SponsorAd } from "@/lib/adConfig";

export type AffiliateAdCampaignStatus = "active" | "paused";

export type AffiliateAdCampaign = {
  id: string;
  title: string;
  partner: AffiliatePartner;
  affiliateUrl: string;
  imageUrl?: string;
  bannerUrl?: string;
  placement: AdPlacement;
  status: AffiliateAdCampaignStatus;
  disclosureText: string;
  headline: string;
  description: string;
  ctaLabel: string;
};

export const REVIEWINTEL_AFFILIATE_DISCLOSURE =
  "ReviewIntel may earn commission. Affiliate compensation does not affect verdicts or review analysis.";

const AD_PLACEMENTS: AdPlacement[] = [
  "homepage_hero",
  "homepage_mid",
  "analyze_below_card",
  "analyze_premium_top",
  "analyze_premium_bottom",
  "results_below_verdict",
  "buyer_dashboard",
  "seller_dashboard",
  "footer",
];

function clean(value?: string | null) {
  return (value || "").trim();
}

function envValue(names: string[]) {
  for (const name of names) {
    const value = clean(process.env[name]);
    if (value) return value;
  }
  return "";
}

function isEnabled(value?: string | null, fallback = true) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return fallback;
  return normalized !== "false" && normalized !== "0" && normalized !== "disabled" && normalized !== "paused";
}

function safeExternalUrl(value?: string | null) {
  const raw = clean(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizePlacement(value: unknown, fallback: AdPlacement): AdPlacement {
  const placement = clean(typeof value === "string" ? value : "");
  return AD_PLACEMENTS.includes(placement as AdPlacement) ? (placement as AdPlacement) : fallback;
}

function placementIsEnabled(placement: AdPlacement, placements?: Partial<Record<AdPlacement, boolean>>) {
  return placements?.[placement] !== false;
}

function normalizePartner(value: unknown): AffiliatePartner {
  const partner = clean(typeof value === "string" ? value : "").toLowerCase();
  if (partner === "amazon" || partner === "travelpayouts" || partner === "stay22") return partner;
  return "custom";
}

function partnerName(partner: AffiliatePartner) {
  if (partner === "amazon") return "Amazon";
  if (partner === "travelpayouts") return "Travelpayouts";
  if (partner === "stay22") return "Stay22";
  return "Affiliate partner";
}

function poweredByLabel(partner: AffiliatePartner) {
  return `Powered by ${partnerName(partner)}`;
}

function labelsFor(partner: AffiliatePartner) {
  return ["Sponsored", "Affiliate", poweredByLabel(partner)];
}

function withReviewIntelUtm(rawUrl: string, partner: AffiliatePartner, campaignId: string) {
  const safe = safeExternalUrl(rawUrl);
  if (!safe) return "";

  const url = new URL(safe);
  if (!url.searchParams.has("utm_source")) url.searchParams.set("utm_source", "reviewintel");
  if (!url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", "affiliate_ad");
  if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", campaignId);
  if (!url.searchParams.has("utm_content")) url.searchParams.set("utm_content", partner);
  return url.toString();
}

function normalizeAmazonMarketplace(value?: string | null) {
  const host = clean(value || "amazon.com")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();

  return /^amazon\.[a-z.]+$/.test(host) ? host : "amazon.com";
}

function amazonAffiliateUrl() {
  const explicit = safeExternalUrl(
    envValue([
      "REVIEWINTEL_AMAZON_AFFILIATE_URL",
      "AMAZON_AFFILIATE_URL",
      "NEXT_PUBLIC_REVIEWINTEL_AMAZON_AFFILIATE_URL",
      "NEXT_PUBLIC_AMAZON_AFFILIATE_URL",
    ]),
  );
  if (explicit) return explicit;

  const marketplace = normalizeAmazonMarketplace(
    envValue(["REVIEWINTEL_AMAZON_MARKETPLACE", "AMAZON_MARKETPLACE", "NEXT_PUBLIC_AMAZON_MARKETPLACE"]),
  );
  const query = envValue(["REVIEWINTEL_AMAZON_SEARCH_QUERY", "NEXT_PUBLIC_REVIEWINTEL_AMAZON_SEARCH_QUERY"]) || "smart shopping deals";
  const url = new URL(`https://${marketplace}/s`);
  url.searchParams.set("k", query);

  return buildAmazonAffiliateUrl(url.toString());
}

function travelpayoutsAffiliateUrl() {
  const explicit = safeExternalUrl(
    envValue([
      "REVIEWINTEL_TRAVELPAYOUTS_AFFILIATE_URL",
      "TRAVELPAYOUTS_AFFILIATE_URL",
      "NEXT_PUBLIC_REVIEWINTEL_TRAVELPAYOUTS_AFFILIATE_URL",
      "NEXT_PUBLIC_TRAVELPAYOUTS_AFFILIATE_URL",
    ]),
  );
  if (explicit) return explicit;

  const marker = envValue([
    "REVIEWINTEL_TRAVELPAYOUTS_MARKER",
    "TRAVELPAYOUTS_MARKER",
    "ROAMLY_TRAVELPAYOUTS_MARKER",
  ]);
  const url = new URL("https://www.aviasales.com/");
  if (marker) url.searchParams.set("marker", marker);
  return url.toString();
}

function isConsumerHotelUrl(value?: string | null) {
  const safe = safeExternalUrl(value);
  if (!safe) return false;

  try {
    const url = new URL(safe);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.toLowerCase();
    const consumerHotelHosts = [
      "booking.com",
      "hotels.com",
      "expedia.com",
      "agoda.com",
      "priceline.com",
      "kayak.com",
      "trivago.com",
      "hotelscombined.com",
      "travelocity.com",
      "orbitz.com",
      "trip.com",
      "vrbo.com",
      "hoteltonight.com",
    ];

    if (host === "stay22.com" || host.endsWith(".stay22.com")) return false;
    if (/\b(app|admin|partner|partners|dashboard|login|signin|sign-in|account)\b/.test(host)) return false;
    if (/\/(?:app|admin|partner|partners|dashboard|login|signin|sign-in|account)(?:\/|$)/i.test(path)) return false;
    return consumerHotelHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
}

function stay22AffiliateUrl() {
  const explicit = envValue([
    "REVIEWINTEL_STAY22_AFFILIATE_URL",
    "REVIEWINTEL_STAY22_HOTEL_AFFILIATE_URL",
    "REVIEWINTEL_STAY22_HOTEL_URL",
    "REVIEWINTEL_STAY22_SMART_LINK_URL",
    "STAY22_AFFILIATE_URL",
    "STAY22_HOTEL_AFFILIATE_URL",
    "STAY22_HOTEL_URL",
    "NEXT_PUBLIC_REVIEWINTEL_STAY22_AFFILIATE_URL",
    "NEXT_PUBLIC_REVIEWINTEL_STAY22_HOTEL_AFFILIATE_URL",
    "NEXT_PUBLIC_REVIEWINTEL_STAY22_HOTEL_URL",
    "NEXT_PUBLIC_STAY22_AFFILIATE_URL",
    "ROAMLY_STAY22_SMART_LINK_URL",
    "ROAMLY_STAY22_REFERRAL_URL",
  ]);
  if (isConsumerHotelUrl(explicit)) return safeExternalUrl(explicit);

  return "";
}

function bannerUrl(partner: AffiliatePartner) {
  const prefix = partner === "amazon" ? "AMAZON" : partner === "travelpayouts" ? "TRAVELPAYOUTS" : "STAY22";
  return safeExternalUrl(
    envValue([
      `REVIEWINTEL_${prefix}_BANNER_URL`,
      `NEXT_PUBLIC_REVIEWINTEL_${prefix}_BANNER_URL`,
      `NEXT_PUBLIC_${prefix}_BANNER_URL`,
    ]),
  );
}

function builtInCampaigns(): AffiliateAdCampaign[] {
  const amazonUrl = amazonAffiliateUrl();
  const travelpayoutsUrl = travelpayoutsAffiliateUrl();
  const stay22Url = stay22AffiliateUrl();
  const amazonEnabled = isEnabled(envValue(["REVIEWINTEL_AMAZON_AFFILIATE_ADS_ENABLED", "NEXT_PUBLIC_REVIEWINTEL_AMAZON_AFFILIATE_ADS_ENABLED"]));
  const travelpayoutsEnabled = isEnabled(envValue(["REVIEWINTEL_TRAVELPAYOUTS_AFFILIATE_ADS_ENABLED", "NEXT_PUBLIC_REVIEWINTEL_TRAVELPAYOUTS_AFFILIATE_ADS_ENABLED"]));
  const stay22Enabled = Boolean(stay22Url) && isEnabled(envValue(["REVIEWINTEL_STAY22_AFFILIATE_ADS_ENABLED", "NEXT_PUBLIC_REVIEWINTEL_STAY22_AFFILIATE_ADS_ENABLED"]));

  return [
    {
      id: "reviewintel-affiliate-amazon-shopping",
      title: "Amazon sponsored shopping options",
      partner: "amazon",
      affiliateUrl: amazonUrl,
      imageUrl: bannerUrl("amazon"),
      placement: "homepage_mid",
      status: amazonEnabled ? "active" : "paused",
      disclosureText: REVIEWINTEL_AFFILIATE_DISCLOSURE,
      headline: "Sponsored shopping options on Amazon",
      description: "Compare shopping options after your ReviewIntel scan. Partner compensation stays separate from review analysis.",
      ctaLabel: "Shop Amazon",
    },
    {
      id: "reviewintel-affiliate-travelpayouts-homepage-flights",
      title: "Travelpayouts sponsored flight deals",
      partner: "travelpayouts",
      affiliateUrl: travelpayoutsUrl,
      imageUrl: bannerUrl("travelpayouts"),
      placement: "homepage_mid",
      status: travelpayoutsEnabled ? "active" : "paused",
      disclosureText: REVIEWINTEL_AFFILIATE_DISCLOSURE,
      headline: "Sponsored flight deals",
      description: "Travelpayouts partner placement for shoppers comparing travel purchases and reviews.",
      ctaLabel: "Compare flights",
    },
    {
      id: "reviewintel-affiliate-travelpayouts-flights",
      title: "Travelpayouts sponsored flight deals",
      partner: "travelpayouts",
      affiliateUrl: travelpayoutsUrl,
      imageUrl: bannerUrl("travelpayouts"),
      placement: "analyze_premium_top",
      status: travelpayoutsEnabled ? "active" : "paused",
      disclosureText: REVIEWINTEL_AFFILIATE_DISCLOSURE,
      headline: "Sponsored flight deals",
      description: "Travelpayouts partner placement for shoppers comparing travel purchases and reviews.",
      ctaLabel: "Compare flights",
    },
    {
      id: "reviewintel-affiliate-stay22-homepage-hotels",
      title: "Stay22 sponsored hotel deals",
      partner: "stay22",
      affiliateUrl: stay22Url,
      imageUrl: bannerUrl("stay22"),
      placement: "homepage_mid",
      status: stay22Enabled ? "active" : "paused",
      disclosureText: REVIEWINTEL_AFFILIATE_DISCLOSURE,
      headline: "Sponsored hotel deals",
      description: "Stay22 partner placement for hotel options. ReviewIntel analysis remains independent.",
      ctaLabel: "Find hotels",
    },
    {
      id: "reviewintel-affiliate-stay22-hotels",
      title: "Stay22 sponsored hotel deals",
      partner: "stay22",
      affiliateUrl: stay22Url,
      imageUrl: bannerUrl("stay22"),
      placement: "footer",
      status: stay22Enabled ? "active" : "paused",
      disclosureText: REVIEWINTEL_AFFILIATE_DISCLOSURE,
      headline: "Sponsored hotel deals",
      description: "Stay22 partner placement for hotel options. ReviewIntel analysis remains independent.",
      ctaLabel: "Find hotels",
    },
  ];
}

function textField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function customCampaignsFromEnv(): AffiliateAdCampaign[] {
  const raw = envValue(["REVIEWINTEL_AFFILIATE_CAMPAIGNS_JSON"]);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item, index): AffiliateAdCampaign | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const partner = normalizePartner(record.partner);
      const title = textField(record, "title", "campaignTitle", "campaign_title") || "Sponsored affiliate campaign";
      const affiliateUrl = safeExternalUrl(textField(record, "affiliateUrl", "affiliate_url", "url", "destinationUrl", "destination_url"));
      const statusValue = textField(record, "status");
      const activeValue = record.active;
      const active = typeof activeValue === "boolean" ? activeValue : isEnabled(statusValue || null);

      return {
        id: textField(record, "id", "campaignId", "campaign_id") || `reviewintel-affiliate-custom-${index + 1}`,
        title,
        partner,
        affiliateUrl,
        imageUrl: safeExternalUrl(textField(record, "imageUrl", "image_url", "bannerUrl", "banner_url")),
        placement: normalizePlacement(record.placement, "homepage_mid"),
        status: active ? "active" : "paused",
        disclosureText: textField(record, "disclosureText", "disclosure_text", "disclosure") || REVIEWINTEL_AFFILIATE_DISCLOSURE,
        headline: textField(record, "headline") || title,
        description: textField(record, "description") || "Sponsored affiliate placement on ReviewIntel.",
        ctaLabel: textField(record, "ctaLabel", "cta_label") || "View offer",
      };
    })
    .filter((campaign): campaign is AffiliateAdCampaign => Boolean(campaign));
}

function toSponsorAd(campaign: AffiliateAdCampaign): SponsorAd | null {
  const destinationUrl = withReviewIntelUtm(campaign.affiliateUrl, campaign.partner, campaign.id);
  if (campaign.status !== "active" || !destinationUrl) return null;

  const imageUrl = safeExternalUrl(campaign.imageUrl || campaign.bannerUrl);

  return {
    id: campaign.id,
    sponsorName: partnerName(campaign.partner),
    campaignTitle: campaign.title,
    headline: campaign.headline,
    description: campaign.description,
    imageUrl: imageUrl || undefined,
    mediaUrl: imageUrl || undefined,
    mediaType: imageUrl ? "image" : undefined,
    destinationUrl,
    placement: campaign.placement,
    active: true,
    status: "approved",
    paymentStatus: "paid",
    sponsorType: "affiliate",
    affiliatePartner: campaign.partner,
    labels: labelsFor(campaign.partner),
    disclosureText: campaign.disclosureText,
    ctaLabel: campaign.ctaLabel,
  };
}

export function getAffiliateAdCampaigns(placements?: Partial<Record<AdPlacement, boolean>>): SponsorAd[] {
  if (!isEnabled(envValue(["REVIEWINTEL_AFFILIATES_ENABLED", "NEXT_PUBLIC_REVIEWINTEL_AFFILIATES_ENABLED"]))) {
    return [];
  }

  return [...builtInCampaigns(), ...customCampaignsFromEnv()]
    .filter((campaign) => placementIsEnabled(campaign.placement, placements))
    .map(toSponsorAd)
    .filter((ad): ad is SponsorAd => Boolean(ad));
}

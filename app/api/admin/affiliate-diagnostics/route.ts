import { NextRequest, NextResponse } from "next/server";
import {
  buildAmazonAffiliateUrl,
  buildWalmartAffiliateUrl,
  getAffiliateDisclosure,
  getWalmartAffiliateId,
  getWalmartImpactTemplate,
  getWalmartPublisherId,
} from "@/lib/affiliate";

function getBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";

  return `${protocol}://${host}`;
}

async function hasOwnerAccess(req: NextRequest) {
  try {
    const response = await fetch(`${getBaseUrl(req)}/api/owner/session`, {
      headers: { cookie: req.headers.get("cookie") || "" },
      cache: "no-store",
    });

    if (!response.ok) return false;

    const data = await response.json();

    return Boolean(
      data?.ok ||
        data?.authenticated ||
        data?.isOwner ||
        data?.owner ||
        data?.admin ||
        data?.user?.role === "admin" ||
        data?.role === "admin"
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const allowed = await hasOwnerAccess(req);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Owner access required." }, { status: 401 });
  }

  const tag = process.env.AMAZON_ASSOCIATE_TAG || "";
  const walmartAffiliateId = getWalmartAffiliateId();
  const walmartPublisherId = getWalmartPublisherId();
  const walmartNetwork = process.env.WALMART_AFFILIATE_NETWORK?.trim() || "impact";
  const walmartTemplate = getWalmartImpactTemplate();
  const disclosure = getAffiliateDisclosure();
  const sampleAmazonUrl = "https://www.amazon.ca/dp/B08N5WRWNW?ref_=reviewintel_test";
  const sampleWalmartUrl = "https://www.walmart.ca/en/ip/test-product/6000200000000";
  const sampleAffiliateUrl = buildAmazonAffiliateUrl(sampleAmazonUrl);
  const sampleWalmartAffiliateUrl = buildWalmartAffiliateUrl(sampleWalmartUrl);

  return NextResponse.json({
    ok: true,
    status: tag ? "amazon_active" : "affiliate_ready_not_connected",
    amazon: {
      tagConnected: Boolean(tag),
      tagPreview: tag ? `${tag.slice(0, 4)}••••${tag.slice(-3)}` : null,
      envName: "AMAZON_ASSOCIATE_TAG",
      sampleOriginalUrl: sampleAmazonUrl,
      sampleAffiliateUrl,
      linkBuilderWorking: Boolean(tag && sampleAffiliateUrl.includes("tag=")),
    },
    walmart: {
      publisherConnected: Boolean(walmartPublisherId),
      affiliateIdConnected: Boolean(walmartAffiliateId),
      publisherPreview: walmartPublisherId ? `${walmartPublisherId.slice(0, 2)}••••${walmartPublisherId.slice(-2)}` : null,
      affiliateIdPreview: walmartAffiliateId ? `${walmartAffiliateId.slice(0, 4)}••••${walmartAffiliateId.slice(-3)}` : null,
      envNames: {
        publisher: "WALMART_PUBLISHER_ID or WALMART_SID",
        affiliateId: "WALMART_AFFILIATE_ID",
        network: "WALMART_AFFILIATE_NETWORK",
        template: "WALMART_IMPACT_TRACKING_URL_TEMPLATE",
      },
      network: walmartNetwork,
      usingDefaultIds: !process.env.WALMART_PUBLISHER_ID && !process.env.WALMART_SID && !process.env.NEXT_PUBLIC_WALMART_PUBLISHER_ID && !process.env.NEXT_PUBLIC_WALMART_SID,
      impactTemplateConfigured: Boolean(walmartTemplate),
      sampleOriginalUrl: sampleWalmartUrl,
      sampleAffiliateUrl: sampleWalmartAffiliateUrl,
      linkBuilderWorking: Boolean(walmartPublisherId && sampleWalmartAffiliateUrl.includes("goto.walmart.com")),
    },
    disclosure: {
      text: disclosure,
      envName: "NEXT_PUBLIC_AFFILIATE_DISCLOSURE",
      usingDefault: !process.env.NEXT_PUBLIC_AFFILIATE_DISCLOSURE,
    },
    betterPicks: {
      endpoint: "/api/product-recommendations",
      shopperOnly: true,
      resultPage: "/results",
    },
    checklist: [
      {
        label: "Amazon Associates Canada registration",
        done: Boolean(tag),
        note: tag ? "Amazon Associate tag is connected." : "Register later, then add AMAZON_ASSOCIATE_TAG in Vercel.",
      },
      {
        label: "Walmart diagnostic only",
        done: Boolean(walmartPublisherId),
        note: walmartPublisherId
          ? "Walmart SID / publisher ID is present, but public Better Picks are Amazon-only."
          : "Walmart is paused. Add WALMART_PUBLISHER_ID or WALMART_SID only if you decide to re-enable it later.",
      },
      {
        label: "Walmart official template diagnostic",
        done: Boolean(walmartTemplate),
        note: walmartTemplate
          ? "Official Walmart affiliate template is configured, but Walmart links are paused publicly."
          : walmartNetwork.toLowerCase() === "rakuten"
            ? "Walmart network is marked Rakuten. Keep paused unless Rakuten gives you an exact deep-link template and you decide to enable it later."
            : "Walmart links are paused publicly. Add a template only if you decide to re-enable Walmart later.",
      },
      {
        label: "Affiliate disclosure",
        done: Boolean(disclosure),
        note: "Disclosure is available for shopper Better Picks.",
      },
      {
        label: "Better Picks endpoint",
        done: true,
        note: "/api/product-recommendations exists.",
      },
      {
        label: "Shopper-only placement",
        done: true,
        note: "Better Picks is wired into shopper ResultsClient.",
      },
    ],
  });
}

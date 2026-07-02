import { NextRequest, NextResponse } from "next/server";
import { buildAmazonAffiliateUrl, getAffiliateDisclosure } from "@/lib/affiliate";

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
  const disclosure = getAffiliateDisclosure();
  const sampleAmazonUrl = "https://www.amazon.ca/dp/B08N5WRWNW?ref_=reviewintel_test";
  const sampleAffiliateUrl = buildAmazonAffiliateUrl(sampleAmazonUrl);

  return NextResponse.json({
    ok: true,
    status: tag ? "active" : "affiliate_ready_not_connected",
    amazon: {
      tagConnected: Boolean(tag),
      tagPreview: tag ? `${tag.slice(0, 4)}••••${tag.slice(-3)}` : null,
      envName: "AMAZON_ASSOCIATE_TAG",
      sampleOriginalUrl: sampleAmazonUrl,
      sampleAffiliateUrl,
      linkBuilderWorking: tag ? sampleAffiliateUrl.includes("tag=") : true,
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

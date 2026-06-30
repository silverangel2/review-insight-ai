import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    facebookPageId: process.env.FACEBOOK_PAGE_ID || null,
    metaPageId: process.env.META_PAGE_ID || null,
    graphVersion:
      process.env.FACEBOOK_GRAPH_API_VERSION ||
      process.env.META_GRAPH_API_VERSION ||
      "v25.0",
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || null,
    hasFacebookAppId: Boolean(process.env.FACEBOOK_APP_ID),
    hasFacebookAppSecret: Boolean(process.env.FACEBOOK_APP_SECRET),
    hasFacebookPageToken: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
  });
}

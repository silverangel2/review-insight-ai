// House Ads Engine (Phase 1) — targeted tests.
// Real modules loaded through jiti (the repo's route-test idiom); Supabase
// is faked at the fetch layer so the exact rows the routes would write are
// asserted without a database or network.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role";

const inserts = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(String(input));
  if (u.hostname !== "fake-supabase.invalid") {
    throw new Error("network blocked in test: " + String(input));
  }
  if ((init.method || "GET").toUpperCase() === "POST") {
    const parsed = JSON.parse(init.body || "{}");
    inserts.push({ table: u.pathname.split("/").pop(), payload: Array.isArray(parsed) ? parsed[0] : parsed });
  }
  return new Response(JSON.stringify([]), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
};
test.after(() => {
  globalThis.fetch = realFetch;
});

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const houseAds = jiti("./lib/houseAds.ts");
const eventRoute = jiti("./app/api/ads/event/route.ts");
const clickRoute = jiti("./app/api/ads/click/[creativeId]/route.ts");

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function jsonRequest(body, ua = BROWSER_UA) {
  return new Request("http://localhost/api/ads/event", {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": ua },
    body: JSON.stringify(body),
  });
}

test("catalog: every creative is complete, labeled, and has a real photo on disk", () => {
  assert.ok(houseAds.HOUSE_AD_CREATIVES.length >= 4);
  for (const creative of houseAds.HOUSE_AD_CREATIVES) {
    assert.ok(creative.id && creative.headline && creative.sponsorLabel, creative.id);
    assert.ok(creative.ctaLabel && creative.imageAlt, creative.id);
    assert.ok(["hotel", "gadget", "trip", "house"].includes(creative.category), creative.id);
    assert.ok(creative.image.startsWith("/ads/"), creative.id);
    const photoPath = path.join(root, "public", creative.image);
    assert.ok(fs.existsSync(photoPath), `missing photo for ${creative.id}: ${creative.image}`);
    assert.ok(houseAds.resolveHouseAdLanding(creative.id), `no landing for ${creative.id}`);
    assert.equal(houseAds.houseAdClickPath(creative.id), `/api/ads/click/${creative.id}`);
  }
});

test("landings: gadget uses the site's tagged Amazon.ca builder; hotels are plain Booking.com search", () => {
  const gadget = new URL(houseAds.resolveHouseAdLanding("gadget-earbuds"));
  assert.equal(gadget.hostname, "www.amazon.ca");
  assert.ok(gadget.searchParams.get("tag"), "Amazon landing must carry the site's Associate tag");
  assert.match(gadget.searchParams.get("k") || "", /earbuds/i);

  const kyoto = new URL(houseAds.resolveHouseAdLanding("hotel-kyoto"));
  assert.equal(kyoto.hostname, "www.booking.com");
  assert.equal(kyoto.searchParams.get("ss"), "Kyoto");
  assert.equal(kyoto.searchParams.get("aid"), null, "no fabricated Booking affiliate id");

  const lisbon = new URL(houseAds.resolveHouseAdLanding("hotel-lisbon"));
  assert.equal(lisbon.searchParams.get("ss"), "Lisbon");

  assert.equal(houseAds.resolveHouseAdLanding("roamly-trip"), "https://roamlyhq.com");
  assert.equal(houseAds.resolveHouseAdLanding("nope"), null);
});

test("selection: even rotation covers the whole family; result pages lead with the gadget family", () => {
  const homeCandidates = houseAds.houseAdCandidates("home");
  const seen = new Set();
  for (let seed = 0; seed < homeCandidates.length; seed++) {
    seen.add(houseAds.pickHouseAd("home", seed).id);
  }
  assert.equal(seen.size, homeCandidates.length, "one full rotation must show every candidate once");
  assert.equal(houseAds.pickHouseAd("home", 0).id, houseAds.pickHouseAd("home", homeCandidates.length).id);
  assert.equal(houseAds.pickHouseAd("result", 0).category, "gadget");
});

test("event parsing: only known creatives and impressions pass; paths are clipped", () => {
  const ok = houseAds.parseHouseAdEvent({
    creativeId: "hotel-kyoto",
    eventType: "impression",
    pagePath: "/" + "x".repeat(400),
  });
  assert.equal(ok.creativeId, "hotel-kyoto");
  assert.equal(ok.pagePath.length, 300);
  assert.equal(houseAds.parseHouseAdEvent({ creativeId: "hotel-kyoto", eventType: "click" }), null);
  assert.equal(houseAds.parseHouseAdEvent({ creativeId: "ghost", eventType: "impression" }), null);
  assert.equal(houseAds.parseHouseAdEvent(null), null);
  assert.equal(
    houseAds.parseHouseAdEvent({ creativeId: "hotel-kyoto", eventType: "impression", pagePath: "https://evil.example" }).pagePath,
    null,
  );
});

test("event route: a real impression is recorded against house_ad_events", async () => {
  inserts.length = 0;
  const res = await eventRoute.POST(
    jsonRequest({ creativeId: "gadget-earbuds", eventType: "impression", pagePath: "/results" }),
  );
  assert.equal(res.status, 200);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].table, "house_ad_events");
  assert.deepEqual(
    {
      site: inserts[0].payload.site,
      creative_id: inserts[0].payload.creative_id,
      event_type: inserts[0].payload.event_type,
      page_path: inserts[0].payload.page_path,
    },
    { site: "reviewintel", creative_id: "gadget-earbuds", event_type: "impression", page_path: "/results" },
  );
});

test("event route: bots and bad payloads record nothing", async () => {
  inserts.length = 0;
  const bot = await eventRoute.POST(
    jsonRequest({ creativeId: "hotel-lisbon", eventType: "impression", pagePath: "/" }, "curl/8.0"),
  );
  assert.equal(bot.status, 200);
  assert.equal(inserts.length, 0);
  const bad = await eventRoute.POST(jsonRequest({ creativeId: "ghost", eventType: "impression" }));
  assert.equal(bad.status, 400);
  assert.equal(inserts.length, 0);
});

test("click route: records the click, then 302-redirects to the resolved landing", async () => {
  inserts.length = 0;
  const req = new Request("http://localhost/api/ads/click/hotel-kyoto", {
    headers: { "user-agent": BROWSER_UA, referer: "http://localhost/results/abc" },
  });
  const res = await clickRoute.GET(req, { params: Promise.resolve({ creativeId: "hotel-kyoto" }) });
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get("location"));
  assert.equal(location.hostname, "www.booking.com");
  assert.equal(location.searchParams.get("ss"), "Kyoto");
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].payload.event_type, "click");
  assert.equal(inserts[0].payload.creative_id, "hotel-kyoto");
  assert.equal(inserts[0].payload.page_path, "/results/abc");
});

test("click route: unknown creative is a 404 with no redirect and no record", async () => {
  inserts.length = 0;
  const req = new Request("http://localhost/api/ads/click/ghost", {
    headers: { "user-agent": BROWSER_UA },
  });
  const res = await clickRoute.GET(req, { params: Promise.resolve({ creativeId: "ghost" }) });
  assert.equal(res.status, 404);
  assert.equal(inserts.length, 0);
});

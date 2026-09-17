import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

function readReleaseSource(path) {
  try {
    return execFileSync("git", ["show", `:${path}`], { encoding: "utf8" });
  } catch {
    return fs.readFileSync(path, "utf8");
  }
}

const library = readReleaseSource("lib/socialAutoPost.ts");
const route = fs.readFileSync("app/api/admin/social-autopost/route.ts", "utf8");
const component = fs.readFileSync("components/AdminSocialAutoPost.tsx", "utf8");

assert.match(library, /export function publishOneFacebookReel\(\)/);
const single = library.slice(library.indexOf("async function publishOneFacebookReelOnce"), library.indexOf("export function publishOneFacebookReel"));
assert.equal((single.match(/postToFacebookPage\(/g) || []).length, 1, "single action has exactly one Facebook publisher call");
assert.doesNotMatch(single, /runSocialAutoPost|postToPlatform|TikTok|instagram|linkedin|youtube_shorts/);
assert.match(single, /status: "publishing"/);
assert.match(library, /singleFacebookReelInFlight/);
assert.match(library, /allowCooldownOverride/);
assert.match(single, /allowCooldownOverride: true/);
const scheduled = library.slice(
  library.indexOf("async function runSocialAutoPostInternal"),
  library.indexOf("export async function runSocialAutoPost")
);
assert.doesNotMatch(scheduled, /allowCooldownOverride/);
assert.match(route, /body\.action === "publish-one-facebook-reel"/);
assert.match(route, /publishOneFacebookReel\(\)/);
assert.match(component, /Publish one Facebook Reel/);
assert.match(component, /action: "publish-one-facebook-reel"/);

console.log("single Facebook Reel control source checks passed");

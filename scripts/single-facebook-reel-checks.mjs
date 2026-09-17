import assert from "node:assert/strict";
import fs from "node:fs";

const library = fs.readFileSync("lib/socialAutoPost.ts", "utf8");
const route = fs.readFileSync("app/api/admin/social-autopost/route.ts", "utf8");
const component = fs.readFileSync("components/AdminSocialAutoPost.tsx", "utf8");

assert.match(library, /export function publishOneFacebookReel\(\)/);
const single = library.slice(library.indexOf("async function publishOneFacebookReelOnce"), library.indexOf("export function publishOneFacebookReel"));
assert.equal((single.match(/postToFacebookPage\(/g) || []).length, 1, "single action has exactly one Facebook publisher call");
assert.doesNotMatch(single, /runSocialAutoPost|postToPlatform|TikTok|instagram|linkedin|youtube_shorts/);
assert.match(single, /status: "publishing"/);
assert.match(library, /singleFacebookReelInFlight/);
assert.match(route, /body\.action === "publish-one-facebook-reel"/);
assert.match(route, /publishOneFacebookReel\(\)/);
assert.match(component, /Publish one Facebook Reel/);
assert.match(component, /action: "publish-one-facebook-reel"/);

console.log("single Facebook Reel control source checks passed");

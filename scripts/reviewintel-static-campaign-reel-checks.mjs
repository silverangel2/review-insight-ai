import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const source = execFileSync("git", ["show", ":lib/socialReelGenerator.ts"], { encoding: "utf8" });
const start = source.indexOf("export async function generateFreshSocialReelVideo");
const body = source.slice(start);

assert.notEqual(start, -1, "fresh Reel generator must exist");
assert.match(body, /sharp\(imageBuffer\)[\s\S]*fit:\s*["']contain["']/);
assert.match(body, /posterPath/);
assert.match(body, /-loop[\s\S]*-framerate[\s\S]*-i[\s\S]*posterPath/);
assert.doesNotMatch(body, /createSceneFrame/);
assert.doesNotMatch(body, /sceneOverlaySvg/);
assert.doesNotMatch(body, /zoompan/);
assert.match(body, /reviewintel-theme\.mp3/);
assert.match(body, /-stream_loop/);
assert.match(body, /-pix_fmt[\s\S]*yuv420p/);
assert.match(body, /-c:a[\s\S]*aac/);
assert.match(body, /-ar[\s\S]*48000/);
assert.match(body, /-ac[\s\S]*2/);

console.log("ReviewIntel static campaign Reel checks passed.");

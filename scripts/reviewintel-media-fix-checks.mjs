import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const source = execFileSync("git", ["show", ":lib/socialReelGenerator.ts"], { encoding: "utf8" });
const generator = source.slice(
  source.indexOf("export async function generateFreshSocialReelVideo"),
  source.indexOf("export async function generateStaticFacebookPosterReel"),
);

assert.match(generator, /reviewintel-theme\.mp3/);
assert.match(generator, /"-stream_loop",\s*"-1"/);
assert.match(generator, /"-ar",\s*"48000"/);
assert.match(generator, /"-ac",\s*"2"/);
assert.doesNotMatch(generator, /audioTrack\.lavfi/);
assert.doesNotMatch(generator, /"-f",\s*"lavfi"/);

const overlay = source.slice(source.indexOf("function sceneOverlaySvg"), source.indexOf("async function createSceneFrame"));
assert.match(overlay, /Arial, Helvetica, sans-serif/);
assert.doesNotMatch(overlay, /@font-face/);

const audioPath = "public/audio/reels/reviewintel-theme.mp3";
assert.ok(existsSync(audioPath), "the real ReviewIntel music asset must be present");
const ffprobe = "node_modules/ffprobe-static/bin/darwin/arm64/ffprobe";
const probe = JSON.parse(execFileSync(ffprobe, ["-v", "error", "-show_streams", "-of", "json", audioPath], { encoding: "utf8" }));
const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
assert.equal(audio?.codec_name, "mp3");
assert.equal(audio?.channels, 2);
assert.equal(audio?.sample_rate, "44100");

console.log("ReviewIntel media fix checks passed.");
